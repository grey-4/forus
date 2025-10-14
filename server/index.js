// Simple Node.js + Express + Socket.IO server for music sync
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const audioDir = path.join(__dirname, '../client/audio');
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    cb(null, audioDir);
  },
  filename: (req, file, cb) => {
    // Keep original filename but ensure it's safe
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, safeName);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});


// Serve static files (audio, client)
app.use('/audio', express.static(path.join(__dirname, '../client/audio')));
app.use('/', express.static(path.join(__dirname, '../client')));

// Endpoint to list audio files
const listAudioFiles = require('./listAudio');
app.get('/api/audio-files', (req, res) => {
  res.json(listAudioFiles());
});

// Upload endpoint
app.post('/api/upload', upload.single('audioFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  console.log('File uploaded:', req.file.filename);
  
  // Notify all connected clients about the new playlist
  io.emit('playlist-updated');
  
  res.json({ 
    message: 'File uploaded successfully', 
    filename: req.file.filename 
  });
});

// Delete song endpoint
app.delete('/api/delete/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../client/audio', filename);
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log('File deleted:', filename);
    
    // Notify all connected clients about the updated playlist
    io.emit('playlist-updated');
    
    res.json({ message: 'File deleted successfully' });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// In-memory user/session store (for demo only)
let rooms = {};

io.on('connection', (socket) => {
  let currentRoom = null;
  let username = null;
  console.log('User connected:', socket.id);

  socket.on('login', ({ room, user }) => {
    console.log(`User ${user} joining room ${room}`);
    username = user;
    currentRoom = room;
    socket.join(room);
    if (!rooms[room]) rooms[room] = [];
    
    // Remove user if already exists (prevent duplicates)
    rooms[room] = rooms[room].filter(u => u !== user);
    rooms[room].push(user);
    
    console.log(`Room ${room} now has users:`, rooms[room]);
    io.to(room).emit('userlist', rooms[room]);
  });

  socket.on('sync', (data) => {
    if (currentRoom) {
      console.log(`Sync in room ${currentRoom}:`, data);
      // For playlist actions, broadcast to all (including sender) for consistency
      if (data.action === 'select') {
        io.to(currentRoom).emit('sync', data);
      } else {
        socket.to(currentRoom).emit('sync', data);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (currentRoom && username) {
      rooms[currentRoom] = rooms[currentRoom].filter(u => u !== username);
      console.log(`Room ${currentRoom} now has users:`, rooms[currentRoom]);
      io.to(currentRoom).emit('userlist', rooms[currentRoom]);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
