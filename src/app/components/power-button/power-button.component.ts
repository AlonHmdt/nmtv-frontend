import { Component, output, input, ChangeDetectionStrategy, ViewChild, ElementRef, signal, effect, untracked, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OldTVEffect } from '../video-player/tv-static-effect';
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
  private cdr = inject(ChangeDetectorRef);
  private helpersService = inject(HelpersService);
  @ViewChild('staticCanvas') staticCanvas?: ElementRef<HTMLCanvasElement>;

  private oldTVEffect: OldTVEffect | null = null;
  private effectTimeout: number | null = null;

  // Inputs/Outputs
  isLoading = input<boolean>(false);
  loadingProgress = input<number>(0); // 0-100 percentage
  isPoweredOn = input<boolean>(false);
  backendIsReady = input<boolean>(false);
  powerOn = output<void>();

  // Local state for animation
  isAnimating = signal(false);
  showLoadingContent = signal(false); // Start as false, will be set based on isLoading
  isFadingOut = signal(false);

  constructor() {
    // Reset animation state when powered off
    effect(() => {
      const poweredOn = this.isPoweredOn();

      if (!poweredOn) {
        untracked(() => {
          this.isAnimating.set(false);
          this.showLoadingContent.set(false);
          this.isFadingOut.set(false);
        });
        this.cleanup();
      }
    });

    // Handle loading state changes with fade-out
    effect(() => {
      const loading = this.isLoading();
      
      if (loading && !this.showLoadingContent()) {
        // Show loading content immediately when loading starts
        untracked(() => {
          this.showLoadingContent.set(true);
          this.isFadingOut.set(false);
        });
      } else if (!loading && this.showLoadingContent()) {
        // Start fade-out
        untracked(() => {
          this.isFadingOut.set(true);
        });
        
        // Hide content after fade-out completes
        setTimeout(() => {
          this.showLoadingContent.set(false);
          this.isFadingOut.set(false);
        }, 500); // Match CSS transition duration
      }
    });
  }

  ngOnInit(): void {
    // Listen for enter key press on desktop
    window.addEventListener('keydown', this.handleEnterKey);
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.handleEnterKey);
    this.helpersService.stopStaticSound();
    this.cleanup();
  }

  private cleanup(): void {
    if (this.oldTVEffect) {
      this.oldTVEffect.destroy();
      this.oldTVEffect = null;
    }
    if (this.effectTimeout) {
      clearTimeout(this.effectTimeout);
      this.effectTimeout = null;
    }
  }

  handleEnterKey = (event: KeyboardEvent) => {
    if (event.code === 'Enter' && !this.isLoading() && !this.isPoweredOn()) {
      this.onPowerClick();
    }
  };

  isAndroidTV(): boolean {
    return this.helpersService.isAndroidTV();
  }

  onPowerClick(): void {
    if (this.isLoading()) {
      return;
    }

    // Clean up any existing effect and timeouts
    this.cleanup();

    // Start animation immediately
    this.isAnimating.set(true);

    // Play static sound effect
    this.helpersService.playStaticSound();

    // Start the power-on sequence
    // Small delay to ensure canvas is rendered
    setTimeout(() => {
      if (this.staticCanvas) {
        // Always create a fresh effect for consistent behavior with channelSwitch mode
        this.oldTVEffect = new OldTVEffect(this.staticCanvas.nativeElement, 'channelSwitch');
        this.oldTVEffect.start();

        // Emit power on event immediately so video starts loading
        this.powerOn.emit();

        // Hide the screen after the effect completes
        this.effectTimeout = window.setTimeout(() => {
          if (this.oldTVEffect) {
            this.oldTVEffect.stop();
          }
          // Stop static sound when effect ends
          this.helpersService.stopStaticSound();
          this.isAnimating.set(false);
          this.cdr.markForCheck();
        }, 1500);
      }
    }, 50);
  }
}