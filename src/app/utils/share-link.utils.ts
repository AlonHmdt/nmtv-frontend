import { Channel } from '../models/video.model';

/**
 * Utilities for shareable links:
 *   /rock            -> opens the Rock channel
 *   /rock?v=VIDEO_ID -> opens the Rock channel and plays that clip first
 *   /?v=VIDEO_ID     -> plays that clip first on the viewer's usual channel
 */

/** Query parameter that carries the shared YouTube video ID */
export const SHARED_VIDEO_PARAM = 'v';

/** Channels that can appear in a link (the hidden NOA channel is never shared) */
export const SHAREABLE_CHANNELS: Channel[] = Object.values(Channel).filter(
  channel => channel !== Channel.NOA
);

export interface ShareLink {
  /** Channel named in the link, or null when the link has no valid channel */
  channel: Channel | null;
  /** Shared YouTube video ID, or null when the link has no valid clip */
  videoId: string | null;
}

export interface ParsedVideoTitle {
  artist?: string;
  song?: string;
  title?: string;
}

/** YouTube video IDs are exactly 11 characters: letters, digits, "-" and "_" */
export function isValidYouTubeVideoId(id: string | null | undefined): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id);
}

/** Returns the shareable channel for a URL path segment, or null */
export function toShareableChannel(slug: string | null | undefined): Channel | null {
  if (!slug) {
    return null;
  }
  const normalized = slug.toLowerCase();
  return SHAREABLE_CHANNELS.find(channel => channel === normalized) ?? null;
}

/** Reads the channel and shared clip from a URL path and query string */
export function parseShareLink(pathname: string, search: string): ShareLink {
  const firstSegment = (pathname || '').split('/').filter(Boolean)[0];
  const videoId = new URLSearchParams(search || '').get(SHARED_VIDEO_PARAM);

  return {
    channel: toShareableChannel(firstSegment),
    videoId: isValidYouTubeVideoId(videoId) ? videoId : null
  };
}

/** Builds a link to a channel, optionally with a clip to play first */
export function buildShareLink(origin: string, channel: Channel | null, videoId?: string | null): string {
  const path = channel && SHAREABLE_CHANNELS.includes(channel) ? `/${channel}` : '/';
  const query = isValidYouTubeVideoId(videoId) ? `?${SHARED_VIDEO_PARAM}=${videoId}` : '';
  return `${origin.replace(/\/+$/, '')}${path}${query}`;
}

/**
 * Splits a raw YouTube title into artist and song, the same way the backend does:
 * drops "(Official Music Video)"-style tags, then splits on the first " - ".
 * The Live channel never splits titles.
 */
export function parseVideoTitle(rawTitle: string | null | undefined, channel?: Channel): ParsedVideoTitle {
  const cleaned = (rawTitle || '')
    .replace(/[\(\[\{][^\)\]\}]*Official\s+Music\s+Video[^\)\]\}]*[\)\]\}]/gi, '')
    .replace(/[\(\[\{][^\)\]\}]*Official\s+Video[^\)\]\}]*[\)\]\}]/gi, '')
    .replace(/\[HD\]/gi, '')
    .trim();

  if (!cleaned) {
    return {};
  }

  const separatorIndex = cleaned.indexOf(' - ');
  if (channel !== Channel.LIVE && separatorIndex > 0) {
    return {
      artist: cleaned.substring(0, separatorIndex).trim(),
      song: cleaned.substring(separatorIndex + 3).trim()
    };
  }

  return { title: cleaned };
}
