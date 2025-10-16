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

// Initialize Firebase services (make them globally available)
let auth, db;

// Wait for Firebase to be ready
firebase.auth().onAuthStateChanged((user) => {
    // Firebase is now ready
    auth = firebase.auth();
    db = firebase.firestore();
    
    // Trigger any initialization that depends on Firebase
    if (typeof window.initializeSyncPlayer === 'function') {
        window.initializeSyncPlayer();
    }
});

// GitHub Configuration (Edit via UI)
let githubConfig = {
    user: 'grey-4',
    repo: 'songs',
    branch: 'main',
    audioPath: '',  // Files are in root directory, not in a subfolder
    repoLink: 'https://github.com/grey-4/songs'
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
    const userInput = document.getElementById('githubUser');
    const repoLinkInput = document.getElementById('repoLink');
    
    if (userInput) {
        userInput.value = githubConfig.user;
        userInput.addEventListener('input', function() {
            githubConfig.user = this.value.trim();
            updateRepoFromUserInput();
            saveGithubConfigToStorage();
        });
    }
    
    if (repoLinkInput) {
        repoLinkInput.value = githubConfig.repoLink;
        repoLinkInput.addEventListener('input', function() {
            githubConfig.repoLink = this.value.trim();
            parseRepoLink();
            saveGithubConfigToStorage();
        });
    }
}

// Update repo link when username changes
function updateRepoFromUserInput() {
    githubConfig.repoLink = `https://github.com/${githubConfig.user}/${githubConfig.repo}`;
    const repoLinkInput = document.getElementById('repoLink');
    if (repoLinkInput) {
        repoLinkInput.value = githubConfig.repoLink;
    }
}

// Parse repository details from GitHub URL
function parseRepoLink() {
    try {
        const url = githubConfig.repoLink;
        const match = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
        if (match) {
            githubConfig.user = match[1];
            githubConfig.repo = match[2].replace(/\.git$/, ''); // Remove .git extension if present
            
            // Update username input
            const userInput = document.getElementById('githubUser');
            if (userInput) {
                userInput.value = githubConfig.user;
            }
        }
    } catch (error) {
        console.warn('Could not parse repository URL:', error);
    }
}

// GitHub Helper Functions
function getGithubAudioUrl(filename) {
    const path = githubConfig.audioPath ? `${githubConfig.audioPath}/` : '';
    return `https://raw.githubusercontent.com/${githubConfig.user}/${githubConfig.repo}/${githubConfig.branch}/${path}${filename}`;
}

function getGithubApiUrl() {
    const path = githubConfig.audioPath || '';
    return `https://api.github.com/repos/${githubConfig.user}/${githubConfig.repo}/contents/${path}?ref=${githubConfig.branch}`;
}

// Firestore Security Rules (COPY TO FIREBASE CONSOLE)
const SECURITY_RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow all authenticated users to read/write everything (for development)
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
`;

// Load config on startup
loadGithubConfig();

// Add input validation
document.addEventListener('DOMContentLoaded', function() {
    const roomIdInput = document.getElementById('roomId');
    const usernameInput = document.getElementById('username');
    
    if (roomIdInput) {
        roomIdInput.addEventListener('input', function() {
            // Visual feedback only - don't auto-remove characters
            const isValid = /^[a-zA-Z0-9_-]*$/.test(this.value) && this.value.length >= 3;
            
            if (this.value.length === 0) {
                this.style.borderColor = '#ddd';
            } else if (!isValid || this.value.length < 3) {
                this.style.borderColor = '#dc3545'; // Red for invalid
            } else {
                this.style.borderColor = '#28a745'; // Green for valid
            }
        });
    }
    
    if (usernameInput) {
        usernameInput.addEventListener('input', function() {
            // Visual feedback only - don't auto-remove characters
            const isValid = /^[a-zA-Z0-9_]*$/.test(this.value) && this.value.length >= 2;
            
            if (this.value.length === 0) {
                this.style.borderColor = '#ddd';
            } else if (!isValid || this.value.length < 2) {
                this.style.borderColor = '#dc3545'; // Red for invalid
            } else {
                this.style.borderColor = '#28a745'; // Green for valid
            }
        });
    }
});