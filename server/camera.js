const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { db } = require('./database');

const getSetting = (key) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.value : null);
    });
  });
};

const captureCameraSnapshot = async (printer, archiveId) => {
  const ip = printer.ip;
  const accessCode = printer.access_code;
  
  if (!ip || !accessCode) {
    throw new Error('Printer IP or Access Code not configured');
  }

  const mediaDir = path.join(__dirname, 'data', 'media');
  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
  }

  const localPhotoPath = path.join(mediaDir, `${archiveId}_photo.jpg`);
  const rtspUrl = `rtsps://bblp:${accessCode}@${ip}:322/streaming/live/1`;
  const cmd = `ffmpeg -y -tls_verify 0 -rtsp_transport tcp -i "${rtspUrl}" -vframes 1 -update 1 "${localPhotoPath}"`;

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[RTSP] Attempting to capture camera snapshot for archive ${archiveId} (Attempt ${attempt}/${maxRetries})...`);
    
    try {
      await new Promise((resolve, reject) => {
        exec(cmd, { timeout: 15000 }, (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else if (fs.existsSync(localPhotoPath)) {
            resolve();
          } else {
            reject(new Error('FFmpeg completed but file was not created'));
          }
        });
      });
      
      console.log(`[RTSP] Successfully captured snapshot to ${localPhotoPath}`);
      return `/media/${archiveId}_photo.jpg`;
    } catch (err) {
      console.error(`[RTSP] Attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxRetries) {
        console.log(`[RTSP] Waiting 5 seconds before retrying...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  console.error(`[RTSP] Failed to capture snapshot after ${maxRetries} attempts.`);
  return null;
};

const extractFrameFromMp4 = (mp4Path, outputPath) => {
  return new Promise((resolve, reject) => {
    // Extract the very last frame using -sseof -3 (look at last 3 seconds) and pull 1 frame
    // A simpler approach for the absolute last frame: ffmpeg -sseof -1 -i file.mp4 -update 1 -q:v 1 out.jpg
    const cmd = `ffmpeg -y -sseof -1 -i "${mp4Path}" -update 1 -vframes 1 -q:v 2 "${outputPath}"`;
    
    console.log(`[FFMPEG] Extracting fallback frame from MP4...`);
    exec(cmd, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[FFMPEG] MP4 extraction error: ${error.message}`);
        // Fallback again: just grab a frame from the middle if sseof fails on some files
        const fallbackCmd = `ffmpeg -y -i "${mp4Path}" -vframes 1 -q:v 2 "${outputPath}"`;
        exec(fallbackCmd, { timeout: 10000 }, (err2) => {
          if (err2 || !fs.existsSync(outputPath)) return resolve(null);
          resolve(outputPath);
        });
        return;
      }
      
      if (fs.existsSync(outputPath)) {
        resolve(outputPath);
      } else {
        resolve(null);
      }
    });
  });
};

module.exports = {
  captureCameraSnapshot,
  extractFrameFromMp4
};
