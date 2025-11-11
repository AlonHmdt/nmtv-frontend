# 🎵 NMTV Music Channel - Frontend

A web-based music video experience inspired by classic MTV channels. Angular 18+ frontend for the retro NMTV music video channel application.

## ✨ Features

- **Continuous Playback**: Non-stop music videos playing in sequence
- **Channel Selection**: Choose from Rock, Hip Hop/Rap, 2000s, 1990s, or 1980s
- **Smart Queue Management**: Maintains a queue of 10 videos with no artist repetition
- **MTV-Style Overlays**: "Playing Now" and "Coming Up Next" information displays
- **Retro Design**: Classic MTV aesthetic with modern Angular technology
- **Full-Screen Experience**: Immersive, lean-back viewing like traditional TV

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A YouTube Data API v3 key

### Installation

1. Navigate to the project:
```bash
cd mtv-music-channel
```

2. Install dependencies:
```bash
npm install
```

3. Get a YouTube API Key:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the YouTube Data API v3
   - Create credentials (API Key)
   - Copy your API key

4. Configure the API key:
   - Open `src/environments/environment.ts`
   - Replace `YOUR_YOUTUBE_API_KEY_HERE` with your actual API key
   - Do the same for `src/environments/environment.development.ts`

```typescript
export const environment = {
  production: false,
  youtubeApiKey: 'YOUR_ACTUAL_API_KEY_HERE'
};
```

5. Start the development server:
```bash
npm start
```

6. Open your browser and navigate to `http://localhost:4200`

## 🎮 How to Use

1. **Launch the App**: The app will start playing music videos from the last selected channel (default: Rock)

2. **Switch Channels**: Click the floating remote button (bottom-left corner) to open the channel selector

3. **Select a Channel**: Choose from:
   - 🎸 Rock
   - 🎤 Hip Hop / Rap
   - 🗓️ 2000s
   - 💼 1990s
   - 📺 1980s

4. **Enjoy**: Sit back and enjoy continuous music videos!

## 🏗️ Project Structure

```
src/
├── app/
│   ├── components/
│   │   ├── video-player/          # Main video player component
│   │   └── channel-selector/      # Channel selection UI
│   ├── models/
│   │   └── video.model.ts         # TypeScript interfaces
│   ├── services/
│   │   ├── youtube.service.ts     # YouTube API integration
│   │   └── queue.service.ts       # Video queue management
│   └── environments/              # Environment configuration
```

## 🎨 Features Explained

### Overlay Display Logic

- **"Playing Now"** appears:
  - 10 seconds after video starts (displays for 10 seconds)
  - 50 seconds before video ends (displays for 20 seconds)
  
- **"Coming Up Next"** appears:
  - 5 seconds after the second "Playing Now" overlay fades
  - Displays for 10 seconds

### Queue Management

- Maintains 10 videos ahead of the currently playing video
- Automatically fetches new videos when the queue drops below 10
- Prevents the same artist from appearing twice in the visible queue
- Randomizes video selection within the selected genre/decade

## 🛠️ Technology Stack

- **Framework**: Angular 20 (Standalone Components)
- **Language**: TypeScript
- **Styling**: SCSS
- **Video Source**: YouTube Data API v3
- **Player**: YouTube IFrame Player API

## 📱 Future Enhancements

- Android TV app version
- YouTube Premium login for ad-free experience
- "Recently Played" history
- User authentication for personalized preferences
- Ambient audio (TV static) between clips
- Additional channels and genres

## 🧪 Development

### Build for Production

```bash
npm run build
```

### Run Tests

```bash
npm test
```

### Lint Code

```bash
npm run lint
```

## 📄 API Usage & Limits

This app uses the YouTube Data API v3. Please be aware of the following:

- Free tier quota: 10,000 units per day
- Each search costs approximately 100 units
- Monitor your usage in the Google Cloud Console
- Consider implementing caching for production use

## ⚠️ Important Notes

- You must provide your own YouTube API key
- The app requires an active internet connection
- Video availability depends on YouTube's content policies and regional restrictions
- Some videos may not be embeddable

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is for educational and personal use. Please respect YouTube's Terms of Service and copyright laws.

## 🙏 Acknowledgments

- Inspired by classic MTV music television
- Built with Angular
- Powered by YouTube

---

**Enjoy your personal MTV experience! 🎵📺**

---

## 🎭 Development Mode (Mock Data)

To avoid YouTube API quota limits during development, the app includes a mock data mode with curated playlists:

### Enable Mock Data (Default for Development)
```typescript
// src/environments/environment.ts
useMockData: true  // No API calls, uses curated video lists
```

### Use Real YouTube API
```typescript
// src/environments/environment.ts
useMockData: false  // Makes real API calls (uses quota)
```

**Benefits of Mock Mode:**
- ✅ No API quota consumption
- ✅ Consistent, high-quality videos
- ✅ Works offline (videos still need internet to play)
- ✅ Perfect for development and testing

See **PRODUCTION_GUIDE.md** for deployment strategies and quota solutions.
