import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HelpersService } from '../../services/helpers.service';
import { SupportModalComponent } from '../support-modal/support-modal.component';
import { ViewChild } from '@angular/core';

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: Record<string, any>) => void;
    };
  }
}

@Component({
  selector: 'app-support-button',
  standalone: true,
  imports: [CommonModule, SupportModalComponent],
  templateUrl: './support-button.component.html',
  styleUrls: ['./support-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupportButtonComponent {
  private helpersService = inject(HelpersService);

  @ViewChild(SupportModalComponent) supportModal?: SupportModalComponent;

  // Umami tracking helper
  private track(eventName: string, eventData?: Record<string, any>): void {
    if (typeof window !== 'undefined' && window.umami) {
      window.umami.track(eventName, eventData);
    }
  }

  isAndroidTV(): boolean {
    return this.helpersService.isAndroidTV();
  }

  openSupport(): void {
    this.track('Support Opened', { platform: this.isAndroidTV() ? 'androidtv' : 'web' });

    if (this.isAndroidTV()) {
      this.supportModal?.open();
      return;
    } else {
      window.open('https://buymeacoffee.com/alonhmdt', '_blank');
    }
  }
}
