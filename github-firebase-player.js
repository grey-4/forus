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
        
        // Validation rules
        if (!roomId || !username) {
            this.showStatus('Please enter room ID and username', 'error');
            return;
        }

        // Room ID validation
        if (roomId.length < 3 || roomId.length > 20) {
            this.showStatus('Room ID must be 3-20 characters long', 'error');
            return;
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(roomId)) {
            this.showStatus('Room ID can only contain letters, numbers, underscore, and dash', 'error');
            return;
        }

        // Username validation
        if (username.length < 2 || username.length > 15) {
            this.showStatus('Username must be 2-15 characters long', 'error');
            return;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            this.showStatus('Username can only contain letters, numbers, and underscore', 'error');
            return;
        }

        try {
            this.showStatus('Connecting...', 'connected');
            
            // Force sign out first if someone is logged in
            if (auth.currentUser) {
                await auth.signOut();
            }

            // Anonymous authentication with timeout protection
            const authPromise = auth.signInAnonymously();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Authentication timeout after 10 seconds')), 10000)
            );
            
            const userCredential = await Promise.race([authPromise, timeoutPromise]);
            
            // Double-check auth state
            if (!auth.currentUser) {
                throw new Error('Authentication succeeded but currentUser is still null');
            }
            
            this.currentUser = {
                uid: userCredential.user.uid,
                username: username,
                joinedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Check if username is already taken in this room
            const roomDoc = await db.collection('rooms').doc(roomId).get();
            if (roomDoc.exists) {
                const roomData = roomDoc.data();
                const userDetails = roomData.userDetails || {};
                const existingUsernames = Object.values(userDetails).map(user => user.username.toLowerCase());
                
                if (existingUsernames.includes(username.toLowerCase())) {
                    this.showStatus(`Username "${username}" is already taken in this room. Please choose another.`, 'error');
                    return;
                }
            }

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
        
        // Add current user to room (don't clear existing users)
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

        // Set up immediate cleanup on any disconnect
        this.setupImmediateCleanup(roomId);
    }

    setupImmediateCleanup(roomId) {
        // Start presence heartbeat to show we're active
        this.startPresenceHeartbeat(roomId);

        const cleanup = async () => {
            try {
                // Stop heartbeat first
                this.stopPresenceHeartbeat();
                
                // Remove from room
                const roomRef = db.collection('rooms').doc(roomId);
                await roomRef.update({
                    users: firebase.firestore.FieldValue.arrayRemove(this.currentUser.uid),
                    [`userDetails.${this.currentUser.uid}`]: firebase.firestore.FieldValue.delete()
                });
            } catch (error) {
                // Ignore cleanup errors
            }
        };

        // Immediate cleanup on ANY page leave event
        window.addEventListener('beforeunload', cleanup);
        window.addEventListener('unload', cleanup);
        window.addEventListener('pagehide', cleanup);
        
        // Store cleanup function for manual use
        this.immediateCleanup = cleanup;
    }

    startPresenceHeartbeat(roomId) {
        // Send heartbeat every 10 seconds to show we're alive
        this.heartbeatInterval = setInterval(async () => {
            try {
                await db.collection('presence').doc(`${roomId}_${this.currentUser.uid}`).set({
                    userId: this.currentUser.uid,
                    username: this.currentUser.username,
                    roomId: roomId,
                    lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                    online: true
                });
            } catch (error) {
                // Ignore heartbeat errors
            }
        }, 10000); // 10 seconds

        // Monitor for stale users and remove them
        this.monitorStaleUsers(roomId);
    }

    stopPresenceHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.staleUserMonitor) {
            clearInterval(this.staleUserMonitor);
            this.staleUserMonitor = null;
        }
    }

    monitorStaleUsers(roomId) {
        // Check every 15 seconds for stale users
        this.staleUserMonitor = setInterval(async () => {
            try {
                const now = Date.now();
                const staleThreshold = 30000; // 30 seconds
                
                const presenceSnapshot = await db.collection('presence')
                    .where('roomId', '==', roomId)
                    .get();

                const roomRef = db.collection('rooms').doc(roomId);
                const roomDoc = await roomRef.get();
                
                if (roomDoc.exists) {
                    const roomData = roomDoc.data();
                    const currentUsers = roomData.users || [];
                    const userDetails = roomData.userDetails || {};
                    
                    // Check which users are stale
                    const activeUsers = new Set();
                    presenceSnapshot.docs.forEach(doc => {
                        const data = doc.data();
                        const lastSeen = data.lastSeen ? data.lastSeen.toMillis() : 0;
                        
                        if (now - lastSeen <= staleThreshold) {
                            activeUsers.add(data.userId);
                        }
                    });
                    
                    // Remove stale users from room
                    const usersToRemove = currentUsers.filter(uid => !activeUsers.has(uid));
                    
                    if (usersToRemove.length > 0) {
                        const updatedUsers = currentUsers.filter(uid => activeUsers.has(uid));
                        const updatedUserDetails = {};
                        
                        // Keep only active users
                        Object.keys(userDetails).forEach(uid => {
                            if (activeUsers.has(uid)) {
                                updatedUserDetails[uid] = userDetails[uid];
                            }
                        });
                        
                        // Update room
                        await roomRef.set({
                            users: updatedUsers,
                            userDetails: updatedUserDetails,
                            lastActivity: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                        
                        // Clean up stale presence records
                        usersToRemove.forEach(async (uid) => {
                            try {
                                await db.collection('presence').doc(`${roomId}_${uid}`).delete();
                            } catch (error) {
                                // Ignore deletion errors
                            }
                        });
                    }
                }
            } catch (error) {
                // Ignore monitoring errors
            }
        }, 15000); // Check every 15 seconds
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
        // Audio is ready for playback
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
        // Stop presence system
        this.stopPresenceHeartbeat();
        
        // Clean up listeners
        if (this.syncListener) this.syncListener();
        if (this.usersListener) this.usersListener();
        if (this.playlistListener) this.playlistListener();
        
        // Properly stop and clean up audio player
        try {
            this.audioPlayer.pause();
            this.audioPlayer.removeAttribute('src');
            this.audioPlayer.load();
        } catch (error) {
            console.warn('Audio cleanup warning:', error);
        }
        
        // Immediate cleanup
        if (this.immediateCleanup) {
            await this.immediateCleanup();
        }
        
        try {
            await auth.signOut();
        } catch (error) {
            console.warn('Sign out warning:', error);
        }
        
        document.getElementById('authSection').classList.remove('hidden');
        document.getElementById('appSection').classList.add('hidden');
        
        // Reset UI elements
        document.getElementById('currentTrack').textContent = 'None';
        document.getElementById('roomTime').textContent = '0:00';
        document.getElementById('playlist').innerHTML = '';
        document.getElementById('usersContainer').innerHTML = '';
        
        // Reset form borders
        document.getElementById('roomId').style.borderColor = '#ddd';
        document.getElementById('username').style.borderColor = '#ddd';
        
        this.currentRoom = null;
        this.currentUser = null;
        this.playlist = [];
        this.currentTrackIndex = 0;
    }
}

// Initialize player (will be set when Firebase is ready)
let player;

// Initialize player when Firebase is ready
window.initializeSyncPlayer = function() {
    player = new GitHubFirebaseSyncPlayer();
};

// Global functions for HTML buttons
function joinRoom() { if (player) player.joinRoom(); }
function loadGithubPlaylist() { if (player) player.loadGithubPlaylist(); }
function addSongManually() { if (player) player.addSongManually(); }
function selectTrack(index) { if (player) player.selectTrack(index); }
function playPause() { if (player) player.playPause(); }
function nextTrack() { if (player) player.nextTrack(); }
function previousTrack() { if (player) player.previousTrack(); }
function syncWithRoom() { if (player) player.syncWithRoom(); }
function refreshPlaylist() { if (player) player.refreshPlaylist(); }
function leaveRoom() { if (player) player.leaveRoom(); }