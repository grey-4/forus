const socket = io();

const loginDiv = document.getElementById('login');
const playerDiv = document.getElementById('player');
const loginBtn = document.getElementById('loginBtn');
const roomInput = document.getElementById('room');
const userInput = document.getElementById('user');
const usersSpan = document.getElementById('users');


const audio = document.getElementById('audio');
const playlistUl = document.getElementById('playlist');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const syncBtn = document.getElementById('syncBtn');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');
const refreshBtn = document.getElementById('refreshBtn');


let room = null;
let user = null;
let playlist = [];
let currentTrack = 0;



// Load playlist from local server (uploaded files)
async function loadPlaylist() {
  try {
    const response = await fetch('/api/audio-files');
    const files = await response.json();
    playlist = files.map(filename => ({
      name: filename,
      url: `/audio/${filename}`
    }));
    renderPlaylist();
    if (playlist.length > 0) {
      setTrack(0);
    }
    console.log('Loaded playlist:', playlist);
  } catch (error) {
    console.error('Error loading playlist:', error);
    playlist = [];
    renderPlaylist();
  }
}

// Load playlist on page load
loadPlaylist();

function renderPlaylist() {
  playlistUl.innerHTML = '';
  if (playlist.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No songs available. Upload some songs above.';
    li.style.color = '#666';
    li.style.padding = '10px';
    playlistUl.appendChild(li);
    return;
  }
  
  playlist.forEach((f, i) => {
    const li = document.createElement('li');
    li.className = 'playlist-item';
    li.style.padding = '8px';
    li.style.borderBottom = '1px solid #eee';
    if (i === currentTrack) {
      li.style.fontWeight = 'bold';
      li.style.backgroundColor = '#e0e0e0';
    }
    
    const songName = document.createElement('span');
    songName.textContent = f.name;
    songName.style.cursor = 'pointer';
    songName.onclick = () => selectTrack(i);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '×';
    deleteBtn.className = 'delete-btn';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteSong(f.name, i);
    };
    
    li.appendChild(songName);
    li.appendChild(deleteBtn);
    playlistUl.appendChild(li);
  });
}

function setTrack(idx) {
  if (idx >= 0 && idx < playlist.length) {
    currentTrack = idx;
    audio.src = playlist[currentTrack].url;
    renderPlaylist();
    console.log('Set track:', playlist[currentTrack].name);
  }
}

function selectTrack(idx) {
  console.log('Selecting track:', idx);
  socket.emit('sync', { action: 'select', track: idx });
}

// Upload functionality
uploadBtn.onclick = async () => {
  const file = fileInput.files[0];
  if (!file) {
    uploadStatus.textContent = 'Please select a file';
    uploadStatus.style.color = 'red';
    return;
  }
  
  const formData = new FormData();
  formData.append('audioFile', file);
  
  uploadStatus.textContent = 'Uploading...';
  uploadStatus.style.color = 'blue';
  
  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (response.ok) {
      uploadStatus.textContent = 'Upload successful!';
      uploadStatus.style.color = 'green';
      fileInput.value = '';
      loadPlaylist(); // Reload playlist
    } else {
      uploadStatus.textContent = result.error || 'Upload failed';
      uploadStatus.style.color = 'red';
    }
  } catch (error) {
    uploadStatus.textContent = 'Upload error: ' + error.message;
    uploadStatus.style.color = 'red';
  }
};

// Refresh playlist
refreshBtn.onclick = () => {
  loadPlaylist();
};

// Delete song functionality
async function deleteSong(filename, index) {
  if (!confirm(`Delete "${filename}"?`)) return;
  
  try {
    const response = await fetch(`/api/delete/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      // If deleted song was current track, reset to first track
      if (index === currentTrack) {
        if (playlist.length > 1) {
          setTrack(0);
        } else {
          audio.pause();
          audio.src = '';
          currentTrack = 0;
        }
      } else if (index < currentTrack) {
        currentTrack--; // Adjust current track index
      }
      
      loadPlaylist(); // Reload playlist
      socket.emit('sync', { action: 'playlist-updated' }); // Notify other users
    } else {
      const result = await response.json();
      alert('Delete failed: ' + result.error);
    }
  } catch (error) {
    alert('Delete error: ' + error.message);
  }
}
prevBtn.onclick = () => {
  if (currentTrack > 0) {
    socket.emit('sync', { action: 'select', track: currentTrack - 1 });
  }
};
nextBtn.onclick = () => {
  if (currentTrack < playlist.length - 1) {
    socket.emit('sync', { action: 'select', track: currentTrack + 1 });
  }
};

loginBtn.onclick = () => {
  room = roomInput.value.trim();
  user = userInput.value.trim();
  if (!room || !user) return alert('Enter room and name');
  console.log('Logging in:', { room, user });
  socket.emit('login', { room, user });
  loginDiv.style.display = 'none';
  playerDiv.style.display = 'block';
  // Load playlist after login
  loadPlaylist();
};

socket.on('userlist', (users) => {
  console.log('User list updated:', users);
  usersSpan.textContent = users.join(', ');
});

// Add connection status indicators
socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

// Listen for playlist updates from server
socket.on('playlist-updated', () => {
  console.log('Playlist updated, reloading...');
  loadPlaylist();
});

playBtn.onclick = () => {
  const now = Date.now();
  const startAt = now + 1500; // 1.5s in future
  console.log('Sending play command');
  socket.emit('sync', { action: 'play', time: audio.currentTime, startAt, track: currentTrack });
};
pauseBtn.onclick = () => {
  console.log('Sending pause command');
  socket.emit('sync', { action: 'pause', time: audio.currentTime, track: currentTrack });
};
syncBtn.onclick = () => {
  console.log('Sending sync command');
  socket.emit('sync', { action: 'seek', time: audio.currentTime, track: currentTrack });
};

socket.on('sync', (data) => {
  console.log('Received sync command:', data);
  
  if (data.action === 'play') {
    // Make sure we're on the right track
    if (data.track !== undefined && data.track !== currentTrack) {
      setTrack(data.track);
    }
    audio.currentTime = data.time;
    const delay = data.startAt - Date.now();
    if (delay > 0) {
      setTimeout(() => {
        audio.play();
        console.log('Started playing with delay:', delay);
      }, delay);
    } else {
      audio.play();
      console.log('Started playing immediately');
    }
  } else if (data.action === 'pause') {
    if (data.track !== undefined && data.track !== currentTrack) {
      setTrack(data.track);
    }
    audio.currentTime = data.time;
    audio.pause();
    console.log('Paused');
  } else if (data.action === 'seek') {
    if (data.track !== undefined && data.track !== currentTrack) {
      setTrack(data.track);
    }
    audio.currentTime = data.time;
    console.log('Seeked to:', data.time);
  } else if (data.action === 'select') {
    setTrack(data.track);
    audio.currentTime = 0;
    audio.pause();
    renderPlaylist();
    console.log('Selected track:', data.track);
  } else if (data.action === 'playlist-updated') {
    loadPlaylist();
    console.log('Playlist updated by another user');
  }
});
