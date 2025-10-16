# 🎵 GitHub + Firebase Sync Music Player

**Perfect hybrid solution:** Audio files hosted on GitHub (free, unlimited) + Real-time sync via Firebase (free tier).

## ✅ Features

- **🆓 100% Free** - No billing requirements, uses free tiers only
- **📁 GitHub Audio Storage** - Upload unlimited music files to your GitHub repo
- **⚡ Real-time Sync** - Instant playback synchronization via Firebase
- **🔐 Secure** - Firebase authentication and security rules
- **👥 Multi-user Rooms** - Multiple people can join and sync playback
- **🎵 Full Playlist Control** - Add, remove, skip tracks with real-time updates
- **📱 Cross-platform** - Works on any device with a modern browser

## 🚀 Setup Instructions

### Step 1: Create GitHub Music Repository

1. **Create a new public GitHub repository** (e.g., `music-files`)
2. **Create an `audio` folder** in your repository
3. **Upload your music files** (.mp3, .wav, .ogg, .m4a, etc.) to the `audio` folder
4. **Note your repository details:**
   - Username: `your-username`
   - Repository: `music-files`
   - Branch: `main` (or `master`)
   - Audio folder: `audio`

### Step 2: Setup Firebase (Free Tier)

1. **Create Firebase Project:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create new project
   - **Don't enable Google Analytics** (not needed)

2. **Enable Authentication:**
   - Go to Authentication → Sign-in method
   - Enable **Anonymous** authentication

3. **Enable Firestore Database:**
   - Go to Firestore Database → Create database
   - Start in **test mode**
   - Choose your preferred location

4. **Get Firebase Config:**
   - Go to Project Settings → General
   - Add web app (`</>` icon)
   - Copy the config object

5. **Set Security Rules:**
   - Go to Firestore → Rules
   - Replace with the rules provided in `firebase-config.js`

### 3. Configure App
- **Update `firebase-config.js`** with your real Firebase config (or copy from template)
- Configure GitHub settings using the built-in editor

### Step 4: Deploy

**Option A: GitHub Pages**
1. Upload all files from `firebase-github/` folder to your GitHub Pages repository
2. Access via your GitHub Pages URL

**Option B: Local Testing**
1. Open `index.html` in a modern web browser
2. Test with multiple browser tabs/windows

## 🎮 How to Use

### Join a Room
1. Enter a **Room ID** (same for all users who want to sync)
2. Enter your **Username**
3. Click **"Join Room"**

### Load Your Music
1. **Configure GitHub settings** (edit button next to GitHub config)
2. Click **"📥 Load from GitHub"** to import all songs from your repo
3. Or **manually add songs** using the filename form

### Sync Playback
- **When one user plays/pauses/skips**, all users sync automatically
- **Real-time playlist updates** - adding/removing songs syncs to everyone
- **Cross-device sync** - works on phones, tablets, computers simultaneously

## 🔧 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GitHub Repo   │    │   Firebase      │    │   Your Device   │
│                 │    │                 │    │                 │
│ 🎵 Audio Files  │───▶│ ⚡ Sync Data    │◄──▶│ 🎮 Web Player   │
│ (Unlimited)     │    │ 👥 User Data    │    │                 │
│                 │    │ 📋 Playlists    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

- **Audio streaming:** Direct from GitHub (raw.githubusercontent.com)
- **Real-time sync:** Firebase Firestore real-time listeners
- **User management:** Firebase Anonymous Authentication
- **Playlist storage:** Firestore (metadata only, not audio files)

## 🔒 Security Features

- **Firebase Authentication** - Anonymous but secure user identification
- **Firestore Security Rules** - Only room members can access room data
- **HTTPS/WSS Encryption** - All communications encrypted
- **Input Validation** - All user inputs sanitized
- **No sensitive data storage** - Only sync commands, not personal info

## 💰 Cost Breakdown (FREE!)

### GitHub (Free Tier)
- **Public repositories:** Unlimited
- **File storage:** Unlimited for public repos
- **Bandwidth:** No limits for public repos

### Firebase (Free Tier)
- **Firestore reads:** 50,000/day
- **Firestore writes:** 20,000/day
- **Authentication:** Unlimited anonymous users
- **Bandwidth:** 10GB/month

**Your music sync app usage:** Less than 1% of these limits! 🎉

## 🛠️ Customization

### Add More Audio Sources
```javascript
// Add support for other audio hosts
const audioSources = {
    github: (filename) => getGithubAudioUrl(filename),
    dropbox: (filename) => `https://dropbox.com/your-link/${filename}`,
    // Add more sources...
};
```

### Extend Playlist Features
- **Shuffle mode**
- **Repeat modes**
- **Volume synchronization**
- **Chat integration**

## 📱 Browser Compatibility

- ✅ **Chrome/Chromium** (recommended)
- ✅ **Firefox**
- ✅ **Safari** (may require user interaction for autoplay)
- ✅ **Edge**
- ✅ **Mobile browsers** (iOS Safari, Chrome Mobile)

## 🐛 Troubleshooting

### Audio Won't Play
- Check that files exist in your GitHub repo
- Verify the GitHub config is correct
- Some browsers require user interaction before playing audio

### Sync Not Working
- Check Firebase console for authentication errors
- Verify Firestore security rules are applied
- Make sure all users are in the same room

### GitHub Load Failed
- Ensure your repository is **public**
- Check that the `audio` folder exists
- Verify your GitHub username and repo name are correct

## 🚀 Perfect For

- **Remote listening parties**
- **Study groups with background music**
- **Synchronized DJ sessions**
- **Family/friend music sharing**
- **Podcast listening groups**
- **Any scenario where people want to listen together**

---

**🎵 Enjoy your synchronized music experience!** Share room IDs with friends and listen together from anywhere in the world! 🌍