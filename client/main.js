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


let room = null;
let user = null;
let playlist = [];
let currentTrack = 0;



// Fetch playlist from GitHub
window.fetchGithubPlaylist().then(files => {
  playlist = files;
  renderPlaylist();
  if (playlist.length > 0) {
    setTrack(0);
  }
});

function renderPlaylist() {
  playlistUl.innerHTML = '';
  playlist.forEach((f, i) => {
    const li = document.createElement('li');
    li.textContent = f.name;
    if (i === currentTrack) li.style.fontWeight = 'bold';
    li.onclick = () => selectTrack(i);
    playlistUl.appendChild(li);
  });
}

function setTrack(idx) {
  currentTrack = idx;
  audio.src = playlist[currentTrack].url;
  renderPlaylist();
}

function selectTrack(idx) {
  socket.emit('sync', { action: 'select', track: idx });
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
  socket.emit('login', { room, user });
  loginDiv.style.display = 'none';
  playerDiv.style.display = 'block';
};

socket.on('userlist', (users) => {
  usersSpan.textContent = users.join(', ');
});

playBtn.onclick = () => {
  const now = Date.now();
  const startAt = now + 1500; // 1.5s in future
  socket.emit('sync', { action: 'play', time: audio.currentTime, startAt });
};
pauseBtn.onclick = () => {
  socket.emit('sync', { action: 'pause', time: audio.currentTime });
};
syncBtn.onclick = () => {
  socket.emit('sync', { action: 'seek', time: audio.currentTime });
};

socket.on('sync', (data) => {
  if (data.action === 'play') {
    audio.currentTime = data.time;
    const delay = data.startAt - Date.now();
    if (delay > 0) {
      setTimeout(() => audio.play(), delay);
    } else {
      audio.play();
    }
  } else if (data.action === 'pause') {
    audio.currentTime = data.time;
    audio.pause();
  } else if (data.action === 'seek') {
    audio.currentTime = data.time;
  } else if (data.action === 'select') {
    setTrack(data.track);
    audio.currentTime = 0;
    audio.pause();
    renderPlaylist();
  }
});
