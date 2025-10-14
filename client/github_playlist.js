// Configuration: Set your GitHub repo details here
const GITHUB_USER = 'sas25';
const GITHUB_REPO = 'music-files';
const GITHUB_BRANCH = 'main'; // or 'master'
const AUDIO_PATH = 'audio'; // folder in your repo

// Fetch the list of audio files from GitHub API
async function fetchGithubPlaylist() {
  const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${AUDIO_PATH}?ref=${GITHUB_BRANCH}`;
  const res = await fetch(apiUrl);
  if (!res.ok) return [];
  const files = await res.json();
  // Only include supported audio files
  const supported = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus'];
  return files
    .filter(f => f.type === 'file' && supported.some(ext => f.name.endsWith(ext)))
    .map(f => ({
      name: f.name,
      url: f.download_url || `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${AUDIO_PATH}/${f.name}`
    }));
}

// Export for use in main.js
window.fetchGithubPlaylist = fetchGithubPlaylist;
