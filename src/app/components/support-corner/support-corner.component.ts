import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { HelpersService } from '../../services/helpers.service';
import { SupportersTickerComponent } from '../supporters-ticker/supporters-ticker.component';

/**
 * Small "Buy me a coffee" triangle pinned to the bottom-right corner.
 * On TVs (our app and TV browsers) it's a small QR code instead: the remote can't click
 * a link, but viewers can scan it with their phone.
 */
@Component({
  selector: 'app-support-corner',
  standalone: true,
  imports: [SupportersTickerComponent],
  templateUrl: './support-corner.component.html',
  styleUrls: ['./support-corner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupportCornerComponent {
  private helpersService = inject(HelpersService);

  readonly url = 'https://buymeacoffee.com/alonhmdt';
  readonly isTV = this.helpersService.isTV();

  onClick(): void {
    if (typeof window !== 'undefined' && window.umami) {
      window.umami.track('Support Opened', { platform: 'web', source: 'corner' });
    }
  }
}
