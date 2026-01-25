import { signal, computed } from '@angular/core';

// Individual video item within a block
export interface VideoItem {
  id: string;
  artist?: string;  // Optional: present if title has " - " separator
  song?: string;    // Optional: present if title has " - " separator
  title?: string;   // Optional: present if no separator
  year?: number;    // Optional: release year fetched from IMVDb
  duration?: number; // Optional: duration in seconds from backend DB
  isBumper?: boolean; // Optional: true if this is a bumper/ident video
  isLimited?: boolean; // Optional: true if video has location/region restrictions
}

// Programming block structure (returned from backend)
export interface VideoBlock {
  playlistLabel: string;  // Label of the playlist (e.g., "Top Rock Of All Time")
  playlistId: string;     // ID of the playlist
  items: VideoItem[];     // Array of videos in this block
}

// Legacy Video interface (for backwards compatibility during transition)
export interface Video {
  id: string;
  artist?: string;
  song?: string;
  title?: string;
  year?: number;
  duration?: number; // Duration in seconds from backend DB
  isBumper?: boolean;
  playlistId?: string;
  playlistName?: string;
  playlistLabel?: string; // Label of the playlist (e.g., "Top Rock Of All Time")
  isLimited?: boolean; // True if video has location/region restrictions
}

export enum Channel {
  ROCK = 'rock',
  HIP_HOP = 'hiphop',
  DECADE_2000S = '2000s',
  DECADE_1990S = '1990s',
  DECADE_1980S = '1980s',
  LIVE = 'live',
  SHOWS = 'shows',
  RANDOM = 'random',
  NOA = 'noa',
  SPECIAL = 'special'
}
export interface ChannelConfig {
  id: Channel;
  name: string;
  icon: string;
  isEasterEgg?: boolean; // Optional flag for easter egg channels
}


export const Channels: ChannelConfig[] = [
  { id: Channel.ROCK, name: 'Rock', icon: '🤘🏼' },
  { id: Channel.HIP_HOP, name: 'Base', icon: '🎤' },
  { id: Channel.DECADE_2000S, name: '2000s', icon: '💿' },
  { id: Channel.DECADE_1990S, name: '1990s', icon: '📼' },
  { id: Channel.DECADE_1980S, name: '1980s', icon: '📻' },
  { id: Channel.LIVE, name: 'Live', icon: '🎬' },
  { id: Channel.SHOWS, name: 'Shows', icon: '📺' },
  { id: Channel.RANDOM, name: 'Random', icon: '🎲' },
  { id: Channel.NOA, name: 'NOA', icon: '🐼', isEasterEgg: true }
];

// Get channels available for navigation (includes special when enabled, excludes easter eggs)
export function getNavigationChannels(isSpecialChannelEnabled: boolean): ChannelConfig[] {
  const channels = Channels.filter(ch => !ch.isEasterEgg);
  
  if (isSpecialChannelEnabled) {
    channels.push({ id: Channel.SPECIAL, name: 'SPECIAL', icon: '⭐' });
  }
  
  return channels;
}

// Get channels for settings modal (excludes easter eggs and special channel)
export function getSettingsChannels(): ChannelConfig[] {
  return Channels.filter(ch => !ch.isEasterEgg && ch.id !== Channel.SPECIAL);
}
