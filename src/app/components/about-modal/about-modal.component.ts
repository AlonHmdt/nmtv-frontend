import { Component, signal, ChangeDetectionStrategy, inject, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { VideoPlayerControlService } from '../../services/video-player-control.service';

declare var YT: any;

@Component({
  selector: 'app-about-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about-modal.component.html',
  styleUrl: './about-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AboutModalComponent implements OnDestroy {
  private videoPlayerControl = inject(VideoPlayerControlService);

  isOpen = signal(false);

  // YouTube video ID for "The Very First Two Hours Of MTV"
  private videoId = 'PJtiPRDIqtI';
  videoUrl: SafeResourceUrl;
  private iframePlayer: any = null;
  private playerCheckInterval: any = null;

  constructor(private sanitizer: DomSanitizer) {
    // Enable YouTube iframe API
    this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${this.videoId}?enablejsapi=1`
    );

    // Watch for modal close to clean up
    effect(() => {
      if (!this.isOpen()) {
        this.destroyIframePlayer();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroyIframePlayer();
  }

  open(): void {
    this.isOpen.set(true);
    // Initialize iframe player after modal opens
    setTimeout(() => {
      this.initIframePlayer();
    }, 500); // Wait for iframe to be in DOM
  }

  close(): void {
    this.isOpen.set(false);
    this.videoPlayerControl.resumeVideo();
  }

  private initIframePlayer(): void {
    // Check if YT API is loaded
    if (typeof YT === 'undefined' || !YT.Player) {
      console.warn('YouTube API not loaded yet, will retry...');
      // Retry after a short delay
      setTimeout(() => this.initIframePlayer(), 500);
      return;
    }

    const iframe = document.getElementById('about-modal-video');
    if (!iframe) {
      console.warn('Iframe not found');
      return;
    }

    try {
      this.iframePlayer = new YT.Player('about-modal-video', {
        events: {
          onStateChange: (event: any) => this.onIframePlayerStateChange(event)
        }
      });
    } catch (error) {
      console.error('Error initializing iframe player:', error);
    }
  }

  private onIframePlayerStateChange(event: any): void {
    // YT.PlayerState.PLAYING = 1
    // YT.PlayerState.PAUSED = 2
    // YT.PlayerState.ENDED = 0

    if (event.data === 1) { // Playing
      this.videoPlayerControl.pauseVideo();
    } else if (event.data === 2 || event.data === 0) { // Paused or Ended
      this.videoPlayerControl.resumeVideo();
    }
  }

  private destroyIframePlayer(): void {
    if (this.iframePlayer) {
      try {
        this.iframePlayer.destroy();
      } catch (error) {
        console.error('Error destroying iframe player:', error);
      }
      this.iframePlayer = null;
    }
    if (this.playerCheckInterval) {
      clearInterval(this.playerCheckInterval);
      this.playerCheckInterval = null;
    }
  }
}
