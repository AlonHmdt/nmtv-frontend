import { Component, signal, output, input, ChangeDetectionStrategy, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HelpersService } from '../../services/helpers.service';

@Component({
  selector: 'app-power-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './power-button.component.html',
  styleUrls: ['./power-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PowerButtonComponent {
  deferredPrompt: any = null;
  showInstallButton = signal(false);
  helpersService = inject(HelpersService);

  ngOnInit(): void {
    // Listen for spacebar press on desktop
    window.addEventListener('keydown', this.handleSpacebar);
    window.addEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt);
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.handleSpacebar);
    window.removeEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt);
  }

  handleSpacebar = (event: KeyboardEvent) => {
    if (event.code === 'Space' && !this.isLoading() && !this.isPoweredOn()) {
      this.onPowerClick();
    }
  };
  isLoading = input<boolean>(false);
  isPoweredOn = input<boolean>(false);
  powerOn = output<void>();
  isAnimating = signal(false);

  constructor() {
    // Reset animation state when powered off
    effect(() => {
      if (!this.isPoweredOn()) {
        this.isAnimating.set(false);
      }
    });
  }

  onPowerClick(): void {
    if (this.isLoading()) return; // Don't allow click while loading

    this.isAnimating.set(true);

    // Wait for animation to complete before emitting
    setTimeout(() => {
      this.powerOn.emit();
    }, 1500);
  }

  handleBeforeInstallPrompt = (event: Event) => {
    event.preventDefault();
    this.deferredPrompt = event;
    if (!this.helpersService.isIOSDevice() && this.helpersService.isMobileResolution()) {
      this.showInstallButton.set(true);
    }
  };

  onInstallClick(): void {
    if (this.deferredPrompt) {
      (this.deferredPrompt as any).prompt();
      (this.deferredPrompt as any).userChoice.then((choiceResult: any) => {
        this.deferredPrompt = null;
        this.showInstallButton.set(false);
      });
    }
  }
}