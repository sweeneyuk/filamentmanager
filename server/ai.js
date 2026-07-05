const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const db = require('./database');

// Helper to get setting from DB
const getSetting = (key) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.value : null);
    });
  });
};

/**
 * Analyzes a print photo using Gemini to determine if it was successful or failed.
 * @param {string} photoPath - Absolute path to the actual print photo file
 * @param {string|null} thumbnailPath - Absolute path to the intended 3MF thumbnail (optional)
 * @param {string} printName - Name of the print
 * @param {number} durationSeconds - Duration of the print
 * @returns {Promise<Object|null>} JSON object with status and reason, or null if disabled/failed
 */
const analyzePrint = async (photoPath, thumbnailPath, printName, durationSeconds) => {
  try {
    const apiKey = await getSetting('gemini_api_key');
    if (!apiKey) {
      console.log('Skipping AI analysis: No Gemini API Key configured.');
      return null;
    }

    if (!photoPath || !fs.existsSync(photoPath)) {
      console.log('Skipping AI analysis: Photo not found at path', photoPath);
      return null;
    }

    console.log(`Starting AI analysis for print: ${printName}`);
    
    // Initialize the official SDK
    const ai = new GoogleGenAI({ apiKey: apiKey });

    // Read the image files and convert to base64
    const parts = [];
    
    let prompt = `You are an expert 3D printing assistant. You are analyzing a completed or failed 3D print named "${printName}" that took ${Math.round(durationSeconds / 60)} minutes.\n`;
    
    if (thumbnailPath && fs.existsSync(thumbnailPath)) {
      prompt += `\nImage 1 is the intended 3D model preview (what it should look like).\nImage 2 is the actual final print.\nCompare the actual print to the intended model preview. Look for missing parts or partial completion.\n`;
      const thumbMime = thumbnailPath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      parts.push({
        inlineData: {
          data: Buffer.from(fs.readFileSync(thumbnailPath)).toString('base64'),
          mimeType: thumbMime
        }
      });
    } else {
      prompt += `\nYou are only provided with the photo of the actual final print.\n`;
    }

    prompt += `
Determine the quality and outcome of the print. Look for:
- Spaghetti (massive stringy failures)
- Stringing (fine hairs between parts)
- Warping (corners lifting off the bed)
- Layer shifting (steps in the side of the print)
- Missing parts or incomplete geometry (compare to intended model if provided)

Respond in JSON format ONLY with exactly these two keys:
1. "status": Must be one of ["SUCCESS", "SPAGHETTI", "STRINGING", "WARPED", "LAYER_SHIFT", "UNKNOWN_FAILURE"]
2. "reason": A short 1-2 sentence witty explanation of what you see.
`;

    parts.push({ text: prompt });
    
    const photoMime = photoPath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    parts.push({
      inlineData: {
        data: Buffer.from(fs.readFileSync(photoPath)).toString('base64'),
        mimeType: photoMime
      }
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: parts
        }
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = response.text;
    console.log(`AI Analysis Raw Response:`, responseText);
    
    try {
      const parsed = JSON.parse(responseText);
      return parsed;
    } catch (parseErr) {
      console.error('Failed to parse Gemini JSON response:', parseErr);
      return null;
    }
  } catch (error) {
    console.error('AI Analysis failed:', error.message);
    return null;
  }
};

module.exports = {
  analyzePrint
};
