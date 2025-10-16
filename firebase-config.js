// Firebase Configuration - REPLACE WITH YOUR ACTUAL CONFIG
// Get this from: Firebase Console → Project Settings → General → Your apps → Web app
const firebaseConfig = {
    apiKey: "AIzaSyC_EyaTwHYMP8oF5YQtHYZyfTcdTUFXCGg",
    authDomain: "forus-sv.firebaseapp.com",
    projectId: "forus-sv",
    storageBucket: "forus-sv.firebasestorage.app",
    messagingSenderId: "724044532685",
    appId: "1:724044532685:web:d1a6c1a2283ed390859284"
};

// Initialize Firebase (NO STORAGE NEEDED)
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

// GitHub Configuration (Edit via UI)
let githubConfig = {
    user: 'sas25',
    repo: 'music-files',
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