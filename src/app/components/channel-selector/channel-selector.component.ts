import { Component, inject, signal, ViewChild, ChangeDetectionStrategy, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueueService } from '../../services/queue.service';
import { Channel, ChannelConfig, Channels } from '../../models/video.model';
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
  
  powerOff = output<void>();
  
  isMenuOpen = signal(false);
  currentChannel = this.queueService.currentChannel;
  oldTVEnabled = this.queueService.oldTVEnabled;
  
  channels: ChannelConfig[] = Channels;
  
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

  turnOff(): void {
    this.isMenuOpen.set(false);
    // Exit fullscreen if active
    if (document.fullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) { /* Safari */
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) { /* IE11 */
        (document as any).msExitFullscreen();
      }
    }
    this.powerOff.emit();
  }

  toggleOldTV(): void {
    this.queueService.oldTVEnabled.update(v => !v);
  }
}
