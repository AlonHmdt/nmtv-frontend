import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { PwaService } from './services/pwa.service';
import { HelpersService } from './services/helpers.service';

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
    // Add Android TV specific class for CSS optimizations
    if (this.helpersService.isAndroidTV()) {
      this.document.body.classList.add('android-tv-mode');
    }
  }
}
