class GitHubFirebaseSyncPlayer {
    constructor() {
        this.currentRoom = null;
        this.currentUser = null;
        this.playlist = [];
        this.currentTrackIndex = 0;
        this.audioPlayer = document.getElementById('audioPlayer');
        this.syncListener = null;
        this.usersListener = null;
        
        // Bind audio player events
        this.audioPlayer.addEventListener('loadedmetadata', () => this.onAudioReady());
        this.audioPlayer.addEventListener('timeupdate', () => this.updateRoomTime());
        this.audioPlayer.addEventListener('error', (e) => this.onAudioError(e));
        
        this.showStatus('Ready to connect', 'connected');
    }

    // Authentication and Room Management
    async joinRoom() {
        const roomId = document.getElementById('roomId').value.trim();
        const username = document.getElementById('username').value.trim();
        
        if (!roomId || !username) {
            this.showStatus('Please enter room ID and username', 'error');
            return;
        }

        try {
            this.showStatus('Connecting...', 'connected');
            
            // Anonymous authentication
            const userCredential = await auth.signInAnonymously();
            this.currentUser = {
                uid: userCredential.user.uid,
                username: username,
                joinedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Join room
            await this.initializeRoom(roomId);
            this.currentRoom = roomId;
            
            // Show app interface
            document.getElementById('authSection').classList.add('hidden');
            document.getElementById('appSection').classList.remove('hidden');
            document.getElementById('currentRoom').textContent = roomId;
            
            // Start listening for real-time updates
            this.startListeners();
            
            this.showStatus('Connected successfully!', 'connected');
            setTimeout(() => document.getElementById('connectionStatus').classList.add('hidden'), 3000);
            
            // Load playlist from room
            await this.loadPlaylist();
            
        } catch (error) {
            console.error('Error joining room:', error);
            this.showStatus('Failed to join room: ' + error.message, 'error');
        }
    }

    async initializeRoom(roomId) {
        const roomRef = db.collection('rooms').doc(roomId);
        
        // Add user to room
        await roomRef.set({
            users: firebase.firestore.FieldValue.arrayUnion(this.currentUser.uid),
            userDetails: {
                [this.currentUser.uid]: this.currentUser
            },
            lastActivity: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Initialize sync data
        const syncRef = db.collection('sync').doc(roomId);
        await syncRef.set({
            currentTrack: null,
            isPlaying: false,
            currentTime: 0,
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: this.currentUser.uid
        }, { merge: true });
    }

    startListeners() {
        // Listen for room sync updates
        this.syncListener = db.collection('sync').doc(this.currentRoom)
            .onSnapshot((doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    this.handleSyncUpdate(data);
                }
            });

        // Listen for users updates
        this.usersListener = db.collection('rooms').doc(this.currentRoom)
            .onSnapshot((doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    this.updateUsersList(data.userDetails || {});
                }
            });

        // Listen for playlist updates
        this.playlistListener = db.collection('playlists').doc(this.currentRoom)
            .onSnapshot((doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    if (data.songs) {
                        this.playlist = data.songs;
                        this.renderPlaylist();
                    }
                }
            });
    }

