import { Injectable, signal } from '@angular/core';
import { Channel, VideoItem } from '../models/video.model';
import { ChannelState, RestoredState, StateRestoreResult } from '../models/channel-state.model';

/**
 * Service for managing channel state persistence.
 * Enables authentic linear TV experience by tracking playback position
 * per channel and calculating restored positions based on elapsed time.
 */
@Injectable({ providedIn: 'root' })
export class ChannelStateService {
  /** Internal map storing state for each channel */
  private states = signal<Map<Channel, ChannelState>>(new Map());

  /** Signal to communicate restored state to VideoPlayer */
  restoredState = signal<RestoredState | null>(null);

  /**
   * Save the current state of a channel when user navigates away.
   * Updates highWaterMark to track maximum position reached.
   *
   * @param channel - The channel being left
   * @param videoId - YouTube video ID currently playing
   * @param position - Current playback position in seconds
   * @param videoIndex - Current video index in the queue
   * @param videoDuration - Duration of current video in seconds
   * @param currentVideo - The current video object (to check if it's a bumper)
   * @param queueVideos - Array of video objects in the queue (to get next video after bumper)
   */
  saveState(
    channel: Channel,
    videoId: string,
    position: number,
    videoIndex: number,
    videoDuration: number,
    currentVideo?: VideoItem,
    queueVideos?: VideoItem[]
  ): void {
    // If current video is a bumper, save state for the next video instead
    if (currentVideo?.isBumper && queueVideos && queueVideos.length > videoIndex + 1) {
      const nextVideo = queueVideos[videoIndex + 1];
      
      // Calculate how much time the bumper consumed
      // Use the current position in the bumper as the starting position for the next video
      // This ensures timeline progression continues naturally
      const bumperTimeElapsed = position;
      
      const state: ChannelState = {
        channelId: channel,
        videoId: nextVideo.id,
        position: bumperTimeElapsed, // Start next video with elapsed bumper time
        savedAt: Date.now(),
        videoIndex: videoIndex + 1, // Point to next video
        videoDuration: nextVideo.duration || 240, // Use next video duration or default
        highWaterMark: bumperTimeElapsed // Initialize with elapsed bumper time
      };

      this.updateState(channel, state);
      return;
    }
    
    // Validate inputs (allow 0 duration for bumpers/short videos)
    if (!videoId || position < 0 || videoIndex < 0 || videoDuration < 0) {
      return;
    }

    // Don't save state if video just started (position < 2s)
    // Duration might not be accurate yet, causing issues on restore
    if (position < 2) {
      return;
    }

    const existing = this.states().get(channel);
    
    // Only update highWaterMark if same video
    const highWaterMark = (existing?.videoId === videoId) 
      ? Math.max(existing?.highWaterMark ?? 0, position)
      : position;

    const state: ChannelState = {
      channelId: channel,
      videoId,
      position,
      savedAt: Date.now(),
      videoIndex,
      videoDuration,
      highWaterMark
    };

    this.updateState(channel, state);
  }

  /**
   * Restore state for a channel, calculating new position based on elapsed time.
   * Handles video boundaries and applies backwards protection.
   *
   * @param channel - The channel being returned to
   * @param targetVideoId - The video ID we're about to play (for validation)
   * @param queueVideos - Array of video objects in the queue (for boundary handling and bumper detection)
   * @returns StateRestoreResult indicating success or failure reason
   */
  restoreState(channel: Channel, targetVideoId?: string, queueVideos: VideoItem[] = []): StateRestoreResult {
    const state = this.states().get(channel);

    if (!state) {
      return { type: 'not-found' };
    }

    // If target video doesn't match saved video, don't restore position
    // (queue might have changed, or we're on a different video)
    if (targetVideoId && state.videoId !== targetVideoId) {
      return { type: 'not-found' };
    }

    const elapsedMs = Date.now() - state.savedAt;
    const elapsedSeconds = elapsedMs / 1000;

    let newPosition = state.position + elapsedSeconds;
    let videoIndex = state.videoIndex;
    let videoSkips = 0;

    // Handle video boundaries - advance through videos if elapsed time exceeds duration
    if (queueVideos.length > 0) {
      // Full boundary handling when video data is available
      // Use default duration (4 min) for videos with unknown duration (0)
      const DEFAULT_VIDEO_DURATION = 240; // 4 minutes in seconds
      
      while (videoIndex < queueVideos.length) {
        const video = queueVideos[videoIndex];
        const duration = video.duration || DEFAULT_VIDEO_DURATION;
        
        // If this is a bumper and we've elapsed past it, skip to next video immediately
        if (video.isBumper && newPosition > duration) {
          newPosition -= duration;
          videoIndex++;
          videoSkips++;
          continue;
        }
        
        if (newPosition <= duration) {
          break; // Stay on this video
        }
        newPosition -= duration;
        videoIndex++;
        videoSkips++;
      }
    } else {
      // If calculated position exceeds video duration, video would have ended
      // Signal to advance to next video
      if (state.videoDuration > 0 && newPosition >= state.videoDuration) {
        return { type: 'expired', reason: 'video would have ended' };
      }
    }

    // Apply backwards protection (only if still on same video)
    if (videoIndex === state.videoIndex && newPosition < state.highWaterMark) {
      newPosition = state.highWaterMark;
    }

    // Ensure position is non-negative and reasonable
    newPosition = Math.max(0, newPosition);

    const restored: RestoredState = {
      position: newPosition,
      videoIndex,
      videoSkips
    };

    this.restoredState.set(restored);

    return { type: 'restored', state: restored };
  }

  /**
   * Clear state for a specific channel.
   * Called when channel content is fully reset.
   *
   * @param channel - The channel to clear state for
   */
  clearState(channel: Channel): void {
    this.states.update(map => {
      const newMap = new Map(map);
      newMap.delete(channel);
      return newMap;
    });
  }

  /**
   * Clear the restored state signal after VideoPlayer has consumed it.
   * Should be called after seeking to the restored position.
   */
  clearRestoredState(): void {
    this.restoredState.set(null);
  }

  /**
   * Check if a channel has saved state.
   *
   * @param channel - The channel to check
   * @returns true if state exists for the channel
   */
  hasState(channel: Channel): boolean {
    return this.states().has(channel);
  }

  /**
   * Helper method to update the states map immutably.
   */
  private updateState(channel: Channel, state: ChannelState): void {
    this.states.update(map => {
      const newMap = new Map(map);
      newMap.set(channel, state);
      return newMap;
    });
  }
}
