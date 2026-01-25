import { Channel } from './video.model';

/**
 * Persisted state for a channel when user navigates away.
 * Stores the playback position and metadata needed to calculate
 * where playback should resume when user returns.
 */
export interface ChannelState {
  /** The channel this state belongs to */
  channelId: Channel;
  /** YouTube video ID that was playing */
  videoId: string;
  /** Playback position in seconds when user left */
  position: number;
  /** Unix timestamp (ms) when state was saved */
  savedAt: number;
  /** Index in the queue of the video being watched */
  videoIndex: number;
  /** Duration of the current video in seconds */
  videoDuration: number;
  /** Maximum position reached (for backwards protection) */
  highWaterMark: number;
}

/**
 * Calculated state when returning to a channel.
 * Contains the computed position after applying elapsed time
 * and any video boundary adjustments.
 */
export interface RestoredState {
  /** Calculated position in seconds to seek to */
  position: number;
  /** Index of video to play */
  videoIndex: number;
  /** Number of videos to advance due to elapsed time */
  videoSkips: number;
}

/**
 * Result of state restoration attempt.
 * Discriminated union for type-safe handling of different outcomes.
 */
export type StateRestoreResult =
  | { type: 'restored'; state: RestoredState }
  | { type: 'not-found' }
  | { type: 'expired'; reason: string };
