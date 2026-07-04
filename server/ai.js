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
 * @param {string} photoPath - Absolute path to the photo file
 * @param {string} printName - Name of the print
 * @param {number} durationSeconds - Duration of the print
 * @returns {Promise<Object|null>} JSON object with status and reason, or null if disabled/failed
 */
const analyzePrint = async (photoPath, printName, durationSeconds) => {
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

    // Read the image file and convert to base64
    const mimeType = photoPath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    
    const prompt = `
You are an expert 3D printing assistant. Analyze the provided photo of a completed or failed 3D print. 
The print is named "${printName}" and took ${Math.round(durationSeconds / 60)} minutes.

Determine the quality and outcome of the print. 
Look for:
- Spaghetti (massive stringy failures)
- Stringing (fine hairs between parts)
- Warping (corners lifting off the bed)
- Layer shifting (steps in the side of the print)

Respond in JSON format ONLY with exactly these two keys:
1. "status": Must be one of ["SUCCESS", "SPAGHETTI", "STRINGING", "WARPED", "LAYER_SHIFT", "UNKNOWN_FAILURE"]
2. "reason": A short 1-2 sentence witty explanation of what you see.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: Buffer.from(fs.readFileSync(photoPath)).toString('base64'),
                mimeType: mimeType
              }
            }
          ]
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
