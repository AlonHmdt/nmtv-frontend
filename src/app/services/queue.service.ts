import { Injectable, signal, computed, inject } from '@angular/core';
import { VideoItem, Channel, VideoBlock } from '../models/video.model';
import { YoutubeService } from './youtube.service';
import { CustomPlaylistService } from './custom-playlist.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class QueueService {
  private youtubeService = inject(YoutubeService);
  private customPlaylistService = inject(CustomPlaylistService);

  // Track blocks for proper currentBlock management
  private currentPlaylistLabelSignal = signal<string>('');

  // Signals for reactive state management
  private queueSignal = signal<VideoItem[]>([]);
  private currentIndexSignal = signal<number>(0);
  private currentChannelSignal = signal<Channel>(Channel.DECADE_1990S);

  // Old TV effect toggle (includes: vignette, snow, scanlines, vcr tracking, wobbly)
  oldTVEnabled = signal<boolean>(false);

  // Computed signals
  queue = computed(() => this.queueSignal());
  currentVideo = computed(() => this.queueSignal()[this.currentIndexSignal()]);
  upcomingVideo = computed(() => this.queueSignal()[this.currentIndexSignal() + 1]);
  currentChannel = computed(() => this.currentChannelSignal());
  currentPlaylistLabel = computed(() => this.currentPlaylistLabelSignal());

  private playedVideoIds = new Set<string>();
  private playedVideosArray: string[] = []; // Track order for FIFO removal
  private unavailableVideoIds = new Set<string>();
  private readonly MAX_TRACKED_VIDEOS = 100; // Track last 100 videos for deduplication

  // Track used playlists to avoid repetition until all are used
  private usedPlaylistIds = new Set<string>();

  // Track whether last block was from custom playlist (for zig-zag pattern)
  // This is tracked per channel to maintain proper zig-zag within each channel
  private lastBlockWasCustomPerChannel = new Map<Channel, boolean>();

  async initializeQueue(channel: Channel): Promise<void> {
    this.currentChannelSignal.set(channel);
    this.currentIndexSignal.set(0);
    this.queueSignal.set([]);
    this.playedVideoIds.clear();
    this.playedVideosArray = [];
    this.unavailableVideoIds.clear();
    this.usedPlaylistIds.clear();
    this.currentPlaylistLabelSignal.set('');
    // Don't reset lastBlockWasCustomPerChannel - it persists across initialization

    const customPlaylistIds = this.customPlaylistService.getPlaylistIds(channel);

    try {
      // Fetch initial block (random playlist)
      await this.fetchAndAppendBlock(channel, customPlaylistIds);
      // Set initial playlist label
      this.updatePlaylistLabel();
    } catch (error) {
      throw error;
    }
  }

  async switchChannel(channel: Channel): Promise<void> {
    // Save the current channel to localStorage (except NOA and SPECIAL channels - easter eggs and events should not persist)
    if (channel !== Channel.NOA && channel !== Channel.SPECIAL) {
      localStorage.setItem('lastChannel', channel);
    }

    // Reset state for new channel
    this.currentChannelSignal.set(channel);
    this.currentIndexSignal.set(0);
    this.queueSignal.set([]);
    this.playedVideoIds.clear();
    this.playedVideosArray = [];
    this.unavailableVideoIds.clear();
    this.usedPlaylistIds.clear();
    this.currentPlaylistLabelSignal.set('');
    // Don't reset lastBlockWasCustomPerChannel - it persists across channel switches

    const customPlaylistIds = this.customPlaylistService.getPlaylistIds(channel);

    await this.fetchAndAppendBlock(channel, customPlaylistIds);
    // Set initial playlist label
    this.updatePlaylistLabel();
  }

  // Helper method: Add video to played tracking with rolling window limit
  private addPlayedVideo(videoId: string): void {
    // Add to Set
    this.playedVideoIds.add(videoId);

    // Add to array for ordering
    this.playedVideosArray.push(videoId);

    // If exceeded limit, remove oldest
    if (this.playedVideosArray.length > this.MAX_TRACKED_VIDEOS) {
      const oldestId = this.playedVideosArray.shift()!; // Remove first (oldest)
      this.playedVideoIds.delete(oldestId);
    }
  }

  // New method: Mark video as unavailable
  markVideoAsUnavailable(videoId: string, errorCode?: number): void {
    this.unavailableVideoIds.add(videoId);
    this.addPlayedVideo(videoId); // Also mark as played so we don't fetch it again

    // Remove from queue
    this.queueSignal.update(queue => queue.filter(v => v.id !== videoId));

    // If it was the current video, the index now points to the next video automatically

    // Call backend to mark as unavailable in database (fire and forget)
    if (environment.production) {
      this.notifyBackendVideoUnavailable(videoId, errorCode);
    }
  }

  private async notifyBackendVideoUnavailable(videoId: string, errorCode?: number): Promise<void> {
    try {
      const response = await fetch(`${environment.backendUrl}/videos/${videoId}/unavailable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ errorCode })
      });

      if (response.ok) {
        const data = await response.json();
      } else {
        // Backend failure (silent)
      }
    } catch (error) {
      // Don't throw - this is fire-and-forget, app continues normally
    }
  }

  async nextVideo(): Promise<void> {
    const currentIndex = this.currentIndexSignal();
    const queue = this.queueSignal();

    // Move to the next video
    this.currentIndexSignal.set(currentIndex + 1);

    // Update playlist label if we've moved to a video from a different playlist
    this.updatePlaylistLabel();

    // Check if we need to add more videos to maintain queue buffer
    // Fetch more when we have fewer than 6 videos left
    const remainingVideos = queue.length - this.currentIndexSignal();
    if (remainingVideos <= 6) {
      await this.addMoreVideos();
    }
  }

  getLastSelectedChannel(): Channel {
    const saved = localStorage.getItem('lastChannel');
    return (saved as Channel) || Channel.DECADE_1990S;
  }

  private async fetchAndAppendBlock(channel: Channel, customPlaylistIds: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      // Clear used playlists if we've tracked too many (> 10) to allow repeats
      if (this.usedPlaylistIds.size > 10) {
        this.usedPlaylistIds.clear();
      }

      const excludePlaylistIds = Array.from(this.usedPlaylistIds);
      const excludeVideoIds = Array.from(this.playedVideoIds);

      // Determine preference for zig-zag pattern
      let preferCustom = false;
      if (customPlaylistIds.length > 0) {
        const lastWasCustom = this.lastBlockWasCustomPerChannel.get(channel);
        if (lastWasCustom === undefined) {
          // First block for this channel: start with custom playlists
          preferCustom = true;
          console.log(`[Frontend] First block for channel ${channel} - preferCustom=true`);
        } else {
          // Zig-zag: alternate between custom and official
          preferCustom = !lastWasCustom;
          console.log(`[Frontend] Zig-zag for channel ${channel} - lastBlockWasCustom=${lastWasCustom}, preferCustom=${preferCustom}`);
        }
      }

      // Use getNextVideos for both initial and subsequent loads
      this.youtubeService.getNextVideos(channel, excludeVideoIds, excludePlaylistIds, customPlaylistIds, preferCustom)
        .subscribe({
          next: (block: VideoBlock) => {

            // Track this playlist as used
            if (block.playlistId) {
              this.usedPlaylistIds.add(block.playlistId);
            }

            // Verify that we exist on the same channel that requested this block
            // This prevents race conditions where rapid channel switching puts videos from
            // the previous channel into the new channel's queue
            if (channel !== this.currentChannelSignal()) {
              return;
            }

            // Track whether this block was from a custom playlist
            const isCustomBlock = customPlaylistIds.includes(block.playlistId);
            this.lastBlockWasCustomPerChannel.set(channel, isCustomBlock);

            // Set current playlist label if this is the first block (queue is empty)
            if (this.queueSignal().length === 0) {
              this.currentPlaylistLabelSignal.set(block.playlistLabel);
            }

            // Enrich video items with playlist metadata from the block
            const enrichedVideos: VideoItem[] = block.items.map(item => ({
              ...item,
              playlistId: block.playlistId,
              playlistLabel: block.playlistLabel
            }));

            // Append enriched videos to queue
            this.queueSignal.update(queue => [...queue, ...enrichedVideos]);

            // Track video IDs
            enrichedVideos.forEach(v => this.addPlayedVideo(v.id));

            resolve();
          },
          error: (err) => {
            reject(err);
          }
        });
    });
  }

  private async addMoreVideos(): Promise<void> {
    const customPlaylistIds = this.customPlaylistService.getPlaylistIds(this.currentChannelSignal());
    await this.fetchAndAppendBlock(this.currentChannelSignal(), customPlaylistIds);
  }

  private updatePlaylistLabel(): void {
    const currentVideo = this.currentVideo();
    if (!currentVideo) return;

    // Check if we need to update the playlist label
    const currentLabel = this.currentPlaylistLabelSignal();
    const videoPlaylistLabel = (currentVideo as any).playlistLabel || '';
    
    if (currentLabel !== videoPlaylistLabel) {
      this.currentPlaylistLabelSignal.set(videoPlaylistLabel);
    }
  }

  // Remove a video from the local queue without notifying backend
  // Used for limited/custom playlist videos that shouldn't be marked unavailable in DB
  removeVideoLocally(videoId: string): void {
    this.queueSignal.update(queue => queue.filter(v => v.id !== videoId));
  }
}
