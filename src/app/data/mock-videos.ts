import { Video, Channel } from '../models/video.model';

// Curated list of popular music videos for each channel
// These are real YouTube video IDs that can be embedded
// NOTE: This file is no longer used - the app now fetches data from the backend API
export const MOCK_VIDEOS: { [key in Channel]: Video[] } = {
  [Channel.ROCK]: [
    { id: 'fJ9rUzIMcZQ', artist: 'Queen', song: 'Bohemian Rhapsody' },
    { id: 'eVTXPUF4Oz4', artist: 'Linkin Park', song: 'In The End' },
    { id: 'hTWKbfoikeg', artist: 'Nirvana', song: 'Smells Like Teen Spirit' },
    { id: 'CD-E-LDc384', artist: 'Guns N Roses', song: 'Sweet Child O Mine' },
    { id: 'kXYiU_JCYtU', artist: 'Linkin Park', song: 'Numb' },
    { id: 'JU9TouRnO84', artist: 'Guns N Roses', song: 'Welcome To The Jungle' },
    { id: 'rY0WxgSXdEE', artist: 'Queen', song: 'Another One Bites The Dust' },
    { id: '1w7OgIMMRc4', artist: 'Eurythmics', song: 'Sweet Dreams' },
    { id: 'DhlPAj38rHc', artist: 'Metallica', song: 'One' },
    { id: 'pAgnJDJN4VA', artist: 'AC/DC', song: 'Back In Black' },
    { id: 'Zi_XLOBDo_Y', artist: 'Michael Jackson', song: 'Billie Jean' },
    { id: 'fRh_vgS2dFE', artist: 'Justin Bieber', song: 'Sorry' }
  ],
  [Channel.HIP_HOP]: [
    { id: 'rMbATaj7Il8', artist: 'Eminem', song: 'Lose Yourself' },
    { id: '2Vv-BfVoq4g', artist: 'Kendrick Lamar', song: 'HUMBLE.' },
    { id: 'YqeW9_5kURI', artist: 'Travis Scott', song: 'SICKO MODE' },
    { id: '_JZom_gVfuw', artist: 'Eminem', song: 'Stan' },
    { id: 'nEcnYFUKSAY', artist: 'Drake', song: 'Hotline Bling' },
    { id: 'fKopy74weus', artist: 'Coolio', song: 'Gangsta\'s Paradise' },
    { id: 'UqyT8IEBkvY', artist: '50 Cent', song: 'In Da Club' },
    { id: 'L_jWHffIx5E', artist: 'Akon', song: 'Smack That' },
    { id: 'WwoM5fLITfk', artist: 'Future', song: 'Mask Off' },
    { id: 'TGgcC5xg9YI', artist: 'Lil Nas X', song: 'Old Town Road' },
    { id: 'kJQP7kiw5Fk', artist: 'Luis Fonsi', song: 'Despacito' },
    { id: 'xpVfcZ0ZcFM', artist: 'The Chainsmokers', song: 'Closer' }
  ],
  [Channel.DECADE_2000S]: [
    { id: 'fRh_vgS2dFE', artist: 'Justin Bieber', song: 'Sorry' },
    { id: 'kJQP7kiw5Fk', artist: 'Luis Fonsi', song: 'Despacito' },
    { id: 'CevxZvSJLk8', artist: 'Ed Sheeran', song: 'Shape of You' },
    { id: 'RgKAFK5djSk', artist: 'Shakira', song: 'Waka Waka' },
    { id: 'QcIy9NiNbmo', artist: 'Train', song: 'Hey Soul Sister' },
    { id: '09R8_2nJtjg', artist: 'Rihanna', song: 'Umbrella' },
    { id: 'nfWlot6h_JM', artist: 'Taylor Swift', song: 'Shake It Off' },
    { id: 'YQHsXMglC9A', artist: 'Adele', song: 'Hello' },
    { id: 'pIgZ7gMze7A', artist: 'Avicii', song: 'Wake Me Up' },
    { id: 'hLQl3WQQoQ0', artist: 'Adele', song: 'Someone Like You' },
    { id: 'lWA2pjMjpBs', artist: 'Katy Perry', song: 'Firework' },
    { id: 'PT2_F-1esPk', artist: 'Ed Sheeran', song: 'Thinking Out Loud' }
  ],
  [Channel.DECADE_1990S]: [
    { id: 'eVTXPUF4Oz4', artist: 'Linkin Park', song: 'In The End' },
    { id: 'fKopy74weus', artist: 'Coolio', song: 'Gangsta\'s Paradise' },
    { id: 'hTWKbfoikeg', artist: 'Nirvana', song: 'Smells Like Teen Spirit' },
    { id: 'C2cMG33mWVY', artist: 'Hanson', song: 'MMMBop' },
    { id: 'tbNlMtqrYS0', artist: 'Natalie Imbruglia', song: 'Torn' },
    { id: 'MrTz5xjmso4', artist: 'Green Day', song: 'Basket Case' },
    { id: 'NOGEyBeoBGM', artist: 'Goo Goo Dolls', song: 'Iris' },
    { id: 'FTQbiNvZqaY', artist: 'Oasis', song: 'Wonderwall' },
    { id: '6Ejga4kJUts', artist: 'Semisonic', song: 'Closing Time' },
    { id: 'NUTGr5t3MoY', artist: 'Spin Doctors', song: 'Two Princes' },
    { id: 'CnQ8N1KacJc', artist: 'TLC', song: 'No Scrubs' },
    { id: '4fndeDfaWCg', artist: 'The Verve', song: 'Bitter Sweet Symphony' }
  ],
  [Channel.DECADE_1980S]: [
    { id: 'Zi_XLOBDo_Y', artist: 'Michael Jackson', song: 'Billie Jean' },
    { id: 'djV11Xbc914', artist: 'a-ha', song: 'Take On Me' },
    { id: '1w7OgIMMRc4', artist: 'Eurythmics', song: 'Sweet Dreams' },
    { id: 'pAgnJDJN4VA', artist: 'AC/DC', song: 'Back In Black' },
    { id: 'rY0WxgSXdEE', artist: 'Queen', song: 'Another One Bites The Dust' },
    { id: 'CD-E-LDc384', artist: 'Guns N Roses', song: 'Sweet Child O Mine' },
    { id: 'JU9TouRnO84', artist: 'Guns N Roses', song: 'Welcome To The Jungle' },
    { id: 'DhlPAj38rHc', artist: 'Metallica', song: 'One' },
    { id: 'dQw4w9WgXcQ', artist: 'Rick Astley', song: 'Never Gonna Give You Up' },
    { id: 'nZXRV4MezEw', artist: 'Whitney Houston', song: 'I Wanna Dance with Somebody' },
    { id: 'btPJPFnesV4', artist: 'Survivor', song: 'Eye of the Tiger' },
    { id: 'KaOC9danxNo', artist: 'Journey', song: 'Don\'t Stop Believin\'' }
  ],
  [Channel.LIVE]: [
    { id: 'fjBw6QaiwoM', title: 'Live Performance Video 1' },
    { id: 'fjBw6QaiwoM', title: 'Live Performance Video 2' },
    { id: 'fjBw6QaiwoM', title: 'Live Performance Video 3' },
    { id: 'fjBw6QaiwoM', title: 'Live Performance Video 4' },
    { id: 'fjBw6QaiwoM', title: 'Live Performance Video 5' },
    { id: 'fjBw6QaiwoM', title: 'Live Performance Video 6' }
  ],
  [Channel.SHOWS]: [
    { id: 'dQw4w9WgXcQ', title: 'Show Clip Video 1' },
    { id: 'dQw4w9WgXcQ', title: 'Show Clip Video 2' },
  ],
  [Channel.NOA]: [
    { id: 'LsoLEjrDogU', artist: 'Panic! At The Disco', song: 'High Hopes' },
    { id: '09R8_2nJtjg', artist: 'Rihanna', song: 'Umbrella' },
    { id: '3AtDnEC4zak', artist: 'Maroon 5', song: 'Sugar' },
  ],
  [Channel.RANDOM]: [
    { id: 'LsoLEjrDogU', artist: 'Panic! At The Disco', song: 'High Hopes' },
    { id: '09R8_2nJtjg', artist: 'Rihanna', song: 'Umbrella' },
    { id: '3AtDnEC4zak', artist: 'Maroon 5', song: 'Sugar' },
  ],
  [Channel.SPECIAL]: [
    { id: 'LsoLEjrDogU', artist: 'Panic! At The Disco', song: 'High Hopes' },
    { id: '09R8_2nJtjg', artist: 'Rihanna', song: 'Umbrella' },
    { id: '3AtDnEC4zak', artist: 'Maroon 5', song: 'Sugar' },
  ]
};

// Example bumpers (these won't be used as backend provides real bumpers)
export const MOCK_BUMPERS: Video[] = [
  { id: '4Xrm1Akt7qY', title: 'MTV Bumper', isBumper: true },
  { id: '-OIa6fckuYU', title: 'MTV Ident', isBumper: true },
  { id: '0qheELHrcy4', title: 'MTV Logo', isBumper: true }
];

// Helper to get random videos from a channel
export function getRandomVideos(channel: Channel, count: number): Video[] {
  const videos = [...MOCK_VIDEOS[channel]];
  const result: Video[] = [];

  for (let i = 0; i < count && videos.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * videos.length);
    result.push(videos.splice(randomIndex, 1)[0]);
  }

  return result;
}
