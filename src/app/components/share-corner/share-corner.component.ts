import { Component, inject, signal, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { HelpersService } from '../../services/helpers.service';
import { ShareLinkService } from '../../services/share-link.service';

/**
 * Small "Share" triangle pinned to the bottom-left corner, mirroring the
 * "Buy me a coffee" triangle on the right. Shares a link to the current channel and clip.
 * Hidden on Android TV (nothing to share to, and the remote can't easily reach it).
 */
@Component({
  selector: 'app-share-corner',
  standalone: true,
  templateUrl: './share-corner.component.html',
  styleUrls: ['./share-corner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShareCornerComponent implements OnDestroy {
  private helpersService = inject(HelpersService);
  private shareLinkService = inject(ShareLinkService);

  readonly visible = !this.helpersService.isAndroidTV();

  // Briefly true after the link was copied, so the corner can confirm it
  readonly copied = signal(false);
  private copiedTimeout: number | null = null;

  async onClick(): Promise<void> {
    // The service reports the analytics event, including the outcome
    const result = await this.shareLinkService.share('corner');

    if (result === 'copied') {
      this.copied.set(true);
      this.clearCopiedTimeout();
      this.copiedTimeout = window.setTimeout(() => this.copied.set(false), 2000);
    }
  }

  ngOnDestroy(): void {
    this.clearCopiedTimeout();
  }

  private clearCopiedTimeout(): void {
    if (this.copiedTimeout !== null) {
      clearTimeout(this.copiedTimeout);
      this.copiedTimeout = null;
    }
  }
}
