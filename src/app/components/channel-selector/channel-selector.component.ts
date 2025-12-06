import { Component, inject, signal, ViewChild, ChangeDetectionStrategy, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueueService } from '../../services/queue.service';
import { Channel, ChannelConfig, Channels } from '../../models/video.model';
import { SettingsModalComponent } from '../settings-modal/settings-modal.component';
import { AboutModalComponent } from '../about-modal/about-modal.component';
import { InstallModalComponent } from '../install-modal/install-modal.component';
import { HelpersService } from '../../services/helpers.service';
import { PwaService } from '../../services/pwa.service';

@Component({
  selector: 'app-channel-selector',
  standalone: true,
  imports: [CommonModule, SettingsModalComponent, AboutModalComponent, InstallModalComponent],
  templateUrl: './channel-selector.component.html',
  styleUrls: ['./channel-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChannelSelectorComponent {
  private queueService = inject(QueueService);
  private helpersService = inject(HelpersService);
  private pwaService = inject(PwaService);

  @ViewChild(SettingsModalComponent) settingsModal?: SettingsModalComponent;
  @ViewChild(AboutModalComponent) aboutModal?: AboutModalComponent;
  @ViewChild(InstallModalComponent) installModal?: InstallModalComponent;

  powerOff = output<void>();

  isMenuOpen = signal(false);
  currentChannel = this.queueService.currentChannel;
  oldTVEnabled = this.queueService.oldTVEnabled;
  isFullscreen = signal(false);
  channels: ChannelConfig[] = Channels;

  showInstallButton = computed(() => {
    // Show if we have an install prompt (Android/Desktop) OR if it's iOS/Mac/Android and not standalone
    return !!this.pwaService.installPrompt() ||
      ((this.pwaService.isIOS() || this.pwaService.isMac() || this.pwaService.isAndroid()) && !this.pwaService.isStandalone());
  });

  constructor() {
    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', () => {
      this.isFullscreen.set(!!document.fullscreenElement);
    });
    document.addEventListener('webkitfullscreenchange', () => {
      this.isFullscreen.set(!!(document as any).webkitFullscreenElement);
    });
  }

  shouldShowFullScreen(): boolean {
    return typeof document !== 'undefined' && !!(document.fullscreenEnabled || (document as any).webkitFullscreenEnabled);
  }

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

  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      // Enter fullscreen
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) { /* Safari */
        (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).msRequestFullscreen) { /* IE11 */
        (elem as any).msRequestFullscreen();
      }
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) { /* Safari */
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) { /* IE11 */
        (document as any).msExitFullscreen();
      }
    }
  }

  openSupport(): void {
    window.open('https://buymeacoffee.com/alonhmdt', '_blank');
  }

  installApp(): void {
    if (this.pwaService.installPrompt()) {
      this.pwaService.promptInstall();
    } else if (this.pwaService.isIOS()) {
      this.installModal?.open('ios');
    } else if (this.pwaService.isMac()) {
      this.installModal?.open('mac');
    } else if (this.pwaService.isAndroid()) {
      this.installModal?.open('android');
    }
  }

  async shareApp(): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'NMTV - Noa\'s Music Television',
          text: 'Check out NMTV! A retro music TV experience.',
          url: window.location.href
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        // Optional: Show a toast or alert, but for now just log
        console.log('URL copied to clipboard');
      } catch (err) {
        console.error('Failed to copy URL:', err);
      }
    }
  }
}
