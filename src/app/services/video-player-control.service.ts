import { Injectable, signal } from '@angular/core';
import { Channel } from '../models/video.model';

@Injectable({
  providedIn: 'root'
})
export class VideoPlayerControlService {
  // Signal to track if video should be paused (e.g., when modal is open)
  shouldPause = signal(false);

  // Signal to track channel switch requests with static effect
  channelSwitchRequest = signal<{ channel: Channel; withEffect: boolean } | null>(null);

  pauseVideo(): void {
    this.shouldPause.set(true);
  }

  resumeVideo(): void {
    this.shouldPause.set(false);
  }

  requestChannelSwitch(channel: Channel, withEffect = true): void {
    this.channelSwitchRequest.set({ channel, withEffect });
  }

  clearChannelSwitchRequest(): void {
    this.channelSwitchRequest.set(null);
  }
}
