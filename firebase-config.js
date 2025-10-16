// Firebase Configuration - REPLACE WITH YOUR ACTUAL CONFIG
// Get this from: Firebase Console → Project Settings → General → Your apps → Web app
const firebaseConfig = {
  apiKey: "AIzaSyC_EyaTwHYMP8oF5YQtHYZyfTcdTUrXCGg",
  authDomain: "forus-sv.firebaseapp.com",
  projectId: "forus-sv",
  storageBucket: "forus-sv.firebasestorage.app",
  messagingSenderId: "724044532685",
  appId: "1:724044532685:web:d1a6c1a2283ed309859284"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

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
    const elements = {
        'githubUser': githubConfig.user,
        'githubRepo': githubConfig.repo,
        'githubBranch': githubConfig.branch,
        'githubPath': githubConfig.audioPath,
        'repoName': githubConfig.repo
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });
    
    const exampleElement = document.getElementById('exampleUrl');
    if (exampleElement) {
        exampleElement.textContent = 
            `https://raw.githubusercontent.com/${githubConfig.user}/${githubConfig.repo}/${githubConfig.branch}/${githubConfig.audioPath}/[filename]`;
    }
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

console.log('🔥 Firebase + GitHub Sync Music Player ready!');

// Load config on startup
loadGithubConfig();