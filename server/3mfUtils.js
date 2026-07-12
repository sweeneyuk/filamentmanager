const path = require('path');

/**
 * Extracts a thumbnail buffer from an AdmZip instance of a 3MF file.
 * Uses fallback logic inspired by Bambuddy to ensure a thumbnail is found
 * even in cross-class slices or files missing per-plate thumbnails.
 * 
 * @param {import('adm-zip')} zip - The AdmZip instance of the 3MF file.
 * @param {number|null} plateNumber - The specific plate number, if known.
 * @returns {Buffer|null} The image buffer, or null if no thumbnail was found.
 */
function extract3mfThumbnailBuffer(zip, plateNumber = null) {
  const thumbnailPaths = [];

  if (plateNumber) {
    thumbnailPaths.push(`Metadata/plate_${plateNumber}.png`);
  }

  thumbnailPaths.push(
    "Metadata/plate_1.png",
    "Metadata/thumbnail.png",
    "Metadata/model_thumbnail.png",
    "Auxiliaries/.thumbnails/thumbnail_middle.png",
    "Auxiliaries/.thumbnails/thumbnail_small.png",
    "Auxiliaries/.thumbnails/thumbnail_3mf.png"
  );

  const zipEntries = zip.getEntries();
  const entryNamesLower = {};
  
  // Create a fast lookup map ignoring case
  zipEntries.forEach(entry => {
    entryNamesLower[entry.entryName.toLowerCase()] = entry;
  });

  for (const thumbPath of thumbnailPaths) {
    const entry = entryNamesLower[thumbPath.toLowerCase()];
    if (entry) {
      return entry.getData();
    }
  }

  return null;
}

module.exports = {
  extract3mfThumbnailBuffer
};
