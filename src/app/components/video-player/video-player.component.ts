import { Component, OnInit, OnDestroy, inject, signal, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { QueueService } from '../../services/queue.service';
import { YoutubeService } from '../../services/youtube.service';
import { Video, Channel } from '../../models/video.model';

declare var YT: any;

@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video-player.component.html',
  styleUrls: ['./video-player.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoPlayerComponent implements OnInit, OnDestroy {
  private queueService = inject(QueueService);
  private youtubeService = inject(YoutubeService);
  private sanitizer = inject(DomSanitizer);
  
  player: any;
  showPlayingNow = signal(false);
  showPlayingNext = signal(false);
  playingNowAnimating = signal(false); // true when hiding with animation
  playingNextAnimating = signal(false); // true when hiding with animation
  currentVideo = this.queueService.currentVideo;
  upcomingVideo = this.queueService.upcomingVideo;
  currentChannel = this.queueService.currentChannel;
  
  private overlayTimeouts: number[] = [];
  private apiReady = signal(false);
  private overlaysStarted = false;
  private isFirstVideo = true; // Track if this is the first video (startup or channel change)
  private previousChannel: string | null = null; // Track channel changes
  private loadAttempts = 0;
  private maxLoadAttempts = 2; // Try loading video twice before marking as unavailable
  private yearFetchTimeout: number | null = null; // Timeout for debouncing year fetch
  
  // Touch gesture tracking
  private touchStartY = 0;
  private touchEndY = 0;
  private minSwipeDistance = 50; // Minimum distance for a swipe to register

  constructor() {
    // Watch for when video changes (initial load or channel switch)
    effect(() => {
      const video = this.currentVideo();
      const channel = this.currentChannel();
      const ready = this.apiReady();
      
      // Check if channel changed
      if (this.previousChannel !== null && this.previousChannel !== channel) {
        this.isFirstVideo = true; // Mark as first video on channel change
      }
      this.previousChannel = channel;
      
      if (video && ready) {
        // Reset overlays for new video
        this.clearTimeouts();
        this.overlaysStarted = false;
        
        if (!this.player) {
          this.initPlayer();
        } else {
          if (this.isFirstVideo) {
            // Start from middle for first video of channel
            this.player.loadVideoById({
              videoId: video.id,
              startSeconds: 135  // Start at 2:15 only for first video
            });
          } else {
            // Start from beginning for subsequent videos
            this.player.loadVideoById(video.id);
          }
        }
      }
    });
  }

  ngOnInit(): void {
    this.loadYouTubeAPI();
    
    // Add keyboard shortcut for testing: Press 'N' to skip to next video
    window.addEventListener('keydown', this.handleKeyPress.bind(this));
    
    // Add touch event listeners for swipe gestures
    window.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
    window.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
  }

  ngOnDestroy(): void {
    this.clearTimeouts();
    if (this.yearFetchTimeout) {
      clearTimeout(this.yearFetchTimeout);
      this.yearFetchTimeout = null;
    }
    if (this.player) {
      this.player.destroy();
    }
    window.removeEventListener('keydown', this.handleKeyPress.bind(this));
    window.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    window.removeEventListener('touchend', this.handleTouchEnd.bind(this));
  }

  private handleKeyPress(event: KeyboardEvent): void {
    // Press 'N' or 'n' to skip to next video (for testing)
    if (event.key === 'n' || event.key === 'N') {
      this.playNextVideo();
    }
    
    // Arrow Up/Down to change channels
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault(); // Prevent page scroll
      this.switchToNextChannel(event.key === 'ArrowUp');
    }
  }
  
  private handleTouchStart(event: TouchEvent): void {
    // Ignore touches that start inside a modal
    const target = event.target as HTMLElement;
    if (this.isInsideModal(target)) {
      return;
    }
    this.touchStartY = event.touches[0].clientY;
  }
  
  private handleTouchEnd(event: TouchEvent): void {
    // Ignore touches that end inside a modal
    const target = event.target as HTMLElement;
    if (this.isInsideModal(target)) {
      return;
    }
    this.touchEndY = event.changedTouches[0].clientY;
    this.handleSwipe();
  }
  
  private isInsideModal(element: HTMLElement): boolean {
    // Check if the element or any of its parents is a modal or menu
    let current: HTMLElement | null = element;
    while (current) {
      const classList = current.classList;
      if (classList && (
        classList.contains('modal-content') ||
        classList.contains('modal-backdrop') ||
        classList.contains('settings-modal') ||
        classList.contains('about-modal') ||
        classList.contains('side-menu') ||
        classList.contains('menu-overlay')
      )) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }
  
  private isMenuOpen(): boolean {
    // Check if the side menu is currently open by looking for visible menu-overlay
    const menuOverlay = document.querySelector('.menu-overlay');
    return menuOverlay ? !menuOverlay.classList.contains('hidden') : false;
  }
  
  private handleSwipe(): void {
    // Don't handle swipes if the menu is open
    if (this.isMenuOpen()) {
      return;
    }
    
    const swipeDistance = this.touchStartY - this.touchEndY;
    
    // Swipe up (finger moves up) - next channel
    if (swipeDistance > this.minSwipeDistance) {
      this.switchToNextChannel(false); // Same as arrow down
    }
    // Swipe down (finger moves down) - previous channel
    else if (swipeDistance < -this.minSwipeDistance) {
      this.switchToNextChannel(true); // Same as arrow up
    }
  }

  private switchToNextChannel(goUp: boolean): void {
    const channels = [
      Channel.ROCK,
      Channel.HIP_HOP,
      Channel.DECADE_2000S,
      Channel.DECADE_1990S,
      Channel.DECADE_1980S,
      Channel.LIVE
    ];
    
    const currentChannel = this.currentChannel();
    const currentIndex = channels.indexOf(currentChannel);
    
    let nextIndex: number;
    if (goUp) {
      // Arrow Up - go to previous channel (wrap around)
      nextIndex = currentIndex > 0 ? currentIndex - 1 : channels.length - 1;
    } else {
      // Arrow Down - go to next channel (wrap around)
      nextIndex = currentIndex < channels.length - 1 ? currentIndex + 1 : 0;
    }
    
    const nextChannel = channels[nextIndex];
    this.queueService.switchChannel(nextChannel);
  }

  private loadYouTubeAPI(): void {
    if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      
      (window as any).onYouTubeIframeAPIReady = () => {
        this.apiReady.set(true);
        // The effect() will handle initialization when video is available
      };
    } else {
      this.apiReady.set(true);
      // The effect() will handle initialization when video is available
    }
  }

  private initPlayer(): void {
    const video = this.currentVideo();
    if (!video) {
      console.warn('No video available to play');
      return;
    }

    this.player = new YT.Player('youtube-player', {
      videoId: video.id,
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        iv_load_policy: 3,
        playsinline: 1,
        enablejsapi: 1,
        origin: window.location.origin,
        mute: 0  // Unmuted since user clicked power button
      },
      events: {
        onReady: (event: any) => this.onPlayerReady(event),
        onStateChange: (event: any) => this.onPlayerStateChange(event),
        onError: (event: any) => this.onPlayerError(event)
      }
    });
  }

  private onPlayerReady(event: any): void {
    this.loadAttempts = 0; // Reset load attempts on successful ready
    
    // Disable all interactions
    event.target.getIframe().style.pointerEvents = 'none';
    
    // User already interacted with power button, so we can try unmuted playback
    event.target.unMute();
    event.target.setVolume(100);
    
    setTimeout(() => {
      if (this.isFirstVideo) {
        // Seek to 2 minutes 15 seconds (135 seconds) only for first video
        event.target.seekTo(135, true);
      }
      event.target.playVideo();
      
      setTimeout(() => {
        const state = event.target.getPlayerState();
        
        if (state !== YT.PlayerState.PLAYING) {
          event.target.playVideo();
        }
      }, 500);
    }, 300);
  }

  private addUnmuteListener(player: any): void {
    const unmute = () => {
      player.unMute();
      player.setVolume(100);
      document.removeEventListener('click', unmute);
    };
    document.addEventListener('click', unmute, { once: true });
  }

  private onPlayerStateChange(event: any): void {
    // Reset load attempts when video starts playing
    if (event.data === YT.PlayerState.PLAYING) {
      this.loadAttempts = 0;
      
      if (!this.overlaysStarted) {
        // Only start overlays once per video
        const video = this.currentVideo();
        const channel = this.currentChannel();
        
        // Skip overlays and year fetching for bumpers
        if (video?.isBumper) {
          this.overlaysStarted = true; // Mark as started so we don't process again
          return; // Skip everything for bumpers
        }
        
        // Clear any pending year fetch request
        if (this.yearFetchTimeout) {
          clearTimeout(this.yearFetchTimeout);
          this.yearFetchTimeout = null;
        }
        
        // Debounce the year fetch to avoid excessive API calls when switching channels rapidly
        // Skip year fetching for Live channel and bumpers
        if (video && channel !== Channel.LIVE && !video.isBumper) {
          const searchTitle = video.artist && video.song 
            ? `${video.artist} ${video.song}` 
            : video.title || '';
          
          this.yearFetchTimeout = window.setTimeout(() => {
            this.youtubeService.getVideoYear(searchTitle).subscribe({
              next: (response) => {
                if (response.year) {
                  video.year = response.year;
                }
              },
              error: (err) => {
                console.error('Error fetching video year:', err);
              }
            });
            this.yearFetchTimeout = null;
          }, 5000); // Wait 5 seconds before fetching
        }
        
        // Small delay to ensure getDuration() returns valid value
        setTimeout(() => {
          this.startOverlayTimers();
          this.overlaysStarted = true;
        }, 500);
      }
    }
    
    // Prevent pausing - always keep playing
    if (event.data === YT.PlayerState.PAUSED) {
      event.target.playVideo();
    } else if (event.data === YT.PlayerState.ENDED) {
      this.playNextVideo();
    }
  }

  private onPlayerError(event: any): void {
    console.error('YouTube player error:', event.data);
    
    const currentVideo = this.currentVideo();
    
    // Error codes from YouTube IFrame API:
    // 2 - Invalid video ID
    // 5 - HTML5 player error
    // 100 - Video not found or private
    // 101, 150 - Video not available (embedding disabled, region restriction, etc.)
    
    const errorMessages: { [key: number]: string } = {
      2: 'Invalid video ID',
      5: 'HTML5 player error',
      100: 'Video not found or private',
      101: 'Video not available for playback',
      150: 'Video not available for playback'
    };
    
    const errorMsg = errorMessages[event.data] || 'Unknown error';
    console.warn(`Video error (${errorMsg}):`, currentVideo?.title || currentVideo?.id);
    
    // For errors 100, 101, 150 - video is definitely unavailable
    if ([100, 101, 150].includes(event.data)) {
      this.handleUnavailableVideo();
      return;
    }
    
    // For other errors, retry once
    this.loadAttempts++;
    if (this.loadAttempts >= this.maxLoadAttempts) {
      console.warn(`Video failed to load after ${this.maxLoadAttempts} attempts, skipping...`);
      this.handleUnavailableVideo();
    } else {
      setTimeout(() => {
        if (this.player && currentVideo) {
          this.player.loadVideoById(currentVideo.id);
        }
      }, 1000); // Wait 1 second before retry
    }
  }

  private handleUnavailableVideo(): void {
    const currentVideo = this.currentVideo();
    if (!currentVideo) return;
    
    // Mark video as unavailable in queue service
    this.queueService.markVideoAsUnavailable(currentVideo.id);
    
    // Load next video immediately
    this.loadAttempts = 0; // Reset attempts for next video
    const nextVideo = this.currentVideo(); // Get the new current video after removal
    
    if (nextVideo && this.player) {
      this.player.loadVideoById(nextVideo.id);
    } else if (!nextVideo) {
      console.error('No more videos in queue after skipping unavailable video');
    }
  }

  private async playNextVideo(): Promise<void> {
    this.clearTimeouts();
    this.overlaysStarted = false; // Reset for next video
    this.isFirstVideo = false; // Subsequent videos start from beginning
    await this.queueService.nextVideo();
    
    const video = this.currentVideo();
    if (video && this.player) {
      // Load from beginning (no startSeconds parameter)
      this.player.loadVideoById(video.id);
    }
  }

  private startOverlayTimers(): void {
    this.clearTimeouts();
    
    if (!this.player) return;
    
    const duration = this.player.getDuration();
    const currentTime = this.player.getCurrentTime();
    const remainingTime = duration - currentTime;
    
    // Skip first "Playing Now" if video started from 2:15 (currentTime > 100)
    const startedFromMiddle = currentTime > 100;
    
    if (!startedFromMiddle) {
      // First "Playing Now" - appears at 10s from current position, stays for 10s
      const timeout1 = window.setTimeout(() => {
        this.showPlayingNow.set(true);
        this.playingNowAnimating.set(false);
        
        const timeout2 = window.setTimeout(() => {
          this.playingNowAnimating.set(true); // Start hide animation
          
          // Wait for animation to complete before hiding
          const timeout2b = window.setTimeout(() => {
            this.showPlayingNow.set(false);
            this.playingNowAnimating.set(false);
          }, 500); // Match animation duration
          
          this.overlayTimeouts.push(timeout2b);
        }, 10000); // Show for 10 seconds
        
        this.overlayTimeouts.push(timeout2);
      }, 10000); // Show after 10 seconds from current time
      
      this.overlayTimeouts.push(timeout1);
    }
    
    // Second "Playing Now" - appears 50s before end, stays for 20s
    if (remainingTime > 60) {
      const showBeforeEnd = (remainingTime - 50) * 1000;
      
      const timeout3 = window.setTimeout(() => {
        this.showPlayingNow.set(true);
        this.playingNowAnimating.set(false);
        
        const timeout4 = window.setTimeout(() => {
          this.playingNowAnimating.set(true); // Start hide animation
          
          // Wait for animation to complete
          const timeout4b = window.setTimeout(() => {
            this.showPlayingNow.set(false);
            this.playingNowAnimating.set(false);
            
            // "Playing Next" - appears 5s after "Playing Now" hides, stays for 10s
            const timeout5 = window.setTimeout(() => {
              this.showPlayingNext.set(true);
              this.playingNextAnimating.set(false);
              
              const timeout6 = window.setTimeout(() => {
                this.playingNextAnimating.set(true); // Start hide animation
                
                // Wait for animation to complete
                const timeout6b = window.setTimeout(() => {
                  this.showPlayingNext.set(false);
                  this.playingNextAnimating.set(false);
                }, 500); // Match animation duration
                
                this.overlayTimeouts.push(timeout6b);
              }, 10000); // Show for 10 seconds
              
              this.overlayTimeouts.push(timeout6);
            }, 5000); // Show 5 seconds after "Playing Now" hides
            
            this.overlayTimeouts.push(timeout5);
          }, 500); // Match animation duration
          
          this.overlayTimeouts.push(timeout4b);
        }, 20000); // Show for 20 seconds
        
        this.overlayTimeouts.push(timeout4);
      }, showBeforeEnd);
      
      this.overlayTimeouts.push(timeout3);
    }
  }

  private clearTimeouts(): void {
    this.overlayTimeouts.forEach(timeout => clearTimeout(timeout));
    this.overlayTimeouts = [];
    this.showPlayingNow.set(false);
    this.showPlayingNext.set(false);
    this.playingNowAnimating.set(false);
    this.playingNextAnimating.set(false);
  }
}
