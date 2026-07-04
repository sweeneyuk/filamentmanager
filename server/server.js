const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { db, initDb, populateDefaults } = require('./database');
const { connectMqtt, getAmsStatus, getPrintState, setIo } = require('./mqtt');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const port = 3000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

setIo(io);

io.on('connection', (socket) => {
  // console.log('Client connected to WebSocket');
  socket.on('disconnect', () => {
    // console.log('Client disconnected');
  });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const authRoutes = require('./authRoutes');
const { authenticateToken } = require('./auth');

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

// GET /api/settings
app.get('/api/settings', (req, res) => {
  db.all('SELECT key, value FROM settings', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const settings = {};
    const sensitiveKeys = ['access_code', 'password', 'token'];
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
      // Reconnect MQTT if related settings changed
      if (settings.bambu_ip || settings.bambu_serial || settings.bambu_access_code) {
        connectMqtt();
      }
      res.json({ success: true });
    });
  });
});

// GET /api/brands
app.get('/api/brands', (req, res) => {
  db.all('SELECT * FROM brands', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
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
  const { brand_id, material_id, subtype, color, color_name, cost, total_weight, empty_weight, used_weight, location } = req.body;
  db.run(`
    INSERT INTO spools (brand_id, material_id, subtype, color, color_name, cost, total_weight, empty_weight, used_weight, location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [brand_id, material_id, subtype, color, color_name, cost, total_weight, empty_weight, used_weight || 0, location], function(err) {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ id: this.lastID });
  });
});

// PUT /api/spools/:id
app.put('/api/spools/:id', (req, res) => {
  const { brand_id, material_id, subtype, color, color_name, cost, total_weight, empty_weight, used_weight, location } = req.body;
  db.run(`
    UPDATE spools 
    SET brand_id = ?, material_id = ?, subtype = ?, color = ?, color_name = ?, cost = ?, total_weight = ?, empty_weight = ?, used_weight = ?, location = ?
    WHERE id = ?
  `, [brand_id, material_id, subtype, color, color_name, cost, total_weight, empty_weight, used_weight, location, req.params.id], (err) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ success: true });
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
        // Paths are stored like /media/1_photo.png, we need to strip the leading /
        const localPath = path.join(mediaDir, p.replace(/^\//, ''));
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
      m.name as material,
      b.name as brand,
      sp.color
    FROM archives a
    LEFT JOIN archive_spools aps ON aps.archive_id = a.id
    LEFT JOIN spools sp ON aps.spool_id = sp.id
    LEFT JOIN brands b ON sp.brand_id = b.id
    LEFT JOIN materials m ON sp.material_id = m.id
    WHERE a.status = 'FINISH' OR a.status = 'COMPLETED'
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
  db.all('SELECT tray_id, spool_id FROM ams_assignments', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const assignments = {};
    rows.forEach(r => { assignments[r.tray_id] = r.spool_id; });
    res.json(assignments);
  });
});

// POST /api/ams/assignments
app.post('/api/ams/assignments', (req, res) => {
  const { tray_id, spool_id } = req.body;
  if (!tray_id) return res.status(400).json({ error: 'tray_id required' });
  
  if (spool_id === null || spool_id === '') {
    db.run('DELETE FROM ams_assignments WHERE tray_id = ?', [tray_id], err => {
      if (err) return res.status(500).json({ error: err.message });
      // Broadcast change
      db.all('SELECT tray_id, spool_id FROM ams_assignments', [], (err, rows) => {
        if (!err) {
          const assignments = {};
          rows.forEach(r => assignments[r.tray_id] = r.spool_id);
          io.emit('ams_assignments_update', assignments);
        }
      });
      res.json({ success: true });
    });
  } else {
    db.run(`
      INSERT INTO ams_assignments (tray_id, spool_id) 
      VALUES (?, ?) 
      ON CONFLICT(tray_id) DO UPDATE SET spool_id = excluded.spool_id
    `, [tray_id, spool_id], err => {
      if (err) return res.status(500).json({ error: err.message });
      // Broadcast change
      db.all('SELECT tray_id, spool_id FROM ams_assignments', [], (err, rows) => {
        if (!err) {
          const assignments = {};
          rows.forEach(r => assignments[r.tray_id] = r.spool_id);
          io.emit('ams_assignments_update', assignments);
        }
      });
      res.json({ success: true });
    });
  }
});

// Serve Media directory
app.use('/media', express.static(path.join(__dirname, 'data/media')));

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
const upload = multer({ dest: 'uploads/' });
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
                r.Location || r.storage_location || r.location || '',
                color,
                colorName,
                parseFloat(r.Cost || r.cost_per_kg) || 0,
                parseFloat(r['Label Weight'] || r.label_weight) || 1000,
                parseFloat(r['Empty Weight'] || r.empty_weight) || 250,
                parseFloat(r['Used Weight'] || r.weight_used) || 0,
                (r.Archived === '1' || r.Archived?.toLowerCase() === 'true' || r.archived === '1' || r.archived?.toLowerCase() === 'true') ? 1 : 0
              );
            });
            insertSpool.finalize();
            db.run('COMMIT', () => {
              fs.unlinkSync(req.file.path);
              res.json({ success: true, message: 'CSV imported successfully!' });
            });
          });
        });
      });
    });
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
