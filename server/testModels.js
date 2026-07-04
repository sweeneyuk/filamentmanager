const { db } = require('./database');
const https = require('https');

db.get("SELECT value FROM settings WHERE key = 'gemini_api_key'", (err, row) => {
  if (err || !row) return console.error('No API key found');
  const key = row.value;
  https.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, (res) => {
    let d = '';
    res.on('data', c => d+=c);
    res.on('end', () => {
      try {
        const json = JSON.parse(d);
        if (json.models) {
          const names = json.models.filter(m => m.supportedGenerationMethods.includes('generateContent')).map(m => m.name);
          console.log('Available models for generateContent:', names);
        } else {
          console.log(json);
        }
      } catch(e) { console.error(e.message); }
    });
  });
});
