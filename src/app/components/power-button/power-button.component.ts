import { Component, signal, output, ChangeDetectionStrategy } from '@angular/core';
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
  powerOn = output<void>();
  isAnimating = signal(false);

  onPowerClick(): void {
    this.isAnimating.set(true);
    
    // Wait for animation to complete before emitting
    setTimeout(() => {
      this.powerOn.emit();
    }, 1500);
  }
}
