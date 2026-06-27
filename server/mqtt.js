const mqtt = require('mqtt');
const { db } = require('./database');
const { getPrinterEnergyUsage, getEnergyRate } = require('./ha');

let client = null;
let currentAmsData = {};
let printState = {
  status: 'IDLE',
  name: '',
  startTime: null,
  startEnergy: 0,
  spoolId: null, // Track which spool we are using
};

// Helper to get settings
const getSetting = (key) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.value : null);
    });
  });
};

const connectMqtt = async () => {
  if (client) {
    client.end();
  }

  const ip = await getSetting('bambu_ip');
  const serial = await getSetting('bambu_serial');
  const accessCode = await getSetting('bambu_access_code');

  if (!ip || !serial || !accessCode) {
    console.log('Bambu Lab MQTT credentials not fully configured.');
    return;
  }

  const brokerUrl = `mqtts://${ip}:8883`;
  console.log(`Connecting to Bambu Lab MQTT at ${brokerUrl} for serial ${serial}...`);

  client = mqtt.connect(brokerUrl, {
    username: 'bblp',
    password: accessCode,
    rejectUnauthorized: false, // Self-signed cert
    reconnectPeriod: 5000,
  });

  client.on('connect', () => {
    console.log('Connected to Bambu Lab MQTT.');
    client.subscribe(`device/${serial}/report`);
  });

  client.on('message', async (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      if (payload.print) {
        handlePrintStatus(payload.print);
      }
    } catch (err) {
      console.error('Error parsing MQTT message:', err);
    }
  });

  client.on('error', (err) => {
    console.error('MQTT connection error:', err);
  });
};

const handlePrintStatus = async (printData) => {
  // Extract AMS data if present
  if (printData.ams && printData.ams.ams) {
    currentAmsData = printData.ams.ams;
  }

  // Handle print lifecycle
  const newStatus = printData.gcode_state;
  const subTaskName = printData.subtask_name;

  if (newStatus && newStatus !== printState.status) {
    console.log(`Print status changed from ${printState.status} to ${newStatus}`);
    
    if (newStatus === 'RUNNING' && printState.status !== 'RUNNING' && printState.status !== 'PAUSE') {
      // Print started
      printState.status = 'RUNNING';
      printState.name = subTaskName || 'Unknown Print';
      printState.startTime = new Date();
      printState.startEnergy = await getPrinterEnergyUsage();
      
      // Determine spool used (naive approach: take the active tray from AMS or default spool)
      // For now, we don't know exactly which spool in the DB maps to the tray, but we can guess or leave it null
      printState.spoolId = null; 

    } else if (newStatus === 'FINISH' && printState.status === 'RUNNING') {
      // Print completed
      const endTime = new Date();
      const endEnergy = await getPrinterEnergyUsage();
      const durationSeconds = Math.round((endTime - printState.startTime) / 1000);
      
      const energyUsed = Math.max(0, endEnergy - printState.startEnergy);
      const energyRate = await getEnergyRate();
      const energyCost = energyUsed * energyRate;

      // Filament used (if provided in MQTT payload it's usually in mc_print_line_num or similar, but Bambu MQTT lacks direct weight in real-time easily, we'll need to rely on users or an estimate, but wait, the printer sends 'mc_print_sub_stage' or 'mc_percent' - actually getting precise weight from read-only MQTT is tricky without slicing metadata. Let's record 0 for now and let the user edit, or if we can extract it, great.)
      // We'll leave filament_used_g = 0 for now unless we can parse it from printData.
      const filamentUsed = 0; 
      const filamentCost = 0;

      const totalCost = energyCost + filamentCost;

      // Save to archive first to get ID
      db.run(`
        INSERT INTO archives (print_name, status, duration_seconds, energy_kwh, energy_cost, filament_used_g, filament_cost, total_cost, spool_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [printState.name, 'COMPLETED', durationSeconds, energyUsed, energyCost, filamentUsed, filamentCost, totalCost, printState.spoolId], async function(err) {
        if (err) {
          console.error('Failed to save archive:', err);
        } else {
          const archiveId = this.lastID;
          console.log(`Print ${printState.name} archived with ID ${archiveId}.`);
          
          // Download timelapse and photo asynchronously
          const { downloadLatestTimelapseAndPhoto } = require('./ftp');
          const paths = await downloadLatestTimelapseAndPhoto(printState.name, archiveId);
          
          if (paths.timelapsePath || paths.photoPath) {
            db.run(
              'UPDATE archives SET timelapse_path = ?, photo_path = ? WHERE id = ?',
              [paths.timelapsePath, paths.photoPath, archiveId]
            );
          }
        }
      });

      // Reset state
      printState = { status: 'IDLE', name: '', startTime: null, startEnergy: 0, spoolId: null };
    } else {
      printState.status = newStatus;
    }
  }
};

const getAmsStatus = () => {
  return currentAmsData;
};

module.exports = {
  connectMqtt,
  getAmsStatus
};
