const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const { db } = require('./database');
const { getPrintState, getAmsStatus } = require('./mqtt');

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
      model: 'gemini-3.1-flash-lite',
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

const getScrapModels = () => {
  return new Promise((resolve) => {
    db.all(`SELECT id, name, weight_g, url, description FROM scrap_models ORDER BY weight_g ASC`, [], (err, rows) => {
      if (err) resolve(JSON.stringify({ error: err.message }));
      else resolve(JSON.stringify(rows.length > 0 ? rows : { message: 'No scrap models found in the Scrap Book.' }));
    });
  });
};

const getAssignedSpools = () => {
  return new Promise((resolve) => {
    db.all(`
      SELECT a.tray_id, s.id as spool_id, b.name as brand, m.name as material, s.color, (s.total_weight - s.used_weight) as remaining_weight
      FROM ams_assignments a
      JOIN spools s ON a.spool_id = s.id
      LEFT JOIN brands b ON s.brand_id = b.id
      LEFT JOIN materials m ON s.material_id = m.id
    `, [], (err, rows) => {
      if (err) resolve(JSON.stringify({ error: err.message }));
      else {
        db.all("SELECT key, value FROM settings WHERE key LIKE 'ams_name_%'", [], (err2, settingRows) => {
          if (!err2) {
            const amsNames = {};
            settingRows.forEach(row => amsNames[row.key] = row.value);
            
            rows = rows.map(r => {
              const amsId = r.tray_id.split('-')[0];
              const defaultName = (amsId === "128" || amsId === "255") ? "External Spool" : `AMS ${parseInt(amsId) + 1}`;
              r.ams_custom_name = amsNames[`ams_name_${amsId}`] || defaultName;
              return r;
            });
          }
          resolve(JSON.stringify(rows));
        });
      }
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
      description: 'ALWAYS call this tool first if the user asks about their spools, filament, or inventory. Gets a summary of all active spools including brand, material, and remaining weight.',
      parameters: { type: 'OBJECT', properties: {} }
    },
    {
      name: 'get_print_history',
      description: 'ALWAYS call this tool if the user asks about recent prints, durations, or failures.',
      parameters: { type: 'OBJECT', properties: {} }
    },
    {
      name: 'get_current_printer_status',
      description: 'Gets the live, current printing status of the 3D printer (temperatures, progress, state).',
      parameters: { type: 'OBJECT', properties: {} }
    },
    {
      name: 'get_scrap_models',
      description: 'Gets the user\'s personal Scrap Book of saved 3D models and their exact weights.',
      parameters: { type: 'OBJECT', properties: {} }
    },
    {
      name: 'get_ams_status',
      description: 'Gets the current physical spools loaded into the AMS (Automatic Material System) unit on the printer.',
      parameters: { type: 'OBJECT', properties: {} }
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
  if (call.name === 'get_current_printer_status') return JSON.stringify(getPrintState() || { status: 'UNKNOWN' });
  if (call.name === 'get_scrap_models') return await getScrapModels();
  if (call.name === 'get_ams_status') return await getAssignedSpools();
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

    const systemInstruction = `You are Filament Manager's AI Assistant. 
CRITICAL RULES:
1. You DO have access to the user's inventory, printer status, AMS status, print history, and personal Scrap Book via your tools!
2. ALWAYS use the get_inventory_summary tool BEFORE answering questions about what spools the user has.
3. If asked about the current print, use get_current_printer_status.
4. If asked what is loaded in the printer, use get_ams_status.
5. If the user asks about using scrap filament or what to print, use get_scrap_models to see their saved models. Suggest generic ideas (e.g. keychains, bins) and generate MakerWorld search URLs for them!
6. If the data from the tool is empty, tell the user they have no spools/prints/models. Do not invent data.`;

    const reqConfig = {
      model: 'gemini-3.1-flash-lite',
      contents: formattedMessages,
      config: {
        systemInstruction: systemInstruction,
        tools: tools
      }
    };

    let response = await ai.models.generateContent(reqConfig);

    // Handle tool calls (function calling loop)
    // We'll allow up to 3 turns of tool calling
    for (let i = 0; i < 3; i++) {
      if (response.functionCalls && response.functionCalls.length > 0) {
        // Execute the function
        const call = response.functionCalls[0];
        let result = await executeTool(call);
        if (typeof result !== 'string') {
          result = JSON.stringify(result);
        }

        // Bypass thought_signature API requirement by injecting the tool result 
        // directly into the user's last message instead of creating a functionResponse part.
        const lastUserMessage = reqConfig.contents[reqConfig.contents.length - 1];
        lastUserMessage.parts.push({
          text: `\n[System: Tool '${call.name}' executed and returned this data: ${result}]`
        });

        // Generate next content with the newly augmented user message
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
