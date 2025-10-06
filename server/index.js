// Simple Node.js + Express + Socket.IO server for music sync
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);


// Serve static files (audio, client)
app.use('/audio', express.static(path.join(__dirname, '../client/audio')));
app.use('/', express.static(path.join(__dirname, '../client')));

// Endpoint to list audio files
const listAudioFiles = require('./listAudio');
app.get('/api/audio-files', (req, res) => {
  res.json(listAudioFiles());
});

// In-memory user/session store (for demo only)
let rooms = {};

io.on('connection', (socket) => {
  let currentRoom = null;
  let username = null;

  socket.on('login', ({ room, user }) => {
    username = user;
    currentRoom = room;
    socket.join(room);
    if (!rooms[room]) rooms[room] = [];
    rooms[room].push(user);
    io.to(room).emit('userlist', rooms[room]);
  });

  socket.on('sync', (data) => {
    if (currentRoom) {
      // For playlist actions, broadcast to all (including sender) for consistency
      if (data.action === 'select') {
        io.to(currentRoom).emit('sync', data);
      } else {
        socket.to(currentRoom).emit('sync', data);
      }
    }
  });

  socket.on('disconnect', () => {
    if (currentRoom && username) {
      rooms[currentRoom] = rooms[currentRoom].filter(u => u !== username);
      io.to(currentRoom).emit('userlist', rooms[currentRoom]);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
