import { Component, inject, signal, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueueService } from '../../services/queue.service';
import { Channel, ChannelConfig } from '../../models/video.model';
import { SettingsModalComponent } from '../settings-modal/settings-modal.component';
import { AboutModalComponent } from '../about-modal/about-modal.component';

@Component({
  selector: 'app-channel-selector',
  standalone: true,
  imports: [CommonModule, SettingsModalComponent, AboutModalComponent],
  templateUrl: './channel-selector.component.html',
  styleUrls: ['./channel-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChannelSelectorComponent {
  private queueService = inject(QueueService);
  
  @ViewChild(SettingsModalComponent) settingsModal?: SettingsModalComponent;
  @ViewChild(AboutModalComponent) aboutModal?: AboutModalComponent;
  
  isMenuOpen = signal(false);
  currentChannel = this.queueService.currentChannel;
  
  channels: ChannelConfig[] = [
    { id: Channel.ROCK, name: 'Rock', icon: '🎸', searchQuery: 'rock music' },
    { id: Channel.HIP_HOP, name: 'Hip Hop / Rap', icon: '🎤', searchQuery: 'hip hop rap' },
    { id: Channel.DECADE_2000S, name: '2000s', icon: '💿', searchQuery: '2000s music' },
    { id: Channel.DECADE_1990S, name: '1990s', icon: '🎧', searchQuery: '1990s music' },
    { id: Channel.DECADE_1980S, name: '1980s', icon: '📻', searchQuery: '1980s music' },
    { id: Channel.LIVE, name: 'Live', icon: '🎬', searchQuery: 'live music' }
  ];

  toggleMenu(): void {
    this.isMenuOpen.update(v => !v);
  }

  async selectChannel(channel: Channel): Promise<void> {
    if (channel !== this.currentChannel()) {
      try {
        await this.queueService.switchChannel(channel);
      } catch (error) {
        console.error('Channel selector: Error switching channel:', error);
      }
    }
    this.isMenuOpen.set(false);
  }

  isActive(channel: Channel): boolean {
    return channel === this.currentChannel();
  }

  openSettings(): void {
    this.isMenuOpen.set(false);
    this.settingsModal?.open();
  }

  openAbout(): void {
    this.isMenuOpen.set(false);
    this.aboutModal?.open();
  }
}
