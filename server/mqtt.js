const mqtt = require('mqtt');
const { db, allQuery, getQuery, runQuery } = require('./database');
const { getPrinterEnergyUsage, getEnergyRate } = require('./ha');
const { getBambuVariantId } = require('./bambuCatalog');

const clients = {}; // printer_id -> mqtt client
const amsDataMap = {}; // printer_id -> ams data
const printStates = {}; // printer_id -> state
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

const PRINT_STAGES = {
  "-1": "Idle", "0": "Printing", "1": "Auto Bed Leveling", "2": "Heating Bed", "3": "Sweeping XY Mech Mode",
  "4": "Changing Filament", "5": "M400 Pause", "6": "Paused (Filament Runout)", "7": "Heating Hotend",
  "8": "Calibrating Extrusion", "9": "Scanning Bed Surface", "10": "Inspecting First Layer", "11": "Identifying Build Plate",
  "12": "Calibrating Micro Lidar", "13": "Homing Toolhead", "14": "Cleaning Nozzle Tip", "15": "Checking Extruder Temp",
  "16": "Paused (User)", "17": "Pause (Front Cover Falling)", "18": "Calibrating Micro Lidar", "19": "Calibrating Extrusion Flow",
  "20": "Paused (Nozzle Temp Malfunction)", "21": "Paused (Bed Temp Malfunction)"
};

const disconnectPrinter = (id) => {
  if (clients[id]) {
    clients[id].end();
    delete clients[id];
  }
  delete printStates[id];
  delete amsDataMap[id];
};

const connectPrinter = (printer) => {
  const { id, ip, serial, access_code, name } = printer;
  
  disconnectPrinter(id);
  
  if (!ip || !serial || !access_code) {
    console.log(`[MQTT] Printer ${id} (${name}) missing credentials.`);
    return;
  }

  printStates[id] = IDLE_STATE();
  printStates[id].isFirstPayload = true;
  amsDataMap[id] = {};

  const brokerUrl = `mqtts://${ip}:8883`;
  console.log(`[MQTT] Connecting to printer ${id} (${name}) at ${brokerUrl}...`);

  const client = mqtt.connect(brokerUrl, {
    username: 'bblp',
    password: access_code,
    rejectUnauthorized: false,
    reconnectPeriod: 5000,
  });

  clients[id] = client;

  client.on('connect', () => {
    console.log(`[MQTT] Connected to printer ${id} (${name}).`);
    client.subscribe(`device/${serial}/report`);
  });

  client.on('message', async (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      if (payload.print) {
        handlePrintStatus(printer, payload.print);
      }
    } catch (err) {
      console.error(`[MQTT] Error parsing message from printer ${id}:`, err);
    }
  });

  client.on('error', (err) => {
    console.error(`[MQTT] Connection error for printer ${id}:`, err.message);
  });
};

const reconnectPrinter = (id, printer) => {
  printer.id = id;
  connectPrinter(printer);
};

const connectMqtt = async () => {
  try {
    const printers = await allQuery('SELECT * FROM printers');
    for (const printer of printers) {
      connectPrinter(printer);
    }
  } catch (err) {
    console.error('[MQTT] Failed to load printers from DB:', err.message);
  }
};

