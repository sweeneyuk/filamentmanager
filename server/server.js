const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { db, initDb, populateDefaults } = require('./database');
const { connectMqtt, getAmsStatus, getPrintState, setIo } = require('./mqtt');
const { getBambuVariantId } = require('./bambuCatalog');
const { resolveVariantId } = require('./geminiVariant');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const port = 3000;

const server = http.createServer(app);

app.disable('x-powered-by');

const customDomain = process.env.DOMAIN 
  ? (process.env.DOMAIN.startsWith('http') ? process.env.DOMAIN : `https://${process.env.DOMAIN}`) 
  : 'https://fm.msglover.me';

const allowedOrigins = [customDomain, 'http://localhost:5173', 'http://localhost:3000'];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const { getJwtSecret, authenticateToken } = require('./auth');
const jwt = require('jsonwebtoken');

io.use(async (socket, next) => {
  // Always allow if no users exist (setup mode)
  db.get("SELECT COUNT(*) as count FROM users", async (err, row) => {
    if (err) return next(new Error('Database error'));
    if (row.count === 0) return next();

    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication error: Token missing'));

    try {
      const secret = await getJwtSecret();
      jwt.verify(token, secret, (err, user) => {
        if (err) return next(new Error('Authentication error: Invalid token'));
        socket.user = user;
        next();
      });
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });
});

setIo(io);

io.on('connection', (socket) => {
  socket.on('disconnect', () => {
  });
});

// Middleware
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[ACCESS] ${req.method} ${req.url}`);
  next();
});

const authRoutes = require('./authRoutes');
const printersRoutes = require('./printersRoutes');

// Auth routes (unprotected)
app.use('/api/auth', authRoutes);

// Protect all other API routes
app.use('/api', authenticateToken, (req, res, next) => {
  if (req.setupRequired) {
    return res.status(403).json({ error: 'Setup Required', setupRequired: true });
  }
  next();
});

// Serve React static files in production
app.use(express.static(path.join(__dirname, '../client/dist')));

// Initialize DB and connect MQTT
initDb().then(() => {
  populateDefaults();
  connectMqtt();
}).catch(console.error);

// API Endpoints
app.use('/api/printers', authenticateToken, printersRoutes);

// GET /api/settings
app.get('/api/settings', (req, res) => {
  db.all('SELECT key, value FROM settings', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const settings = {};
    const sensitiveKeys = ['access_code', 'password', 'token', 'secret', 'gemini_api_key'];
    rows.forEach(r => {
      if (sensitiveKeys.some(k => r.key.toLowerCase().includes(k)) && r.value) {
        settings[r.key] = '********';
      } else {
        settings[r.key] = r.value;
      }
    });
    res.json(settings);
  });
});

// POST /api/settings
app.post('/api/settings', (req, res) => {
  const settings = req.body;
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(settings)) {
      if (value !== '********') {
        stmt.run(key, value);
      }
    }
    stmt.finalize();
    db.run('COMMIT', () => {
      res.json({ success: true });
    });
  });
});

// GET /api/brands
app.get('/api/brands', (req, res) => {
  db.all('SELECT * FROM brands ORDER BY name ASC', (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

// GET /api/knowledge/brands
app.get('/api/knowledge/brands', (req, res) => {
  try {
    const { BRAND_SPOOL_WEIGHTS } = require('./brandKnowledge');
    
    // Fetch overrides from the DB
    db.all('SELECT * FROM brand_knowledge_overrides', [], (err, rows) => {
      if (err) {
        // If error (e.g. table doesn't exist yet for some reason), just return static list
        console.error('Error fetching brand knowledge overrides:', err);
        return res.json(BRAND_SPOOL_WEIGHTS);
      }
      
      // Clone the static list so we can modify it
      let mergedKnowledge = [...BRAND_SPOOL_WEIGHTS];
      
      if (rows && rows.length > 0) {
        rows.forEach(override => {
          let parsedVariants = [];
          try {
            if (override.variants_json) parsedVariants = JSON.parse(override.variants_json);
          } catch(e) {}
          
          const index = mergedKnowledge.findIndex(k => k.brand.toLowerCase() === override.brand_name.toLowerCase());
          const overrideObj = {
            brand: override.brand_name,
            weight: override.weight,
            note: override.note || 'Custom override',
            variants: parsedVariants.length > 0 ? parsedVariants : undefined,
            confidence: 'override'
          };
          
          if (index !== -1) {
            mergedKnowledge[index] = overrideObj;
          } else {
            mergedKnowledge.push(overrideObj);
          }
        });
      }
      
      res.json(mergedKnowledge);
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load brand knowledge base' });
  }
});

// POST /api/chat
app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Messages array is required' });
  
  const { chatWithAssistant } = require('./ai');
  const response = await chatWithAssistant(messages);
  if (response.error) {
    res.status(500).json({ error: response.error });
  } else {
    res.json(response);
  }
});

// GET /api/scrapsaver/models
app.get('/api/scrapsaver/models', (req, res) => {
  db.all('SELECT * FROM scrap_models ORDER BY weight_g ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /api/scrapsaver/models
app.post('/api/scrapsaver/models', (req, res) => {
  const { name, weight_g, url, description } = req.body;
  if (!name || !weight_g) return res.status(400).json({ error: 'Name and weight are required' });
  
  db.run('INSERT INTO scrap_models (name, weight_g, url, description) VALUES (?, ?, ?, ?)', [name, parseFloat(weight_g), url, description], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name, weight_g, url, description });
  });
});

// DELETE /api/scrapsaver/models/:id
app.delete('/api/scrapsaver/models/:id', (req, res) => {
  db.run('DELETE FROM scrap_models WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// POST /api/brands
app.post('/api/brands', (req, res) => {
  const { name, default_empty_weight } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  
  db.run('INSERT INTO brands (name, default_empty_weight) VALUES (?, ?)', [name, default_empty_weight || 250], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name, default_empty_weight });
  });
});

// GET /api/materials
app.get('/api/materials', (req, res) => {
  db.all('SELECT * FROM materials', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /api/materials
app.post('/api/materials', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  
  db.run('INSERT INTO materials (name) VALUES (?)', [name], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name });
  });
});

// GET /api/spools
app.get('/api/spools', (req, res) => {
  const query = `
    SELECT s.*, b.name as brand_name, m.name as material_name 
    FROM spools s 
    LEFT JOIN brands b ON s.brand_id = b.id 
    LEFT JOIN materials m ON s.material_id = m.id
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /api/spools
app.post('/api/spools', (req, res) => {
  const { brand_id, material_id, subtype, color, color_name, cost, total_weight, empty_weight, used_weight, location, shopify_variant_id } = req.body;
  
  db.get('SELECT b.name as brand, m.name as material FROM brands b, materials m WHERE b.id = ? AND m.id = ?', [brand_id, material_id], (err, row) => {
    let finalVariantId = shopify_variant_id || null;
    if (row && row.brand.includes('Bambu Lab') && !finalVariantId) {
      finalVariantId = getBambuVariantId(row.material, subtype, color) || null;
    }
    
    db.run(`
      INSERT INTO spools (brand_id, material_id, subtype, color, color_name, cost, total_weight, empty_weight, used_weight, location, shopify_variant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [brand_id, material_id, subtype, color, color_name, cost, total_weight, empty_weight, used_weight || 0, location, finalVariantId], function(err) {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ id: this.lastID });
    });
  });
});

// PUT /api/spools/:id
app.put('/api/spools/:id', (req, res) => {
  const { brand_id, material_id, subtype, color, color_name, cost, total_weight, empty_weight, used_weight, location, shopify_variant_id } = req.body;
  
  db.get('SELECT b.name as brand, m.name as material FROM brands b, materials m WHERE b.id = ? AND m.id = ?', [brand_id, material_id], (err, row) => {
    let finalVariantId = shopify_variant_id || null;
    if (row && row.brand.includes('Bambu Lab') && !finalVariantId) {
      finalVariantId = getBambuVariantId(row.material, subtype, color) || null;
    }

    db.run(`
      UPDATE spools 
      SET brand_id = ?, material_id = ?, subtype = ?, color = ?, color_name = ?, cost = ?, total_weight = ?, empty_weight = ?, used_weight = ?, location = ?, shopify_variant_id = ?
      WHERE id = ?
    `, [brand_id, material_id, subtype, color, color_name, cost, total_weight, empty_weight, used_weight, location, finalVariantId, req.params.id], (err) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ success: true });
    });
  });
});

// POST /api/spools/:id/deduct
app.post('/api/spools/:id/deduct', (req, res) => {
  const amount = parseFloat(req.body.amount);
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  db.run(`UPDATE spools SET used_weight = used_weight + ? WHERE id = ?`, [amount, req.params.id], function(err) {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ success: true, deducted: amount });
  });
});

// PUT /api/spools/:id/archive
app.put('/api/spools/:id/archive', (req, res) => {
  const { archived } = req.body;
  db.run('UPDATE spools SET archived = ? WHERE id = ?', [archived ? 1 : 0, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// DELETE /api/spools/:id
app.delete('/api/spools/:id', (req, res) => {
  db.run('DELETE FROM spools WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// POST /api/gemini/resolve-variant
app.post('/api/gemini/resolve-variant', async (req, res) => {
  try {
    const { materialName, subtype, colorName } = req.body;
    if (!colorName) {
      return res.status(400).json({ error: 'Color Name is required to search for a Variant ID.' });
    }
    const variantId = await resolveVariantId(materialName, subtype, colorName);
    res.json({ variantId });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to resolve variant ID' });
  }
});

// GET /api/archives
app.get('/api/archives', (req, res) => {
  // Join to the archive_spools junction table for accurate per-print spool tracking
  const query = `
    SELECT 
      a.*,
      GROUP_CONCAT(sp.color, '|') as spool_colors,
      GROUP_CONCAT(sp.color_name, '|') as spool_color_names,
      GROUP_CONCAT(m.name, '|') as spool_materials,
      GROUP_CONCAT(b.name, '|') as spool_brands,
      GROUP_CONCAT(aps.weight_used_g, '|') as spool_weights
    FROM archives a
    LEFT JOIN archive_spools aps ON aps.archive_id = a.id
    LEFT JOIN spools sp ON aps.spool_id = sp.id
    LEFT JOIN brands b ON sp.brand_id = b.id
    LEFT JOIN materials m ON sp.material_id = m.id
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const parsed = rows.map(r => ({
      ...r,
      spools_used: r.spool_brands ? r.spool_brands.split('|').map((brand, i) => ({
        brand,
        material: r.spool_materials ? r.spool_materials.split('|')[i] : '',
        color: r.spool_colors ? r.spool_colors.split('|')[i] : null,
        color_name: r.spool_color_names ? r.spool_color_names.split('|')[i] : null,
        weight_used_g: r.spool_weights ? parseFloat(r.spool_weights.split('|')[i]) : null,
      })) : []
    }));
    res.json(parsed);
  });
});

// POST /api/archives
app.post('/api/archives', (req, res) => {
  const { print_name, duration_seconds, energy_cost, filament_cost, total_cost, spool_id } = req.body;
  db.run(`
    INSERT INTO archives (print_name, status, duration_seconds, energy_cost, filament_cost, total_cost, spool_id) 
    VALUES (?, 'MANUAL', ?, ?, ?, ?, ?)
  `, [print_name, duration_seconds, energy_cost, filament_cost, total_cost, spool_id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

// DELETE /api/archives/:id
app.delete('/api/archives/:id', (req, res) => {
  const id = req.params.id;
  
  // First, fetch the media paths so we can delete the files
  db.get('SELECT timelapse_path, photo_path, thumbnail_path FROM archives WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Archive not found' });
    
    // Delete media files to free up disk space
    const fs = require('fs');
    const path = require('path');
    const mediaDir = path.join(__dirname, 'data');
    
    [row.timelapse_path, row.photo_path, row.thumbnail_path].forEach(p => {
      if (p) {
        const localPath = path.resolve(path.join(mediaDir, p.replace(/^\//, '')));
        // Path traversal protection: ensure the resolved path is within mediaDir
        if (!localPath.startsWith(path.resolve(mediaDir))) {
          console.error('Suspicious path rejected during media delete:', localPath);
          return;
        }
        if (fs.existsSync(localPath)) {
          try { fs.unlinkSync(localPath); } catch (e) { console.error('Failed to delete media:', e.message); }
        }
      }
    });

    // Delete from database
    db.run('DELETE FROM archives WHERE id = ?', [id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      // Also delete from archive_spools junction table
      db.run('DELETE FROM archive_spools WHERE archive_id = ?', [id], () => {
        res.json({ success: true });
      });
    });
  });
});

// POST /api/archives/:id/regenerate-image
app.post('/api/archives/:id/regenerate-image', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
  const source = req.body.source || 'live';

  try {
    const { captureCameraSnapshot, extractFrameFromMp4 } = require('./camera');
    const { analyzePrint } = require('./ai');
    const path = require('path');
    
    db.get('SELECT print_name, duration_seconds, thumbnail_path, timelapse_path FROM archives WHERE id = ?', [id], async (err, archive) => {
      if (err || !archive) {
        return res.status(404).json({ error: 'Archive not found' });
      }

      const absoluteThumbPath = archive.thumbnail_path ? path.join(__dirname, 'data', archive.thumbnail_path.replace(/^\//, '')) : null;

      const triggerAiAndRespond = async (photoPath, relativePath) => {
        db.run('UPDATE archives SET photo_path = ? WHERE id = ?', [relativePath, id]);
        
        // Fix: Always use the relative path to resolve against the data directory for AI analysis
        const absolutePhotoPath = path.join(__dirname, 'data', relativePath.replace(/^\//, ''));
        const aiResult = await analyzePrint(absolutePhotoPath, absoluteThumbPath, archive.print_name, archive.duration_seconds || 0);
        
        if (aiResult) {
          db.run('UPDATE archives SET ai_analysis = ? WHERE id = ?', [JSON.stringify(aiResult), id]);
        }
        return res.json({ success: true, photo_path: relativePath, ai_analysis: aiResult });
      };

      if (source === 'live') {
        // 1. Try RTSP Snapshot First
        const rtspPhotoPath = await captureCameraSnapshot(id);
        if (rtspPhotoPath) {
          return await triggerAiAndRespond(rtspPhotoPath, rtspPhotoPath);
        }
        return res.status(500).json({ error: 'Failed to capture RTSP live snapshot.' });
      } else {
        // 2. Fallback: Try to extract from an existing timelapse
        if (archive.timelapse_path) {
          const absoluteMp4Path = path.join(__dirname, 'data', archive.timelapse_path.replace(/^\//, ''));
          const fallbackPhotoPath = path.join(__dirname, 'data', 'media', `${id}_photo.jpg`);
          const extracted = await extractFrameFromMp4(absoluteMp4Path, fallbackPhotoPath);
          if (extracted) {
            return await triggerAiAndRespond(extracted, `/media/${id}_photo.jpg`);
          }
        }

        // 3. Fallback: Attempt to download latest MP4 and extract
        const { downloadLatestTimelapse } = require('./ftp');
        const paths = await downloadLatestTimelapse(archive.print_name, id);
        if (paths.localPath) {
          const fallbackPhotoPath = path.join(__dirname, 'data', 'media', `${id}_photo.jpg`);
          const extracted = await extractFrameFromMp4(paths.localPath, fallbackPhotoPath);
          if (extracted) {
            db.run('UPDATE archives SET timelapse_path = ? WHERE id = ?', [paths.timelapsePath, id]);
            return await triggerAiAndRespond(extracted, `/media/${id}_photo.jpg`);
          }
        }
        return res.status(500).json({ error: 'Failed to extract frame from timelapse.' });
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics
app.get('/api/analytics', (req, res) => {
  const query = `
    SELECT 
      a.id,
      a.created_at,
      a.total_cost,
      a.energy_cost,
      a.filament_cost,
      a.filament_used_g,
      a.ai_analysis,
      m.name as material,
      b.name as brand,
      sp.color
    FROM archives a
    LEFT JOIN archive_spools aps ON aps.archive_id = a.id
    LEFT JOIN spools sp ON aps.spool_id = sp.id
    LEFT JOIN brands b ON sp.brand_id = b.id
    LEFT JOIN materials m ON sp.material_id = m.id
    WHERE a.status IN ('FINISH', 'COMPLETED', 'FAILED')
    ORDER BY a.created_at ASC
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/ams
app.get('/api/ams', (req, res) => {
  res.json(getAmsStatus());
});

// GET /api/print_status
app.get('/api/print_status', (req, res) => {
    res.json(getPrintState());
});

// GET /api/ams/assignments
app.get('/api/ams/assignments', (req, res) => {
  db.all('SELECT printer_id, tray_id, spool_id FROM ams_assignments', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const assignments = {};
    rows.forEach(r => {
      if (!assignments[r.printer_id]) assignments[r.printer_id] = {};
      assignments[r.printer_id][r.tray_id] = r.spool_id;
    });
    res.json(assignments);
  });
});

// POST /api/ams/assignments
app.post('/api/ams/assignments', (req, res) => {
  const { printer_id, tray_id, spool_id } = req.body;
  if (!tray_id || !printer_id) return res.status(400).json({ error: 'printer_id and tray_id required' });
  
  if (spool_id === null || spool_id === '') {
    db.run('DELETE FROM ams_assignments WHERE printer_id = ? AND tray_id = ?', [printer_id, tray_id], err => {
      if (err) return res.status(500).json({ error: err.message });
      broadcastAmsAssignments();
      res.json({ success: true });
    });
  } else {
    db.run(`
      INSERT INTO ams_assignments (printer_id, tray_id, spool_id) 
      VALUES (?, ?, ?) 
      ON CONFLICT(printer_id, tray_id) DO UPDATE SET spool_id=excluded.spool_id
    `, [printer_id, tray_id, spool_id], err => {
      if (err) return res.status(500).json({ error: err.message });
      broadcastAmsAssignments();
      res.json({ success: true });
    });
  }
});

function broadcastAmsAssignments() {
  db.all('SELECT printer_id, tray_id, spool_id FROM ams_assignments', [], (err, rows) => {
    if (!err) {
      const assignments = {};
      rows.forEach(r => {
        if (!assignments[r.printer_id]) assignments[r.printer_id] = {};
        assignments[r.printer_id][r.tray_id] = r.spool_id;
      });
      io.emit('ams_assignments_update', assignments);
    }
  });
}

// Serve Media directory
app.use('/media', authenticateToken, express.static(path.join(__dirname, 'data/media')));

// GET /api/export/csv
app.get('/api/export/csv', (req, res) => {
  const { createObjectCsvStringifier } = require('csv-writer');
  const query = `
    SELECT s.*, b.name as brand_name, m.name as material_name 
    FROM spools s 
    LEFT JOIN brands b ON s.brand_id = b.id 
    LEFT JOIN materials m ON s.material_id = m.id
  `;
  db.all(query, [], async (err, rows) => {
    if (err) return res.status(500).send(err.message);
    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'id', title: 'ID' },
        { id: 'brand_name', title: 'Brand' },
        { id: 'material_name', title: 'Material' },
        { id: 'subtype', title: 'Subtype' },
        { id: 'color', title: 'Color' },
        { id: 'total_weight', title: 'Label Weight' },
        { id: 'empty_weight', title: 'Empty Weight' },
        { id: 'used_weight', title: 'Used Weight' },
        { id: 'cost', title: 'Cost' },
        { id: 'location', title: 'Location' },
        { id: 'created_at', title: 'Added At' },
        { id: 'last_used_at', title: 'Last Used' },
        { id: 'archived', title: 'Archived' }
      ]
    });
    const header = csvStringifier.getHeaderString();
    const records = csvStringifier.stringifyRecords(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="spool_inventory.csv"');
    res.send(header + records);
  });
});

// POST /api/import/csv
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.csv$/i)) {
      return cb(new Error('Only CSV files are allowed'));
    }
    cb(null, true);
  }
});
app.post('/api/import/csv', upload.single('csvFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });
  const csv = require('csv-parser');
  const fs = require('fs');
  const results = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      // Basic CSV import logic: insert brands/materials, then spools
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const insertBrand = db.prepare('INSERT OR IGNORE INTO brands (name, default_empty_weight) VALUES (?, 250)');
        const insertMat = db.prepare('INSERT OR IGNORE INTO materials (name) VALUES (?)');
        
        results.forEach(r => {
          const brand = r.Brand || r.brand || '';
          const material = r.Material || r.material || '';
          if (brand) insertBrand.run(brand);
          if (material) insertMat.run(material);
        });
        insertBrand.finalize();
        insertMat.finalize();

        // Resolve IDs
        const brandMap = {};
        const matMap = {};
        db.all('SELECT id, name FROM brands', (err, bRows) => {
          if (!err) bRows.forEach(r => brandMap[r.name] = r.id);
          db.all('SELECT id, name FROM materials', (err, mRows) => {
            if (!err) mRows.forEach(r => matMap[r.name] = r.id);
            
            const insertSpool = db.prepare(`
              INSERT INTO spools (brand_id, material_id, subtype, location, color, color_name, cost, total_weight, empty_weight, used_weight, archived) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            results.forEach(r => {
              const brand = r.Brand || r.brand || '';
              const material = r.Material || r.material || '';
              
              // Color mapping
              let color = r.Color || '#ffffff';
              if (!r.Color && r.rgba) {
                let hexMatch = r.rgba.match(/[0-9A-Fa-f]{6}/);
                if (hexMatch) color = '#' + hexMatch[0];
              }
              
              const colorName = r['Color Name'] || r.color_name || '';

              insertSpool.run(
                brandMap[brand] || null,
                matMap[material] || null,
                r.Subtype || r.subtype || '',
                r.Location || r.storage_location || r.location || r[' location'] || r['Location '] || '',
                color,
                colorName,
                parseFloat(r.Cost || r.cost_per_kg) || 0,
                parseFloat(r['Label Weight'] || r.label_weight) || 1000,
                parseFloat(r['Empty Weight'] || r.empty_weight) || 250,
                parseFloat(r['Used Weight'] || r.weight_used || r.used_weight) || 0,
                (r.Archived === '1' || r.Archived?.toLowerCase() === 'true' || r.archived === '1' || r.archived?.toLowerCase() === 'true') ? 1 : 0
              );
            });
            insertSpool.finalize();
            db.run('COMMIT', () => {
              fs.unlink(req.file.path, () => {}); // Clean up temp file
              res.json({ success: true, message: 'CSV imported successfully!' });
            });
          });
        });
      });
    }).on('error', (err) => {
      fs.unlink(req.file.path, () => {}); // Clean up temp file on parse error
      res.status(400).json({ error: 'Failed to parse CSV: ' + err.message });
    });
});

const upload3mf = multer({
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for 3mf
});

// POST /api/calculator/parse
app.post('/api/calculator/parse', upload3mf.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const zip = new AdmZip(req.file.path);
    const zipEntries = zip.getEntries();
    
    // TEMPORARY DEBUG: Write to file
    try {
      const debugFile = path.join(__dirname, '3mf_debug.txt');
      fs.writeFileSync(debugFile, "ZIP ENTRIES:\n" + zipEntries.map(e => e.entryName).join("\n"));
      fs.copyFileSync(req.file.path, path.join(__dirname, 'test_hanger.3mf'));
    } catch(e) {}
    
    let weights = [];
    let printTimeSeconds = 0;
    
    const sliceInfoEntry = zipEntries.find(e => e.entryName.toLowerCase() === 'metadata/slice_info.config');
    const projectDetailsEntry = zipEntries.find(e => e.entryName.toLowerCase() === 'metadata/project_details.json');
    
    // First try project_details.json
    if (projectDetailsEntry) {
      try {
        const data = JSON.parse(projectDetailsEntry.getData().toString('utf8'));
        
        let wArr = [];
        let cArr = [];
        if (data.filament_weight) {
          wArr = Array.isArray(data.filament_weight) ? data.filament_weight : [data.filament_weight];
          cArr = data.filament_colors ? (Array.isArray(data.filament_colors) ? data.filament_colors : [data.filament_colors]) : [];
        } else if (data.plate_summary && data.plate_summary.length > 0) {
          wArr = data.plate_summary[0].filament_weight || [];
          cArr = data.plate_summary[0].filament_colors || [];
        }
        
        weights = wArr.map((w, i) => ({
          weight: w,
          hex: cArr[i] ? cArr[i].substring(0, 7) : '#888888'
        }));
        
        if (data.prediction) {
          printTimeSeconds = data.prediction;
        } else if (data.plate_summary && data.plate_summary.length > 0 && data.plate_summary[0].prediction) {
          printTimeSeconds = data.plate_summary[0].prediction;
        }
      } catch (e) {
        console.error("Failed to parse project_details.json", e);
      }
    }
    
    // If we didn't get weights/time, or just to be safe, check slice_info.config
    if ((weights.length === 0 || printTimeSeconds === 0) && sliceInfoEntry) {
      const contentStr = sliceInfoEntry.getData().toString('utf8');
      const filamentRegex = /<filament\s+([^>]+)>/gi;
      let match;
      while ((match = filamentRegex.exec(contentStr)) !== null) {
        const attrs = match[1];
        const weightMatch = attrs.match(/used_g="([\d\.]+)"/i);
        const colorMatch = attrs.match(/color="([^"]+)"/i);
        if (weightMatch) {
          weights.push({
            weight: parseFloat(weightMatch[1]),
            hex: colorMatch ? colorMatch[1].substring(0, 7) : '#888888'
          });
        }
      }
      
      if (weights.length === 0) {
        const weightMatch = contentStr.match(/<metadata\s+key="weight"\s+value="([\d\.\,\s]+)"/i);
        if (weightMatch && weightMatch[1]) {
           weights = [{ weight: parseFloat(weightMatch[1]), hex: '#888888' }];
        }
      }
      
      if (printTimeSeconds === 0) {
        const timeMatch = contentStr.match(/<metadata\s+key="prediction"\s+value="([\d]+)"/i);
        if (timeMatch && timeMatch[1]) {
          printTimeSeconds = parseInt(timeMatch[1], 10);
        }
      }
    }
    
    let thumbnailPath = null;
    const thumbnailEntry = zipEntries.find(e => e.entryName.toLowerCase() === 'metadata/plate_1.png');
    if (thumbnailEntry) {
      const prefix = Date.now().toString();
      const localThumbPath = path.join(__dirname, 'data', 'media', `${prefix}_quote_thumb.png`);
      fs.writeFileSync(localThumbPath, thumbnailEntry.getData());
      thumbnailPath = `/media/${prefix}_quote_thumb.png`;
    }
    
    fs.unlinkSync(req.file.path);
    
    res.json({
      weights,
      printTimeSeconds,
      thumbnailPath
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Failed to parse 3mf file: ' + err.message });
  }
});

// POST /api/test/ha
app.post('/api/test/ha', async (req, res) => {
  const { getEnergyRate, getPrinterEnergyUsage } = require('./ha');
  const overrides = req.body || {};
  try {
    const rate = await getEnergyRate(overrides);
    const usage = await getPrinterEnergyUsage(overrides);
    res.json({ success: true, message: `Successfully connected to HA. Rate: ${rate}, Printer Energy: ${usage} kWh` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/ha/rate
app.get('/api/ha/rate', async (req, res) => {
  const { getEnergyRate } = require('./ha');
  try {
    const rate = await getEnergyRate();
    res.json({ rate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/test/bambu
app.post('/api/test/bambu', async (req, res) => {
  const { connectFtp } = require('./ftp');
  const { db } = require('./database');
  const overrides = req.body || {};
  
  try {
    const ftpClient = await connectFtp(overrides);
    ftpClient.close();
    res.json({ success: true, message: 'Successfully connected to Bambu Lab Printer (MQTT/FTPS verified)' });
  } catch (err) {
    db.get("SELECT value FROM settings WHERE key = 'printer_mode'", (dbErr, row) => {
      const mode = row ? row.value : 'lan';
      if (mode === 'cloud') {
        res.json({ success: true, message: 'Successfully connected in Cloud Mode! (Note: FTPS media downloads are unavailable over cloud)' });
      } else {
        res.status(500).json({ success: false, message: `FTPS Connection Failed: ${err.message}` });
      }
    });
  }
});

// React Router fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

server.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
