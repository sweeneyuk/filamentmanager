const https = require('https');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { db } = require('./database');

// Helper to fetch HTML from Bambu Lab store
function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let data = '';
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchHTML(res.headers.location).then(resolve).catch(reject);
      }
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Map material and subtype to the Bambu Lab URL slug
function getBambuSlug(material, subtype) {
  const matLower = (material || '').toLowerCase();
  const subLower = (subtype || '').toLowerCase().replace(/\s+/g, '-');
  
  if (matLower === 'pla') {
    if (subLower === 'basic' || !subLower) return 'pla-basic-filament';
    if (subLower === 'matte') return 'pla-matte';
    if (subLower.includes('silk')) return 'pla-silk';
    if (subLower.includes('cf')) return 'pla-cf';
    if (subLower.includes('tough')) return 'pla-tough';
    return `pla-${subLower}`;
  }
  
  if (matLower === 'petg') {
    if (subLower === 'basic' || !subLower) return 'petg-basic';
    if (subLower.includes('hf')) return 'petg-hf';
    if (subLower.includes('cf')) return 'petg-cf';
    if (subLower.includes('translucent')) return 'petg-translucent';
    return `petg-${subLower}`;
  }
  
  if (matLower === 'abs') return 'abs-filament';
  if (matLower === 'asa') return 'asa-filament';
  if (matLower === 'tpu') return 'tpu-95a';
  if (matLower === 'pc') return 'pc-filament';
  
  return `${matLower}-${subLower}`;
}

async function resolveVariantId(materialName, subtype, colorName) {
  return new Promise((resolve, reject) => {
    db.get("SELECT value FROM settings WHERE key = 'gemini_api_key'", async (err, row) => {
      if (err) return reject(err);
      
      const apiKey = row?.value;
      if (!apiKey) {
        return reject(new Error('Gemini API key is not configured in Settings.'));
      }

      try {
        const slug = getBambuSlug(materialName, subtype);
        const url = `https://uk.store.bambulab.com/products/${slug}`;
        
        console.log(`Fetching product HTML from ${url}`);
        const html = await fetchHTML(url);
        
        const schemaRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
        let match;
        let jsonSchema = '';
        
        while ((match = schemaRegex.exec(html)) !== null) {
          if (match[1].includes('"@type":"Product"')) {
            jsonSchema = match[1];
            break;
          }
        }
        
        if (!jsonSchema) {
          return reject(new Error('Could not find the product schema on the Bambu Lab website. The URL may be invalid or the site layout changed.'));
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
You are an expert data extractor. I am going to provide you with a JSON-LD schema extracted from the Bambu Lab store.
Your task is to find the "sku" (Variant ID) that corresponds to the specific filament variation requested.

User is looking for:
Material: ${materialName}
Subtype: ${subtype || 'Any'}
Color Name: ${colorName}
Format: Prefer "Refill" if available, otherwise fallback to "with spool".

Here is the JSON Schema:
${jsonSchema.substring(0, 50000)}

Find the exact "sku" string for the requested color. 
Output ONLY the numerical SKU string. Do NOT output any markdown, explanations, or code blocks.
If you cannot find a match, output "NOT_FOUND".
`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        
        if (text === 'NOT_FOUND' || !/^\d+$/.test(text)) {
          return reject(new Error('Gemini could not find a matching Variant ID for that color.'));
        }
        
        resolve(text);
      } catch (error) {
        console.error('Error resolving variant:', error);
        reject(error);
      }
    });
  });
}

module.exports = {
  resolveVariantId
};
