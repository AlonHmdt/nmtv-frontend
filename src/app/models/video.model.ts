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


export const Channels: ChannelConfig[] = [
    { id: Channel.ROCK, name: 'Rock', icon: '🤘🏼' },
    { id: Channel.HIP_HOP, name: 'Hip Hop / Rap', icon: '🎤' },
    { id: Channel.DECADE_2000S, name: '2000s', icon: '💿' },
    { id: Channel.DECADE_1990S, name: '1990s', icon: '📼' },
    { id: Channel.DECADE_1980S, name: '1980s', icon: '📻' },
    { id: Channel.LIVE, name: 'Live', icon: '🎬' },
    { id: Channel.SHOWS, name: 'Shows', icon: '📺' }
  ];
