import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class VideoPlayerControlService {
  // Signal to track if video should be paused (e.g., when modal is open)
  shouldPause = signal(false);

  pauseVideo(): void {
    this.shouldPause.set(true);
  }

  resumeVideo(): void {
    this.shouldPause.set(false);
  }
}
