import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Channel, VideoBlock } from '../models/video.model';
import { CustomPlaylistService } from './custom-playlist.service';
import { QueueService } from './queue.service';
import { YoutubeService } from './youtube.service';

describe('QueueService - shared clips', () => {
  const SHARED_ID = 'hTWKbfoikeg';

  let service: QueueService;
  let getNextVideos: jasmine.Spy;

  function makeBlock(ids: string[], label = 'Top Rock Of All Time'): VideoBlock {
    return {
      playlistLabel: label,
      playlistId: 'playlist-1',
      items: ids.map(id => ({ id, artist: `Artist ${id}`, song: `Song ${id}`, duration: 200 }))
    };
  }

  beforeEach(() => {
    getNextVideos = jasmine.createSpy('getNextVideos').and.callFake(() => of(makeBlock(['a', 'b', 'c'])));

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: YoutubeService, useValue: { getNextVideos } },
        { provide: CustomPlaylistService, useValue: { getPlaylistIds: () => [] } }
      ]
    });
    service = TestBed.inject(QueueService);
  });

  describe('initializeQueue', () => {
    it('loads the channel as usual when there is no shared clip', async () => {
      await service.initializeQueue(Channel.ROCK);

      expect(service.currentChannel()).toBe(Channel.ROCK);
      expect(service.queue().map(v => v.id)).toEqual(['a', 'b', 'c']);
      expect(service.currentVideo().id).toBe('a');
      expect(service.currentPlaylistLabel()).toBe('Top Rock Of All Time');
    });

    it('plays the shared clip first, followed by the regular programming', async () => {
      await service.initializeQueue(Channel.ROCK, SHARED_ID);

      expect(service.currentChannel()).toBe(Channel.ROCK);
      expect(service.queue().map(v => v.id)).toEqual([SHARED_ID, 'a', 'b', 'c']);
      expect(service.currentVideo().id).toBe(SHARED_ID);
      expect(service.currentVideo().isShared).toBeTrue();
      expect(service.upcomingVideo().id).toBe('a');
    });

    it('shows no label for the shared clip, then the playlist label on the next video', async () => {
      await service.initializeQueue(Channel.ROCK, SHARED_ID);
      expect(service.currentPlaylistLabel()).toBe('');

      await service.nextVideo();

      expect(service.currentVideo().id).toBe('a');
      expect(service.currentVideo().isShared).toBeFalsy();
      expect(service.currentPlaylistLabel()).toBe('Top Rock Of All Time');
    });

    it('asks the backend not to send the shared clip again', async () => {
      await service.initializeQueue(Channel.ROCK, SHARED_ID);

      const [channel, excludeVideoIds] = getNextVideos.calls.mostRecent().args;
      expect(channel).toBe(Channel.ROCK);
      expect(excludeVideoIds).toContain(SHARED_ID);
    });

    it('does not play the shared clip twice when the block contains it anyway', async () => {
      getNextVideos.and.callFake(() => of(makeBlock(['a', SHARED_ID, 'b'])));

      await service.initializeQueue(Channel.ROCK, SHARED_ID);

      expect(service.queue().map(v => v.id)).toEqual([SHARED_ID, 'a', 'b']);
      expect(service.currentVideo().isShared).toBeTrue();
    });

    it('still queues the shared clip when the channel fails to load', async () => {
      getNextVideos.and.callFake(() => throwError(() => new Error('backend down')));

      await expectAsync(service.initializeQueue(Channel.ROCK, SHARED_ID)).toBeRejected();

      expect(service.queue().map(v => v.id)).toEqual([SHARED_ID]);
      expect(service.currentPlaylistLabel()).toBe('');
    });

    it('starts clean when re-initialized without a shared clip', async () => {
      await service.initializeQueue(Channel.ROCK, SHARED_ID);
      await service.initializeQueue(Channel.DECADE_1990S);

      expect(service.queue().map(v => v.id)).toEqual(['a', 'b', 'c']);
      expect(service.queue().some(v => v.isShared)).toBeFalse();
    });
  });

  describe('fillVideoDetails', () => {
    beforeEach(async () => {
      await service.initializeQueue(Channel.ROCK, SHARED_ID);
    });

    it('fills in the title of the shared clip', () => {
      service.fillVideoDetails(SHARED_ID, { artist: 'Nirvana', song: 'Come As You Are', duration: 219 });

      const video = service.currentVideo();
      expect(video.artist).toBe('Nirvana');
      expect(video.song).toBe('Come As You Are');
      expect(video.duration).toBe(219);
    });

    it('keeps the same video object so the player does not reload the clip', () => {
      const before = service.currentVideo();

      service.fillVideoDetails(SHARED_ID, { title: 'Me at the zoo' });

      expect(service.currentVideo()).toBe(before);
      expect(service.currentVideo().title).toBe('Me at the zoo');
    });

    it('does not overwrite details that are already known', () => {
      service.fillVideoDetails('a', { artist: 'Someone Else', song: 'Other Song', duration: 999 });

      const video = service.queue().find(v => v.id === 'a')!;
      expect(video.artist).toBe('Artist a');
      expect(video.song).toBe('Song a');
      expect(video.duration).toBe(200);
    });

    it('ignores an unknown video and a missing duration', () => {
      expect(() => service.fillVideoDetails('unknown', { title: 'x' })).not.toThrow();

      service.fillVideoDetails(SHARED_ID, { title: 'Clip', duration: 0 });
      expect(service.currentVideo().duration).toBeUndefined();
    });
  });
});
