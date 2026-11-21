import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { SupportersService } from '../../services/supporters.service';

/** Seconds each name spends crossing the ticker; the loop gets longer as the list grows */
export const SECONDS_PER_NAME = 3;

/**
 * Scrolling "thank you" strip with every supporter's name, placed next to the coffee corner.
 * Names are rendered twice so the scroll loops without a gap.
 */
@Component({
  selector: 'app-supporters-ticker',
  standalone: true,
  templateUrl: './supporters-ticker.component.html',
  styleUrls: ['./supporters-ticker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.tv]': 'tv()'
  }
})
export class SupportersTickerComponent {
  private supportersService = inject(SupportersService);

  /** TV layout: sits next to the QR code instead of the triangle */
  readonly tv = input(false);

  readonly names = computed(() => this.supportersService.supporters().map(s => s.name));

  /** Total loop time in seconds (at least 12s, so a short list doesn't race by) */
  readonly durationSeconds = computed(() => Math.max(12, this.names().length * SECONDS_PER_NAME));

  /** Everything the ticker says, for screen readers (the moving copy is hidden from them) */
  readonly accessibleText = computed(() => `Thank you to our supporters: ${this.names().join(', ')}`);
}
