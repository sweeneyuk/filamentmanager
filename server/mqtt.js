const mqtt = require('mqtt');
const { db } = require('./database');
const { getPrinterEnergyUsage, getEnergyRate } = require('./ha');

let client = null;
let currentAmsData = {};
let ioInstance = null;

const IDLE_STATE = () => ({
  status: 'IDLE',
  name: '',
  progress: 0,
  remainingTime: 0,
  startTime: null,
  startEnergy: 0,
  predictedWeights: [],
  activeTrays: [],
  currentTrayId: null,
  nozzleTemp: 0,
  nozzleTarget: 0,
  bedTemp: 0,
  bedTarget: 0,
  chamberTemp: 0,
  light: false,
  layerNum: 0,
  totalLayerNum: 0,
  stage: 'Idle',
  activeGcodeFile: null,
  raw: null
});

let printState = IDLE_STATE();

const PRINT_STAGES = {
  "-1": "Idle",
  "0": "Printing",
  "1": "Auto Bed Leveling",
  "2": "Heating Bed",
  "3": "Sweeping XY Mech Mode",
  "4": "Changing Filament",
  "5": "M400 Pause",
  "6": "Paused (Filament Runout)",
  "7": "Heating Hotend",
  "8": "Calibrating Extrusion",
  "9": "Scanning Bed Surface",
  "10": "Inspecting First Layer",
  "11": "Identifying Build Plate",
  "12": "Calibrating Micro Lidar",
  "13": "Homing Toolhead",
  "14": "Cleaning Nozzle Tip",
  "15": "Checking Extruder Temp",
  "16": "Paused (User)",
  "17": "Pause (Front Cover Falling)",
  "18": "Calibrating Micro Lidar",
  "19": "Calibrating Extrusion Flow",
  "20": "Paused (Nozzle Temp Malfunction)",
  "21": "Paused (Bed Temp Malfunction)"
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

let hasLoggedKeys = false;
const handlePrintStatus = async (printData) => {
  if (!hasLoggedKeys) {
    const fs = require('fs');
    fs.writeFileSync('C:\\Users\\micha\\.gemini\\antigravity\\brain\\cf39f222-2d73-4673-b082-d7930f2024d0\\scratch\\printData.json', JSON.stringify(printData, null, 2));
    console.log("DEBUG: printData keys =", Object.keys(printData));
    const temps = Object.keys(printData).filter(k => k.includes('temp') || k.includes('nozzle') || k.includes('ext'));
    console.log("DEBUG: Temperature related keys =", temps.map(k => `${k}: ${JSON.stringify(printData[k])}`));
    hasLoggedKeys = true;
  }

  // Extract AMS data if present
  if (printData.ams && printData.ams.ams) {
    currentAmsData = printData.ams.ams;
  }

  // Handle print lifecycle
  const newStatus = printData.gcode_state;
  const subTaskName = printData.subtask_name;

  // Save raw data for dynamic rendering in the UI
  printState.raw = printData;

  // Live Telemetry
  if (printData.mc_percent !== undefined) printState.progress = printData.mc_percent;
  if (printData.mc_remaining_time !== undefined) printState.remainingTime = printData.mc_remaining_time;
  if (printData.nozzle_temper !== undefined) printState.nozzleTemp = printData.nozzle_temper;
  if (printData.nozzle_target_temper !== undefined) printState.nozzleTarget = printData.nozzle_target_temper;
  if (printData.bed_temper !== undefined) printState.bedTemp = printData.bed_temper;
  if (printData.bed_target_temper !== undefined) printState.bedTarget = printData.bed_target_temper;
  if (printData.chamber_temper !== undefined) printState.chamberTemp = printData.chamber_temper;
  if (printData.lights_report && printData.lights_report.length > 0) {
    printState.light = printData.lights_report[0].mode === "on";
  }
  if (printData.layer_num !== undefined) printState.layerNum = printData.layer_num;
  if (printData.total_layer_num !== undefined) printState.totalLayerNum = printData.total_layer_num;
  if (printData.stg_cur !== undefined) {
    printState.stage = PRINT_STAGES[printData.stg_cur.toString()] || `Stage ${printData.stg_cur}`;
  }
  
  if (printData.chamber_temper !== undefined) {
    printState.chamberTemp = printData.chamber_temper;
  } else if (printData.device?.ctc?.info?.temp !== undefined) {
    printState.chamberTemp = printData.device.ctc.info.temp;
  }

  // Track exactly which spool is currently feeding (updates continuously)
  if (printData.ams && printData.ams.tray_now !== undefined) {
    const m = parseInt(printData.ams.tray_now, 10);
    if (m !== 255 && !isNaN(m)) {
      printState.currentTrayId = `${Math.floor(m / 4)}-${m % 4}`;
    } else {
      printState.currentTrayId = null;
    }
  }

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

      // If ams_mapping or mapping exists, we can know which trays are being used for the whole print
      const mappingArray = printData.mapping || printData.ams_mapping;
      if (mappingArray && Array.isArray(mappingArray)) {
        printState.activeTrays = mappingArray.map(m => {
          // 255 or 65535 means no AMS tray assigned
          if (m === 255 || m === 65535) return null;
          const amsId = Math.floor(m / 4);
          const trayId = m % 4;
          return `${amsId}-${trayId}`;
        }).filter(Boolean);
      } else if (printData.vt_tray && printData.vt_tray.id !== 255) {
        // Single tray active
        printState.activeTrays = [`0-${printData.vt_tray.id}`]; // naive fallback
      }

      // Start fetching the 3MF weights and thumbnail asynchronously in the background
      if (printData.gcode_file && printState.lastFetchedGcode !== printData.gcode_file) {
        printState.lastFetchedGcode = printData.gcode_file;
        const { getPredictedWeights, extractThumbnailFrom3mf } = require('./ftp');
        getPredictedWeights(printData.gcode_file, printData.subtask_name).then(res => {
          if (res && res.weights && Array.isArray(res.weights)) {
            printState.predictedWeights = res.weights;
            if (res.path) printState.activeGcodeFile = res.path;
            console.log('Successfully extracted predicted weights:', res.weights);
          }
        }).catch(err => console.log('Failed to fetch weights via FTP:', err.message));
        
        // Extract thumbnail right away with a timestamp prefix
        const thumbPrefix = Date.now().toString();
        extractThumbnailFrom3mf(printData.gcode_file, thumbPrefix).then(thumbPath => {
          if (thumbPath) {
            printState.thumbnailPath = thumbPath;
          }
        }).catch(err => console.log('Failed to fetch thumbnail via FTP:', err.message));
      }

    } else if ((newStatus === 'FINISH' || newStatus === 'FAILED') && printState.status !== 'FINISH' && printState.status !== 'FAILED') {
      // Print completed or failed
      
      // Ensure we have basic state if we missed the RUNNING phase (e.g. backend restarted during print)
      if (!printState.name) printState.name = subTaskName || 'Unknown Print';
      if (!printState.startTime) printState.startTime = new Date(); // Best guess if missed
      if (printState.startEnergy === undefined) printState.startEnergy = await getPrinterEnergyUsage();
      
      if (!printState.activeTrays || printState.activeTrays.length === 0) {
        const mappingArray = printData.mapping || printData.ams_mapping;
        if (mappingArray && Array.isArray(mappingArray)) {
          printState.activeTrays = mappingArray.map(m => {
            if (m === 255 || m === 65535) return null;
            return `${Math.floor(m / 4)}-${m % 4}`;
          }).filter(Boolean);
        } else if (printData.vt_tray && printData.vt_tray.id !== 255) {
          printState.activeTrays = [`0-${printData.vt_tray.id}`];
        } else {
          printState.activeTrays = [];
        }
      }
      
      if ((!printState.predictedWeights || printState.predictedWeights.length === 0) && printData.gcode_file) {
        console.log('Fetching predicted weights at finish line because they were missing...');
        const { getPredictedWeights } = require('./ftp');
        try {
          const res = await getPredictedWeights(printData.gcode_file, printData.subtask_name);
          if (res && res.weights && Array.isArray(res.weights)) {
            printState.predictedWeights = res.weights;
            if (res.path) printState.activeGcodeFile = res.path;
          }
        } catch (err) {
          console.log('Failed to fetch weights at finish line:', err.message);
        }
      }

      const endTime = new Date();
      const endEnergy = await getPrinterEnergyUsage();
      const durationSeconds = Math.round((endTime - printState.startTime) / 1000);
      
      const energyUsed = Math.max(0, endEnergy - printState.startEnergy);
      const energyRate = await getEnergyRate();
      const energyCost = energyUsed * energyRate;

      // Calculate Filament Used
      let percentCompleted = 1.0;
      if (newStatus === 'FAILED') {
        percentCompleted = Math.max(0, printState.progress || 0) / 100.0;
      }

      let filamentUsed = 0;
      let filamentCost = 0;
      const archivedState = { ...printState };
      const spoolDeductions = []; // Track exactly which spools were used
      
      // Deduct weight from assigned spools and compute costs
      db.all('SELECT aa.tray_id, aa.spool_id, s.cost, s.total_weight FROM ams_assignments aa LEFT JOIN spools s ON aa.spool_id = s.id', [], (err, assignments) => {
        const assignMap = {};
        const costMap = {};
        if (!err && assignments) {
          assignments.forEach(a => {
            assignMap[a.tray_id] = a.spool_id;
            costMap[a.spool_id] = (a.cost > 0 && a.total_weight > 0) ? (a.cost / a.total_weight) : 0;
          });
        }

        archivedState.activeTrays.forEach((trayId, idx) => {
          const predicted = (archivedState.predictedWeights[idx] || 0) * percentCompleted;
          if (predicted > 0) {
            filamentUsed += predicted;
            const spoolId = assignMap[trayId];
            if (spoolId) {
              db.run('UPDATE spools SET used_weight = used_weight + ?, last_used_at = CURRENT_TIMESTAMP, last_print_name = ? WHERE id = ?',
                [predicted, archivedState.name, spoolId]);
              // Record which spool was used
              spoolDeductions.push({ spoolId, predicted });
              filamentCost += predicted * (costMap[spoolId] || 0);
            }
          }
        });

        // If we didn't have active trays mapped but have a predicted weight, just sum it
        if (archivedState.activeTrays.length === 0 && archivedState.predictedWeights.length > 0) {
          filamentUsed = archivedState.predictedWeights.reduce((a, b) => a + b, 0) * percentCompleted;
        }

        const totalCost = energyCost + filamentCost;

        // Save to archive first to get ID
        db.run(`
          INSERT INTO archives (print_name, status, duration_seconds, energy_kwh, energy_cost, filament_used_g, filament_cost, total_cost, thumbnail_path)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [archivedState.name, newStatus, durationSeconds, energyUsed, energyCost, filamentUsed, filamentCost, totalCost, archivedState.thumbnailPath || null], async function(err) {
          if (err) {
            console.error('Failed to save archive:', err);
          } else {
            const archiveId = this.lastID;
            console.log(`Print ${archivedState.name} archived with ID ${archiveId}.`);

            // Record which spools were used for this specific archive entry
            spoolDeductions.forEach(({ spoolId, predicted }) => {
              db.run('INSERT INTO archive_spools (archive_id, spool_id, weight_used_g) VALUES (?, ?, ?)',
                [archiveId, spoolId, predicted]);
            });
            // Download timelapse and photo asynchronously after 60 seconds
            // This gives the printer time to render the final timelapse MP4
            setTimeout(async () => {
              try {
                const { downloadLatestTimelapseAndPhoto } = require('./ftp');
                // Use the successfully identified gcode file path from start of print, fallback to raw
                const gcodePath = archivedState.activeGcodeFile || archivedState.raw.gcode_file;
                const paths = await downloadLatestTimelapseAndPhoto(archivedState.name, archiveId, gcodePath);
                
                if (paths.timelapsePath || paths.photoPath) {
                  db.run(
                    'UPDATE archives SET timelapse_path = ?, photo_path = ? WHERE id = ?',
                    [paths.timelapsePath, paths.photoPath, archiveId]
                  );
                }
              } catch (e) {
                console.error('Failed to download timelapse asynchronously:', e);
              }
            }, 60000);
          }
        });
      });

      // Reset state synchronously to prepare for next print
      printState = IDLE_STATE();
    } else {
      printState.status = newStatus;
    }
  }

  if (ioInstance) {
    ioInstance.emit('print_state_update', printState);
    ioInstance.emit('ams_update', currentAmsData);
  }
};

const getAmsStatus = () => {
  return currentAmsData;
};

const getPrintState = () => {
  return printState;
};

const setIo = (io) => {
  ioInstance = io;
};

module.exports = {
  connectMqtt,
  getAmsStatus,
  getPrintState,
  setIo
};
