import { Injectable, signal, computed, inject } from '@angular/core';
import { VideoItem, Channel, VideoBlock } from '../models/video.model';
import { YoutubeService } from './youtube.service';
import { CustomPlaylistService } from './custom-playlist.service';
import { ChannelStateService } from './channel-state.service';
import { environment } from '../../environments/environment';

// Interface for tracking played videos with FIFO removal
interface PlayedVideosTracker {
  ids: Set<string>;      // Set for O(1) lookups
  orderedArray: string[]; // Array for FIFO ordering
}

// Interface for saved channel state to reduce parameter complexity
interface SavedChannelState {
  queue: VideoItem[];                    // The saved video queue
  currentIndex: number;                  // Current position in the queue
  playedVideos: PlayedVideosTracker;     // Tracking for deduplication
  usedPlaylistIds: Set<string>;          // Playlists already used (for variety)
}

@Injectable({
  providedIn: 'root'
})
export class QueueService {
  private youtubeService = inject(YoutubeService);
  private customPlaylistService = inject(CustomPlaylistService);
  private channelStateService = inject(ChannelStateService);

  // Signals for reactive state management
  private currentPlaylistLabelSignal = signal<string>('');
  private queueSignal = signal<VideoItem[]>([]);
  private currentIndexSignal = signal<number>(0);
  private currentChannelSignal = signal<Channel>(Channel.DECADE_1990S);

  // Playback position tracking (updated by VideoPlayerComponent)
  private currentPlaybackPosition = signal<number>(0);
  private currentVideoDuration = signal<number>(0);

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
  private readonly MAX_TRACKED_VIDEOS = 100; // Track last 100 videos for deduplication

  // Track used playlists to avoid repetition until all are used
  private usedPlaylistIds = new Set<string>();

  // Track whether last block was from custom playlist (for zig-zag pattern)
  // This is tracked per channel to maintain proper zig-zag within each channel
  private lastBlockWasCustomPerChannel = new Map<Channel, boolean>();

  // Saved queues per channel for state persistence (allows returning to same video)
  private savedQueuesPerChannel = new Map<Channel, SavedChannelState>();

