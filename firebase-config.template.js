// Firebase Configuration Template
// INSTRUCTIONS:
// 1. Copy this file and rename it to "firebase-config.js"
// 2. Replace all the "YOUR_" placeholder values with your actual Firebase config
// 3. Get your config from: Firebase Console → Project Settings → General → Your apps → Web app

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// GitHub Configuration (Edit via UI or change defaults here)
let githubConfig = {
    user: 'YOUR_GITHUB_USERNAME',
    repo: 'YOUR_MUSIC_REPO',
    branch: 'main',
    audioPath: 'audio'
};

// Load GitHub config from localStorage
function loadGithubConfig() {
    const saved = localStorage.getItem('githubConfig');
    if (saved) {
        githubConfig = { ...githubConfig, ...JSON.parse(saved) };
    }
    updateGithubUI();
}

// Save GitHub config to localStorage
function saveGithubConfigToStorage() {
    localStorage.setItem('githubConfig', JSON.stringify(githubConfig));
}

// Update GitHub UI elements
function updateGithubUI() {
    document.getElementById('githubUser').textContent = githubConfig.user;
    document.getElementById('githubRepo').textContent = githubConfig.repo;
    document.getElementById('githubBranch').textContent = githubConfig.branch;
    document.getElementById('githubPath').textContent = githubConfig.audioPath;
    document.getElementById('repoName').textContent = githubConfig.repo;
    document.getElementById('exampleUrl').textContent = 
        `https://raw.githubusercontent.com/${githubConfig.user}/${githubConfig.repo}/${githubConfig.branch}/${githubConfig.audioPath}/[filename]`;
}

// GitHub Helper Functions
function getGithubAudioUrl(filename) {
    return `https://raw.githubusercontent.com/${githubConfig.user}/${githubConfig.repo}/${githubConfig.branch}/${githubConfig.audioPath}/${filename}`;
}

function getGithubApiUrl() {
    return `https://api.github.com/repos/${githubConfig.user}/${githubConfig.repo}/contents/${githubConfig.audioPath}?ref=${githubConfig.branch}`;
}

// Initialize Firebase (DO NOT EDIT BELOW THIS LINE)
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

// Firestore Security Rules (COPY TO FIREBASE CONSOLE)
const SECURITY_RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Rooms - only authenticated users can read/write
    match /rooms/{roomId} {
      allow read, write: if request.auth != null;
    }
    
    // Room sync data - only authenticated users
    match /sync/{roomId} {
      allow read, write: if request.auth != null;
    }
    
    // Playlist metadata - only authenticated users
    match /playlists/{playlistId} {
      allow read, write: if request.auth != null;
    }
  }
}
`;

console.log('🔥 Firebase initialized (GitHub + Firestore hybrid mode)');
console.log('📁 Audio files will be loaded from GitHub');
console.log('⚡ Sync data will be stored in Firestore');
console.log('🔒 Apply these security rules in Firebase Console > Firestore > Rules:');
console.log(SECURITY_RULES);

// Load config on startup
loadGithubConfig();