import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { VideoPlayerComponent } from './components/video-player/video-player.component';
import { ChannelSelectorComponent } from './components/channel-selector/channel-selector.component';
import { PowerButtonComponent } from './components/power-button/power-button.component';
import { QueueService } from './services/queue.service';
import { YoutubeService } from './services/youtube.service';
import { Channel } from './models/video.model';
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
  isPoweredOn = signal(false);
  isLoading = signal(true);

  async ngOnInit(): Promise<void> {
    // Initialize Vercel Analytics
    injectAnalytics();
    
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
    } finally {
      this.isLoading.set(false);
    }
  }

  private async waitForBackend(): Promise<boolean> {
    const maxRetries = 40; // Max 40 retries (about 120 seconds with 3 second intervals)
    let retries = 0;

    while (retries < maxRetries) {
      const isReady = await this.youtubeService.checkBackendReady();
      if (isReady) {
        return true;
      }
      
      retries++;      
      // Wait 3 seconds before next retry
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    return false;
  }

  onPowerOn(): void {
    this.isPoweredOn.set(true);
    
    // For iOS: Give the video player a moment to initialize, then trigger play
    setTimeout(() => {
      // Dispatch a custom event that the video player can listen to
      window.dispatchEvent(new CustomEvent('forceVideoPlay'));
    }, 500);
  }
}