const handlePrintStatus = async (printer, printData) => {
  const pid = printer.id;
  const state = printStates[pid];

  let amsList = Array.isArray(amsDataMap[pid]) ? [...amsDataMap[pid]] : [];
  let updated = false;



  if (printData.ams && Array.isArray(printData.ams.ams)) {
    // Keep external trays (254, 255), replace real AMS units
    amsList = amsList.filter(a => a.id === "254" || a.id === "255");
    amsList.unshift(...printData.ams.ams);
    updated = true;
  }

  // Handle vir_slot (X2D dual-nozzle external spools)
  if (Array.isArray(printData.vir_slot)) {
    // Remove old external spools
    amsList = amsList.filter(a => a.id !== "254" && a.id !== "255");
    
    printData.vir_slot.forEach(slot => {
      let unitId = String(slot.id);
      // Bambu sometimes uses 255 for a single external spool, remap to 254
      if (printData.vir_slot.length === 1 && unitId === "255") {
        unitId = "254";
      }
      amsList.push({
        id: unitId,
        tray: [{ ...slot, id: "0" }]
      });
    });
    updated = true;
  } else {
    // Handle vt_tray (single-nozzle external spool fallback)
    const rawVtTray = printData.vt_tray || (printData.ams && printData.ams.vt_tray);
    if (rawVtTray) {
      // Remove old external spool
      amsList = amsList.filter(a => a.id !== "254");
      
      // Bambu uses id=255 to mean empty/unloaded for the external spool
      if (rawVtTray.id !== 255 && Object.keys(rawVtTray).length > 1) {
        amsList.push({
          id: "254",
          tray: [{ ...rawVtTray, id: "0" }]
        });
      } else {
        amsList.push({
          id: "254",
          tray: [{ id: "0", tray_type: "", tray_color: "000000FF" }]
        });
      }
      updated = true;
    }
  }

  if (updated) {
    const oldAmsStr = JSON.stringify(amsDataMap[pid]);
    const newAmsStr = JSON.stringify(amsList);
    
    amsDataMap[pid] = amsList;
    
    if (oldAmsStr !== newAmsStr) {
      syncAmsSpools(pid, amsList).catch(err => console.error('[MQTT] AMS Sync Error:', err.message));
    }
  }

  const newStatus = printData.gcode_state;
  const subTaskName = printData.subtask_name;
  
  if (newStatus && state.isFirstPayload) {
    state.status = newStatus;
    state.isFirstPayload = false;
  }

  state.raw = printData;

  // Live Telemetry
  if (printData.mc_percent !== undefined) state.progress = printData.mc_percent;
  if (printData.mc_remaining_time !== undefined) state.remainingTime = printData.mc_remaining_time;
  if (printData.nozzle_temper !== undefined) state.nozzleTemp = printData.nozzle_temper;
  if (printData.nozzle_target_temper !== undefined) state.nozzleTarget = printData.nozzle_target_temper;
  if (printData.bed_temper !== undefined) state.bedTemp = printData.bed_temper;
  if (printData.bed_target_temper !== undefined) state.bedTarget = printData.bed_target_temper;
  if (printData.chamber_temper !== undefined) state.chamberTemp = printData.chamber_temper;
  if (printData.lights_report && printData.lights_report.length > 0) {
    state.light = printData.lights_report[0].mode === "on";
  }
  if (printData.layer_num !== undefined) state.layerNum = printData.layer_num;
  if (printData.total_layer_num !== undefined) state.totalLayerNum = printData.total_layer_num;
  if (printData.stg_cur !== undefined) {
    state.stage = PRINT_STAGES[printData.stg_cur.toString()] || `Stage ${printData.stg_cur}`;
  }
  
  if (printData.chamber_temper !== undefined) {
    state.chamberTemp = printData.chamber_temper;
  } else if (printData.device?.ctc?.info?.temp !== undefined) {
    state.chamberTemp = printData.device.ctc.info.temp;
  }

  let activeExtruder = 0;
  if (printData.device?.extruder?.state !== undefined) {
    activeExtruder = (printData.device.extruder.state >> 8) & 1;
  }

  const decodeTrayId = (m, activeExt = 0) => {
    if (m === 255 || m === 65535) return null;
    
    if (m === 254 || m === -1) {
      // 254 (or -1 from slicer mapping) is generic external spool.
      if (activeExt === 0 && printData.device?.extruder?.info?.length > 1) {
        return '255-0';
      }
      return '254-0';
    }
    
    // AMS HT units use IDs 128 to 135 (single slot)
    if (m >= 128 && m <= 135) return `${m}-0`;
    
    // Snow encoded values (e.g. from ams_mapping)
    if (m >= 256) return `${m >> 8}-${m & 0xFF}`;
    
    // Regular AMS slots (0-15)
    return `${Math.floor(m / 4)}-${m % 4}`;
  };

  if (printData.ams && printData.ams.tray_now !== undefined) {
    let m = parseInt(printData.ams.tray_now, 10);
    
    // H2D dual-nozzle only reports the slot number (0-3) in tray_now.
    // Use the snow field from device.extruder.info for the true global ID.
    if (printData.device?.extruder?.info && Array.isArray(printData.device.extruder.info)) {
      if (printData.device.extruder.info.length > 1) {
        const snowTray = printData.device.extruder.info[activeExtruder]?.snow;
        if (snowTray !== undefined && snowTray !== null && snowTray !== 255) {
          m = snowTray;
        }
      }
    }
    
    state.currentTrayId = !isNaN(m) ? decodeTrayId(m, activeExtruder) : null;
  }
  
  if (state.currentTrayId && state.activeTrays && !state.activeTrays.includes(state.currentTrayId)) {
    state.activeTrays.push(state.currentTrayId);
  }

  if (newStatus && newStatus !== state.status) {
    console.log(`[MQTT ${pid}] Print status changed from ${state.status} to ${newStatus}`);
    
    if (newStatus === 'RUNNING' && state.status !== 'RUNNING' && state.status !== 'PAUSE') {
      state.status = 'RUNNING';
      state.name = subTaskName || 'Unknown Print';
      state.startTime = new Date();
      state.startEnergy = await getPrinterEnergyUsage();
      state.predictedWeights = [];
      state.activeTrays = [];

      const mappingArray = printData.mapping || printData.ams_mapping;
      if (mappingArray && Array.isArray(mappingArray)) {
        state.activeTrays = mappingArray.map(m => decodeTrayId(m)).filter(Boolean);
      } else if (printData.vt_tray && printData.vt_tray.id !== 255) {
        state.activeTrays = [`0-${printData.vt_tray.id}`];
      }

      db.run(`
        INSERT INTO archives (printer_id, print_name, status, created_at)
        VALUES (?, ?, 'In Progress', CURRENT_TIMESTAMP)
      `, [pid, state.name], function(err) {
        if (!err) {
          state.archiveId = this.lastID;
          console.log(`[MQTT ${pid}] Created in-progress archive record with ID ${state.archiveId}`);

          if (printData.gcode_file) {
            state.lastFetchedGcode = printData.gcode_file;
            const { getPredictedWeights, extractThumbnailFrom3mf } = require('./ftp');
            
            getPredictedWeights(printer, printData.gcode_file, printData.subtask_name).then(res => {
              if (res && res.weights && Array.isArray(res.weights)) {
                state.predictedWeights = res.weights;
                if (res.path) state.activeGcodeFile = res.path;
                console.log(`[MQTT ${pid}] Successfully extracted predicted weights:`, res.weights);
              }
            }).catch(err => console.log(`[MQTT ${pid}] Failed to fetch weights via FTP:`, err.message));
            
            // Attempt thumbnail extraction. The 3MF may not be on the printer's FTP
            // immediately when RUNNING fires (BambuStudio is still uploading), so
            // we try once right away and, if that fails, retry after a 15-second delay.
            const attemptThumbnail = (attempt) => {
              const thumbPrefix = `${Date.now()}`;
              extractThumbnailFrom3mf(printer, printData.gcode_file, thumbPrefix, printData.subtask_name).then(thumbPath => {
                if (thumbPath) {
                  state.thumbnailPath = thumbPath;
                  if (state.archiveId) {
                    db.run('UPDATE archives SET thumbnail_path = ? WHERE id = ?', [thumbPath, state.archiveId]);
                  }
                  console.log(`[MQTT ${pid}] Thumbnail stored (attempt ${attempt}): ${thumbPath}`);
                } else if (attempt < 3) {
                  const delay = attempt * 15000; // 15s, 30s
                  console.log(`[MQTT ${pid}] Thumbnail attempt ${attempt} failed, retrying in ${delay / 1000}s...`);
                  setTimeout(() => attemptThumbnail(attempt + 1), delay);
                } else {
                  console.log(`[MQTT ${pid}] Could not extract thumbnail after ${attempt} attempts.`);
                }
              }).catch(err => {
                console.log(`[MQTT ${pid}] Thumbnail fetch error (attempt ${attempt}):`, err.message);
                if (attempt < 3) setTimeout(() => attemptThumbnail(attempt + 1), attempt * 15000);
              });
            };
            attemptThumbnail(1);
          }
        }
      });

    } else if ((newStatus === 'FINISH' || newStatus === 'FAILED') && state.status !== 'FINISH' && state.status !== 'FAILED') {
      
      if (!state.name) state.name = subTaskName || 'Unknown Print';
      if (!state.startTime) state.startTime = new Date();
      if (state.startEnergy === undefined) state.startEnergy = await getPrinterEnergyUsage();
      
      if (!state.activeTrays || state.activeTrays.length === 0) {
        const mappingArray = printData.mapping || printData.ams_mapping;
        if (mappingArray && Array.isArray(mappingArray)) {
          state.activeTrays = mappingArray.map(m => decodeTrayId(m)).filter(Boolean);
        } else if (printData.vt_tray && printData.vt_tray.id !== 255) {
          state.activeTrays = [`0-${printData.vt_tray.id}`];
        } else {
          state.activeTrays = [];
        }
      }
      
      if ((!state.predictedWeights || state.predictedWeights.length === 0) && printData.gcode_file) {
        const { getPredictedWeights } = require('./ftp');
        try {
          const res = await getPredictedWeights(printer, printData.gcode_file, printData.subtask_name);
          if (res && res.weights && Array.isArray(res.weights)) {
            state.predictedWeights = res.weights;
            if (res.path) state.activeGcodeFile = res.path;
          }
        } catch (err) {}
      }

      const endTime = new Date();
      const endEnergy = await getPrinterEnergyUsage();
      const durationSeconds = Math.round((endTime - state.startTime) / 1000);
      
      const energyUsed = Math.max(0, endEnergy - state.startEnergy);
      const energyRate = await getEnergyRate();
      const energyCost = energyUsed * energyRate;

      let percentCompleted = 1.0;
      if (newStatus === 'FAILED') {
        percentCompleted = Math.max(0, state.progress || 0) / 100.0;
      }

      let filamentUsed = 0;
      let filamentCost = 0;
      const archivedState = { ...state };
      const spoolDeductions = [];
      
      // Select mappings specifically for this printer
      db.all('SELECT aa.tray_id, aa.spool_id, s.cost, s.total_weight FROM ams_assignments aa LEFT JOIN spools s ON aa.spool_id = s.id WHERE aa.printer_id = ?', [pid], (err, assignments) => {
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
              spoolDeductions.push({ spoolId, predicted });
              filamentCost += predicted * (costMap[spoolId] || 0);
            }
          }
        });

        if (archivedState.activeTrays.length === 0 && archivedState.predictedWeights.length > 0) {
          filamentUsed = archivedState.predictedWeights.reduce((a, b) => a + b, 0) * percentCompleted;
        }

        const totalCost = energyCost + filamentCost;

        const handleArchiveSave = async (err, rowId) => {
          if (err) return;
          const archiveId = rowId;
          console.log(`[MQTT ${pid}] Print ${archivedState.name} archived with ID ${archiveId}.`);

          spoolDeductions.forEach(({ spoolId, predicted }) => {
            db.run('INSERT INTO archive_spools (archive_id, spool_id, weight_used_g) VALUES (?, ?, ?)',
              [archiveId, spoolId, predicted]);
          });

          let rtspSuccessPath = null;
          try {
            const { captureCameraSnapshot } = require('./camera');
            rtspSuccessPath = await captureCameraSnapshot(printer, archiveId);
            if (rtspSuccessPath) {
              db.run('UPDATE archives SET photo_path = ? WHERE id = ?', [rtspSuccessPath, archiveId]);
              const path = require('path');
              const absolutePhotoPath = path.join(__dirname, 'data', rtspSuccessPath.replace(/^\//, ''));
              const absoluteThumbPath = archivedState.thumbnailPath ? path.join(__dirname, 'data', archivedState.thumbnailPath.replace(/^\//, '')) : null;
              const { analyzePrint } = require('./ai');
              const aiResult = await analyzePrint(absolutePhotoPath, absoluteThumbPath, archivedState.name, durationSeconds);
              if (aiResult) {
                db.run('UPDATE archives SET ai_analysis = ? WHERE id = ?', [JSON.stringify(aiResult), archiveId]);
              }
            }
          } catch (camErr) {}

          setTimeout(async () => {
            try {
              const { downloadLatestTimelapse } = require('./ftp');
              const paths = await downloadLatestTimelapse(printer, archivedState.name, archiveId);
              
              if (paths.timelapsePath) {
                db.run('UPDATE archives SET timelapse_path = ? WHERE id = ?', [paths.timelapsePath, archiveId]);
                
                if (!rtspSuccessPath && paths.localPath) {
                  const { extractFrameFromMp4 } = require('./camera');
                  const path = require('path');
                  const fallbackPhotoPath = path.join(__dirname, 'data', 'media', `${archiveId}_photo.jpg`);
                  const mp4Extracted = await extractFrameFromMp4(paths.localPath, fallbackPhotoPath);
                  
                  if (mp4Extracted) {
                    const relativePhotoPath = `/media/${archiveId}_photo.jpg`;
                    db.run('UPDATE archives SET photo_path = ? WHERE id = ?', [relativePhotoPath, archiveId]);
                    
                    const absoluteThumbPath = archivedState.thumbnailPath ? path.join(__dirname, 'data', archivedState.thumbnailPath.replace(/^\//, '')) : null;
                    const { analyzePrint } = require('./ai');
                    const aiResult = await analyzePrint(mp4Extracted, absoluteThumbPath, archivedState.name, durationSeconds);
                    if (aiResult) {
                      db.run('UPDATE archives SET ai_analysis = ? WHERE id = ?', [JSON.stringify(aiResult), archiveId]);
                    }
                  }
                }
              }
            } catch (e) {}
          }, 60000);
        };

        if (state.archiveId) {
          db.run(`
            UPDATE archives SET status = ?, duration_seconds = ?, energy_kwh = ?, energy_cost = ?, filament_used_g = ?, filament_cost = ?, total_cost = ?, thumbnail_path = COALESCE(?, thumbnail_path)
            WHERE id = ?
          `, [newStatus, durationSeconds, energyUsed, energyCost, filamentUsed, filamentCost, totalCost, archivedState.thumbnailPath || null, state.archiveId], function(err) {
            handleArchiveSave(err, state.archiveId);
            state.archiveId = null;
          });
        } else {
          db.run(`
            INSERT INTO archives (printer_id, print_name, status, duration_seconds, energy_kwh, energy_cost, filament_used_g, filament_cost, total_cost, thumbnail_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [pid, archivedState.name, newStatus, durationSeconds, energyUsed, energyCost, filamentUsed, filamentCost, totalCost, archivedState.thumbnailPath || null], function(err) {
            handleArchiveSave(err, this.lastID);
          });
        }
      });

      state.status = newStatus;
    } else {
      if (newStatus === 'IDLE' && state.status !== 'IDLE') {
        const firstPayload = state.isFirstPayload;
        Object.assign(state, IDLE_STATE());
        state.isFirstPayload = firstPayload;
      } else {
        state.status = newStatus;
      }
    }
  }

  if (ioInstance) {
    ioInstance.emit('print_state_update', { printer_id: pid, state });
    ioInstance.emit('ams_update', { printer_id: pid, ams: amsDataMap[pid] });
  }
};

async function syncAmsSpools(pid, amsDataArray) {
  if (!Array.isArray(amsDataArray)) return;
  
  let didChangeAssignments = false;

  for (const amsUnit of amsDataArray) {
    if (!amsUnit.tray || !Array.isArray(amsUnit.tray)) continue;
    
    for (let i = 0; i < amsUnit.tray.length; i++) {
      const tray = amsUnit.tray[i];
      if (tray.id === undefined) continue;
      
      const trayId = `${amsUnit.id}-${tray.id}`;
      const tagUid = tray.tag_uid;
      const subBrand = tray.tray_sub_brands;
      
      const isEmpty = !tray.tray_type || tray.tray_type === '';
      if (isEmpty) {
        const existingAssign = await getQuery('SELECT spool_id FROM ams_assignments WHERE printer_id = ? AND tray_id = ?', [pid, trayId]);
        if (existingAssign) {
          await runQuery('DELETE FROM ams_assignments WHERE printer_id = ? AND tray_id = ?', [pid, trayId]);
          didChangeAssignments = true;
          console.log(`[MQTT] Unassigned spool from empty tray ${trayId}`);
        }
        continue;
      }
      
      // We only auto-add Bambu smart spools (detected by valid RFID)
      if (!tagUid || tagUid === '0000000000000000') {
        continue;
      }
      
      try {
        let spool = await getQuery('SELECT id FROM spools WHERE rfid = ?', [tagUid]);
        let spoolId;
        
        // Hoist the existing assignment check
        const existingAssign = await getQuery('SELECT spool_id FROM ams_assignments WHERE printer_id = ? AND tray_id = ?', [pid, trayId]);
        
        // --- RFID Adoption Logic ---
        if (!spool && existingAssign) {
          let assignedSpool = await getQuery('SELECT id, rfid FROM spools WHERE id = ?', [existingAssign.spool_id]);
          // If the assigned spool doesn't have an RFID yet, it's an old manual entry we can adopt!
          if (assignedSpool && !assignedSpool.rfid) {
            await runQuery('UPDATE spools SET rfid = ? WHERE id = ?', [tagUid, assignedSpool.id]);
            spool = { id: assignedSpool.id };
            console.log(`[MQTT] Adopted manual spool ${spool.id} with new RFID ${tagUid}`);
            
            // Notify frontend that this spool got updated
            if (ioInstance) ioInstance.emit('spool_updated', { id: spool.id, rfid: tagUid });
          }
        }
        
        if (!spool) {
          // Auto-create spool
          let brand = await getQuery("SELECT id FROM brands WHERE name = 'Bambu' OR name = 'Bambu Lab'");
          let brandId = brand ? brand.id : null;
          if (!brandId) {
             const result = await runQuery("INSERT INTO brands (name, default_empty_weight) VALUES ('Bambu', 250)");
             brandId = result.lastID;
          }
          
          let material = await getQuery("SELECT id FROM materials WHERE name = ?", [tray.tray_type]);
          let materialId = material ? material.id : null;
          if (!materialId && tray.tray_type) {
             const result = await runQuery("INSERT INTO materials (name) VALUES (?)", [tray.tray_type]);
             materialId = result.lastID;
          }
          
          const hexColor = tray.tray_color ? `#${tray.tray_color.substring(0, 6)}` : '#FFFFFF';
          
          let subtype = 'Basic';
          if (subBrand && subBrand.toLowerCase().includes('matte')) subtype = 'Matte';
          else if (subBrand && subBrand.toLowerCase().includes('silk')) subtype = 'Silk';
          else if (subBrand && subBrand.toLowerCase().includes('support')) subtype = subBrand;
          
          const variantId = getBambuVariantId(tray.tray_type, subtype, hexColor);
          
          const result = await runQuery(`
            INSERT INTO spools (brand_id, material_id, subtype, color, total_weight, empty_weight, used_weight, shopify_variant_id, rfid)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [brandId, materialId, subtype, hexColor, 1000, 250, 0, variantId, tagUid]);
          
          spoolId = result.lastID;
          
          // Emit WebSocket event so inventory page updates immediately
          if (ioInstance) ioInstance.emit('spool_added', { id: spoolId });
        } else {
          spoolId = spool.id;
        }
        
        // Auto-assign to ams_assignments
        if (!existingAssign || existingAssign.spool_id !== spoolId) {
          await runQuery(`
            INSERT INTO ams_assignments (printer_id, tray_id, spool_id)
            VALUES (?, ?, ?)
            ON CONFLICT(printer_id, tray_id) DO UPDATE SET spool_id = excluded.spool_id
          `, [pid, trayId, spoolId]);
          didChangeAssignments = true;
        }
      } catch (e) {
        console.error('[MQTT] AMS Sync Error for slot', trayId, ':', e.message);
      }
    }
  }
  
  // Broadcast updated assignments if they changed
  if (didChangeAssignments && ioInstance) {
    try {
      const assignmentsData = await allQuery('SELECT printer_id, tray_id, spool_id FROM ams_assignments');
      const assignmentsMap = {};
      assignmentsData.forEach(r => {
        if (!assignmentsMap[r.printer_id]) assignmentsMap[r.printer_id] = {};
        assignmentsMap[r.printer_id][r.tray_id] = r.spool_id;
      });
      ioInstance.emit('ams_assignments_update', assignmentsMap);
    } catch (e) {
      console.error('[MQTT] Failed to broadcast AMS assignments:', e.message);
    }
  }
}

const getAmsStatus = () => {
  return amsDataMap;
};

const getPrintState = () => {
  return printStates;
};

const setIo = (io) => {
  ioInstance = io;
};

module.exports = {
  connectMqtt,
  connectPrinter,
  reconnectPrinter,
  disconnectPrinter,
  getAmsStatus,
  getPrintState,
  setIo
};
