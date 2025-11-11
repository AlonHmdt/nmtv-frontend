import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { VideoPlayerComponent } from './components/video-player/video-player.component';
import { ChannelSelectorComponent } from './components/channel-selector/channel-selector.component';
import { PowerButtonComponent } from './components/power-button/power-button.component';
import { QueueService } from './services/queue.service';
import { Channel } from './models/video.model';

@Component({
  selector: 'app-root',
  imports: [VideoPlayerComponent, ChannelSelectorComponent, PowerButtonComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App implements OnInit {
  private queueService = inject(QueueService);
  isPoweredOn = signal(false);

  async ngOnInit(): Promise<void> {
    // Load the last selected channel or default to Rock
    const lastChannel = this.queueService.getLastSelectedChannel();
    try {
      await this.queueService.initializeQueue(lastChannel);
    } catch (error) {
      console.error('Error initializing queue:', error);
    }
  }

  onPowerOn(): void {
    this.isPoweredOn.set(true);
  }
}
