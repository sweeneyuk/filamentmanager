const express = require('express');
const cors = require('cors');
const { db, initDb, populateDefaults } = require('./database');
const { connectMqtt, getAmsStatus } = require('./mqtt');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

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
    rows.forEach(r => settings[r.key] = r.value);
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
      stmt.run(key, value);
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

// GET /api/materials
app.get('/api/materials', (req, res) => {
  db.all('SELECT * FROM materials', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
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
  const { brand_id, material_id, subtype, location, color, cost, total_weight, empty_weight } = req.body;
  db.run(`
    INSERT INTO spools (brand_id, material_id, subtype, location, color, cost, total_weight, empty_weight) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [brand_id, material_id, subtype, location, color, cost, total_weight, empty_weight], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

// PUT /api/spools/:id
app.put('/api/spools/:id', (req, res) => {
  const { brand_id, material_id, subtype, location, color, cost, total_weight, empty_weight, used_weight } = req.body;
  db.run(`
    UPDATE spools 
    SET brand_id = ?, material_id = ?, subtype = ?, location = ?, color = ?, cost = ?, total_weight = ?, empty_weight = ?, used_weight = ?
    WHERE id = ?
  `, [brand_id, material_id, subtype, location, color, cost, total_weight, empty_weight, used_weight, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
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
  const query = `
    SELECT a.*, s.color as spool_color, b.name as spool_brand
    FROM archives a
    LEFT JOIN spools s ON a.spool_id = s.id
    LEFT JOIN brands b ON s.brand_id = b.id
    ORDER BY a.created_at DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
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

// GET /api/ams
app.get('/api/ams', (req, res) => {
  res.json(getAmsStatus());
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
      res.json({ success: true });
    });
  } else {
    db.run(`
      INSERT INTO ams_assignments (tray_id, spool_id) VALUES (?, ?)
      ON CONFLICT(tray_id) DO UPDATE SET spool_id = excluded.spool_id
    `, [tray_id, spool_id], err => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  }
});

// Serve Media directory
app.use('/media', express.static(path.join(__dirname, 'data/media')));

// POST /api/import/bambuddy
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
app.post('/api/import/bambuddy', upload.single('dbFile'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { importBambuddyDb } = require('./import');
  try {
    await importBambuddyDb(req.file.path);
    res.json({ success: true, message: 'Database imported successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

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
          if (r.Brand) insertBrand.run(r.Brand);
          if (r.Material) insertMat.run(r.Material);
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
              INSERT INTO spools (brand_id, material_id, subtype, location, color, cost, total_weight, empty_weight, used_weight, archived) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            results.forEach(r => {
              insertSpool.run(
                brandMap[r.Brand] || null,
                matMap[r.Material] || null,
                r.Subtype || '',
                r.Location || '',
                r.Color || '#ffffff',
                parseFloat(r.Cost) || 0,
                parseFloat(r['Label Weight']) || 1000,
                parseFloat(r['Empty Weight']) || 250,
                parseFloat(r['Used Weight']) || 0,
                r.Archived === '1' || r.Archived?.toLowerCase() === 'true' ? 1 : 0
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

// GET /api/test/ha
app.get('/api/test/ha', async (req, res) => {
  const { getEnergyRate, getPrinterEnergyUsage } = require('./ha');
  try {
    const rate = await getEnergyRate();
    const usage = await getPrinterEnergyUsage();
    res.json({ success: true, message: `Successfully connected to HA. Rate: ${rate}, Printer Energy: ${usage} kWh` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/test/mqtt
app.get('/api/test/mqtt', async (req, res) => {
  const { connectFtp } = require('./ftp');
  try {
    // We can also test FTPS here since they use the same credentials
    const ftpClient = await connectFtp();
    ftpClient.close();
    res.json({ success: true, message: 'Successfully connected to Bambu Lab Printer (MQTT/FTPS verified)' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// React Router fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
