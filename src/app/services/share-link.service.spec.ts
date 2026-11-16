import { Location } from '@angular/common';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Channel, VideoItem } from '../models/video.model';
import { QueueService } from './queue.service';
import { ShareLinkService } from './share-link.service';
import { YoutubeService } from './youtube.service';

describe('ShareLinkService', () => {
  const VIDEO_ID = 'hTWKbfoikeg';
  const origin = 'https://nmtv.online';

  let service: ShareLinkService;
  let currentVideo: ReturnType<typeof signal<VideoItem | undefined>>;
  let currentChannel: ReturnType<typeof signal<Channel>>;
  let specialEventData: ReturnType<typeof signal<any>>;
  let replaceState: jasmine.Spy;

  beforeEach(() => {
    replaceState = jasmine.createSpy('replaceState');
    currentVideo = signal<VideoItem | undefined>({ id: VIDEO_ID, artist: 'Nirvana', song: 'Come As You Are' });
    currentChannel = signal<Channel>(Channel.ROCK);
    specialEventData = signal<any>(null);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: QueueService, useValue: { currentVideo, currentChannel } },
        { provide: YoutubeService, useValue: { specialEventData } },
        { provide: Location, useValue: { replaceState } }
      ]
    });
    service = TestBed.inject(ShareLinkService);
  });

  describe('readLanding', () => {
    it('reads a shared clip link and marks the clip as waiting', () => {
      const link = service.readLanding({ pathname: '/rock', search: `?v=${VIDEO_ID}` });

      expect(link).toEqual({ channel: Channel.ROCK, videoId: VIDEO_ID });
      expect(service.landing()).toEqual({ channel: Channel.ROCK, videoId: VIDEO_ID });
      expect(service.sharedClipPending()).toBeTrue();
    });

    it('reads a channel-only link without a waiting clip', () => {
      service.readLanding({ pathname: '/1980s', search: '' });

      expect(service.landing()).toEqual({ channel: Channel.DECADE_1980S, videoId: null });
      expect(service.sharedClipPending()).toBeFalse();
    });

    it('finds nothing on the plain home page', () => {
      service.readLanding({ pathname: '/', search: '' });

      expect(service.landing()).toEqual({ channel: null, videoId: null });
      expect(service.sharedClipPending()).toBeFalse();
    });

    it('stops waiting once the TV is powered on', () => {
      service.readLanding({ pathname: '/rock', search: `?v=${VIDEO_ID}` });

      service.markSharedClipOpened();

      expect(service.sharedClipPending()).toBeFalse();
    });
  });

  describe('resolveLandingChannel', () => {
    it('prefers the channel in the link over the fallback', () => {
      service.readLanding({ pathname: '/rock', search: '' });
      expect(service.resolveLandingChannel(Channel.DECADE_1990S)).toBe(Channel.ROCK);
    });

    it('uses the fallback when the link has no channel', () => {
      service.readLanding({ pathname: '/', search: `?v=${VIDEO_ID}` });
      expect(service.resolveLandingChannel(Channel.DECADE_1990S)).toBe(Channel.DECADE_1990S);
    });

    it('opens the special channel only while an event is running', () => {
      service.readLanding({ pathname: '/special', search: '' });
      expect(service.resolveLandingChannel(Channel.DECADE_1990S)).toBe(Channel.DECADE_1990S);

      specialEventData.set({ enabled: true, label: 'Hall of Fame' });
      expect(service.resolveLandingChannel(Channel.DECADE_1990S)).toBe(Channel.SPECIAL);
    });
  });

  describe('address bar reset', () => {
    /** Mimics startup: read the link, pick the channel, and let the queue load it */
    function land(pathname: string, search: string, lastChannel = Channel.DECADE_1990S): void {
      service.readLanding({ pathname, search });
      const channel = service.resolveLandingChannel(lastChannel);
      currentChannel.set(channel);
      TestBed.tick();
    }

    it('keeps the link while the shared clip is playing', () => {
      land('/rock', `?v=${VIDEO_ID}`);

      expect(replaceState).not.toHaveBeenCalled();
    });

    it('resets to the home page when the shared clip ends', () => {
      land('/rock', `?v=${VIDEO_ID}`);

      currentVideo.set({ id: 'nextVideo01' });
      TestBed.tick();

      expect(replaceState).toHaveBeenCalledOnceWith('/');
    });

    it('resets when the viewer changes channel during the shared clip', () => {
      land('/rock', `?v=${VIDEO_ID}`);

      currentChannel.set(Channel.DECADE_1980S);
      TestBed.tick();

      expect(replaceState).toHaveBeenCalledOnceWith('/');
    });

    it('resets a clip-only link when the clip ends', () => {
      land('/', `?v=${VIDEO_ID}`);
      expect(replaceState).not.toHaveBeenCalled();

      currentVideo.set({ id: 'nextVideo01' });
      TestBed.tick();

      expect(replaceState).toHaveBeenCalledOnceWith('/');
    });

    it('keeps a channel link while songs change on that channel', () => {
      land('/rock', '');

      currentVideo.set({ id: 'nextVideo01' });
      TestBed.tick();
      currentVideo.set({ id: 'nextVideo02' });
      TestBed.tick();

      expect(replaceState).not.toHaveBeenCalled();
    });

    it('resets a channel link when the viewer changes channel', () => {
      land('/rock', '');

      currentChannel.set(Channel.HIP_HOP);
      TestBed.tick();

      expect(replaceState).toHaveBeenCalledOnceWith('/');
    });

    it('resets only once', () => {
      land('/rock', `?v=${VIDEO_ID}`);

      currentVideo.set({ id: 'nextVideo01' });
      TestBed.tick();
      currentChannel.set(Channel.HIP_HOP);
      TestBed.tick();
      currentVideo.set({ id: 'nextVideo02' });
      TestBed.tick();

      expect(replaceState).toHaveBeenCalledTimes(1);
    });

    it('does nothing on a normal visit without a link', () => {
      land('/', '');

      currentChannel.set(Channel.HIP_HOP);
      currentVideo.set({ id: 'nextVideo01' });
      TestBed.tick();

      expect(replaceState).not.toHaveBeenCalled();
    });

    it('waits for the shared clip to start before watching for its end', () => {
      // The queue is still empty / on another video while the channel loads
      currentVideo.set(undefined);
      land('/rock', `?v=${VIDEO_ID}`);
      expect(replaceState).not.toHaveBeenCalled();

      currentVideo.set({ id: VIDEO_ID, isShared: true });
      TestBed.tick();
      expect(replaceState).not.toHaveBeenCalled();

      currentVideo.set({ id: 'nextVideo01' });
      TestBed.tick();
      expect(replaceState).toHaveBeenCalledOnceWith('/');
    });

    it('does not reset before startup has picked the channel', () => {
      // Link says rock, but the queue still shows its default channel
      currentChannel.set(Channel.DECADE_1990S);
      service.readLanding({ pathname: '/rock', search: '' });
      TestBed.tick();

      expect(replaceState).not.toHaveBeenCalled();
    });
  });

  describe('getShareUrl', () => {
    it('links to the current channel and clip', () => {
      expect(service.getShareUrl(origin)).toBe(`https://nmtv.online/rock?v=${VIDEO_ID}`);
    });

    it('follows the channel and clip as they change', () => {
      currentChannel.set(Channel.DECADE_2000S);
      currentVideo.set({ id: 'dQw4w9WgXcQ' });
      expect(service.getShareUrl(origin)).toBe('https://nmtv.online/2000s?v=dQw4w9WgXcQ');
    });

    it('links to the channel only while a bumper is playing', () => {
      currentVideo.set({ id: VIDEO_ID, isBumper: true });
      expect(service.getShareUrl(origin)).toBe('https://nmtv.online/rock');
    });

    it('links to the channel only when nothing is playing', () => {
      currentVideo.set(undefined);
      expect(service.getShareUrl(origin)).toBe('https://nmtv.online/rock');
    });

    it('keeps the hidden NOA channel out of the link', () => {
      currentChannel.set(Channel.NOA);
      expect(service.getShareUrl(origin)).toBe(`https://nmtv.online/?v=${VIDEO_ID}`);
    });
  });

  describe('share analytics', () => {
    let track: jasmine.Spy;
    let originalUmami: any;

    beforeEach(() => {
      originalUmami = (window as any).umami;
      track = jasmine.createSpy('track');
      (window as any).umami = { track };
      Object.defineProperty(navigator, 'share', { configurable: true, writable: true, value: undefined });
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        writable: true,
        value: { writeText: jasmine.createSpy('writeText').and.resolveTo() }
      });
    });

    afterEach(() => {
      (window as any).umami = originalUmami;
      delete (navigator as any).share;
      delete (navigator as any).clipboard;
    });

    it('reports one event with the source, channel, clip and outcome', async () => {
      await service.share('corner');

      expect(track).toHaveBeenCalledOnceWith('Share App Clicked', {
        source: 'corner',
        method: 'clipboard',
        result: 'copied',
        channel: Channel.ROCK,
        has_clip: true,
        video_id: VIDEO_ID,
        clip: 'Nirvana - Come As You Are',
        shared_clip: false
      });
    });

    it('reports the menu as the default source', async () => {
      await service.share();

      expect(track.calls.mostRecent().args[1].source).toBe('menu');
    });

    it('reports a failed copy', async () => {
      (navigator.clipboard.writeText as jasmine.Spy).and.rejectWith(new Error('denied'));

      await service.share('menu');

      expect(track.calls.mostRecent().args[1].result).toBe('failed');
    });

    it('still shares when analytics is not loaded', async () => {
      (window as any).umami = undefined;

      expect(await service.share('menu')).toBe('copied');
    });
  });

  describe('getShareEventData', () => {
    it('uses the title when there is no artist and song', () => {
      currentVideo.set({ id: VIDEO_ID, title: 'Queen - Live Aid 1985' });

      expect(service.getShareEventData('menu', 'native', 'shared')['clip']).toBe('Queen - Live Aid 1985');
    });

    it('marks a clip that itself came from a shared link', () => {
      currentVideo.set({ id: VIDEO_ID, isShared: true });

      const data = service.getShareEventData('menu', 'native', 'shared');

      expect(data['shared_clip']).toBeTrue();
      expect(data['clip']).toBe('');
    });

    it('reports no clip while a bumper is playing', () => {
      currentVideo.set({ id: VIDEO_ID, isBumper: true, title: 'NMTV ident' });

      const data = service.getShareEventData('corner', 'clipboard', 'copied');

      expect(data['has_clip']).toBeFalse();
      expect(data['video_id']).toBe('');
      expect(data['clip']).toBe('');
    });

    it('keeps long titles short', () => {
      currentVideo.set({ id: VIDEO_ID, title: 'x'.repeat(500) });

      expect((service.getShareEventData('menu', 'native', 'shared')['clip'] as string).length).toBe(200);
    });
  });

  describe('share', () => {
    let writeText: jasmine.Spy;

    function setNavigatorProperty(name: 'share' | 'clipboard', value: unknown): void {
      Object.defineProperty(navigator, name, { configurable: true, writable: true, value });
    }

    beforeEach(() => {
      writeText = jasmine.createSpy('writeText').and.resolveTo();
      setNavigatorProperty('clipboard', { writeText });
    });

    afterEach(() => {
      // Remove the overrides so the real browser properties show through again
      delete (navigator as any).share;
      delete (navigator as any).clipboard;
    });

    it('opens the share sheet with the link when the device has one', async () => {
      const nativeShare = jasmine.createSpy('share').and.resolveTo();
      setNavigatorProperty('share', nativeShare);

      const result = await service.share();

      expect(result).toBe('shared');
      expect(nativeShare).toHaveBeenCalledTimes(1);
      expect(nativeShare.calls.mostRecent().args[0].url).toBe(`${window.location.origin}/rock?v=${VIDEO_ID}`);
      expect(writeText).not.toHaveBeenCalled();
    });

    it('reports a dismissed share sheet as cancelled', async () => {
      setNavigatorProperty('share', () => Promise.reject(new DOMException('dismissed', 'AbortError')));
      expect(await service.share()).toBe('cancelled');
    });

    it('reports a share sheet error as failed', async () => {
      setNavigatorProperty('share', () => Promise.reject(new Error('boom')));
      expect(await service.share()).toBe('failed');
    });

    it('copies the link when there is no share sheet', async () => {
      setNavigatorProperty('share', undefined);

      const result = await service.share();

      expect(result).toBe('copied');
      expect(writeText).toHaveBeenCalledOnceWith(`${window.location.origin}/rock?v=${VIDEO_ID}`);
    });

    it('reports a clipboard error as failed', async () => {
      setNavigatorProperty('share', undefined);
      writeText.and.rejectWith(new Error('denied'));

      expect(await service.share()).toBe('failed');
    });
  });
});
