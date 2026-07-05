const ftp = require('basic-ftp');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
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

const connectFtp = async (overrides = {}) => {
  const ip = overrides.bambu_ip !== undefined ? overrides.bambu_ip : await getSetting('bambu_ip');
  const accessCode = overrides.bambu_access_code !== undefined && overrides.bambu_access_code !== '********' ? overrides.bambu_access_code : await getSetting('bambu_access_code');

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
const downloadLatestTimelapseAndPhoto = async (printName, archiveId, gcodeFile = null) => {
  let client;
  try {
    client = await connectFtp();
    
    let timelapsePath = null;
    let photoPath = null;
    
    // 1. Try to fetch the latest timelapse from /timelapse
    let latestMp4Name = null;
    try {
      const list = await client.list('/timelapse');
      // Filter for mp4 and sort alphabetically descending to get the latest
      const mp4s = list.filter(f => f.name.endsWith('.mp4')).sort((a, b) => b.name.localeCompare(a.name));
      
      if (mp4s.length > 0) {
        const latestMp4 = mp4s[0];
        latestMp4Name = latestMp4.name;
        const localPath = path.join(mediaDir, `${archiveId}_timelapse.mp4`);
        await client.downloadTo(localPath, `/timelapse/${latestMp4.name}`);
        timelapsePath = `/media/${archiveId}_timelapse.mp4`;
        console.log(`Downloaded timelapse: ${latestMp4.name}`);
      }
    } catch (err) {
      console.log('Could not fetch timelapse (maybe disabled or missing folder):', err.message);
    }

    // 2. Fetch the matching thumbnail from /timelapse/thumbnails/
    if (latestMp4Name) {
      try {
        const baseName = path.basename(latestMp4Name, '.mp4');
        const localPhotoPath = path.join(mediaDir, `${archiveId}_photo.jpg`);
        await client.downloadTo(localPhotoPath, `/timelapse/thumbnails/${baseName}.jpg`);
        photoPath = `/media/${archiveId}_photo.jpg`;
        console.log(`Downloaded thumbnail from /timelapse/thumbnails/${baseName}.jpg`);
      } catch (err) {
        console.log('Could not fetch timelapse thumbnail, falling back to /cam:', err.message);
        // Fallback: try /cam folder
        try {
          const list = await client.list('/cam');
          const jpgs = list.filter(f => f.name.endsWith('.jpg') || f.name.endsWith('.png')).sort((a, b) => b.name.localeCompare(a.name));
          if (jpgs.length > 0) {
            const latestJpg = jpgs[0];
            const ext = path.extname(latestJpg.name);
            const localPath = path.join(mediaDir, `${archiveId}_photo${ext}`);
            await client.downloadTo(localPath, `/cam/${latestJpg.name}`);
            photoPath = `/media/${archiveId}_photo${ext}`;
            console.log(`Downloaded photo from /cam: ${latestJpg.name}`);
          }
        } catch (camErr) {
          console.log('Could not fetch photo from /cam:', camErr.message);
        }
      }
    } else {
      // No timelapse at all — try /cam directly
      try {
        const list = await client.list('/cam');
        const jpgs = list.filter(f => f.name.endsWith('.jpg') || f.name.endsWith('.png')).sort((a, b) => b.name.localeCompare(a.name));
        if (jpgs.length > 0) {
          const latestJpg = jpgs[0];
          const ext = path.extname(latestJpg.name);
          const localPath = path.join(mediaDir, `${archiveId}_photo${ext}`);
          await client.downloadTo(localPath, `/cam/${latestJpg.name}`);
          photoPath = `/media/${archiveId}_photo${ext}`;
          console.log(`Downloaded photo from /cam: ${latestJpg.name}`);
        }
      } catch (err) {
        console.log('Could not fetch photo from /cam:', err.message);
      }
    }

    client.close();
    
    return { timelapsePath, photoPath };
  } catch (err) {
    if (client) client.close();
    console.error('FTP Error during download:', err.message);
    return { timelapsePath: null, photoPath: null };
  }
};

const findRemotePrintFile = async (client, gcodeFile, subtaskName) => {
  let cleanPath = gcodeFile.startsWith('/data/') ? gcodeFile.substring(5) : gcodeFile;
  if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
  
  const pathsToTry = [];
  pathsToTry.push(gcodeFile.startsWith('/') ? gcodeFile : '/' + gcodeFile);
  pathsToTry.push(cleanPath);
  pathsToTry.push(`/tasks${cleanPath}`);

  if (subtaskName) {
    const sub = subtaskName.trim();
    pathsToTry.push(`/${sub}.gcode.3mf`);
    pathsToTry.push(`/cache/${sub}.gcode.3mf`);
    pathsToTry.push(`/${sub}.3mf`);
    pathsToTry.push(`/cache/${sub}.3mf`);
  }

  // 1. Try explicit paths
  for (const p of pathsToTry) {
    try {
      await client.size(p); // Throws if file does not exist
      return p;
    } catch(e) {}
  }
  
  // 2. Try fuzzy match or fallback to the newest .3mf file in root
  try {
    const rootFiles = await client.list('/');
    const candidates = rootFiles.filter(f => f.name.toLowerCase().endsWith('.3mf'));
    
    if (subtaskName) {
      const subClean = subtaskName.trim().toLowerCase();
      const bestMatch = candidates.find(f => f.name.toLowerCase().includes(subClean));
      if (bestMatch) return `/${bestMatch.name}`;
    }
    
    if (candidates.length > 0) {
      // rawModifiedAt is usually like 'Jul 02 17:18'
      candidates.sort((a, b) => new Date(b.rawModifiedAt) - new Date(a.rawModifiedAt));
      return `/${candidates[0].name}`;
    }
  } catch (e) {
    console.error('Fallback search failed:', e.message);
  }
  
  return null;
};

/**
 * Extracts the 3MF thumbnail at the start of a print.
 */
const extractThumbnailFrom3mf = async (gcodeFile, prefix, subtaskName = null) => {
  if (!gcodeFile || !gcodeFile.toLowerCase().endsWith('.3mf')) return null;
  
  let client;
  try {
    client = await connectFtp();
    const remotePath = await findRemotePrintFile(client, gcodeFile, subtaskName);
    if (!remotePath) {
      console.log(`Could not find remote file for thumbnail extraction.`);
      client.close();
      return null;
    }
    
    const localTemp3mf = path.join(mediaDir, `${prefix}_temp_thumb.3mf`);
    console.log(`Attempting to extract initial thumbnail from ${remotePath}`);
    await client.downloadTo(localTemp3mf, remotePath);
    
    const zip = new AdmZip(localTemp3mf);
    const zipEntries = zip.getEntries();
    const thumbnailEntry = zipEntries.find(e => e.entryName.toLowerCase() === 'metadata/plate_1.png');
    
    let thumbnailPath = null;
    if (thumbnailEntry) {
      const localThumbPath = path.join(mediaDir, `${prefix}_thumbnail.png`);
      fs.writeFileSync(localThumbPath, thumbnailEntry.getData());
      thumbnailPath = `/media/${prefix}_thumbnail.png`;
      console.log(`Successfully extracted initial 3MF thumbnail for prefix ${prefix}`);
    }
    
    fs.unlinkSync(localTemp3mf);
    client.close();
    return thumbnailPath;
  } catch (err) {
    if (client) client.close();
    console.log('Failed to extract initial thumbnail from 3MF:', err.message);
    return null;
  }
};

const extractWeightsFrom3mf = async (client, remoteFile) => {
  const localTemp = path.join(mediaDir, 'temp_print.3mf');
  try {
    await client.downloadTo(localTemp, remoteFile);
    const zip = new AdmZip(localTemp);
    const zipEntries = zip.getEntries();
    const detailsEntry = zipEntries.find(e => e.entryName === 'Metadata/project_details.json' || e.entryName === 'Metadata/slice_info.config');
    
    if (detailsEntry) {
      const contentStr = detailsEntry.getData().toString('utf8');
      fs.unlinkSync(localTemp); // Cleanup
      
      try {
        const data = JSON.parse(contentStr);
        if (data.filament_weight) return Array.isArray(data.filament_weight) ? data.filament_weight : [data.filament_weight];
        if (data.plate_summary && data.plate_summary.length > 0) return data.plate_summary[0].filament_weight || [];
      } catch (jsonErr) {
        // It's XML (slice_info.config)
        const filamentRegex = /<filament\s+[^>]*used_g="([\d\.]+)"/gi;
        const weights = [];
        let match;
        while ((match = filamentRegex.exec(contentStr)) !== null) {
          weights.push(parseFloat(match[1]));
        }
        if (weights.length > 0) return weights;

        // Fallback to total weight metadata
        const weightMatch = contentStr.match(/<metadata\s+key="weight"\s+value="([\d\.\,\s]+)"/i);
        if (weightMatch && weightMatch[1]) {
           return [parseFloat(weightMatch[1])];
        }
      }
    }
  } catch (err) {
    console.error(`Failed to extract weights from 3mf at ${remoteFile}:`, err.message);
  }
  if (fs.existsSync(localTemp)) fs.unlinkSync(localTemp);
  return null;
};

const extractWeightsFromGcode = async (client, remoteFile) => {
  const localTemp = path.join(mediaDir, 'temp_print.gcode');
  try {
    await client.downloadTo(localTemp, remoteFile);
    const content = fs.readFileSync(localTemp, 'utf8');
    fs.unlinkSync(localTemp);

    const match = content.match(/;\s*filament used \[g\]\s*=\s*([\d\.\,\s]+)/i);
    if (match && match[1]) {
      const weightsStr = match[1].split(',');
      const weights = weightsStr.map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
      if (weights.length > 0) return weights;
    }
  } catch (err) {
    console.error(`Failed to extract weights from gcode at ${remoteFile}:`, err.message);
  }
  if (fs.existsSync(localTemp)) fs.unlinkSync(localTemp);
  return null;
};

const getPredictedWeights = async (gcodeFile, subtaskName) => {
  let client;
  try {
    client = await connectFtp();
    const remotePath = await findRemotePrintFile(client, gcodeFile, subtaskName);
    
    if (!remotePath) {
      console.log(`Could not find remote file for weight extraction.`);
      client.close();
      return { weights: null, path: null };
    }

    const isGcode = remotePath.toLowerCase().endsWith('.gcode');
    const extractFn = isGcode ? extractWeightsFromGcode : extractWeightsFrom3mf;
    
    const weights = await extractFn(client, remotePath);
    if (weights) {
      console.log(`Successfully extracted weights from ${remotePath}`);
    } else {
      console.log(`Failed to parse weights inside ${remotePath}`);
    }

    client.close();
    return { weights, path: remotePath };
  } catch (err) {
    if (client) client.close();
    console.error('FTP Error getting weights:', err.message);
    return { weights: null, path: null };
  }
};

module.exports = {
  connectFtp,
  downloadLatestTimelapseAndPhoto,
  extractThumbnailFrom3mf,
  getPredictedWeights
};
