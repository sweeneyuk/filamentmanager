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

const connectFtp = async (printer, maxRetries = 3) => {
  const ip = printer.ip;
  const accessCode = printer.access_code;

  if (!ip || !accessCode) {
    throw new Error('Printer FTP credentials not fully configured.');
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
      if (attempt < maxRetries) {
        console.log(`[FTP] Connection attempt ${attempt} failed: ${err.message}. Retrying in 5s...`);
        await new Promise(r => setTimeout(r, 5000));
      } else {
        throw err;
      }
    }
  }
};

/**
 * Downloads the most recent timelapse from the /timelapse folder.
 */
const downloadLatestTimelapse = async (printer, printName, archiveId) => {
  let client;
  try {
    client = await connectFtp(printer);
    
    let timelapsePath = null;
    let localPath = null;
    
    // Try to fetch the latest timelapse from /timelapse
    try {
      const list = await client.list('/timelapse');
      // Filter for mp4 and sort alphabetically descending to get the latest
      const mp4s = list.filter(f => f.name.endsWith('.mp4')).sort((a, b) => b.name.localeCompare(a.name));
      
      if (mp4s.length > 0) {
        const latestMp4 = mp4s[0];
        localPath = path.join(mediaDir, `${archiveId}_timelapse.mp4`);
        await client.downloadTo(localPath, `/timelapse/${latestMp4.name}`);
        timelapsePath = `/media/${archiveId}_timelapse.mp4`;
        console.log(`Downloaded timelapse: ${latestMp4.name}`);
      }
    } catch (err) {
      console.log('Could not fetch timelapse (maybe disabled or missing folder):', err.message);
    }

    client.close();
    return { timelapsePath, localPath };
  } catch (err) {
    if (client) client.close();
    console.error('FTP Timelapse Error:', err.message);
    return { timelapsePath: null, localPath: null };
  }
};

const findRemotePrintFile = async (client, gcodeFile, subtaskName) => {
  // Build a prioritised list of explicit paths to try
  const pathsToTry = new Set();

  // 1. Use the raw gcode_file path reported by MQTT
  if (gcodeFile) {
    pathsToTry.add(gcodeFile.startsWith('/') ? gcodeFile : '/' + gcodeFile);
    const clean = gcodeFile.startsWith('/data/') ? gcodeFile.substring(5) : gcodeFile;
    pathsToTry.add(clean.startsWith('/') ? clean : '/' + clean);
    pathsToTry.add(`/tasks${clean.startsWith('/') ? clean : '/' + clean}`);
  }

  // 2. Build candidates from subtask_name (matching Bambuddy naming conventions)
  const buildNameVariants = (base) => {
    const variants = [];
    for (const name of [`${base}.gcode.3mf`, `${base}.3mf`]) {
      for (const dir of ['/', '/cache', '/model', '/data', '/data/Metadata']) {
        variants.push(dir === '/' ? `/${name}` : `${dir}/${name}`);
      }
      // Also try with spaces replaced by underscores
      if (name.includes(' ')) {
        const normalized = name.replace(/ /g, '_');
        for (const dir of ['/', '/cache', '/model', '/data']) {
          variants.push(dir === '/' ? `/${normalized}` : `${dir}/${normalized}`);
        }
      }
    }
    return variants;
  };

  if (subtaskName) {
    buildNameVariants(subtaskName.trim()).forEach(p => pathsToTry.add(p));
  }

  // 3. Try each explicit path (existence check via size, which is cheap)
  for (const p of pathsToTry) {
    try {
      await client.size(p);
      console.log(`[FTP] Found 3MF at explicit path: ${p}`);
      return p;
    } catch(e) {}
  }

  // 4. Fuzzy directory scan across all common locations
  console.log(`[FTP] Explicit paths failed, scanning directories for 3MF...`);
  try {
    const allCandidates = [];
    const dirsToScan = ['/', '/cache', '/model', '/data', '/data/Metadata', '/tasks'];
    for (const d of dirsToScan) {
      try {
        const files = await client.list(d);
        for (const f of files) {
          if (f.name.toLowerCase().endsWith('.3mf')) {
            allCandidates.push({
              name: f.name,
              path: d === '/' ? `/${f.name}` : `${d}/${f.name}`,
              modifiedAt: f.modifiedAt ? f.modifiedAt.getTime() : (f.rawModifiedAt ? new Date(f.rawModifiedAt).getTime() : 0)
            });
          }
        }
      } catch(e) {}
    }

    if (subtaskName) {
      const subClean = subtaskName.trim().toLowerCase().replace(/ /g, '_');
      // Exact-ish name match first (spaces → underscores normalised)
      const bestMatch = allCandidates.find(f => f.name.toLowerCase().replace(/ /g, '_').includes(subClean));
      if (bestMatch) {
        console.log(`[FTP] Fuzzy name match: ${bestMatch.path}`);
        return bestMatch.path;
      }
    }

    // Fall back to the most recently modified .3mf file
    if (allCandidates.length > 0) {
      allCandidates.sort((a, b) => b.modifiedAt - a.modifiedAt);
      console.log(`[FTP] Falling back to most-recent 3MF: ${allCandidates[0].path}`);
      return allCandidates[0].path;
    }
  } catch (e) {
    console.error('[FTP] Fallback directory scan failed:', e.message);
  }

  return null;
};

