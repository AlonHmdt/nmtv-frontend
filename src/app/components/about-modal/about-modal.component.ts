import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-about-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about-modal.component.html',
  styleUrl: './about-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AboutModalComponent {
  isOpen = signal(false);
  
  // YouTube video ID for "The Very First Two Hours Of MTV"
  private videoId = 'PJtiPRDIqtI';
  videoUrl: SafeResourceUrl;

  constructor(private sanitizer: DomSanitizer) {
    this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${this.videoId}`
    );
  }

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }
}
