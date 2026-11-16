import { Location } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';
import { Channel } from '../models/video.model';
import { ShareLink, buildShareLink, parseShareLink } from '../utils/share-link.utils';
import { QueueService } from './queue.service';
import { YoutubeService } from './youtube.service';

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';
export type ShareSource = 'menu' | 'corner';

/**
 * Handles shareable links in both directions:
 * reading the link a visitor arrived with, and building/sharing a link to what is playing now.
 */
@Injectable({ providedIn: 'root' })
export class ShareLinkService {
  private queueService = inject(QueueService);
  private youtubeService = inject(YoutubeService);
  private location = inject(Location);

  /** The link the visitor arrived with */
  readonly landing = signal<ShareLink>({ channel: null, videoId: null });

  /** The channel the visit actually started on (null until startup has picked one) */
  private readonly landedChannel = signal<Channel | null>(null);

  // Tracking for putting the address bar back to "/" once the link is no longer what is on screen
  private urlReset = false;
  private landedChannelSeen = false;
  private sharedClipSeen = false;

  constructor() {
    // The link describes one channel and (optionally) one clip. As soon as the viewer
    // changes channel, or the shared clip is over, the address bar goes back to "/".
    effect(() => {
      const landing = this.landing();
      const landedChannel = this.landedChannel();
      const channel = this.queueService.currentChannel();
      const video = this.queueService.currentVideo();

      if (this.urlReset || landedChannel === null || (!landing.channel && !landing.videoId)) {
        return;
      }

      if (channel === landedChannel) {
        this.landedChannelSeen = true;
      } else if (this.landedChannelSeen) {
        this.resetUrl();
        return;
      }

      if (landing.videoId) {
        if (video?.id === landing.videoId) {
          this.sharedClipSeen = true;
        } else if (this.sharedClipSeen) {
          this.resetUrl();
        }
      }
    });
  }

  private resetUrl(): void {
    this.urlReset = true;
    this.location.replaceState('/');
  }

  /** True from landing on a shared clip until the TV is powered on */
  readonly sharedClipPending = signal(false);

  /** Reads the channel and shared clip from the page URL. Call once on startup. */
  readLanding(location: { pathname: string; search: string } = window.location): ShareLink {
    const link = parseShareLink(location.pathname, location.search);
    this.urlReset = false;
    this.landedChannelSeen = false;
    this.sharedClipSeen = false;
    this.landedChannel.set(null);
    this.landing.set(link);
    this.sharedClipPending.set(link.videoId !== null);
    return link;
  }

  /**
   * The channel to start on: the one in the link when it can be opened,
   * otherwise the fallback (the viewer's last channel).
   * The result is remembered, so the address bar can be reset when the viewer leaves that channel.
   */
  resolveLandingChannel(fallback: Channel): Channel {
    const linkChannel = this.landing().channel;
    const specialUnavailable =
      linkChannel === Channel.SPECIAL && !this.youtubeService.specialEventData()?.enabled;
    const channel = linkChannel && !specialUnavailable ? linkChannel : fallback;

    this.landedChannel.set(channel);
    return channel;
  }

  /** Call when the TV is powered on: the shared clip is no longer waiting. */
  markSharedClipOpened(): void {
    this.sharedClipPending.set(false);
  }

  /** Link to the current channel and the clip playing on it (bumpers are left out) */
  getShareUrl(origin: string = window.location.origin): string {
    const video = this.queueService.currentVideo();
    const videoId = video && !video.isBumper ? video.id : null;
    return buildShareLink(origin, this.queueService.currentChannel(), videoId);
  }

  /**
   * Opens the device share sheet when there is one, otherwise copies the link.
   * Reports a "Share App Clicked" analytics event with what was shared and how it went.
   *
   * @param source - Which button was used: the channel menu or the corner triangle
   */
  async share(source: ShareSource = 'menu'): Promise<ShareResult> {
    const url = this.getShareUrl();
    const method = this.hasNativeShare() ? 'native' : 'clipboard';
    const result = method === 'native' ? await this.shareNative(url) : await this.copyLink(url);

    this.trackShare(source, method, result);
    return result;
  }

  /** Analytics details for a share: where from, which channel and clip, and the outcome */
  getShareEventData(source: ShareSource, method: 'native' | 'clipboard', result: ShareResult): Record<string, string | boolean> {
    const video = this.queueService.currentVideo();
    const clip = video && !video.isBumper ? video : null;
    const clipName = clip
      ? (clip.artist && clip.song ? `${clip.artist} - ${clip.song}` : clip.title || '')
      : '';

    return {
      source,
      method,
      result,
      channel: this.queueService.currentChannel(),
      has_clip: !!clip,
      video_id: clip?.id ?? '',
      clip: clipName.slice(0, 200),
      shared_clip: !!clip?.isShared
    };
  }

  private trackShare(source: ShareSource, method: 'native' | 'clipboard', result: ShareResult): void {
    if (typeof window !== 'undefined' && window.umami) {
      window.umami.track('Share App Clicked', this.getShareEventData(source, method, result));
    }
  }

  private async shareNative(url: string): Promise<ShareResult> {
    try {
      await navigator.share({
        title: 'NMTV - Noa\'s Music Television',
        text: 'Watch this on NMTV 📺',
        url
      });
      return 'shared';
    } catch (error) {
      return (error as any)?.name === 'AbortError' ? 'cancelled' : 'failed';
    }
  }

  private async copyLink(url: string): Promise<ShareResult> {
    try {
      await navigator.clipboard.writeText(url);
      return 'copied';
    } catch (error) {
      return 'failed';
    }
  }

  hasNativeShare(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  }
}
