import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { HelpersService } from '../../services/helpers.service';

/**
 * Small "Buy me a coffee" triangle pinned to the bottom-right corner.
 * Hidden on Android TV (no browser to open the link, and the remote can't easily reach it).
 */
@Component({
  selector: 'app-support-corner',
  standalone: true,
  templateUrl: './support-corner.component.html',
  styleUrls: ['./support-corner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupportCornerComponent {
  private helpersService = inject(HelpersService);

  readonly url = 'https://buymeacoffee.com/alonhmdt';
  readonly visible = !this.helpersService.isAndroidTV();

  onClick(): void {
    if (typeof window !== 'undefined' && window.umami) {
      window.umami.track('Support Opened', { platform: 'web', source: 'corner' });
    }
  }
}
