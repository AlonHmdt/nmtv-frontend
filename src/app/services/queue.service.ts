import { Injectable, signal, computed, inject } from '@angular/core';
import { Video, Channel, VideoBlock, VideoItem } from '../models/video.model';
import { YoutubeService } from './youtube.service';
import { CustomPlaylistService } from './custom-playlist.service';
import { catchError, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class QueueService {
  private youtubeService = inject(YoutubeService);
  private customPlaylistService = inject(CustomPlaylistService);

  // Signals for reactive state management
  private queueSignal = signal<Video[]>([]);
  private currentIndexSignal = signal<number>(0);
  private currentChannelSignal = signal<Channel>(Channel.DECADE_1990S);

  // Old TV effect toggle (includes: vignette, snow, scanlines, vcr tracking, wobbly)
  oldTVEnabled = signal<boolean>(false);

  // Computed signals
  queue = computed(() => this.queueSignal());
  currentVideo = computed(() => this.queueSignal()[this.currentIndexSignal()]);
  upcomingVideo = computed(() => this.queueSignal()[this.currentIndexSignal() + 1]);
  currentChannel = computed(() => this.currentChannelSignal());

  private playedVideoIds = new Set<string>();
  private playedVideosArray: string[] = []; // Track order for FIFO removal
  private unavailableVideoIds = new Set<string>();
  private readonly MAX_TRACKED_VIDEOS = 100; // Track last 100 videos for deduplication

  // Track used playlists to avoid repetition until all are used
  private usedPlaylistIds = new Set<string>();

  // Track whether last block was from custom playlist (for zig-zag pattern)
  private lastBlockWasCustom: boolean | null = null;

  async initializeQueue(channel: Channel): Promise<void> {
    console.log('QueueService: Initializing queue for channel:', channel);
    this.currentChannelSignal.set(channel);
    this.currentIndexSignal.set(0);
    this.queueSignal.set([]);
    this.playedVideoIds.clear();
    this.playedVideosArray = [];
    this.unavailableVideoIds.clear();
    this.usedPlaylistIds.clear();
    this.lastBlockWasCustom = null; // Reset for new channel

    const customPlaylistIds = this.customPlaylistService.getPlaylistIds(channel);
    console.log(`QueueService: Using ${customPlaylistIds.length} custom playlists for channel ${channel}`);

    try {
      console.log('Fetching initial programming block...');
      // Fetch initial block (random playlist)
      await this.fetchAndAppendBlock(channel, customPlaylistIds);
      console.log('QueueService: Initial block loaded, total videos:', this.queueSignal().length);
    } catch (error) {
      console.error('QueueService: Error filling queue:', error);
      throw error;
    }
  }

  async switchChannel(channel: Channel): Promise<void> {
    // Save the current channel to localStorage
    localStorage.setItem('lastChannel', channel);

    // Reset state for new channel
    this.currentChannelSignal.set(channel);
    this.currentIndexSignal.set(0);
    this.queueSignal.set([]);
    this.playedVideoIds.clear();
    this.playedVideosArray = [];
    this.unavailableVideoIds.clear();
    this.usedPlaylistIds.clear();

    const customPlaylistIds = this.customPlaylistService.getPlaylistIds(channel);

    await this.fetchAndAppendBlock(channel, customPlaylistIds);
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

  // New method: Mark video as unavailable and auto-skip
  markVideoAsUnavailable(videoId: string): void {
    console.log(`Video ${videoId} marked as unavailable, skipping...`);
    this.unavailableVideoIds.add(videoId);
    this.addPlayedVideo(videoId); // Also mark as played so we don't fetch it again

    // Remove from queue
    this.queueSignal.update(queue => queue.filter(v => v.id !== videoId));

    // If it was the current video, the index now points to the next video automatically
    console.log(`Video removed from queue. Current index: ${this.currentIndexSignal()}, Queue length: ${this.queueSignal().length}`);
  }

  async nextVideo(): Promise<void> {
    const currentIndex = this.currentIndexSignal();
    const queue = this.queueSignal();

    // Move to the next video
    this.currentIndexSignal.set(currentIndex + 1);

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
        if (this.lastBlockWasCustom === null) {
          // First block: always prefer custom
          preferCustom = true;
        } else {
          // Zig-zag: alternate between custom and official
          preferCustom = !this.lastBlockWasCustom;
        }
      }

      // Use getNextVideos for both initial and subsequent loads
      this.youtubeService.getNextVideos(channel, excludeVideoIds, excludePlaylistIds, customPlaylistIds, preferCustom)
        .subscribe({
          next: (block: VideoBlock) => {
            console.log(`QueueService: Received block "${block.playlistLabel}" with ${block.items.length} items`);

            // Track this playlist as used
            if (block.playlistId) {
              this.usedPlaylistIds.add(block.playlistId);
            }

            // Track whether this block was from a custom playlist
            // Check if the playlistId is in the customPlaylistIds array
            const isCustomBlock = customPlaylistIds.includes(block.playlistId);
            this.lastBlockWasCustom = isCustomBlock;

            // Flatten block into Video[] with playlist metadata
            const enrichedVideos: Video[] = block.items.map(item => ({
              ...item,
              playlistId: block.playlistId,
              playlistLabel: block.playlistLabel
            }));

            // Append to queue
            this.queueSignal.update(queue => [...queue, ...enrichedVideos]);

            // Track video IDs
            enrichedVideos.forEach(v => this.addPlayedVideo(v.id));

            resolve();
          },
          error: (err) => {
            console.error('QueueService: Error fetching block:', err);
            reject(err);
          }
        });
    });
  }

  private async addMoreVideos(): Promise<void> {
    console.log('QueueService: Fetching next block of videos...');
    const customPlaylistIds = this.customPlaylistService.getPlaylistIds(this.currentChannelSignal());
    await this.fetchAndAppendBlock(this.currentChannelSignal(), customPlaylistIds);
  }
}
