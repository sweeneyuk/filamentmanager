const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const { db } = require('./database');

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

const getInventorySummary = () => {
  return new Promise((resolve) => {
    db.all(`
      SELECT 
        s.id, b.name as brand, m.name as material, s.color, s.total_weight, s.used_weight, s.cost
      FROM spools s
      LEFT JOIN brands b ON s.brand_id = b.id
      LEFT JOIN materials m ON s.material_id = m.id
      WHERE s.archived = 0
    `, [], (err, rows) => {
      if (err) resolve(JSON.stringify({ error: err.message }));
      else resolve(JSON.stringify(rows));
    });
  });
};

const getPrintHistory = () => {
  return new Promise((resolve) => {
    db.all(`
      SELECT id, print_name, status, duration_seconds, total_cost, created_at 
      FROM archives 
      ORDER BY created_at DESC 
      LIMIT 10
    `, [], (err, rows) => {
      if (err) resolve(JSON.stringify({ error: err.message }));
      else resolve(JSON.stringify(rows));
    });
  });
};

const readMemory = (topic) => {
  return new Promise((resolve) => {
    db.all(`SELECT topic, insight_text FROM ai_memory WHERE topic LIKE ?`, [`%${topic}%`], (err, rows) => {
      if (err) resolve(JSON.stringify({ error: err.message }));
      else resolve(JSON.stringify(rows.length > 0 ? rows : { message: 'No memory found for this topic.' }));
    });
  });
};

const saveMemory = (topic, insight_text) => {
  return new Promise((resolve) => {
    db.run(
      `INSERT INTO ai_memory (topic, insight_text) VALUES (?, ?) 
       ON CONFLICT(topic) DO UPDATE SET insight_text = excluded.insight_text, updated_at = CURRENT_TIMESTAMP`,
      [topic, insight_text],
      function(err) {
        if (err) resolve(JSON.stringify({ error: err.message }));
        else resolve(JSON.stringify({ success: true, topic, message: 'Memory saved.' }));
      }
    );
  });
};

const tools = [{
  functionDeclarations: [
    {
      name: 'get_inventory_summary',
      description: 'Gets a summary of all active spools in the inventory, including brand, material, and remaining weight.'
    },
    {
      name: 'get_print_history',
      description: 'Gets the recent 10 print archives including duration and status.'
    },
    {
      name: 'read_memory',
      description: 'Reads a saved insight or memory about a specific topic from the local ai_memory database.',
      parameters: {
        type: 'OBJECT',
        properties: {
          topic: { type: 'STRING', description: 'The topic to recall memory for' }
        },
        required: ['topic']
      }
    },
    {
      name: 'save_memory',
      description: 'Saves a new learned fact or insight into the local ai_memory database so it can be recalled later.',
      parameters: {
        type: 'OBJECT',
        properties: {
          topic: { type: 'STRING', description: 'A short, unique topic string' },
          insight_text: { type: 'STRING', description: 'The fact or insight to save' }
        },
        required: ['topic', 'insight_text']
      }
    }
  ]
}];

const executeTool = async (call) => {
  if (call.name === 'get_inventory_summary') return await getInventorySummary();
  if (call.name === 'get_print_history') return await getPrintHistory();
  if (call.name === 'read_memory') return await readMemory(call.args.topic);
  if (call.name === 'save_memory') return await saveMemory(call.args.topic, call.args.insight_text);
  return JSON.stringify({ error: 'Unknown tool' });
};

const chatWithAssistant = async (messages) => {
  try {
    const apiKey = await getSetting('gemini_api_key');
    if (!apiKey) return { error: 'Gemini API key not configured in Settings.' };

    const ai = new GoogleGenAI({ apiKey });

    // Format messages for @google/genai
    // Incoming messages from frontend: [{role: 'user', content: 'hello'}, {role: 'model', content: 'hi'}]
    const formattedMessages = messages.map(m => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content || m.text }]
    }));

    const systemInstruction = "You are Filament Manager's AI Assistant. You help the user manage their 3D printing filament, track costs, and analyze print history. Use your tools to fetch live database information and save insights. Always be helpful and concise.";

    const reqConfig = {
      model: 'gemini-2.5-flash',
      contents: formattedMessages,
      systemInstruction: systemInstruction,
      tools: tools
    };

    let response = await ai.models.generateContent(reqConfig);

    // Handle tool calls (function calling loop)
    // We'll allow up to 3 turns of tool calling
    for (let i = 0; i < 3; i++) {
      if (response.functionCalls && response.functionCalls.length > 0) {
        // Append model's function call to history
        formattedMessages.push({
          role: 'model',
          parts: [{ functionCall: response.functionCalls[0] }]
        });

        // Execute the function
        const call = response.functionCalls[0];
        const result = await executeTool(call);

        // Append function response
        formattedMessages.push({
          role: 'user',
          parts: [{
            functionResponse: {
              name: call.name,
              response: { result: result }
            }
          }]
        });

        // Generate next content
        reqConfig.contents = formattedMessages;
        response = await ai.models.generateContent(reqConfig);
      } else {
        break;
      }
    }

    return { text: response.text };
  } catch (error) {
    console.error('AI Chat failed:', error);
    return { error: 'Chat failed: ' + error.message };
  }
};

module.exports = {
  analyzePrint,
  chatWithAssistant
};
