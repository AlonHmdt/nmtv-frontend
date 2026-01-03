import { Component, OnInit, OnDestroy, AfterViewInit, inject, signal, effect, ChangeDetectionStrategy, ViewChild, ElementRef, computed, untracked, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueueService } from '../../services/queue.service';
import { YoutubeService } from '../../services/youtube.service';
import { VideoPlayerControlService } from '../../services/video-player-control.service';
import { HelpersService } from '../../services/helpers.service';
import { EasterEggService } from '../../services/easter-egg.service';
import { CustomPlaylistService } from '../../services/custom-playlist.service';
import { ModalStateService } from '../../services/modal-state.service';
import { Video, Channel, Channels } from '../../models/video.model';
import { OldTVEffect, EffectMode } from './tv-static-effect';


declare var YT: any;

@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video-player.component.html',
  styleUrls: ['./video-player.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoPlayerComponent implements OnInit, AfterViewInit, OnDestroy {
  private queueService = inject(QueueService);
  private youtubeService = inject(YoutubeService);
  private videoPlayerControl = inject(VideoPlayerControlService);
  private helpersService = inject(HelpersService);
  private easterEggService = inject(EasterEggService);
  private customPlaylistService = inject(CustomPlaylistService);
  private modalState = inject(ModalStateService);


  @ViewChild('staticCanvas') staticCanvas?: ElementRef<HTMLCanvasElement>;

  // Input to track if channel selector menu is open
  isChannelSelectorOpen = input<boolean>(false);

  player: any;
  overlayState = signal<{
    playingNow: { visible: boolean; animating: boolean };
    playingNext: { visible: boolean; animating: boolean };
  }>({
    playingNow: { visible: false, animating: false },
    playingNext: { visible: false, animating: false }
  });
  currentVideo = this.queueService.currentVideo;
  upcomingVideo = this.queueService.upcomingVideo;
  currentChannel = this.queueService.currentChannel;
  currentChannelConfig = computed(() => {
    const channel = this.currentChannel();
    return Channels.find(c => c.id === channel);
  });
  oldTVEnabled = this.queueService.oldTVEnabled;
  showChannelSwitchStatic = signal(true); // Show static when switching channels (starts true for power-on)
  minStaticTimePassed = signal(false); // Track if minimum static time (600ms) has passed
  showUnmuteMessage = signal(false); // Show "Tap to unmute" message on iOS
  showVintageChannelIndicator = signal(false); // Show vintage channel name in top right corner
  volumeLevel = signal(100); // Volume level from 0-100
  showVolumeIndicator = signal(false); // Show vintage volume indicator

  private overlayTimeouts: number[] = [];
  private apiReady = signal(false);
  private overlaysStarted = false;
  private isFirstVideo = true; // Track if this is the first video (startup or channel change)

  private loadAttempts = 0;
  private timeouts = new Map<string, number>(); // Centralized timeout management
  private oldTVEffect: OldTVEffect | null = null;
  private isAwaitingIOSUnmute = false; // Track if waiting for user interaction to unmute on iOS

  // Touch gesture tracking
  private touchStart = { x: 0, y: 0, time: 0 };
  private touchEnd = { x: 0, y: 0 };
  private lastSwipeTime = 0;
  private readonly swipeConfig = {
    minDistance: 80,
    maxTime: 500,
    minVelocity: 0.3,
    maxHorizontalRatio: 0.5,
    debounceMs: 300
  };

  // Event listener bound handlers for proper cleanup
  private readonly boundHandlers = {
    keyPress: this.handleKeyPress.bind(this),
    touchStart: this.handleTouchStart.bind(this),
    touchEnd: this.handleTouchEnd.bind(this)
  }
  private readonly CHANNEL_SWITCH_DELAY_MS = 1200; // Minimum duration for static effect visibility (increased to mask loading)
  private readonly VOLUME_STEP = 5; // Volume adjustment step (5%)
  private readonly VOLUME_INDICATOR_DURATION = 2000; // Show volume indicator for 2 seconds

  // Available channels in order (NOA will be filtered out if locked)
  private readonly ALL_CHANNELS = [
    Channel.ROCK,
    Channel.HIP_HOP,
    Channel.DECADE_2000S,
    Channel.DECADE_1990S,
    Channel.DECADE_1980S,
    Channel.LIVE,
    Channel.SHOWS,
    Channel.NOA
  ] as const;

  constructor() {
    // Watch for when video changes (initial load or channel switch)
    effect(() => {
      const video = this.currentVideo();
      const ready = this.apiReady();

      // Check if channel changed
      // Note: isFirstVideo is handled in switchToNextChannel for manual switches

      if (video && ready) {
        // Reset overlays for new video
        this.clearTimeouts();
        this.overlaysStarted = false;

        if (!this.player) {
          this.initPlayer();
          // isFirstVideo will be handled in handlePlayingState via seekTo
        } else {
          if (this.isFirstVideo) {
            // For channel switches, load directly at the desired time
            // Extended static duration (1200ms) masks any loading time
            this.player.loadVideoById({
              videoId: video.id,
              startSeconds: this.getRandomStartTime(),
              suggestedQuality: this.helpersService.isAndroidTV() ? 'hd1080' : 'default'
            });
            this.isFirstVideo = false;
          } else {
            this.player.loadVideoById({
              videoId: video.id,
              suggestedQuality: this.helpersService.isAndroidTV() ? 'hd1080' : 'default'
            });
          }
        }
      }
    });

    // Separate effect to hide static when both conditions are met
    effect(() => {
      const video = this.currentVideo();
      const ready = this.apiReady();
      const minTimePassed = this.minStaticTimePassed();

      // Hide static when video is ready AND minimum time has passed
      // The minimum time is now longer (1400ms) to mask the loading/buffering
      if (video && ready && minTimePassed && untracked(() => this.showChannelSwitchStatic())) {
        this.showChannelSwitchStatic.set(false);
        // Stop static sound when effect ends
        this.helpersService.stopStaticSound();

        // Unmute the player now that the channel switch is complete
        if (this.player && !this.isAwaitingIOSUnmute) {
          this.player.unMute();
        }
      }
    });

    // Watch for Old TV effect toggle changes or channel switch static
    effect(() => {
      const enabled = this.oldTVEnabled();
      const channelSwitch = this.showChannelSwitchStatic();

      if (this.oldTVEffect) {
        if (enabled || channelSwitch) {
          // Set the appropriate mode based on which effect is active
          const mode: EffectMode = channelSwitch ? 'channelSwitch' : 'oldTV';
          this.oldTVEffect.setMode(mode);
          this.oldTVEffect.start();
        } else {
          this.oldTVEffect.stop();
        }
      }
    });

    // Watch for channel switches to show vintage channel indicator
    effect(() => {
      const channelSwitch = this.showChannelSwitchStatic();

      if (channelSwitch) {
        // Hide immediately when channel switch starts
        this.showVintageChannelIndicator.set(false);

        // Show vintage channel indicator 1 second after channel switch starts
        this.setNamedTimeout('vintageChannelShow', () => {
          this.showVintageChannelIndicator.set(true);

          // Hide after 6 seconds
          this.setNamedTimeout('vintageChannelHide', () => {
            this.showVintageChannelIndicator.set(false);
          }, 6000);
        }, 1000);
      }
    });

    // Watch for pause/resume signals from modals
    effect(() => {
      const shouldPause = this.videoPlayerControl.shouldPause();

      if (this.player) {
        if (shouldPause) {
          this.player.pauseVideo();
        } else {
          this.player.playVideo();
        }
      }
    });

    // Watch for channel switch requests from service
    effect(() => {
      const request = this.videoPlayerControl.channelSwitchRequest();

      if (request) {
        this.unmuteIfNeeded();

        if (request.withEffect) {
          this.initiateChannelSwitch();
          this.scheduleChannelLoad(request.channel);
        } else {
          // Direct switch without static effect
          this.queueService.switchChannel(request.channel);
        }

        // Clear the request after processing
        untracked(() => this.videoPlayerControl.clearChannelSwitchRequest());
      }
    });
  }

  // Centralized timeout management methods
  private setNamedTimeout(name: string, callback: () => void, delay: number): void {
    this.clearNamedTimeout(name);
    const timeoutId = window.setTimeout(callback, delay);
    this.timeouts.set(name, timeoutId);
  }

  private clearNamedTimeout(name: string): void {
    const timeoutId = this.timeouts.get(name);
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      this.timeouts.delete(name);
    }
  }

  private clearAllNamedTimeouts(): void {
    this.timeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.timeouts.clear();
  }

  private getRandomStartTime(): number {
    // Random start time between 1:40 (100s) and 2:40 (160s)
    const MIN_START = 100;
    const MAX_START = 160;
    return Math.floor(Math.random() * (MAX_START - MIN_START + 1)) + MIN_START;
  }

  ngOnInit(): void {
    // Load YouTube API and set apiReady signal
    // This must happen in ngOnInit to ensure it runs before effects process
    this.loadYouTubeAPI();

    // Add keyboard shortcut for testing: Press 'N' to skip to next video
    window.addEventListener('keydown', this.boundHandlers.keyPress);

    // Add touch event listeners for swipe gestures
    window.addEventListener('touchstart', this.boundHandlers.touchStart, { passive: true });
    window.addEventListener('touchend', this.boundHandlers.touchEnd, { passive: true });
  }

  ngAfterViewInit(): void {
    // Initialize Old TV effect after view is ready
    if (this.staticCanvas) {
      // Start with channelSwitch mode for power-on effect
      this.oldTVEffect = new OldTVEffect(this.staticCanvas.nativeElement, 'channelSwitch');

      // Use setTimeout to ensure DOM is ready and effect runs properly
      setTimeout(() => {
        if (this.oldTVEffect && this.showChannelSwitchStatic()) {
          this.oldTVEffect.start();
        }

        // Schedule minimum static time for power-on
        this.setNamedTimeout('minStatic', () => {
          this.minStaticTimePassed.set(true);
        }, this.CHANNEL_SWITCH_DELAY_MS);

        // Play static sound effect for power-on
        this.helpersService.playStaticSound();
      }, 0);
    }
  }

  ngOnDestroy(): void {
    this.clearTimeouts();
    this.clearAllNamedTimeouts();

    if (this.oldTVEffect) {
      this.oldTVEffect.destroy();
      this.oldTVEffect = null;
    }
    if (this.player) {
      this.player.destroy();
    }
    // Stop any playing static sound
    this.helpersService.stopStaticSound();

    // Remove event listeners using bound handlers
    window.removeEventListener('keydown', this.boundHandlers.keyPress);
    window.removeEventListener('touchstart', this.boundHandlers.touchStart);
    window.removeEventListener('touchend', this.boundHandlers.touchEnd);
  }

  private handleKeyPress(event: KeyboardEvent): void {
    // Press 'N' or 'n' to skip to next video (for testing)
    if (event.key === 'n' || event.key === 'N') {
      this.playNextVideo();
    }

    // Arrow Up/Down to change channels (only if menu and modals are closed)
    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && !this.isChannelSelectorOpen() && !this.modalState.isAnyModalOpen()) {
      event.preventDefault(); // Prevent page scroll
      this.switchToNextChannel(event.key === 'ArrowUp');
    }

    // Arrow Left/Right to control volume (only if menu and modals are closed)
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !this.isChannelSelectorOpen() && !this.modalState.isAnyModalOpen()) {
      event.preventDefault(); // Prevent page scroll
      this.adjustVolume(event.key === 'ArrowRight');
    }
  }

  private handleTouchStart(event: TouchEvent): void {
    // Ignore touches that start inside a modal
    const target = event.target as HTMLElement;
    if (this.isInsideModal(target)) {
      return;
    }

    // Unmute on first touch if muted for iOS
    this.unmuteIfNeeded();

    this.touchStart = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
      time: Date.now()
    };
  }

  private handleTouchEnd(event: TouchEvent): void {
    // Ignore touches that end inside a modal
    const target = event.target as HTMLElement;
    if (this.isInsideModal(target)) {
      return;
    }
    this.touchEnd = {
      x: event.changedTouches[0].clientX,
      y: event.changedTouches[0].clientY
    };
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
    if (this.isMenuOpen() || !this.isSwipeValid()) {
      return;
    }

    const verticalDistance = this.touchStart.y - this.touchEnd.y;
    this.lastSwipeTime = Date.now();

    if (verticalDistance > this.swipeConfig.minDistance) {
      this.switchToNextChannel(false); // Swipe up - next channel
    } else if (verticalDistance < -this.swipeConfig.minDistance) {
      this.switchToNextChannel(true); // Swipe down - previous channel
    }
  }

  private isSwipeValid(): boolean {
    const now = Date.now();

    // Check debounce
    if (now - this.lastSwipeTime < this.swipeConfig.debounceMs) {
      return false;
    }

    const verticalDistance = this.touchStart.y - this.touchEnd.y;
    const horizontalDistance = Math.abs(this.touchStart.x - this.touchEnd.x);
    const swipeTime = now - this.touchStart.time;
    const velocity = Math.abs(verticalDistance) / swipeTime;

    // Validate swipe timing
    if (swipeTime > this.swipeConfig.maxTime) {
      return false;
    }

    // Validate swipe is mostly vertical
    if (horizontalDistance > Math.abs(verticalDistance) * this.swipeConfig.maxHorizontalRatio) {
      return false;
    }

    // Validate swipe velocity
    return velocity >= this.swipeConfig.minVelocity;
  }

  private switchToNextChannel(goUp: boolean): void {
    const nextChannel = this.calculateNextChannel(goUp);
    this.videoPlayerControl.requestChannelSwitch(nextChannel, true);
  }

  private calculateNextChannel(goUp: boolean): Channel {
    // Filter out NOA channel if not unlocked
    const availableChannels = this.easterEggService.isUnlocked()
      ? [...this.ALL_CHANNELS]
      : this.ALL_CHANNELS.filter(ch => ch !== Channel.NOA) as Channel[];

    const currentChannel = this.currentChannel();
    const currentIndex = availableChannels.indexOf(currentChannel);

    const nextIndex = goUp
      ? (currentIndex > 0 ? currentIndex - 1 : availableChannels.length - 1)
      : (currentIndex < availableChannels.length - 1 ? currentIndex + 1 : 0);

    return availableChannels[nextIndex];
  }

  private initiateChannelSwitch(): void {
    this.showChannelSwitchStatic.set(true);
    this.minStaticTimePassed.set(false);
    this.isFirstVideo = true;
    this.clearChannelSwitchTimeouts();

    // Mute the player during channel switch to prevent audio bleed-through
    if (this.player) {
      this.player.mute();
    }

    // Play static sound effect
    this.helpersService.playStaticSound();
  }

  private scheduleChannelLoad(nextChannel: Channel): void {
    // Switch channel immediately to start loading the new video right away
    this.queueService.switchChannel(nextChannel);

    this.setNamedTimeout('minStatic', () => {
      this.minStaticTimePassed.set(true);
    }, this.CHANNEL_SWITCH_DELAY_MS);
  }

  private clearChannelSwitchTimeouts(): void {
    this.clearNamedTimeout('minStatic');
  }

  private adjustVolume(increase: boolean): void {
    if (!this.player) {
      return;
    }

    // Calculate new volume level
    const currentVolume = this.volumeLevel();
    const newVolume = increase
      ? Math.min(100, currentVolume + this.VOLUME_STEP)
      : Math.max(0, currentVolume - this.VOLUME_STEP);

    // Update volume
    this.volumeLevel.set(newVolume);
    this.player.setVolume(newVolume);

    // Show volume indicator
    this.showVolumeIndicatorWithTimeout();
  }

  private showVolumeIndicatorWithTimeout(): void {
    // Show the indicator
    this.showVolumeIndicator.set(true);

    // Hide after duration
    this.setNamedTimeout('volumeIndicator', () => {
      this.showVolumeIndicator.set(false);
    }, this.VOLUME_INDICATOR_DURATION);
  }

  private loadYouTubeAPI(): void {
    // Check if YT API is already loaded
    if ((window as any).YT && (window as any).YT.Player) {
      this.apiReady.set(true);
      return;
    }

    // If script tag exists but hasn't loaded yet, set up callback
    if (document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      // Script is loading, ensure callback is set
      if (!(window as any).onYouTubeIframeAPIReady) {
        (window as any).onYouTubeIframeAPIReady = () => {
          this.apiReady.set(true);
        };
      } else {
        // Callback already exists, we need to chain it
        const existingCallback = (window as any).onYouTubeIframeAPIReady;
        (window as any).onYouTubeIframeAPIReady = () => {
          existingCallback();
          this.apiReady.set(true);
        };
      }
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    (window as any).onYouTubeIframeAPIReady = () => {
      this.apiReady.set(true);
    };
  }

  private initPlayer(): void {
    // Destroy existing player instance to prevent memory leaks
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }

    const video = this.currentVideo();
    if (!video) {
      console.warn('No video available to play');
      return;
    }

    // Ensure YT API is actually ready
    if (!(window as any).YT || !(window as any).YT.Player) {
      console.warn('YouTube API not ready, cannot initialize player');
      return;
    }

    // Ensure container element exists in DOM - use requestAnimationFrame for proper timing
    requestAnimationFrame(() => {
      const playerElement = document.getElementById('youtube-player');
      if (!playerElement) {
        console.warn('Player element #youtube-player not found in DOM, retrying...');
        // Retry after next frame if element not found
        setTimeout(() => {
          if (!this.player) {
            this.initPlayer();
          }
        }, 100);
        return;
      }

      try {
        const playerConfig: any = {
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
            iv_load_policy: 3,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin,
            mute: 0,  // Unmuted since user clicked power button
            cc_load_policy: 0,  // Disable captions by default (0 = off, 1 = on if available)
            start: this.isFirstVideo ? this.getRandomStartTime() : undefined,
            widget_referrer: window.location.origin  // Help with browser caching
          },
          events: {
            onReady: (event: any) => this.onPlayerReady(event),
            onStateChange: (event: any) => this.onPlayerStateChange(event),
            onError: (event: any) => this.onPlayerError(event)
          }
        };

        this.player = new YT.Player('youtube-player', playerConfig);
      } catch (error) {
        console.error('Error initializing YouTube player:', error);
      }
    });
  }

  private onPlayerReady(event: any): void {
    this.loadAttempts = 0;
    this.configurePlayer(event.target);
    this.setupAudioForPlatform(event.target);
    this.startPlaybackWithRetries(event.target);
  }

  private configurePlayer(player: any): void {
    player.getIframe().style.pointerEvents = 'none';
    player.setVolume(100);

    // Set Full HD 1080p quality for Android TV to prevent 4K lag
    if (this.helpersService.isAndroidTV()) {
      try {
        player.setPlaybackQuality('hd1080');
      } catch (e) {
        // Ignore if quality setting fails
      }
    }

    // Force disable captions on player ready (overrides user's YouTube account preferences)
    try {
      if (player.loadModule) {
        player.loadModule('captions');
        // Unload/clear any caption track
        player.unloadModule('captions');
      }
    } catch (e) {
      // Ignore errors if caption module not available
    }
  }

  private setupAudioForPlatform(player: any): void {
    if (this.helpersService.isIOSDevice()) {
      this.setupIOSAudio(player);
    } else {
      player.unMute();
    }
  }

  private setupIOSAudio(player: any): void {
    player.mute();
    this.isAwaitingIOSUnmute = true;

    setTimeout(() => {
      if (this.isAwaitingIOSUnmute) {
        this.showUnmuteMessage.set(true);
      }
    }, 1000);
  }

  private startPlaybackWithRetries(player: any): void {
    player.playVideo();

    const retryPlayback = (delay: number, attempt: number = 1) => {
      setTimeout(() => {
        const state = player.getPlayerState();

        // If not playing or buffering, try to recover
        if (state !== YT.PlayerState.PLAYING && state !== YT.PlayerState.BUFFERING) {
          if (attempt >= 3) {
            // On final attempt, reload the video
            const currentVid = this.currentVideo();
            if (currentVid) {
              player.loadVideoById({
                videoId: currentVid.id,
                suggestedQuality: this.helpersService.isAndroidTV() ? 'hd1080' : 'default'
              });
            }
          } else {
            player.playVideo();
          }
        }
      }, delay);
    };

    retryPlayback(500, 1);
    retryPlayback(1500, 2);
    retryPlayback(3000, 3);
  }

  private unmuteIfNeeded(): void {
    if (this.isAwaitingIOSUnmute && this.player) {
      this.player.unMute();
      this.isAwaitingIOSUnmute = false;
      this.showUnmuteMessage.set(false);
    }
  }


  private onPlayerStateChange(event: any): void {
    if (event.data === YT.PlayerState.PLAYING) {
      this.handlePlayingState(event.target);
    } else if (event.data === YT.PlayerState.PAUSED) {
      this.handlePausedState(event.target);
    } else if (event.data === YT.PlayerState.ENDED) {
      this.playNextVideo();
    }
  }

  private handlePlayingState(player: any): void {
    this.loadAttempts = 0;

    if (this.isFirstVideo) {
      // Mark as no longer first video
      this.isFirstVideo = false;

      // Start overlays immediately since video already loaded at correct time
      if (!this.overlaysStarted) {
        this.initializeVideoOverlays();
      }
      return;
    }

    if (!this.overlaysStarted) {
      this.initializeVideoOverlays();
    }
  }

  private handlePausedState(player: any): void {
    if (!this.videoPlayerControl.shouldPause()) {
      player.playVideo();
    }
  }

  private initializeVideoOverlays(): void {
    const video = this.currentVideo();
    const channel = this.currentChannel();

    if (video?.isBumper) {
      this.overlaysStarted = true;
      return;
    }

    this.clearPendingYearFetch();
    this.scheduleYearFetch(video, channel);
    this.scheduleOverlayStart();
  }

  private clearPendingYearFetch(): void {
    this.clearNamedTimeout('yearFetch');
  }

  private scheduleYearFetch(video: Video | undefined, channel: Channel): void {
    if (!video || channel === Channel.LIVE || channel === Channel.SHOWS || video.isBumper) {
      return;
    }

    const searchTitle = video.artist && video.song
      ? `${video.artist} ${video.song}`
      : video.title || '';

    this.setNamedTimeout('yearFetch', () => {
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
    }, 5000);
  }

  private scheduleOverlayStart(): void {
    setTimeout(() => {
      this.startOverlayTimers();
      this.overlaysStarted = true;
    }, 500);
  }

  toggleMenu(): void {
    this.videoPlayerControl.toggleMenu();
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
    if (this.loadAttempts >= 2) {
      console.warn(`Video failed to load after 2 attempts, skipping...`);
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
    const currentChannel = this.currentChannel();
    if (!currentVideo) return;

    // Don't mark as unavailable if it's from a custom playlist (localStorage)
    // Just skip to next video without marking in database
    if (currentVideo.playlistId) {
      const customPlaylistIds = this.customPlaylistService.getPlaylistIds(currentChannel);
      if (customPlaylistIds.includes(currentVideo.playlistId)) {

        // Remove from queue locally only
        this.queueService.queue().splice(this.queueService.queue().indexOf(currentVideo), 1);

        // Load next video
        this.loadAttempts = 0;
        const nextVideo = this.currentVideo();

        if (nextVideo && this.player) {
          this.player.loadVideoById(nextVideo.id);
        } else if (!nextVideo) {
          console.error('No more videos in queue after skipping unavailable video');
        }
        return;
      }
    }

    // Mark video as unavailable in queue service (will also update DB)
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
    // isFirstVideo is already false at this point (set in effect)
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

    const currentVideo = this.currentVideo();
    const upcomingVideo = this.upcomingVideo();

    if (currentVideo?.isBumper) {
      return;
    }

    const duration = this.player.getDuration();
    const currentTime = this.player.getCurrentTime();
    const remainingTime = duration - currentTime;
    const startedFromMiddle = currentTime > 100;

    if (!startedFromMiddle) {
      this.scheduleFirstPlayingNowOverlay();
    }

    if (remainingTime > 60) {
      this.scheduleSecondPlayingNowOverlay(remainingTime, upcomingVideo);
    }
  }

  private scheduleFirstPlayingNowOverlay(): void {
    const timeout = window.setTimeout(() => {
      this.showOverlay('playingNow', 10000);
    }, 10000);

    this.overlayTimeouts.push(timeout);
  }

  private scheduleSecondPlayingNowOverlay(remainingTime: number, upcomingVideo: Video | undefined): void {
    const showBeforeEnd = (remainingTime - 50) * 1000;

    const timeout = window.setTimeout(() => {
      this.showOverlay('playingNow', 20000, () => {
        if (!upcomingVideo?.isBumper) {
          this.schedulePlayingNextOverlay();
        }
      });
    }, showBeforeEnd);

    this.overlayTimeouts.push(timeout);
  }

  private schedulePlayingNextOverlay(): void {
    const timeout = window.setTimeout(() => {
      this.showOverlay('playingNext', 10000);
    }, 5000);

    this.overlayTimeouts.push(timeout);
  }

  private showOverlay(type: 'playingNow' | 'playingNext', duration: number, callback?: () => void): void {
    // Show overlay
    this.overlayState.update(state => ({
      ...state,
      [type]: { visible: true, animating: false }
    }));

    const hideTimeout = window.setTimeout(() => {
      // Start hiding animation
      this.overlayState.update(state => ({
        ...state,
        [type]: { visible: true, animating: true }
      }));

      const completeTimeout = window.setTimeout(() => {
        // Complete hide
        this.overlayState.update(state => ({
          ...state,
          [type]: { visible: false, animating: false }
        }));
        callback?.();
      }, 500);

      this.overlayTimeouts.push(completeTimeout);
    }, duration);

    this.overlayTimeouts.push(hideTimeout);
  }

  private clearTimeouts(): void {
    this.overlayTimeouts.forEach(timeout => clearTimeout(timeout));
    this.overlayTimeouts = [];
    this.overlayState.set({
      playingNow: { visible: false, animating: false },
      playingNext: { visible: false, animating: false }
    });
  }
}
