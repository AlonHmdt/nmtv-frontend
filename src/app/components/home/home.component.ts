import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { VideoPlayerComponent } from '../video-player/video-player.component';
import { ChannelSelectorComponent } from '../channel-selector/channel-selector.component';
import { PowerButtonComponent } from '../power-button/power-button.component';
import { QueueService } from '../../services/queue.service';
import { YoutubeService } from '../../services/youtube.service';

interface SpecialEventPlaylist {
  id: string;
  label: string;
}

interface SpecialEventConfig {
  enabled: boolean;
  id: string;
  label: string;
  playlists: SpecialEventPlaylist[];
}

interface BackendReadyResponse {
  ready: boolean;
  mode?: 'youtube_api' | 'database';
  cacheSize?: number;
  totalPlaylists?: number;
  bumpersLoaded?: boolean;
  bumpersCount?: number;
  loadingTime?: number;
  noaChannelReady?: boolean;
  specialEvent?: SpecialEventConfig;
}

type ReadyData = boolean | BackendReadyResponse;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [VideoPlayerComponent, ChannelSelectorComponent, PowerButtonComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit {
  private queueService = inject(QueueService);
  private youtubeService = inject(YoutubeService);

  isPoweredOn = signal(false);
  isLoading = signal(true); // Start true to disable button, then set based on backend status
  isChannelSelectorOpen = signal(false);
  loadingProgress = signal(0); // 0-100 percentage
  backendIsReady = signal(false); // Track if backend successfully responded

  async ngOnInit(): Promise<void> {

    try {
      // Wait for backend to be ready with data first
      const backendReady = await this.waitForBackend();

      if (backendReady) {
        // Only load channel data after backend confirms it's ready
        const lastChannel = this.queueService.getLastSelectedChannel();
        await this.queueService.initializeQueue(lastChannel);
      }
    } catch (error) {
      console.error('Error initializing app:', error);
    }
  }

  private async waitForBackend(): Promise<boolean> {
    const maxRetries = 40; // Max 40 retries (about 120 seconds with 3 second intervals)
    let retries = 0;

    while (retries < maxRetries) {
      const readyData: ReadyData = await this.youtubeService.checkBackendReady();
      
      // Update progress based on cache size from backend
      if (readyData && typeof readyData === 'object') {
        const cacheSize = readyData.cacheSize || 0;
        const totalPlaylists = readyData.totalPlaylists || 50;
        const progress = Math.min(95, Math.floor((cacheSize / totalPlaylists) * 100));
        this.loadingProgress.set(progress);
        
        // Store special event data for other components to use
        this.youtubeService.specialEventData.set(readyData.specialEvent || null);
      }
      
      if (readyData === true || (typeof readyData === 'object' && readyData.ready === true)) {
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
