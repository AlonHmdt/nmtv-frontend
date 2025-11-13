import { Injectable, signal, computed, inject } from '@angular/core';
import { Video, Channel } from '../models/video.model';
import { YoutubeService } from './youtube.service';
import { CustomPlaylistService } from './custom-playlist.service';
import { timeout, catchError, of } from 'rxjs';

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
  
  // Computed signals
  queue = computed(() => this.queueSignal());
  currentVideo = computed(() => this.queueSignal()[this.currentIndexSignal()]);
  upcomingVideo = computed(() => this.queueSignal()[this.currentIndexSignal() + 1]);
  currentChannel = computed(() => this.currentChannelSignal());

  private playedVideoIds = new Set<string>();
  private playedVideosArray: string[] = []; // Track order for FIFO removal
  private unavailableVideoIds = new Set<string>();
  private readonly MAX_TRACKED_VIDEOS = 100; // Only track last 100 videos to prevent memory growth

  async initializeQueue(channel: Channel): Promise<void> {
    console.log('QueueService: Initializing queue for channel:', channel);
    this.currentChannelSignal.set(channel);
    this.currentIndexSignal.set(0);
    this.queueSignal.set([]);
    this.playedVideoIds.clear();
    this.playedVideosArray = []; // Clear the tracking array too
    this.unavailableVideoIds.clear(); // Reset unavailable videos on channel switch
    
    const customPlaylistIds = this.customPlaylistService.getPlaylistIds(channel);
    console.log(`QueueService: Using ${customPlaylistIds.length} custom playlists for channel ${channel}`);
    
    try {
      // Phase 1: Load official playlists immediately (instant from cache)
      console.log('Phase 1: Loading official playlists (instant)...');
      await this.fillQueueOfficial();
      console.log('QueueService: Official videos loaded, total videos:', this.queueSignal().length);
      
      // Phase 2: Load custom playlists in background (if any)
      if (customPlaylistIds.length > 0) {
        console.log(`Phase 2: Loading ${customPlaylistIds.length} custom playlists in background...`);
        this.loadCustomPlaylistsInBackground(channel, customPlaylistIds);
      }
    } catch (error) {
      console.error('QueueService: Error filling queue:', error);
      throw error;
    }
  }

  async switchChannel(channel: Channel): Promise<void> {
    // Save the current channel to localStorage
    localStorage.setItem('lastChannel', channel);
    
    this.currentChannelSignal.set(channel);
    this.currentIndexSignal.set(0);
    this.queueSignal.set([]);
    this.playedVideoIds.clear();
    this.playedVideosArray = []; // Clear the tracking array too
    this.unavailableVideoIds.clear(); // Reset unavailable videos on channel switch
    
    const customPlaylistIds = this.customPlaylistService.getPlaylistIds(channel);
    
    // Phase 1: Load official playlists immediately (instant from cache)
    console.log('Loading official playlists (instant)...');
    await this.fillQueueOfficial();
    console.log('Official videos loaded, starting playback');
    
    // Phase 2: Load custom playlists in background (if any)
    if (customPlaylistIds.length > 0) {
      console.log(`Loading ${customPlaylistIds.length} custom playlists in background...`);
      this.loadCustomPlaylistsInBackground(channel, customPlaylistIds);
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

  // New method: Mark video as unavailable and auto-skip
  markVideoAsUnavailable(videoId: string): void {
    console.log(`Video ${videoId} marked as unavailable, skipping...`);
    this.unavailableVideoIds.add(videoId);
    this.addPlayedVideo(videoId); // Also mark as played so we don't fetch it again
    
    // Remove from queue
    this.queueSignal.update(queue => queue.filter(v => v.id !== videoId));
    
    // If it was the current video, the index now points to the next video automatically
    // No need to change currentIndexSignal because filtering shifts everything down
    console.log(`Video removed from queue. Current index: ${this.currentIndexSignal()}, Queue length: ${this.queueSignal().length}`);
  }

  async nextVideo(): Promise<void> {
    const currentIndex = this.currentIndexSignal();
    const queue = this.queueSignal();
    
    // Move to the next video
    this.currentIndexSignal.set(currentIndex + 1);
    
    // Check if we need to add more videos to maintain queue of 6 ahead (half of batch size)
    const remainingVideos = queue.length - this.currentIndexSignal();
    if (remainingVideos <= 6) {
      await this.addMoreVideos();
    }
  }

  getLastSelectedChannel(): Channel {
    const saved = localStorage.getItem('lastChannel');
    return (saved as Channel) || Channel.DECADE_1990S;
  }

  private enrichVideosWithPlaylistNames(videos: Video[]): Video[] {
    return videos.map(video => {
      if (video.playlistId) {
        const playlistName = this.customPlaylistService.getPlaylistName(video.playlistId);
        if (playlistName) {
          return { ...video, playlistName };
        }
      }
      return video;
    });
  }

  private async fillQueue(): Promise<void> {
    // Fetch initial 30 videos from backend
    console.log('QueueService: Fetching initial videos from backend...');
    
    const customPlaylistIds = this.customPlaylistService.getPlaylistIds(this.currentChannelSignal());
    
    return new Promise((resolve, reject) => {
      this.youtubeService.getChannelVideos(this.currentChannelSignal(), customPlaylistIds)
        .subscribe({
          next: (videos) => {
            console.log(`QueueService: Received ${videos.length} videos from backend`);
            const enrichedVideos = this.enrichVideosWithPlaylistNames(videos);
            this.queueSignal.set(enrichedVideos);
            // Track all video IDs using rolling window
            videos.forEach(v => this.addPlayedVideo(v.id));
            resolve();
          },
          error: (err) => {
            console.error('QueueService: Error fetching videos from backend:', err);
            reject(err);
          }
        });
    });
  }

  private async fillQueueOfficial(): Promise<void> {
    // Fetch official playlists only (instant from cache)
    console.log('QueueService: Fetching official videos (skipCustom=true)...');
    
    return new Promise((resolve, reject) => {
      this.youtubeService.getChannelVideos(this.currentChannelSignal(), [], true) // skipCustom=true
        .subscribe({
          next: (videos) => {
            console.log(`QueueService: Received ${videos.length} official videos`);
            this.queueSignal.set(videos);
            // Track all video IDs using rolling window
            videos.forEach(v => this.addPlayedVideo(v.id));
            resolve();
          },
          error: (err) => {
            console.error('QueueService: Error fetching official videos:', err);
            reject(err);
          }
        });
    });
  }

  private loadCustomPlaylistsInBackground(channel: Channel, customPlaylists: string[]): void {
    // Fetch custom + official mixed videos in background with 30-second timeout
    this.youtubeService.getChannelVideos(channel, customPlaylists, false)
      .pipe(
        timeout(30000), // 30-second timeout for all custom playlists
        catchError(error => {
          console.error('Custom playlist fetch failed or timed out:', error);
          return of([]); // Return empty array on timeout/error, user keeps official playlists
        })
      )
      .subscribe({
        next: (mixedVideos) => {
          // If empty (timeout/error), don't replace queue
          if (mixedVideos.length === 0) {
            console.log('Custom playlists failed to load, continuing with official playlists');
            return;
          }
          
          console.log(`✓ Custom playlists loaded! Received ${mixedVideos.length} mixed videos`);
          
          // Enrich videos with playlist names
          const enrichedVideos = this.enrichVideosWithPlaylistNames(mixedVideos);
          
          // Get the video that's currently playing
          const currentVideo = this.currentVideo();
          
          if (!currentVideo) {
            // If no video playing yet, just replace entire queue
            this.queueSignal.set(enrichedVideos);
            enrichedVideos.forEach(v => this.addPlayedVideo(v.id));
            console.log('Queue replaced with mixed videos (no video was playing)');
            return;
          }
          
          // Find the current video in the new mixed queue
          const currentVideoIndexInMixed = enrichedVideos.findIndex(v => v.id === currentVideo.id);
          
          if (currentVideoIndexInMixed >= 0) {
            // Current video exists in mixed queue
            // Set it as the starting point
            this.currentIndexSignal.set(currentVideoIndexInMixed);
            this.queueSignal.set(enrichedVideos);
            enrichedVideos.forEach(v => this.addPlayedVideo(v.id));
            console.log(`✓ Queue replaced: Current video "${currentVideo.artist || currentVideo.title}" found at index ${currentVideoIndexInMixed}`);
          } else {
            // Current video NOT in mixed queue (edge case)
            // Insert current video at the beginning, then add mixed queue
            const newQueue = [currentVideo, ...enrichedVideos];
            this.queueSignal.set(newQueue);
            this.currentIndexSignal.set(0);
            newQueue.forEach(v => this.addPlayedVideo(v.id));
            console.log(`✓ Queue replaced: Current video not in mixed queue, inserted at beginning`);
          }
        },
        error: (error) => {
          // This shouldn't be called due to catchError, but kept as safety
          console.error('Unexpected error in custom playlist background fetch:', error);
        }
      });
  }

  private async addMoreVideos(): Promise<void> {
    console.log('QueueService: Fetching next batch of videos...');
    
    const customPlaylistIds = this.customPlaylistService.getPlaylistIds(this.currentChannelSignal());
    
    return new Promise((resolve, reject) => {
      const excludeIds = Array.from(this.playedVideoIds);
      
      this.youtubeService.getNextVideos(this.currentChannelSignal(), excludeIds, customPlaylistIds)
        .subscribe({
          next: (videos) => {
            console.log(`QueueService: Received ${videos.length} new videos from backend`);
            const enrichedVideos = this.enrichVideosWithPlaylistNames(videos);
            this.queueSignal.update(queue => [...queue, ...enrichedVideos]);
            // Track new video IDs using rolling window
            videos.forEach(v => this.addPlayedVideo(v.id));
            resolve();
          },
          error: (err) => {
            console.error('QueueService: Error fetching next videos:', err);
            reject(err);
          }
        });
    });
  }
}