    // GitHub Integration
    async loadGithubPlaylist() {
        try {
            const apiUrl = getGithubApiUrl();
            console.log('Loading from GitHub:', apiUrl);
            
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }
            
            const files = await response.json();
            const audioFiles = files.filter(file => 
                file.type === 'file' && 
                /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(file.name)
            );

            // Convert to playlist format
            const githubPlaylist = audioFiles.map(file => ({
                id: `github_${file.sha}`,
                filename: file.name,
                title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
                url: getGithubAudioUrl(file.name),
                source: 'github',
                addedBy: this.currentUser.uid,
                addedAt: firebase.firestore.FieldValue.serverTimestamp()
            }));

            // Save to Firestore for room sharing
            await db.collection('playlists').doc(this.currentRoom).set({
                songs: githubPlaylist,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: this.currentUser.uid
            });

            console.log(`Loaded ${githubPlaylist.length} songs from GitHub`);
            
        } catch (error) {
            console.error('Error loading GitHub playlist:', error);
            alert('Failed to load from GitHub: ' + error.message + '\n\nMake sure:\n1. Repository exists and is public\n2. Audio folder exists\n3. Repository contains audio files');
        }
    }

    async addSongManually() {
        const filename = document.getElementById('songFilename').value.trim();
        const title = document.getElementById('songTitle').value.trim();
        
        if (!filename) {
            alert('Please enter a filename');
            return;
        }

        const song = {
            id: `manual_${Date.now()}`,
            filename: filename,
            title: title || filename.replace(/\.[^/.]+$/, ""),
            url: getGithubAudioUrl(filename),
            source: 'manual',
            addedBy: this.currentUser.uid,
            addedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Add to current playlist
        const updatedPlaylist = [...this.playlist, song];
        
        // Save to Firestore
        await db.collection('playlists').doc(this.currentRoom).set({
            songs: updatedPlaylist,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: this.currentUser.uid
        });

        // Clear inputs
        document.getElementById('songFilename').value = '';
        document.getElementById('songTitle').value = '';
    }

    async loadPlaylist() {
        try {
            const playlistDoc = await db.collection('playlists').doc(this.currentRoom).get();
            if (playlistDoc.exists) {
                const data = playlistDoc.data();
                this.playlist = data.songs || [];
                this.renderPlaylist();
            }
        } catch (error) {
            console.error('Error loading playlist:', error);
        }
    }

    renderPlaylist() {
        const container = document.getElementById('playlist');
        container.innerHTML = '';
        
        if (this.playlist.length === 0) {
            container.innerHTML = `
                <p>No songs in playlist yet.</p>
                <ul>
                    <li>📥 Click "Load from GitHub" to import from your repo</li>
                    <li>➕ Or add songs manually using the form above</li>
                </ul>
            `;
            return;
        }

        this.playlist.forEach((track, index) => {
            const item = document.createElement('div');
            item.className = `playlist-item ${index === this.currentTrackIndex ? 'active' : ''}`;
            
            const sourceIcon = track.source === 'github' ? '📁' : '✏️';
            item.innerHTML = `
                <span onclick="player.selectTrack(${index})" style="flex: 1;">
                    ${sourceIcon} ${track.title}
                    <small style="color: #666; display: block;">${track.filename}</small>
                </span>
                <button onclick="player.deleteTrack(${index})" style="background: #dc3545; color: white; border: none; padding: 5px 8px; border-radius: 3px;">×</button>
            `;
            container.appendChild(item);
        });
    }

    // Playback Control and Sync
    async selectTrack(index) {
        if (index < 0 || index >= this.playlist.length) return;
        
        this.currentTrackIndex = index;
        const track = this.playlist[index];
        
        if (track) {
            console.log('Loading track:', track.url);
            this.audioPlayer.src = track.url;
            document.getElementById('currentTrack').textContent = track.title;
            
            // Sync with room
            await this.updateRoomSync({
                currentTrack: track.id,
                currentTime: 0,
                isPlaying: false
            });
            
            this.renderPlaylist();
        }
    }

    async playPause() {
        try {
            const isPlaying = !this.audioPlayer.paused;
            
            if (isPlaying) {
                this.audioPlayer.pause();
            } else {
                await this.audioPlayer.play();
            }

            // Sync with room
            await this.updateRoomSync({
                isPlaying: !isPlaying,
                currentTime: this.audioPlayer.currentTime
            });
        } catch (error) {
            console.error('Play/pause error:', error);
            alert('Playback error: ' + error.message);
        }
    }

    async nextTrack() {
        if (this.currentTrackIndex < this.playlist.length - 1) {
            await this.selectTrack(this.currentTrackIndex + 1);
        } else {
            await this.selectTrack(0); // Loop to first track
        }
    }

    async previousTrack() {
        if (this.currentTrackIndex > 0) {
            await this.selectTrack(this.currentTrackIndex - 1);
        } else {
            await this.selectTrack(this.playlist.length - 1); // Loop to last track
        }
    }

    async syncWithRoom() {
        try {
            const syncDoc = await db.collection('sync').doc(this.currentRoom).get();
            if (syncDoc.exists) {
                const data = syncDoc.data();
                this.handleSyncUpdate(data, true);
            }
        } catch (error) {
            console.error('Sync error:', error);
        }
    }

    async updateRoomSync(updates) {
        try {
            await db.collection('sync').doc(this.currentRoom).update({
                ...updates,
                lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: this.currentUser.uid
            });
        } catch (error) {
            console.error('Update sync error:', error);
        }
    }

    async handleSyncUpdate(data, forceSync = false) {
        // Don't sync our own updates unless forced
        if (data.updatedBy === this.currentUser.uid && !forceSync) {
            return;
        }

        console.log('Handling sync update:', data);

        // Find track by ID
        if (data.currentTrack) {
            const trackIndex = this.playlist.findIndex(t => t.id === data.currentTrack);
            if (trackIndex !== -1 && trackIndex !== this.currentTrackIndex) {
                await this.selectTrack(trackIndex);
            }
        }

        // Sync playback state
        if (data.isPlaying && this.audioPlayer.paused) {
            this.audioPlayer.currentTime = data.currentTime || 0;
            try {
                await this.audioPlayer.play();
            } catch (e) {
                console.warn('Auto-play blocked:', e);
            }
        } else if (!data.isPlaying && !this.audioPlayer.paused) {
            this.audioPlayer.pause();
        }

        // Sync time (allow small tolerance)
        if (Math.abs(this.audioPlayer.currentTime - (data.currentTime || 0)) > 2) {
            this.audioPlayer.currentTime = data.currentTime || 0;
        }
    }

    // Helper Functions
    async deleteTrack(index) {
        if (confirm('Remove this track from the playlist?')) {
            try {
                const updatedPlaylist = this.playlist.filter((_, i) => i !== index);
                
                // Adjust current track index if needed
                if (index === this.currentTrackIndex) {
                    // If deleted track was playing, reset
                    this.audioPlayer.pause();
                    this.audioPlayer.src = '';
                    document.getElementById('currentTrack').textContent = 'None';
                    this.currentTrackIndex = 0;
                } else if (index < this.currentTrackIndex) {
                    this.currentTrackIndex--;
                }
                
                // Save to Firestore
                await db.collection('playlists').doc(this.currentRoom).set({
                    songs: updatedPlaylist,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedBy: this.currentUser.uid
                });
                
            } catch (error) {
                console.error('Delete error:', error);
                alert('Failed to delete track');
            }
        }
    }

    updateUsersList(userDetails) {
        const container = document.getElementById('usersContainer');
        const users = Object.values(userDetails);
        container.innerHTML = users.map(user => 
            `<span style="margin-right: 10px;">👤 ${user.username}</span>`
        ).join('');
    }

    updateRoomTime() {
        const time = this.audioPlayer.currentTime;
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        document.getElementById('roomTime').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    onAudioReady() {
        console.log('Audio ready:', this.audioPlayer.src);
    }

    onAudioError(e) {
        console.error('Audio error:', e);
        const error = this.audioPlayer.error;
        if (error) {
            alert(`Audio playback error: ${error.message}\n\nCheck that the file exists in your GitHub repo and is accessible.`);
        }
    }

    showStatus(message, type) {
        const status = document.getElementById('connectionStatus');
        status.textContent = message;
        status.className = `status ${type}`;
        status.classList.remove('hidden');
    }

    async refreshPlaylist() {
        await this.loadPlaylist();
    }

    async leaveRoom() {
        if (this.syncListener) this.syncListener();
        if (this.usersListener) this.usersListener();
        if (this.playlistListener) this.playlistListener();
        
        try {
            // Remove user from room
            await db.collection('rooms').doc(this.currentRoom).update({
                users: firebase.firestore.FieldValue.arrayRemove(this.currentUser.uid),
                [`userDetails.${this.currentUser.uid}`]: firebase.firestore.FieldValue.delete()
            });
        } catch (error) {
            console.error('Error leaving room:', error);
        }
        
        await auth.signOut();
        
        document.getElementById('authSection').classList.remove('hidden');
        document.getElementById('appSection').classList.add('hidden');
        
        this.currentRoom = null;
        this.currentUser = null;
        this.playlist = [];
        this.audioPlayer.src = '';
    }
}

// GitHub Config Management
function editGithubConfig() {
    document.getElementById('editGithubUser').value = githubConfig.user;
    document.getElementById('editGithubRepo').value = githubConfig.repo;
    document.getElementById('editGithubBranch').value = githubConfig.branch;
    document.getElementById('editGithubPath').value = githubConfig.audioPath;
    document.getElementById('githubConfigEditor').classList.remove('hidden');
}

function saveGithubConfig() {
    githubConfig.user = document.getElementById('editGithubUser').value.trim();
    githubConfig.repo = document.getElementById('editGithubRepo').value.trim();
    githubConfig.branch = document.getElementById('editGithubBranch').value.trim();
    githubConfig.audioPath = document.getElementById('editGithubPath').value.trim();
    
    if (!githubConfig.user || !githubConfig.repo || !githubConfig.branch) {
        alert('Please fill in all GitHub configuration fields');
        return;
    }
    
    saveGithubConfigToStorage();
    updateGithubUI();
    document.getElementById('githubConfigEditor').classList.add('hidden');
    
    alert('GitHub configuration saved! You can now load your playlist.');
}

function cancelGithubEdit() {
    document.getElementById('githubConfigEditor').classList.add('hidden');
}

// Initialize player
const player = new GitHubFirebaseSyncPlayer();

// Global functions for HTML buttons
function joinRoom() { player.joinRoom(); }
function loadGithubPlaylist() { player.loadGithubPlaylist(); }
function addSongManually() { player.addSongManually(); }
function selectTrack(index) { player.selectTrack(index); }
function playPause() { player.playPause(); }
function nextTrack() { player.nextTrack(); }
function previousTrack() { player.previousTrack(); }
function syncWithRoom() { player.syncWithRoom(); }
function refreshPlaylist() { player.refreshPlaylist(); }
function leaveRoom() { player.leaveRoom(); }