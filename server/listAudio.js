// Lists audio files in the audio directory
const fs = require('fs');
const path = require('path');

const AUDIO_DIR = path.join(__dirname, '../client/audio');
const SUPPORTED = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus'];

function listAudioFiles() {
  return fs.readdirSync(AUDIO_DIR)
    .filter(f => SUPPORTED.includes(path.extname(f).toLowerCase()));
}

module.exports = listAudioFiles;
