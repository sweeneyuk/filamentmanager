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

const captureCameraSnapshot = async (archiveId) => {
  return new Promise(async (resolve, reject) => {
    try {
      const ip = await getSetting('bambu_ip');
      const accessCode = await getSetting('bambu_access_code');
      
      if (!ip || !accessCode) {
        return reject(new Error('Bambu IP or Access Code not configured'));
      }

      const mediaDir = path.join(__dirname, 'data', 'media');
      if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir, { recursive: true });
      }

      const localPhotoPath = path.join(mediaDir, `${archiveId}_photo.jpg`);
      const rtspUrl = `rtsps://bblp:${accessCode}@${ip}:322/streaming/live/1`;

      // ffmpeg command to capture a single frame from the RTSPS stream
      const cmd = `ffmpeg -y -tls_verify 0 -rtsp_transport tcp -i "${rtspUrl}" -vframes 1 -update 1 "${localPhotoPath}"`;

      console.log(`[RTSP] Attempting to capture camera snapshot for archive ${archiveId}...`);
      
      exec(cmd, { timeout: 15000 }, (error, stdout, stderr) => {
        if (error) {
          console.error(`[RTSP] FFmpeg error: ${error.message}`);
          return resolve(null); // Return null on failure so caller can fallback
        }
        
        if (fs.existsSync(localPhotoPath)) {
          console.log(`[RTSP] Successfully captured snapshot to ${localPhotoPath}`);
          resolve(`/media/${archiveId}_photo.jpg`);
        } else {
          console.error(`[RTSP] FFmpeg completed but file was not created`);
          resolve(null);
        }
      });

    } catch (err) {
      console.error(`[RTSP] Setup error: ${err.message}`);
      resolve(null);
    }
  });
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
