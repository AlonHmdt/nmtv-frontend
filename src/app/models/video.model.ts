// Individual video item within a block
export interface VideoItem {
  id: string;
  artist?: string;  // Optional: present if title has " - " separator
  song?: string;    // Optional: present if title has " - " separator
  title?: string;   // Optional: present if no separator
  year?: number;    // Optional: release year fetched from IMVDb
  isBumper?: boolean; // Optional: true if this is a bumper/ident video
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
  isBumper?: boolean;
  playlistId?: string;
  playlistName?: string;
  playlistLabel?: string; // Label of the playlist (e.g., "Top Rock Of All Time")
}

export enum Channel {
  ROCK = 'rock',
  HIP_HOP = 'hiphop',
  DECADE_2000S = '2000s',
  DECADE_1990S = '1990s',
  DECADE_1980S = '1980s',
  LIVE = 'live',
  SHOWS = 'shows',
  NOA = 'noa'
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
  { id: Channel.NOA, name: 'NOA', icon: '🐼', isEasterEgg: true }
];
