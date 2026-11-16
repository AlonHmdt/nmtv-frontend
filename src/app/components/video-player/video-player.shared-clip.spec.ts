import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Channel, VideoItem } from '../../models/video.model';
import { CustomPlaylistService } from '../../services/custom-playlist.service';
import { EasterEggService } from '../../services/easter-egg.service';
import { QueueService } from '../../services/queue.service';
import { YoutubeService } from '../../services/youtube.service';
import { VideoPlayerComponent } from './video-player.component';

/**
 * Covers how the player treats a clip that arrived through a shared link.
 * The component is created without rendering, so no YouTube player is loaded;
 * a fake player object stands in for the YouTube IFrame API.
 */
describe('VideoPlayerComponent - shared clips', () => {
  const SHARED_ID = 'hTWKbfoikeg';

  let component: any;
  let currentVideo: ReturnType<typeof signal<VideoItem | undefined>>;
  let queueService: {
    fillVideoDetails: jasmine.Spy;
    removeVideoLocally: jasmine.Spy;
    markVideoAsUnavailable: jasmine.Spy;
  };

  function fakePlayer(overrides: Record<string, unknown> = {}) {
    return {
      getVideoData: () => ({ video_id: SHARED_ID, title: 'Nirvana - Come As You Are (Official Music Video)' }),
      getDuration: () => 219.4,
      loadVideoById: jasmine.createSpy('loadVideoById'),
      ...overrides
    };
  }

  beforeEach(() => {
    currentVideo = signal<VideoItem | undefined>({ id: SHARED_ID, isShared: true });
    queueService = {
      fillVideoDetails: jasmine.createSpy('fillVideoDetails'),
      removeVideoLocally: jasmine.createSpy('removeVideoLocally'),
      markVideoAsUnavailable: jasmine.createSpy('markVideoAsUnavailable')
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: QueueService,
          useValue: {
            ...queueService,
            currentVideo,
            upcomingVideo: signal(undefined),
            currentChannel: signal(Channel.ROCK),
            currentPlaylistLabel: signal(''),
            oldTVEnabled: signal(false),
            getRestoredState: () => signal(null)
          }
        },
        { provide: YoutubeService, useValue: { specialEventData: signal(null) } },
        { provide: EasterEggService, useValue: { isUnlocked: signal(false) } },
        { provide: CustomPlaylistService, useValue: { getPlaylistIds: () => [] } }
      ]
    });

    component = TestBed.runInInjectionContext(() => new VideoPlayerComponent());
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  describe('title lookup', () => {
    it('takes artist, song and duration from the loaded YouTube video', () => {
      component.fillSharedClipDetails(fakePlayer());

      expect(queueService.fillVideoDetails).toHaveBeenCalledOnceWith(SHARED_ID, {
        artist: 'Nirvana',
        song: 'Come As You Are',
        duration: 219
      });
    });

    it('does nothing for regular videos', () => {
      currentVideo.set({ id: 'a', artist: 'Blur', song: 'Song 2' });

      component.fillSharedClipDetails(fakePlayer());

      expect(queueService.fillVideoDetails).not.toHaveBeenCalled();
    });

    it('does nothing once the title is known', () => {
      currentVideo.set({ id: SHARED_ID, isShared: true, title: 'Me at the zoo' });

      component.fillSharedClipDetails(fakePlayer());

      expect(queueService.fillVideoDetails).not.toHaveBeenCalled();
    });

    it('ignores data that belongs to a different video', () => {
      component.fillSharedClipDetails(fakePlayer({ getVideoData: () => ({ video_id: 'other', title: 'A - B' }) }));

      expect(queueService.fillVideoDetails).not.toHaveBeenCalled();
    });

    it('survives a player without title data', () => {
      expect(() => component.fillSharedClipDetails(fakePlayer({ getVideoData: undefined }))).not.toThrow();
      expect(() =>
        component.fillSharedClipDetails(
          fakePlayer({
            getVideoData: () => {
              throw new Error('not ready');
            }
          })
        )
      ).not.toThrow();
      expect(queueService.fillVideoDetails).not.toHaveBeenCalled();
    });
  });

  describe('clip shorter than the mid-song start point', () => {
    beforeEach(() => {
      component.firstVideoStartSeconds = 120;
    });

    it('replays the clip from the beginning instead of skipping it', () => {
      const player = fakePlayer({ getDuration: () => 19 });

      expect(component.restartShortSharedClip(player)).toBeTrue();
      expect(player.loadVideoById).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ videoId: SHARED_ID, startSeconds: 0 })
      );
    });

    it('replays it only once, so the channel continues when it ends', () => {
      const player = fakePlayer({ getDuration: () => 19 });

      component.restartShortSharedClip(player);

      expect(component.restartShortSharedClip(player)).toBeFalse();
      expect(player.loadVideoById).toHaveBeenCalledTimes(1);
    });

    it('lets a normal-length clip end as usual', () => {
      const player = fakePlayer({ getDuration: () => 219 });

      expect(component.restartShortSharedClip(player)).toBeFalse();
      expect(player.loadVideoById).not.toHaveBeenCalled();
    });

    it('never replays regular videos', () => {
      currentVideo.set({ id: 'a', artist: 'Blur', song: 'Song 2' });
      const player = fakePlayer({ getDuration: () => 19 });

      expect(component.restartShortSharedClip(player)).toBeFalse();
      expect(player.loadVideoById).not.toHaveBeenCalled();
    });

    it('does nothing when the duration is unknown', () => {
      const player = fakePlayer({ getDuration: () => 0 });

      expect(component.restartShortSharedClip(player)).toBeFalse();
    });
  });

  describe('unavailable clip', () => {
    it('skips a broken shared clip without reporting it to the backend', () => {
      component.handleUnavailableVideo(150);

      expect(queueService.removeVideoLocally).toHaveBeenCalledOnceWith(SHARED_ID);
      expect(queueService.markVideoAsUnavailable).not.toHaveBeenCalled();
    });

    it('still reports regular videos', () => {
      currentVideo.set({ id: 'a', artist: 'Blur', song: 'Song 2' });

      component.handleUnavailableVideo(150);

      expect(queueService.markVideoAsUnavailable).toHaveBeenCalledOnceWith('a', 150);
      expect(queueService.removeVideoLocally).not.toHaveBeenCalled();
    });
  });
});
