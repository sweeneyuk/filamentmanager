const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');

async function test() {
  try {
    const rawData = fs.readFileSync('./data/settings.json');
    const settings = JSON.parse(rawData);
    const apiKey = settings.gemini_api_key;
    
    const ai = new GoogleGenAI({ apiKey });
    
    const tools = [{
      functionDeclarations: [
        {
          name: 'get_current_printer_status',
          description: 'Gets the live, current printing status of the 3D printer (temperatures, progress, state).',
          parameters: { type: 'OBJECT', properties: {} }
        }
      ]
    }];

    const reqConfig = {
      model: 'gemini-3.1-flash-lite',
      contents: [{ role: 'user', parts: [{ text: 'What is the print status at the moment?' }] }],
      config: { tools: tools }
    };

    let response = await ai.models.generateContent(reqConfig);
    console.log(JSON.stringify(response.candidates[0].content, null, 2));
    
  } catch(e) {
    console.error(e);
  }
}
test();
