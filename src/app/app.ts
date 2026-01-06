import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { VideoPlayerComponent } from './components/video-player/video-player.component';
import { ChannelSelectorComponent } from './components/channel-selector/channel-selector.component';
import { PowerButtonComponent } from './components/power-button/power-button.component';
import { QueueService } from './services/queue.service';
import { YoutubeService } from './services/youtube.service';
import { PwaService } from './services/pwa.service';
import { HelpersService } from './services/helpers.service';
import { inject as injectAnalytics } from '@vercel/analytics';

@Component({
  selector: 'app-root',
  imports: [VideoPlayerComponent, ChannelSelectorComponent, PowerButtonComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App implements OnInit {
  private queueService = inject(QueueService);
  private youtubeService = inject(YoutubeService);
  private pwaService = inject(PwaService); // Initialize PWA service early to catch install prompt
  private helpersService = inject(HelpersService);
  private document = inject(DOCUMENT);

  isPoweredOn = signal(false);
  isLoading = signal(true); // Start true to disable button, then set based on backend status
  isChannelSelectorOpen = signal(false);
  loadingProgress = signal(0); // 0-100 percentage
  backendIsReady = signal(false); // Track if backend successfully responded

  async ngOnInit(): Promise<void> {
    // Initialize Vercel Analytics
    injectAnalytics();

    // Add Android TV specific class for CSS optimizations
    if (this.helpersService.isAndroidTV()) {
      this.document.body.classList.add('android-tv-mode');
    }

    try {
      // Wait for backend to be ready with data first
      const backendReady = await this.waitForBackend();

      if (backendReady) {
        // Only load channel data after backend confirms it's ready
        const lastChannel = this.queueService.getLastSelectedChannel();
        await this.queueService.initializeQueue(lastChannel);
      } else {
        console.error('Backend not ready after timeout');
      }
    } catch (error) {
      console.error('Error initializing app:', error);
    }
  }

  private async waitForBackend(): Promise<boolean> {
    const maxRetries = 40; // Max 40 retries (about 120 seconds with 3 second intervals)
    let retries = 0;

    while (retries < maxRetries) {
      const readyData = await this.youtubeService.checkBackendReady();

      // Update progress based on cache size from backend
      if (readyData && typeof readyData === 'object') {
        const cacheSize = (readyData as any).cacheSize || 0;
        const totalPlaylists = (readyData as any).totalPlaylists || 50; // Use backend's count or fallback
        const progress = Math.min(95, Math.floor((cacheSize / totalPlaylists) * 100));
        this.loadingProgress.set(progress);
      }

      if (readyData === true || (typeof readyData === 'object' && (readyData as any).ready === true)) {
        this.loadingProgress.set(100);
        this.backendIsReady.set(true);
        this.isLoading.set(false);
        return true;
      }

      retries++;
      // Wait 3 seconds before next retry
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Backend failed - keep isLoading true so button stays disabled
    this.backendIsReady.set(false);
    return false;
  }

  onPowerOn(): void {
    this.isPoweredOn.set(true);
    // Power button click provides the user interaction needed for iOS autoplay
    // Video will start with the last selected channel (or default channel)
  }

  onPowerOff(): void {
    this.isPoweredOn.set(false);
  }

  onMenuStateChange(isOpen: boolean): void {
    this.isChannelSelectorOpen.set(isOpen);
  }
}
