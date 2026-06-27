const ftp = require('basic-ftp');
const fs = require('fs');
const path = require('path');
const { db } = require('./database');

// Ensure media directory exists
const mediaDir = path.join(__dirname, 'data', 'media');
if (!fs.existsSync(mediaDir)) {
  fs.mkdirSync(mediaDir, { recursive: true });
}

// Helper to get settings
const getSetting = (key) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.value : null);
    });
  });
};

const connectFtp = async () => {
  const ip = await getSetting('bambu_ip');
  const accessCode = await getSetting('bambu_access_code');

  if (!ip || !accessCode) {
    throw new Error('Bambu Lab FTP credentials not fully configured.');
  }

  const client = new ftp.Client();
  // client.ftp.verbose = true;

  try {
    // Bambu uses implicit FTPS on port 990
    await client.access({
      host: ip,
      user: 'bblp',
      password: accessCode,
      port: 990,
      secure: 'implicit',
      secureOptions: {
        rejectUnauthorized: false // Ignore self-signed certs
      }
    });
    return client;
  } catch (err) {
    client.close();
    throw err;
  }
};

/**
 * Downloads the most recent timelapse from the /timelapse folder.
 */
const downloadLatestTimelapseAndPhoto = async (printName, archiveId) => {
  let client;
  try {
    client = await connectFtp();
    
    let timelapsePath = null;
    let photoPath = null;
    
    // 1. Try to fetch the latest timelapse from /timelapse
    try {
      const list = await client.list('/timelapse');
      // Filter for mp4 and sort by date modified (descending)
      const mp4s = list.filter(f => f.name.endsWith('.mp4')).sort((a, b) => b.modifiedAt - a.modifiedAt);
      
      if (mp4s.length > 0) {
        const latestMp4 = mp4s[0];
        const localPath = path.join(mediaDir, `${archiveId}_timelapse.mp4`);
        await client.downloadTo(localPath, `/timelapse/${latestMp4.name}`);
        timelapsePath = `/media/${archiveId}_timelapse.mp4`;
        console.log(`Downloaded timelapse: ${latestMp4.name}`);
      }
    } catch (err) {
      console.log('Could not fetch timelapse (maybe disabled or missing folder):', err.message);
    }

    // 2. Try to fetch the latest thumbnail/photo (bambu often stores thumbnails near the gcode or a specific cam folder)
    // The exact path varies, but often it's in /cam or /ipcam, or we just grab the last modified .jpg
    try {
      const list = await client.list('/cam');
      const jpgs = list.filter(f => f.name.endsWith('.jpg') || f.name.endsWith('.png')).sort((a, b) => b.modifiedAt - a.modifiedAt);
      
      if (jpgs.length > 0) {
        const latestJpg = jpgs[0];
        const ext = path.extname(latestJpg.name);
        const localPath = path.join(mediaDir, `${archiveId}_photo${ext}`);
        await client.downloadTo(localPath, `/cam/${latestJpg.name}`);
        photoPath = `/media/${archiveId}_photo${ext}`;
        console.log(`Downloaded photo: ${latestJpg.name}`);
      }
    } catch (err) {
      console.log('Could not fetch photo from /cam:', err.message);
    }
    
    client.close();
    
    return { timelapsePath, photoPath };
  } catch (err) {
    if (client) client.close();
    console.error('FTP Error during download:', err.message);
    return { timelapsePath: null, photoPath: null };
  }
};

module.exports = {
  connectFtp,
  downloadLatestTimelapseAndPhoto
};
