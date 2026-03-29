import { Component, signal, ChangeDetectionStrategy, inject, OnDestroy, OnInit, effect, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { VideoPlayerControlService } from '../../services/video-player-control.service';
import { ModalStateService } from '../../services/modal-state.service';

declare var YT: any;

@Component({
  selector: 'app-about-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about-modal.component.html',
  styleUrl: './about-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AboutModalComponent implements OnInit, OnDestroy {
  private videoPlayerControl = inject(VideoPlayerControlService);
  private modalState = inject(ModalStateService);

  @ViewChild('modalBody') modalBody?: ElementRef<HTMLDivElement>;

  isOpen = signal(false);

  // YouTube video ID for "The Very First Two Hours Of MTV"
  private videoId = 'PJtiPRDIqtI';
  videoUrl: SafeResourceUrl;
  private iframePlayer: any = null;
  private playerCheckInterval: any = null;

  constructor(private sanitizer: DomSanitizer) {
    // Enable YouTube iframe API with iOS-compatible parameters
    this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${this.videoId}?enablejsapi=1&playsinline=1&rel=0&modestbranding=1`
    );

    // Watch for modal close to clean up
    effect(() => {
      if (!this.isOpen()) {
        this.destroyIframePlayer();
      }
    });
  }

  ngOnInit(): void {
    // Lifecycle method for cleanup
  }

  ngOnDestroy(): void {
    this.destroyIframePlayer();
    window.removeEventListener('keydown', this.handleEscapeKey);
    window.removeEventListener('keydown', this.handleArrowKeys);
  }

  open(): void {
    this.isOpen.set(true);
    // Initialize iframe player after modal opens (skip on iOS)
    if (!this.isIOS()) {
      setTimeout(() => {
        this.initIframePlayer();
      }, 500); // Wait for iframe to be in DOM
    } else {
      // On iOS, just pause the main video without trying to control the iframe
      this.videoPlayerControl.pauseVideo();
    }
    // Notify global modal state
    this.modalState.openModal();
    // Add event listeners when modal opens
    window.addEventListener('keydown', this.handleEscapeKey);
    window.addEventListener('keydown', this.handleArrowKeys);
  }

  close(): void {
    this.isOpen.set(false);
    this.videoPlayerControl.resumeVideo();
    // Notify global modal state
    this.modalState.closeModal();
    // Remove event listeners when modal closes
    window.removeEventListener('keydown', this.handleEscapeKey);
    window.removeEventListener('keydown', this.handleArrowKeys);
  }

  private isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  private handleEscapeKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.isOpen()) {
      event.preventDefault();
      this.close();
    }
  };

  private handleArrowKeys = (event: KeyboardEvent): void => {
    // Handle arrow key scrolling manually when modal is open
    if (this.isOpen() && this.modalBody) {
      const scrollAmount = 40; // Pixels to scroll per key press
      
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        this.modalBody.nativeElement.scrollTop -= scrollAmount;
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        this.modalBody.nativeElement.scrollTop += scrollAmount;
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        // Stop propagation but don't prevent default for left/right
        event.stopPropagation();
      }
    }
  };

  private initIframePlayer(): void {
    // Check if YT API is loaded
    if (typeof YT === 'undefined' || !YT.Player) {
      // Retry after a short delay
      setTimeout(() => this.initIframePlayer(), 500);
      return;
    }

    const iframe = document.getElementById('about-modal-video');
    if (!iframe) {
      return;
    }

    try {
      this.iframePlayer = new YT.Player('about-modal-video', {
        events: {
          onStateChange: (event: any) => this.onIframePlayerStateChange(event)
        }
      });
    } catch (error) {
      // Silent fail
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
        // Silent fail
      }
      this.iframePlayer = null;
    }
    if (this.playerCheckInterval) {
      clearInterval(this.playerCheckInterval);
      this.playerCheckInterval = null;
    }
  }
}
