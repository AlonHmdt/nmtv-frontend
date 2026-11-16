import { Channel } from '../models/video.model';
import {
  SHAREABLE_CHANNELS,
  buildShareLink,
  isValidYouTubeVideoId,
  parseShareLink,
  parseVideoTitle,
  toShareableChannel
} from './share-link.utils';

describe('share-link utils', () => {
  describe('isValidYouTubeVideoId', () => {
    it('accepts 11-character YouTube IDs', () => {
      expect(isValidYouTubeVideoId('hTWKbfoikeg')).toBeTrue();
      expect(isValidYouTubeVideoId('-zLkB2U_hwI')).toBeTrue();
    });

    it('rejects anything else', () => {
      expect(isValidYouTubeVideoId('short')).toBeFalse();
      expect(isValidYouTubeVideoId('hTWKbfoikeg1')).toBeFalse();
      expect(isValidYouTubeVideoId('hTWKbfoike!')).toBeFalse();
      expect(isValidYouTubeVideoId('<script>xx')).toBeFalse();
      expect(isValidYouTubeVideoId('')).toBeFalse();
      expect(isValidYouTubeVideoId(null)).toBeFalse();
      expect(isValidYouTubeVideoId(undefined)).toBeFalse();
    });
  });

  describe('toShareableChannel', () => {
    it('maps a path segment to its channel', () => {
      expect(toShareableChannel('rock')).toBe(Channel.ROCK);
      expect(toShareableChannel('1990s')).toBe(Channel.DECADE_1990S);
      expect(toShareableChannel('special')).toBe(Channel.SPECIAL);
    });

    it('ignores letter case', () => {
      expect(toShareableChannel('Rock')).toBe(Channel.ROCK);
    });

    it('never returns the hidden NOA channel', () => {
      expect(SHAREABLE_CHANNELS).not.toContain(Channel.NOA);
      expect(toShareableChannel('noa')).toBeNull();
    });

    it('returns null for unknown or empty segments', () => {
      expect(toShareableChannel('privacy-policy')).toBeNull();
      expect(toShareableChannel('')).toBeNull();
      expect(toShareableChannel(undefined)).toBeNull();
    });
  });

  describe('parseShareLink', () => {
    it('reads the channel and the clip', () => {
      expect(parseShareLink('/rock', '?v=hTWKbfoikeg')).toEqual({
        channel: Channel.ROCK,
        videoId: 'hTWKbfoikeg'
      });
    });

    it('reads a channel-only link', () => {
      expect(parseShareLink('/2000s', '')).toEqual({ channel: Channel.DECADE_2000S, videoId: null });
    });

    it('reads a clip-only link', () => {
      expect(parseShareLink('/', '?v=hTWKbfoikeg')).toEqual({ channel: null, videoId: 'hTWKbfoikeg' });
    });

    it('returns nothing for the plain home page', () => {
      expect(parseShareLink('/', '')).toEqual({ channel: null, videoId: null });
    });

    it('drops an invalid clip but keeps the channel', () => {
      expect(parseShareLink('/rock', '?v=nope')).toEqual({ channel: Channel.ROCK, videoId: null });
    });

    it('drops an unknown channel but keeps the clip', () => {
      expect(parseShareLink('/polka', '?v=hTWKbfoikeg')).toEqual({ channel: null, videoId: 'hTWKbfoikeg' });
    });

    it('tolerates a trailing slash and other query parameters', () => {
      expect(parseShareLink('/rock/', '?utm_source=x&v=hTWKbfoikeg')).toEqual({
        channel: Channel.ROCK,
        videoId: 'hTWKbfoikeg'
      });
    });
  });

  describe('buildShareLink', () => {
    const origin = 'https://nmtv.online';

    it('builds a channel + clip link', () => {
      expect(buildShareLink(origin, Channel.ROCK, 'hTWKbfoikeg')).toBe('https://nmtv.online/rock?v=hTWKbfoikeg');
    });

    it('builds a channel-only link', () => {
      expect(buildShareLink(origin, Channel.DECADE_1980S)).toBe('https://nmtv.online/1980s');
      expect(buildShareLink(origin, Channel.DECADE_1980S, null)).toBe('https://nmtv.online/1980s');
    });

    it('leaves the hidden NOA channel out of the link', () => {
      expect(buildShareLink(origin, Channel.NOA, 'hTWKbfoikeg')).toBe('https://nmtv.online/?v=hTWKbfoikeg');
      expect(buildShareLink(origin, Channel.NOA)).toBe('https://nmtv.online/');
    });

    it('leaves an invalid clip out of the link', () => {
      expect(buildShareLink(origin, Channel.ROCK, 'bad id')).toBe('https://nmtv.online/rock');
    });

    it('does not double the slash when the origin ends with one', () => {
      expect(buildShareLink('https://nmtv.online/', Channel.ROCK)).toBe('https://nmtv.online/rock');
    });

    it('produces links that parse back to the same channel and clip', () => {
      for (const channel of SHAREABLE_CHANNELS) {
        const url = new URL(buildShareLink(origin, channel, 'hTWKbfoikeg'));
        expect(parseShareLink(url.pathname, url.search)).toEqual({ channel, videoId: 'hTWKbfoikeg' });
      }
    });
  });

  describe('parseVideoTitle', () => {
    it('splits "Artist - Song"', () => {
      expect(parseVideoTitle('Nirvana - Smells Like Teen Spirit')).toEqual({
        artist: 'Nirvana',
        song: 'Smells Like Teen Spirit'
      });
    });

    it('drops "Official Video" tags and [HD]', () => {
      expect(parseVideoTitle('Nirvana - Come As You Are (Official Music Video)')).toEqual({
        artist: 'Nirvana',
        song: 'Come As You Are'
      });
      expect(parseVideoTitle('Blur - Song 2 [Official Video] [HD]')).toEqual({ artist: 'Blur', song: 'Song 2' });
    });

    it('splits only on the first separator', () => {
      expect(parseVideoTitle('AC/DC - Back In Black - Live')).toEqual({
        artist: 'AC/DC',
        song: 'Back In Black - Live'
      });
    });

    it('keeps the whole title when there is no separator', () => {
      expect(parseVideoTitle('Me at the zoo')).toEqual({ title: 'Me at the zoo' });
    });

    it('never splits titles on the Live channel', () => {
      expect(parseVideoTitle('Queen - Live Aid 1985', Channel.LIVE)).toEqual({ title: 'Queen - Live Aid 1985' });
    });

    it('returns nothing for an empty title', () => {
      expect(parseVideoTitle('')).toEqual({});
      expect(parseVideoTitle(undefined)).toEqual({});
    });
  });
});
