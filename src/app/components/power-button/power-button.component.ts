import { Component, signal, output, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-power-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './power-button.component.html',
  styleUrls: ['./power-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PowerButtonComponent {
  isLoading = input<boolean>(false);
  powerOn = output<void>();
  isAnimating = signal(false);

  onPowerClick(): void {
    if (this.isLoading()) return; // Don't allow click while loading
    
    this.isAnimating.set(true);
    
    // Wait for animation to complete before emitting
    setTimeout(() => {
      this.powerOn.emit();
    }, 1500);
  }
}
