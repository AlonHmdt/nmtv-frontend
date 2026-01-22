import { Component, inject, signal, ViewChild, ChangeDetectionStrategy, output, computed, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { YoutubeService } from '../../services/youtube.service';
import { QueueService } from '../../services/queue.service';
import { EasterEggService } from '../../services/easter-egg.service';
import { VideoPlayerControlService } from '../../services/video-player-control.service';
import { Channel, Channels, getNavigationChannels } from '../../models/video.model';
import { SettingsModalComponent } from '../settings-modal/settings-modal.component';
import { AboutModalComponent } from '../about-modal/about-modal.component';
import { InstallModalComponent } from '../install-modal/install-modal.component';
import { SupportModalComponent } from '../support-modal/support-modal.component';
import { HelpersService } from '../../services/helpers.service';
import { PwaService } from '../../services/pwa.service';
import { CustomPlaylistService } from '../../services/custom-playlist.service';
import { ModalStateService } from '../../services/modal-state.service';
import { environment } from '../../../environments/environment';

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: Record<string, any>) => void;
    };
  }
}

@Component({
  selector: 'app-channel-selector',
  standalone: true,
  imports: [CommonModule, SettingsModalComponent, AboutModalComponent, InstallModalComponent, SupportModalComponent],
  templateUrl: './channel-selector.component.html',
  styleUrls: ['./channel-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChannelSelectorComponent implements OnInit, OnDestroy {
  private queueService = inject(QueueService);
  private helpersService = inject(HelpersService);
  private pwaService = inject(PwaService);
  public easterEggService = inject(EasterEggService);
  private videoPlayerControl = inject(VideoPlayerControlService);
  private customPlaylistService = inject(CustomPlaylistService);
  private modalState = inject(ModalStateService);
  private youtubeService = inject(YoutubeService); // Inject YoutubeService

  public isSpecialChannelEnabled = signal(false); // Change to signal

  @ViewChild(SettingsModalComponent) settingsModal?: SettingsModalComponent;
  @ViewChild(AboutModalComponent) aboutModal?: AboutModalComponent;
  @ViewChild(InstallModalComponent) installModal?: InstallModalComponent;
  @ViewChild(SupportModalComponent) supportModal?: SupportModalComponent;

  powerOff = output<void>();
  menuStateChange = output<boolean>(); // Emit menu open/close state

  // Use service signal for menu state
  isMenuOpen = this.videoPlayerControl.isMenuOpen;

  currentChannel = this.queueService.currentChannel;
  oldTVEnabled = this.queueService.oldTVEnabled;
  isFullscreen = signal(false);

  // Umami tracking helper
  private track(eventName: string, eventData?: Record<string, any>): void {
    if (typeof window !== 'undefined' && window.umami) {
      window.umami.track(eventName, eventData);
    }
  }

  // Filter channels - exclude easter egg channels and special channel (special has its own slot)
  channels = computed(() => {
    return getNavigationChannels(this.isSpecialChannelEnabled()).filter(ch => ch.id !== Channel.SPECIAL);
  });

  // Easter egg state for NOA channel
  isNoaChannelReady = this.easterEggService.isNoaChannelReady;
  isLoadingNoa = this.easterEggService.isLoadingNoa;

  // Focus management for arrow key navigation
  private focusableElements: HTMLElement[] = [];
  private currentFocusIndex = 0;

  // Flag video tracking
  private stereoClickCount = 0;
  private stereoClickTimeout: number | null = null;

  showInstallButton = computed(() => {
    // Show if we have an install prompt (Android/Desktop) OR if it's iOS/Mac/Android and not standalone
    return !!this.pwaService.installPrompt() ||
      ((this.pwaService.isIOS() || this.pwaService.isMac() || this.pwaService.isAndroid()) && !this.pwaService.isStandalone());
  });

  isAndroidTV(): boolean {
    return this.helpersService.isAndroidTV();
  }

  constructor() {
    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', () => {
      this.isFullscreen.set(!!document.fullscreenElement);
    });
    document.addEventListener('webkitfullscreenchange', () => {
      this.isFullscreen.set(!!(document as any).webkitFullscreenElement);
    });

    // Update focusable elements when special channel visibility changes
    effect(() => {
      // If menu is open, update focusable elements
      if (this.isMenuOpen()) {
        setTimeout(() => {
          this.updateFocusableElements();
        }, 100);
      }
    });

    // Handle menu open/close focus management
    effect(() => {
      const isOpen = this.isMenuOpen();
      // Emit state change for parent components
      this.menuStateChange.emit(isOpen);

      if (isOpen) {
        setTimeout(() => {
          this.updateFocusableElements();
          // Focus first element
          if (this.focusableElements.length > 0) {
            this.focusableElements[0]?.focus();
          }
        }, 100); // Small delay to ensure DOM is updated
      } else {
        // When menu closes, blur any focused element so arrow keys work for channel navigation
        if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    });
  }

  ngOnInit(): void {
    // Listen for Space key to toggle menu
    window.addEventListener('keydown', this.handleKeyPress.bind(this));
    this.checkSpecialEvent();
  }

  private checkSpecialEvent(): void {
    // Use the special event data already fetched by the home component
    // instead of making another backend request
    const specialEventData = this.youtubeService.specialEventData();
    if (specialEventData && specialEventData.enabled) {
      this.isSpecialChannelEnabled.set(true);
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.handleKeyPress.bind(this));
  }

  private handleKeyPress(event: KeyboardEvent): void {
    // Handle Android TV back button / Escape key
    if (event.key === 'Escape' || event.key === 'GoBack' || event.keyCode === 4) {
      // Don't handle if a modal is open - let the modal handle it
      if (this.modalState.isAnyModalOpen()) {
        return;
      }

      event.preventDefault();
      if (this.isMenuOpen()) {
        // Close menu if open
        this.toggleMenu();
      } else {
        // Power off the app if menu is closed and no modals are open
        this.turnOff();
      }
      return;
    }

    // Toggle menu with Space key (only if not in a modal or input field)
    if ((event.code === 'Space' || event.key === ' ' || event.keyCode === 32) && !this.isInInputField(event.target as HTMLElement)) {
      event.preventDefault();
      this.toggleMenu();
      return;
    }

    // Handle arrow keys and Enter when menu is open
    if (this.isMenuOpen()) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.focusDown();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.focusUp();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        this.focusRight();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.focusLeft();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        this.activateFocusedElement();
      }
    }
  }

  private isInInputField(element: HTMLElement): boolean {
    // Don't trigger Space toggle if user is typing in an input/textarea
    return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA';
  }

  private updateFocusableElements(): void {
    // Get all focusable elements in the menu (buttons, img, span with tabindex="0")
    const menuElement = document.querySelector('.side-menu');
    if (!menuElement) return;

    this.focusableElements = Array.from(
      menuElement.querySelectorAll('[tabindex="0"]')
    ) as HTMLElement[];
    this.currentFocusIndex = 0;
  }

  private getElementPosition(element: HTMLElement): { top: number; left: number; width: number; height: number } {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height
    };
  }

  private groupElementsIntoRows(): HTMLElement[][] {
    // Group elements into rows based on their vertical position
    const rows: HTMLElement[][] = [];
    const rowThreshold = 30; // Elements within 30px vertically are considered same row (increased for header elements)

    for (const element of this.focusableElements) {
      const pos = this.getElementPosition(element);

      // Find existing row with similar top position
      let foundRow = false;
      for (const row of rows) {
        const rowPos = this.getElementPosition(row[0]);
        if (Math.abs(pos.top - rowPos.top) < rowThreshold) {
          row.push(element);
          foundRow = true;
          break;
        }
      }

      // Create new row if not found
      if (!foundRow) {
        rows.push([element]);
      }
    }

    // Sort elements within each row by left position
    rows.forEach(row => {
      row.sort((a, b) => {
        const posA = this.getElementPosition(a);
        const posB = this.getElementPosition(b);
        return posA.left - posB.left;
      });
    });

    // Sort rows by top position
    rows.sort((a, b) => {
      const posA = this.getElementPosition(a[0]);
      const posB = this.getElementPosition(b[0]);
      return posA.top - posB.top;
    });

    return rows;
  }

  private findElementInRows(rows: HTMLElement[][], element: HTMLElement): { rowIndex: number; colIndex: number } | null {
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const colIndex = rows[rowIndex].indexOf(element);
      if (colIndex !== -1) {
        return { rowIndex, colIndex };
      }
    }
    return null;
  }

  private focusDown(): void {
    if (this.focusableElements.length === 0) return;

    const currentElement = this.focusableElements[this.currentFocusIndex];
    const rows = this.groupElementsIntoRows();
    const position = this.findElementInRows(rows, currentElement);

    if (!position) return;

    // Try to move to next row, same column
    if (position.rowIndex < rows.length - 1) {
      const nextRow = rows[position.rowIndex + 1];
      // Try same column, or closest column if row is shorter
      const targetCol = Math.min(position.colIndex, nextRow.length - 1);
      const targetElement = nextRow[targetCol];

      this.currentFocusIndex = this.focusableElements.indexOf(targetElement);
      this.focusableElements[this.currentFocusIndex]?.focus();
    }
  }

  private focusUp(): void {
    if (this.focusableElements.length === 0) return;

    const currentElement = this.focusableElements[this.currentFocusIndex];
    const rows = this.groupElementsIntoRows();
    const position = this.findElementInRows(rows, currentElement);

    if (!position) return;

    // Try to move to previous row, same column
    if (position.rowIndex > 0) {
      const prevRow = rows[position.rowIndex - 1];
      // Try same column, or closest column if row is shorter
      const targetCol = Math.min(position.colIndex, prevRow.length - 1);
      const targetElement = prevRow[targetCol];

      this.currentFocusIndex = this.focusableElements.indexOf(targetElement);
      this.focusableElements[this.currentFocusIndex]?.focus();
    }
  }

  private focusRight(): void {
    if (this.focusableElements.length === 0) return;

    const currentElement = this.focusableElements[this.currentFocusIndex];
    const rows = this.groupElementsIntoRows();
    const position = this.findElementInRows(rows, currentElement);

    if (!position) return;

    const currentRow = rows[position.rowIndex];

    // Move to next element in same row
    if (position.colIndex < currentRow.length - 1) {
      const targetElement = currentRow[position.colIndex + 1];
      this.currentFocusIndex = this.focusableElements.indexOf(targetElement);
      this.focusableElements[this.currentFocusIndex]?.focus();
    }
  }

  private focusLeft(): void {
    if (this.focusableElements.length === 0) return;

    const currentElement = this.focusableElements[this.currentFocusIndex];
    const rows = this.groupElementsIntoRows();
    const position = this.findElementInRows(rows, currentElement);

    if (!position) return;

    const currentRow = rows[position.rowIndex];

    // Move to previous element in same row
    if (position.colIndex > 0) {
      const targetElement = currentRow[position.colIndex - 1];
      this.currentFocusIndex = this.focusableElements.indexOf(targetElement);
      this.focusableElements[this.currentFocusIndex]?.focus();
    }
  }

  private activateFocusedElement(): void {
    if (this.focusableElements.length === 0) return;

    const focusedElement = this.focusableElements[this.currentFocusIndex];
    if (focusedElement) {
      focusedElement.click();
    }
  }

  shouldShowFullScreen(): boolean {
    return typeof document !== 'undefined' && !!(document.fullscreenEnabled || (document as any).webkitFullscreenEnabled);
  }

  toggleMenu(): void {
    this.videoPlayerControl.toggleMenu();
  }

  async selectChannel(channel: Channel): Promise<void> {
    // Prevent selecting NOA channel if it's not ready yet
    if (channel === Channel.NOA && !this.isNoaChannelReady()) {
      return;
    }

    if (channel !== this.currentChannel()) {
      // Track channel selection
      this.track('Channel Selected', { channel });

      // Request channel switch through service with static effect
      this.videoPlayerControl.requestChannelSwitch(channel, true);
    }
    this.videoPlayerControl.setMenuOpen(false);

    // Blur focused element so arrow keys work for channel navigation
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  isActive(channel: Channel): boolean {
    return channel === this.currentChannel();
  }

  openSettings(): void {
    this.track('Settings Opened');

    this.videoPlayerControl.setMenuOpen(false);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.settingsModal?.open();
  }

  openAbout(): void {
    this.track('About Opened');

    this.videoPlayerControl.setMenuOpen(false);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.aboutModal?.open();
  }

  turnOff(): void {
    this.track('Power Off');

    // On Android TV, close the app completely
    if (this.helpersService.isAndroidTV()) {
      // Call Android native method to close app
      if ((window as any).AndroidInterface && (window as any).AndroidInterface.closeApp) {
        (window as any).AndroidInterface.closeApp();
      }
      return;
    }

    // On web, just power off the TV effect
    this.videoPlayerControl.setMenuOpen(false);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
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
    const newValue = !this.queueService.oldTVEnabled();
    this.track('VCR Mode Toggled', { enabled: newValue });

    this.queueService.oldTVEnabled.update(v => !v);
    this.toggleMenu();
  }

  toggleFullscreen(): void {
    this.track('Fullscreen Toggled', { entering: !document.fullscreenElement });

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
    this.track('Support Opened', { platform: this.isAndroidTV() ? 'androidtv' : 'web' });

    if (this.isAndroidTV()) {
      this.supportModal?.open();
      return;
    } else {
      window.open('https://buymeacoffee.com/alonhmdt', '_blank');
    }
  }

  installApp(): void {
    let platform = 'unknown';
    if (this.pwaService.installPrompt()) platform = 'native';
    else if (this.pwaService.isIOS()) platform = 'ios';
    else if (this.pwaService.isMac()) platform = 'mac';
    else if (this.pwaService.isAndroid()) platform = 'android';

    this.track('Install App Clicked', { platform });

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
    const hasNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    this.track('Share App Clicked', { method: hasNativeShare ? 'native' : 'clipboard' });

    if (hasNativeShare) {
      try {
        await navigator.share({
          title: 'NMTV - Noa\'s Music Television',
          text: 'Check out NMTV! A retro music TV experience.',
          url: window.location.href
        });
      } catch (error) {
        // Silent error
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        await navigator.clipboard.writeText(window.location.href);
      } catch (err) {
        // Silent fail
      }
    }
  }

  onSpecialChannelClick(): void {
    this.track('Special Channel Clicked');
    this.selectChannel(Channel.SPECIAL);
  }

  onLogoClick(): void {
    this.track('Logo Clicked');

    // If easter egg is unlocked, clicking logo switches to NOA channel
    if (this.easterEggService.isUnlocked()) {
      this.selectChannel(Channel.NOA);
    } else {
      // Otherwise handle click for potential unlock
      this.easterEggService.handleLogoClick();
    }
  }

  // Flag video feature - click 5 times on "STEREO SOUND" text
  onStereoClick(): void {
    this.stereoClickCount++;

    // Reset timeout on each click
    if (this.stereoClickTimeout) {
      clearTimeout(this.stereoClickTimeout);
    }

    // Reset counter after 2 seconds of inactivity
    this.stereoClickTimeout = window.setTimeout(() => {
      this.resetStereoClickCount();
    }, 2000);

    // If 5 clicks reached, flag the video
    if (this.stereoClickCount >= 5) {
      this.track('Video Flagged', { videoId: this.queueService.currentVideo()?.id });
      this.flagCurrentVideo();
    }
  }

  private resetStereoClickCount(): void {
    this.stereoClickCount = 0;
    if (this.stereoClickTimeout) {
      clearTimeout(this.stereoClickTimeout);
      this.stereoClickTimeout = null;
    }
  }

  private async flagCurrentVideo(): Promise<void> {
    const video = this.queueService.currentVideo();
    const currentChannel = this.queueService.currentChannel();

    if (!video || video.isBumper) {
      this.resetStereoClickCount();
      return;
    }

    // Don't allow flagging videos from custom playlists (localStorage)
    if (video.playlistId) {
      const customPlaylistIds = this.customPlaylistService.getPlaylistIds(currentChannel);
      if (customPlaylistIds.includes(video.playlistId)) {
        this.resetStereoClickCount();
        return;
      }
    }

    try {
      const response = await fetch(`${environment.backendUrl}/videos/${video.id}/flag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Skip to next video
        await this.queueService.nextVideo();
      } else {
        // Still skip to next video even if backend fails
        await this.queueService.nextVideo();
      }
    } catch (error) {
      // Still skip to next video even if request fails
      await this.queueService.nextVideo();
    } finally {
      this.resetStereoClickCount();
    }
  }
}
