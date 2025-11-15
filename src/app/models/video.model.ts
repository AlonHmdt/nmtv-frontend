export interface Video {
  id: string;
  artist?: string;  // Optional: present if title has " - " separator
  song?: string;    // Optional: present if title has " - " separator
  title?: string;   // Optional: present if no separator
  year?: number;    // Optional: release year fetched from IMVDb
  isBumper?: boolean; // Optional: true if this is a bumper/ident video
  playlistId?: string; // Optional: ID of the playlist this video is from
  playlistName?: string; // Optional: Name of the custom playlist
}

export enum Channel {
  ROCK = 'rock',
  HIP_HOP = 'hiphop',
  DECADE_2000S = '2000s',
  DECADE_1990S = '1990s',
  DECADE_1980S = '1980s',
  LIVE = 'live',
  SHOWS = 'shows'
}
export interface ChannelConfig {
  id: Channel;
  name: string;
  icon: string;
}
