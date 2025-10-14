# Sync Music Player

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Add Your Music Files
- Create a public GitHub repository (e.g., `music-files`)
- Create an `audio` folder in your repo
- Upload your music files (.mp3, .wav, .ogg, .m4a, .aac, .flac, .opus)
- Update the GitHub configuration in `client/github_playlist.js`

### 3. Run the Server
```bash
npm start
```

### 4. Test the App
- Open http://localhost:3000 in two different browser tabs
- Enter the same room name and different usernames
- You should see both users listed
- Select songs from the playlist and use the controls to sync playback

### Current Issues Fixed:
- ✅ User list now shows connected users
- ✅ Better error handling for playlist loading
- ✅ Improved synchronization with logging
- ✅ Added demo fallback when GitHub repo is not available

### For Deployment:
- Frontend: Deploy `client` folder to Cloudflare Pages
- Backend: Deploy server to Render.com, Fly.io, or similar free service
- Audio: Host files on GitHub as configured in `client/github_playlist.js`