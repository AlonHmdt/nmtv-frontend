import { Component, signal, output, input, ChangeDetectionStrategy, effect, inject, ViewChild, ElementRef, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HelpersService } from '../../services/helpers.service';
import { OldTVEffect } from '../video-player/tv-static-effect';

@Component({
  selector: 'app-power-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './power-button.component.html',
  styleUrls: ['./power-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PowerButtonComponent {
  @ViewChild('staticCanvas') staticCanvas?: ElementRef<HTMLCanvasElement>;

  deferredPrompt: any = null;
  showInstallButton = signal(false);
  helpersService = inject(HelpersService);
  private oldTVEffect: OldTVEffect | null = null;

  // Inputs/Outputs
  isLoading = input<boolean>(false);
  isPoweredOn = input<boolean>(false);
  powerOn = output<void>();

  // State
  isAnimating = signal(false);
  readyToHide = signal(false);

  constructor() {
    // Reset state when powered off
    effect(() => {
      const poweredOn = this.isPoweredOn();

      if (!poweredOn) {
        // Use untracked to avoid triggering this effect when we set these signals
        untracked(() => {
          this.isAnimating.set(false);
          this.readyToHide.set(false);
        });

        // Clean up old TV effect
        if (this.oldTVEffect) {
          this.oldTVEffect.destroy();
          this.oldTVEffect = null;
        }
      }
    });
  }

  ngOnInit(): void {
    // Listen for spacebar press on desktop
    window.addEventListener('keydown', this.handleSpacebar);
    window.addEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt);
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.handleSpacebar);
    window.removeEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt);

    if (this.oldTVEffect) {
      this.oldTVEffect.destroy();
      this.oldTVEffect = null;
    }
  }

  handleSpacebar = (event: KeyboardEvent) => {
    if (event.code === 'Space' && !this.isLoading() && !this.isPoweredOn()) {
      this.onPowerClick();
    }
  };

  onPowerClick(): void {
    if (this.isLoading()) return;

    this.isAnimating.set(true);
    this.readyToHide.set(false);

    // Initialize and start static effect
    setTimeout(() => {
      if (this.staticCanvas && !this.oldTVEffect) {
        this.oldTVEffect = new OldTVEffect(this.staticCanvas.nativeElement);
        this.oldTVEffect.start();
      } else if (this.oldTVEffect) {
        this.oldTVEffect.start();
      }
    }, 50);

    // Start video loading immediately
    this.powerOn.emit();

    // Hide screen after static effect completes
    setTimeout(() => {
      if (this.oldTVEffect) {
        this.oldTVEffect.stop();
      }
      this.readyToHide.set(true);
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