/**
 * Extracts the 3MF thumbnail at the start of a print.
 */
/**
 * Download a remote file with retries on transient FTP errors.
 * 550 (file not found) is not retried — it means the path is wrong.
 */
const downloadWithRetry = async (client, remotePath, localPath, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await client.downloadTo(localPath, remotePath);
      return true;
    } catch (err) {
      const msg = err.message || '';
      // 550 = file does not exist at this path — pointless to retry
      if (msg.includes('550')) throw err;
      if (attempt < maxRetries) {
        const delay = 500 * attempt;
        console.log(`[FTP] Download attempt ${attempt} failed (${msg}), retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
};

const extractThumbnailFrom3mf = async (printer, gcodeFile, prefix, subtaskName = null) => {
  let client;
  try {
    client = await connectFtp(printer);
    const remotePath = await findRemotePrintFile(client, gcodeFile, subtaskName);
    if (!remotePath || !remotePath.toLowerCase().endsWith('.3mf')) {
      console.log(`[FTP] Could not find remote 3MF for thumbnail extraction (gcode_file=${gcodeFile}, subtask=${subtaskName}).`);
      client.close();
      return null;
    }

    const localTemp3mf = path.join(mediaDir, `${prefix}_temp_thumb.3mf`);
    console.log(`[FTP] Downloading 3MF for thumbnail from ${remotePath}`);
    await downloadWithRetry(client, remotePath, localTemp3mf);

    const zip = new AdmZip(localTemp3mf);
    const { extract3mfThumbnailBuffer } = require('./3mfUtils');

    // Detect plate number: first from subtask_name, then from gcode_file path
    let plateNumber = null;
    const plateSource = subtaskName || gcodeFile || '';
    const plateMatch = plateSource.match(/(?:plate[_ ]?)(\d+)/i);
    if (plateMatch) {
      plateNumber = parseInt(plateMatch[1], 10);
      console.log(`[FTP] Detected plate number ${plateNumber} for thumbnail extraction`);
    }

    const thumbnailBuffer = extract3mfThumbnailBuffer(zip, plateNumber);
    let thumbnailPath = null;

    if (thumbnailBuffer) {
      const localThumbPath = path.join(mediaDir, `${prefix}_thumbnail.png`);
      fs.writeFileSync(localThumbPath, thumbnailBuffer);
      thumbnailPath = `/media/${prefix}_thumbnail.png`;
      console.log(`[FTP] Successfully extracted 3MF thumbnail for prefix ${prefix}`);
    } else {
      console.log(`[FTP] No thumbnail found inside 3MF at ${remotePath} (entries: ${zip.getEntries().map(e => e.entryName).filter(n => n.endsWith('.png')).join(', ') || 'none'})`);
    }

    try { fs.unlinkSync(localTemp3mf); } catch (_) {}
    client.close();
    return thumbnailPath;
  } catch (err) {
    if (client) client.close();
    console.log('[FTP] Failed to extract thumbnail from 3MF:', err.message);
    return null;
  }
};

const extractWeightsFrom3mf = async (client, remoteFile, subtaskName = null, gcodeFile = null) => {
  const localTemp = path.join(mediaDir, `temp_${Date.now()}_print.3mf`);
  try {
    await client.downloadTo(localTemp, remoteFile);
    const zip = new AdmZip(localTemp);
    const zipEntries = zip.getEntries();

    // Detect plate number: first from subtask_name, then from gcode_file path
    const plateSource = subtaskName || gcodeFile || '';
    const plateMatch = plateSource.match(/(?:plate[_ ]?)(\d+)/i);
    const plateNumber = plateMatch ? parseInt(plateMatch[1], 10) : 1;

    // Prioritize slice_info.config which contains plate configs, filament lists, and layer mappings
    const sliceEntry = zipEntries.find(e => e.entryName === 'Metadata/slice_info.config');
    if (sliceEntry) {
      const contentStr = sliceEntry.getData().toString('utf8');
      // Extract plate blocks
      const plateRegex = /<plate>([\s\S]*?)<\/plate>/gi;
      let pMatch;
      const plateBlocks = [];
      while ((pMatch = plateRegex.exec(contentStr)) !== null) {
        const block = pMatch[1];
        const idxMatch = block.match(/<metadata\s+key="index"\s+value="(\d+)"/i);
        const idx = idxMatch ? parseInt(idxMatch[1], 10) : 1;
        plateBlocks.push({ index: idx, content: block });
      }

      const selectedPlate = (plateBlocks.length > 0)
        ? (plateBlocks.find(p => p.index === plateNumber) || plateBlocks[0])
        : { content: contentStr };

      const filaments = [];
      const weights = [];
      const filamentRegex = /<filament\s+([^>]+)\/>/gi;
      let fMatch;
      while ((fMatch = filamentRegex.exec(selectedPlate.content)) !== null) {
        const attrs = fMatch[1];
        const id = (attrs.match(/id="([^"]+)"/) || [])[1];
        const used_g = parseFloat((attrs.match(/used_g="([^"]+)"/) || [])[1] || '0');
        const color = (attrs.match(/color="([^"]+)"/) || [])[1];
        const type = (attrs.match(/type="([^"]+)"/) || [])[1];
        filaments.push({ id, used_g, color, type });
        weights.push(used_g);
      }

      const lflRegex = /<layer_filament_list\s+filament_list="([^"]+)"\s+layer_ranges="([^"]+)"/gi;
      let lMatch;
      const rawLists = [];
      while ((lMatch = lflRegex.exec(selectedPlate.content)) !== null) {
        const fList = lMatch[1].trim().split(/\s+/).map(x => parseInt(x, 10)).filter(x => !isNaN(x));
        const ranges = lMatch[2].trim().split(/\s+/).map(x => parseInt(x, 10)).filter(x => !isNaN(x));
        rawLists.push({ fList, ranges });
      }

      let allFIndices = [];
      rawLists.forEach(r => allFIndices.push(...r.fList));
      const minIdx = allFIndices.length > 0 ? Math.min(...allFIndices) : 0;
      const maxIdx = allFIndices.length > 0 ? Math.max(...allFIndices) : 0;
      const is1Based = minIdx >= 1 && maxIdx === weights.length && !allFIndices.includes(0);

      const layerMap = {};
      const layerCounts = {};
      rawLists.forEach(({ fList, ranges }) => {
        const normalizedFList = is1Based ? fList.map(x => x - 1) : fList;
        for (let i = 0; i < ranges.length; i += 2) {
          const start = ranges[i];
          const end = ranges[i + 1] !== undefined ? ranges[i + 1] : start;
          for (let l = start; l <= end; l++) {
            layerMap[l] = normalizedFList;
            normalizedFList.forEach(fIdx => {
              layerCounts[fIdx] = (layerCounts[fIdx] || 0) + 1;
            });
          }
        }
      });

      if (fs.existsSync(localTemp)) fs.unlinkSync(localTemp);

      if (weights.length > 0) {
        return { weights, filaments, layerMap, layerCounts };
      }

      // Fallback to total weight metadata within plate
      const weightMatch = selectedPlate.content.match(/<metadata\s+key="weight"\s+value="([\d\.\,\s]+)"/i);
      if (weightMatch && weightMatch[1]) {
        return { weights: [parseFloat(weightMatch[1])], filaments: null, layerMap: null, layerCounts: null };
      }
    }

    // Secondary fallback: project_details.json
    const detailsEntry = zipEntries.find(e => e.entryName === 'Metadata/project_details.json');
    if (detailsEntry) {
      const contentStr = detailsEntry.getData().toString('utf8');
      if (fs.existsSync(localTemp)) fs.unlinkSync(localTemp);
      try {
        const data = JSON.parse(contentStr);
        if (data.plate_summary && data.plate_summary.length > 0) {
          const plateObj = data.plate_summary.find(p => p.index === plateNumber) || data.plate_summary[0];
          const w = plateObj?.filament_weight || [];
          if (w.length > 0) return { weights: Array.isArray(w) ? w : [w], filaments: null, layerMap: null, layerCounts: null };
        }
        if (data.filament_weight) {
          const w = Array.isArray(data.filament_weight) ? data.filament_weight : [data.filament_weight];
          return { weights: w, filaments: null, layerMap: null, layerCounts: null };
        }
      } catch (_) {}
    }

    // Tertiary fallback: plate JSON file (e.g. Metadata/plate_1.json)
    const plateJsonEntry = zipEntries.find(e => e.entryName === `Metadata/plate_${plateNumber}.json` || e.entryName === 'Metadata/plate_1.json');
    if (plateJsonEntry) {
      try {
        const pData = JSON.parse(plateJsonEntry.getData().toString('utf8'));
        if (pData.filament_weight) {
          const w = Array.isArray(pData.filament_weight) ? pData.filament_weight : [pData.filament_weight];
          if (fs.existsSync(localTemp)) fs.unlinkSync(localTemp);
          return { weights: w, filaments: null, layerMap: null, layerCounts: null };
        }
      } catch (_) {}
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
      if (weights.length > 0) return { weights, filaments: null, layerMap: null, layerCounts: null };
    }
  } catch (err) {
    console.error(`Failed to extract weights from gcode at ${remoteFile}:`, err.message);
  }
  if (fs.existsSync(localTemp)) fs.unlinkSync(localTemp);
  return null;
};

const getPredictedWeights = async (printer, gcodeFile, subtaskName) => {
  let client;
  try {
    client = await connectFtp(printer);
    const remotePath = await findRemotePrintFile(client, gcodeFile, subtaskName);
    
    if (!remotePath) {
      console.log(`Could not find remote file for weight extraction.`);
      client.close();
      return { weights: null, filaments: null, layerMap: null, layerCounts: null, path: null };
    }

    const isGcode = remotePath.toLowerCase().endsWith('.gcode');
    const parsed = isGcode
      ? await extractWeightsFromGcode(client, remotePath)
      : await extractWeightsFrom3mf(client, remotePath, subtaskName, gcodeFile);
    const weights = parsed?.weights || (Array.isArray(parsed) ? parsed : null);
    const filaments = parsed?.filaments || null;
    const layerMap = parsed?.layerMap || null;
    const layerCounts = parsed?.layerCounts || null;

    if (weights) {
      console.log(`Successfully extracted weights from ${remotePath}:`, weights);
    } else {
      console.log(`Failed to parse weights inside ${remotePath}`);
    }

    client.close();
    return { weights, filaments, layerMap, layerCounts, path: remotePath };
  } catch (err) {
    if (client) client.close();
    console.error('FTP Error getting weights:', err.message);
    return { weights: null, filaments: null, layerMap: null, layerCounts: null, path: null };
  }
};

module.exports = {
  connectFtp,
  getPredictedWeights,
  extractThumbnailFrom3mf,
  downloadLatestTimelapse
};