  async initializeQueue(channel: Channel): Promise<void> {
    this.currentChannelSignal.set(channel);
    this.currentIndexSignal.set(0);
    this.queueSignal.set([]);
    this.playedVideoIds.clear();
    this.playedVideosArray = [];
    this.usedPlaylistIds.clear();
    this.currentPlaylistLabelSignal.set('');
    // Don't reset lastBlockWasCustomPerChannel - it persists across initialization

    // Clear any saved queue and state for this channel (fresh start)
    this.savedQueuesPerChannel.delete(channel);
    this.channelStateService.clearState(channel);
    
    // Reset playback position tracking
    this.currentPlaybackPosition.set(0);
    this.currentVideoDuration.set(0);

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

    // Save current channel state before switching (for channel state persistence)
    const previousChannel = this.currentChannelSignal();
    const currentVideo = this.currentVideo();
    const position = this.currentPlaybackPosition();
    // Prefer backend duration (more reliable), fall back to player duration
    const duration = currentVideo?.duration ?? this.currentVideoDuration();
    const videoIndex = this.currentIndexSignal();
    const queue = this.queueSignal();

    if (currentVideo && position > 0 && duration > 0) {
      // Check if video is near the end (last 5 seconds)
      const isVideoEnding = duration > 0 && position >= duration - 5;
      
      if (isVideoEnding) {
        // Video is about to end - save queue with NEXT video index
        // So user gets a fresh song when they return
        const nextIndex = videoIndex + 1;
        if (nextIndex < queue.length) {
          this.savedQueuesPerChannel.set(
            previousChannel, 
            this.createSavedChannelState(queue, nextIndex)
          );
          // Don't save channel state - let them start fresh on next video
        }
      } else {
        // Normal case - save current position
        this.channelStateService.saveState(previousChannel, currentVideo.id, position, videoIndex, duration, currentVideo, queue);
        
        // Also save the queue so we can return to the same video
        this.savedQueuesPerChannel.set(
          previousChannel, 
          this.createSavedChannelState(queue, videoIndex)
        );
      }
    }

    // Reset playback position tracking
    this.currentPlaybackPosition.set(0);
    this.currentVideoDuration.set(0);

    // Check if we have a saved queue for the target channel
    const rawSavedQueue = this.savedQueuesPerChannel.get(channel);
    const savedQueue = rawSavedQueue ? this.migrateSavedState(rawSavedQueue) : null;
    const hasChannelState = this.channelStateService.hasState(channel);

    if (savedQueue && hasChannelState && savedQueue.queue.length > 0) {
      // Get the target video for validation
      const targetVideo = savedQueue.queue[savedQueue.currentIndex];
      
      // Restore the saved queue instead of fetching new videos
      // IMPORTANT: Restore state FIRST to set restoredState signal BEFORE queue changes trigger effects
      // Pass the full video objects (not just durations) for bumper detection and boundary calculation
      // Don't validate video ID since queues can refresh with different videos
      const result = this.channelStateService.restoreState(channel, undefined, savedQueue.queue);
      
      let targetIndex = savedQueue.currentIndex;
      let shouldFetchFresh = false;
      
      if (result.type === 'restored') {
        // Check if all videos in queue have ended (index exceeds queue length)
        if (result.state.videoIndex >= savedQueue.queue.length) {
          // All videos ended - fetch fresh playlist from backend
          shouldFetchFresh = true;
          console.log(`[QueueService] All ${savedQueue.queue.length} videos ended, fetching fresh playlist`);
        } else {
          targetIndex = result.state.videoIndex;
        }
      } else if (result.type === 'expired') {
        // Too much time has passed - advance to next video for fresh start
        if (savedQueue.currentIndex + 1 >= savedQueue.queue.length) {
          // Would go past queue - fetch fresh
          shouldFetchFresh = true;
        } else {
          targetIndex = savedQueue.currentIndex + 1;
        }
      }
      // For 'not-found', keep savedQueue.currentIndex (same video, fresh start)
      
      if (shouldFetchFresh) {
        // Clear saved state and fetch new content
        this.savedQueuesPerChannel.delete(channel);
        this.channelStateService.clearState(channel);
        this.channelStateService.clearRestoredState();
        
        this.currentChannelSignal.set(channel);
        this.currentIndexSignal.set(0);
        this.queueSignal.set([]);
        // Keep playedVideoIds to avoid repeating recently watched videos
        this.playedVideoIds = new Set(savedQueue.playedVideos.ids);
        this.playedVideosArray = [...savedQueue.playedVideos.orderedArray];
        this.usedPlaylistIds = new Set(savedQueue.usedPlaylistIds);

        const customPlaylistIds = this.customPlaylistService.getPlaylistIds(channel);
        await this.fetchAndAppendBlock(channel, customPlaylistIds);
      } else {
        // Resume within the saved queue
        this.currentChannelSignal.set(channel);
        this.restoreFromSavedState(savedQueue, targetIndex);
      }
    } else {
      // No saved queue - fetch fresh videos (first visit or state expired)
      // Clear any stale restored state BEFORE queue changes trigger effects
      this.channelStateService.clearRestoredState();
      
      this.currentChannelSignal.set(channel);
      this.currentIndexSignal.set(0);
      this.queueSignal.set([]);
      this.playedVideoIds.clear();
      this.playedVideosArray = [];
      this.usedPlaylistIds.clear();

      const customPlaylistIds = this.customPlaylistService.getPlaylistIds(channel);
      await this.fetchAndAppendBlock(channel, customPlaylistIds);
    }
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
    this.addPlayedVideo(videoId); // Mark as played so we don't fetch it again

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
    const currentChannel = this.currentChannelSignal();

    // Move to the next video
    const newIndex = currentIndex + 1;
    this.currentIndexSignal.set(newIndex);

    // Update saved channel state if it exists - user manually advanced
    if (this.savedQueuesPerChannel.has(currentChannel) && newIndex < queue.length) {
      const savedState = this.savedQueuesPerChannel.get(currentChannel)!;
      const newVideo = queue[newIndex];
      
      // Update the saved queue to reflect the new current index
      const updatedSavedState = {
        ...savedState,
        currentIndex: newIndex
      };
      this.savedQueuesPerChannel.set(currentChannel, updatedSavedState);
      
      // Update channel state to reflect manual advancement - start fresh on new video
      if (newVideo) {
        this.channelStateService.saveState(
          currentChannel, 
          newVideo.id, 
          0, // Start fresh from beginning
          newIndex, 
          newVideo.duration || 240,
          newVideo,
          queue
        );
      }
    }

    // Clean up old videos from queue to prevent memory bloat
    // Keep only a few videos behind current position for potential rewind
    const KEEP_PREVIOUS_VIDEOS = 5;
    if (currentIndex > KEEP_PREVIOUS_VIDEOS) {
      const videosToRemove = currentIndex - KEEP_PREVIOUS_VIDEOS;
      this.queueSignal.update(q => q.slice(videosToRemove));
      this.currentIndexSignal.set(KEEP_PREVIOUS_VIDEOS + 1); // Adjust index after cleanup
    }

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

  /**
   * Update current playback position (called by VideoPlayerComponent).
   * Used to track position for channel state persistence.
   */
  updatePlaybackPosition(position: number, duration: number): void {
    this.currentPlaybackPosition.set(position);
    this.currentVideoDuration.set(duration);
  }

  /**
   * Get the restored state signal for VideoPlayerComponent to consume.
   */
  getRestoredState() {
    return this.channelStateService.restoredState;
  }

  /**
   * Clear restored state after VideoPlayerComponent has consumed it.
   */
  clearRestoredState(): void {
    this.channelStateService.clearRestoredState();
  }

  /**
   * Check if channel has saved state.
   */
  hasChannelState(channel: Channel): boolean {
    return this.channelStateService.hasState(channel);
  }

  /**
   * Save state pointing to the next video with elapsed time from current video.
   * Used when manually advancing (e.g., pressing 'N') to prevent timeline regression.
   * 
   * @param elapsedPosition - Position elapsed in current video before advancing
   */
  saveStateForNextVideo(elapsedPosition: number): void {
    const currentChannel = this.currentChannelSignal();
    const currentIndex = this.currentIndexSignal();
    const queue = this.queueSignal();
    
    // Check if there's a next video to advance to
    if (queue.length > currentIndex + 1) {
      const nextVideo = queue[currentIndex + 1];
      
      // Save state pointing to next video with elapsed time as starting position
      this.channelStateService.saveState(
        currentChannel,
        nextVideo.id,
        elapsedPosition, // Start next video with elapsed time from current video
        currentIndex + 1, // Next video index
        nextVideo.duration || 240, // Next video duration
        nextVideo,
        queue
      );

      // Also save the queue state pointing to the next video
      this.savedQueuesPerChannel.set(
        currentChannel,
        this.createSavedChannelState(queue, currentIndex + 1)
      );
    }
  }

  // Helper method: Create a saved channel state object
  private createSavedChannelState(
    queue: VideoItem[], 
    currentIndex: number
  ): SavedChannelState {
    return {
      queue: [...queue],
      currentIndex,
      playedVideos: {
        ids: new Set(this.playedVideoIds),
        orderedArray: [...this.playedVideosArray]
      },
      usedPlaylistIds: new Set(this.usedPlaylistIds)
    };
  }

  // Helper method: Restore state from saved channel state
  private restoreFromSavedState(savedState: SavedChannelState, targetIndex: number): void {
    this.playedVideoIds = new Set(savedState.playedVideos.ids);
    this.playedVideosArray = [...savedState.playedVideos.orderedArray];
    this.usedPlaylistIds = new Set(savedState.usedPlaylistIds);
    this.currentIndexSignal.set(targetIndex);
    this.queueSignal.set(savedState.queue);
    
    // Update playlist label to reflect the current video's playlist
    this.updatePlaylistLabel();
  }

  // Helper method: Migrate old saved queue format to new format (backwards compatibility)
  private migrateSavedState(oldState: any): SavedChannelState {
    // Handle old format that had playedVideoIds and playedVideosArray as separate properties
    if ('playedVideoIds' in oldState && 'playedVideosArray' in oldState) {
      return {
        queue: oldState.queue,
        currentIndex: oldState.currentIndex,
        playedVideos: {
          ids: new Set(oldState.playedVideoIds),
          orderedArray: [...oldState.playedVideosArray]
        },
        usedPlaylistIds: new Set(oldState.usedPlaylistIds)
      };
    }
    // Already in new format
    return oldState as SavedChannelState;
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
