# MTV Music Channel - Quick Start Guide

## 🎯 Quick Setup (5 minutes)

### Step 1: Get Your YouTube API Key

1. Go to: https://console.cloud.google.com/
2. Create a new project (or select existing)
3. Click "Enable APIs and Services"
4. Search for "YouTube Data API v3"
5. Click "Enable"
6. Go to "Credentials" → "Create Credentials" → "API Key"
7. Copy your API key

### Step 2: Configure the Project

Open these two files and replace `YOUR_YOUTUBE_API_KEY_HERE` with your actual API key:

1. `src/environments/environment.ts`
2. `src/environments/environment.development.ts`

```typescript
export const environment = {
  production: false,
  youtubeApiKey: 'AIza...' // Your actual key here
};
```

### Step 3: Install & Run

```bash
# Install dependencies
npm install

# Start the app
npm start
```

Then open http://localhost:4200 in your browser!

## 🎮 Controls

- **Remote Button** (bottom-left): Click to open channel menu
- **No Skip/Pause**: True MTV experience - just watch!

## 📺 Channels Available

- 🎸 **Rock** - Classic and modern rock hits
- 🎤 **Hip Hop/Rap** - Urban beats and rhymes
- 🗓️ **2000s** - Turn of the millennium hits
- 💼 **1990s** - The golden era
- 📺 **1980s** - Retro classics

## ⚠️ Troubleshooting

**Videos not loading?**
- Check your API key is correct
- Verify API key has YouTube Data API v3 enabled
- Check browser console for errors

**Black screen?**
- Some videos may not be embeddable
- Try switching channels
- Check internet connection

**API quota exceeded?**
- Free tier: 10,000 units/day
- Each search ≈ 100 units
- Wait 24 hours or upgrade quota

## 🚀 Next Steps

- Customize channel search queries in `youtube.service.ts`
- Adjust overlay timings in `video-player.component.ts`
- Modify retro styling in component SCSS files
- Add more channels in `channel-selector.component.ts`

Enjoy your MTV experience! 🎵
