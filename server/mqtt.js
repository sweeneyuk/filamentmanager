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
  predictedWeights: [], // Extracted from 3MF
  activeTrays: [], // Tray IDs being used (e.g., '0-0')
  progress: 0,
  remainingTime: 0,
  nozzleTemp: 0,
  nozzleTarget: 0,
  bedTemp: 0,
  bedTarget: 0,
  layerNum: 0,
  totalLayerNum: 0,
  raw: null
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

  // Save raw data for dynamic rendering
  printState.raw = printData;

  // Live Telemetry
  if (printData.mc_percent !== undefined) printState.progress = printData.mc_percent;
  if (printData.mc_remaining_time !== undefined) printState.remainingTime = printData.mc_remaining_time;
  if (printData.nozzle_temper !== undefined) printState.nozzleTemp = printData.nozzle_temper;
  if (printData.nozzle_target_temper !== undefined) printState.nozzleTarget = printData.nozzle_target_temper;
  if (printData.bed_temper !== undefined) printState.bedTemp = printData.bed_temper;
  if (printData.bed_target_temper !== undefined) printState.bedTarget = printData.bed_target_temper;
  if (printData.layer_num !== undefined) printState.layerNum = printData.layer_num;
  if (printData.total_layer_num !== undefined) printState.totalLayerNum = printData.total_layer_num;

  if (newStatus && newStatus !== printState.status) {
    console.log(`Print status changed from ${printState.status} to ${newStatus}`);
    
    if (newStatus === 'RUNNING' && printState.status !== 'RUNNING' && printState.status !== 'PAUSE') {
      // Print started
      printState.status = 'RUNNING';
      printState.name = subTaskName || 'Unknown Print';
      printState.startTime = new Date();
      printState.startEnergy = await getPrinterEnergyUsage();
      printState.predictedWeights = [];
      printState.activeTrays = [];

      // If ams_mapping exists, we can know which trays are being used
      if (printData.ams_mapping && Array.isArray(printData.ams_mapping)) {
        printState.activeTrays = printData.ams_mapping.map(m => {
          // Sometimes it's [255] for no AMS, or [0, 1] for AMS 0 Tray 0 and Tray 1
          // Bambu sometimes returns ams_mapping: [0, 255, 255...] where 0 means AMS 0 Tray 0
          if (m === 255) return null;
          const amsId = Math.floor(m / 4);
          const trayId = m % 4;
          return `${amsId}-${trayId}`;
        }).filter(Boolean);
      } else if (printData.vt_tray && printData.vt_tray.id !== 255) {
        // Single tray active
        printState.activeTrays = [`0-${printData.vt_tray.id}`]; // naive fallback
      }

      // Start fetching the 3MF weights asynchronously in the background
      if (printData.gcode_file) {
        const { getPredictedWeights } = require('./ftp');
        getPredictedWeights(printData.gcode_file).then(weights => {
          if (weights && Array.isArray(weights)) {
            printState.predictedWeights = weights;
            console.log('Successfully extracted predicted weights:', weights);
          }
        });
      }

    } else if ((newStatus === 'FINISH' || newStatus === 'FAILED') && printState.status === 'RUNNING') {
      // Print completed or failed
      const endTime = new Date();
      const endEnergy = await getPrinterEnergyUsage();
      const durationSeconds = Math.round((endTime - printState.startTime) / 1000);
      
      const energyUsed = Math.max(0, endEnergy - printState.startEnergy);
      const energyRate = await getEnergyRate();
      const energyCost = energyUsed * energyRate;

      // Calculate Filament Used
      let percentCompleted = 1.0;
      if (newStatus === 'FAILED' && printData.mc_percent) {
        percentCompleted = printData.mc_percent / 100.0;
      }

      let filamentUsed = 0;
      // Deduct weight from assigned spools
      db.all('SELECT tray_id, spool_id FROM ams_assignments', [], (err, assignments) => {
        const assignMap = {};
        if (!err && assignments) assignments.forEach(a => assignMap[a.tray_id] = a.spool_id);

        printState.activeTrays.forEach((trayId, idx) => {
          const predicted = (printState.predictedWeights[idx] || 0) * percentCompleted;
          if (predicted > 0) {
            filamentUsed += predicted;
            const spoolId = assignMap[trayId];
            if (spoolId) {
              db.run('UPDATE spools SET used_weight = used_weight + ?, last_used_at = CURRENT_TIMESTAMP, last_print_name = ? WHERE id = ?', [predicted, printState.name, spoolId]);
            }
          }
        });

        // If we didn't have active trays mapped but have a predicted weight, just sum it
        if (printState.activeTrays.length === 0 && printState.predictedWeights.length > 0) {
          filamentUsed = printState.predictedWeights.reduce((a, b) => a + b, 0) * percentCompleted;
        }

        const filamentCost = 0; // Requires looking up the spool cost/g which we can skip or do a subquery
        const totalCost = energyCost + filamentCost;

        // Save to archive first to get ID
        db.run(`
          INSERT INTO archives (print_name, status, duration_seconds, energy_kwh, energy_cost, filament_used_g, filament_cost, total_cost)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [printState.name, newStatus, durationSeconds, energyUsed, energyCost, filamentUsed, filamentCost, totalCost], async function(err) {
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
        printState = { status: 'IDLE', name: '', startTime: null, startEnergy: 0, predictedWeights: [], activeTrays: [], progress: 0, remainingTime: 0, nozzleTemp: 0, nozzleTarget: 0, bedTemp: 0, bedTarget: 0, layerNum: 0, totalLayerNum: 0 };
      });
    } else {
      printState.status = newStatus;
    }
  }
};

const getAmsStatus = () => {
  return currentAmsData;
};

const getPrintState = () => {
  return printState;
};

module.exports = {
  connectMqtt,
  getAmsStatus,
  getPrintState
};
