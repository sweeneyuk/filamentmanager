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
  const { brand_id, material_id, color, cost, total_weight, empty_weight } = req.body;
  db.run(`
    INSERT INTO spools (brand_id, material_id, color, cost, total_weight, empty_weight) 
    VALUES (?, ?, ?, ?, ?, ?)
  `, [brand_id, material_id, color, cost, total_weight, empty_weight], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
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

// React Router fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
