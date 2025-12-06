import { Component, output, input, ChangeDetectionStrategy, ViewChild, ElementRef, signal, effect, untracked, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  private cdr = inject(ChangeDetectorRef);
  @ViewChild('staticCanvas') staticCanvas?: ElementRef<HTMLCanvasElement>;

  private oldTVEffect: OldTVEffect | null = null;
  private effectTimeout: number | null = null;

  // Inputs/Outputs
  isLoading = input<boolean>(false);
  isPoweredOn = input<boolean>(false);
  powerOn = output<void>();

  // Local state for animation
  isAnimating = signal(false);

  constructor() {
    // Reset animation state when powered off
    effect(() => {
      const poweredOn = this.isPoweredOn();

      if (!poweredOn) {
        untracked(() => {
          this.isAnimating.set(false);
        });
        this.cleanup();
      }
    });
  }

  ngOnInit(): void {
    // Listen for spacebar press on desktop
    window.addEventListener('keydown', this.handleSpacebar);
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.handleSpacebar);
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

  handleSpacebar = (event: KeyboardEvent) => {
    if (event.code === 'Space' && !this.isLoading() && !this.isPoweredOn()) {
      this.onPowerClick();
    }
  };

  onPowerClick(): void {
    if (this.isLoading()) {
      return;
    }

    // Clean up any existing effect and timeouts
    this.cleanup();

    // Start animation immediately
    this.isAnimating.set(true);

    // Start the power-on sequence
    // Small delay to ensure canvas is rendered
    setTimeout(() => {
      if (this.staticCanvas) {
        // Always create a fresh effect for consistent behavior
        this.oldTVEffect = new OldTVEffect(this.staticCanvas.nativeElement);
        this.oldTVEffect.start();

        // Emit power on event immediately so video starts loading
        this.powerOn.emit();

        // Hide the screen after the effect completes
        this.effectTimeout = window.setTimeout(() => {
          if (this.oldTVEffect) {
            this.oldTVEffect.stop();
          }
          this.isAnimating.set(false);
          this.cdr.markForCheck();
        }, 1500);
      }
    }, 50);
  }
}