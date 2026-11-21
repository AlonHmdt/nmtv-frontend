import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { PwaService } from './services/pwa.service';
import { HelpersService } from './services/helpers.service';
import { inject as injectAnalytics } from '@vercel/analytics';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App implements OnInit {
  private pwaService = inject(PwaService); // Initialize PWA service early to catch install prompt
  private helpersService = inject(HelpersService);
  private document = inject(DOCUMENT);

  ngOnInit(): void {
    // Initialize Vercel Analytics at app level
    injectAnalytics();

    // Lighter rendering for TVs (the app and TV browsers both run on weak hardware)
    if (this.helpersService.isTV()) {
      this.document.body.classList.add('android-tv-mode');
    }

    this.trackTvVisit();
  }

  /**
   * Reports one "TV Visit" event per page load for TVs, so Umami can tell TV visitors
   * apart from phones and desktops (its browser report can't).
   * source: 'app' = our Android TV APK, 'browser' = the TV's built-in browser.
   */
  private trackTvVisit(): void {
    const isApp = this.helpersService.isAndroidTV();
    const platform = isApp ? 'androidtv' : this.helpersService.getTvPlatform();
    if (!platform) return;

    const eventData = { platform, source: isApp ? 'app' : 'browser' };

    // The Umami script loads with `defer` and may not be ready yet; retry for a few seconds
    let attemptsLeft = 10;
    const send = (): void => {
      if (window.umami) {
        window.umami.track('TV Visit', eventData);
      } else if (--attemptsLeft > 0) {
        setTimeout(send, 500);
      }
    };
    send();
  }
}
