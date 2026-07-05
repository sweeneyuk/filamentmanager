const express = require('express');
const router = express.Router();
const { db, getQuery, allQuery, runQuery } = require('./database');
const mqtt = require('./mqtt'); // We will need to trigger reconnects

// Get all printers
router.get('/', async (req, res) => {
  try {
    const printers = await allQuery('SELECT * FROM printers ORDER BY id ASC');
    res.json({ success: true, printers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Add a new printer
router.post('/', async (req, res) => {
  const { name, ip, serial, access_code } = req.body;
  if (!name || !ip || !serial) {
    return res.status(400).json({ success: false, message: 'Name, IP, and Serial are required.' });
  }

  try {
    const result = await runQuery(
      'INSERT INTO printers (name, ip, serial, access_code) VALUES (?, ?, ?, ?)',
      [name, ip, serial, access_code || '']
    );
    
    // Trigger MQTT to connect to the new printer
    mqtt.connectPrinter(result.lastID, { name, ip, serial, access_code });
    
    res.json({ success: true, id: result.lastID });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update a printer
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, ip, serial, access_code } = req.body;
  
  try {
    await runQuery(
      'UPDATE printers SET name = ?, ip = ?, serial = ?, access_code = ? WHERE id = ?',
      [name, ip, serial, access_code || '', id]
    );
    
    // Trigger MQTT to reconnect with new settings
    mqtt.reconnectPrinter(id, { name, ip, serial, access_code });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete a printer
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await runQuery('DELETE FROM printers WHERE id = ?', [id]);
    
    // Disconnect MQTT
    mqtt.disconnectPrinter(id);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
