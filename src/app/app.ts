import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PwaService } from './services/pwa.service';
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

  ngOnInit(): void {
    // Initialize Vercel Analytics at app level
    injectAnalytics();
  }
}
