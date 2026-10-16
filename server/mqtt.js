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
  startEnergy: undefined,
  currentEnergy: 0,
  currentEnergyCost: 0,
  energyRate: 0,
  predictedWeights: [],
  slicerFilaments: [],
  layerFilamentMap: null,
  layerCounts: null,
  activeSlotTrays: {},
  takeoverMap: {},
  runoutSpools: {},
  spoolDeductedGrams: {},
  slotDeductedGrams: {},
  totalGramsDeducted: 0,
  lastDeductedLayer: 0,
  activeTrays: [],
  trayProgress: {},
  lastTrackedProgress: 0,
  takeovers: [],
  currentTrayId: null,
  activeExtruder: 0,
  extruderInfo: null,
  sawRunoutStage: false,
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

/**
 * Deduct a given weight (grams) from the spool assigned to trayId.
 * If the spool runs out (or is already depleted), any overflow is routed to the takeover tray.
 */
const deductFilamentForTray = (pid, state, trayId, grams, slotIdx = 0) => {
  if (!grams || grams <= 0 || !trayId) return;

  db.get(
    'SELECT aa.spool_id, s.total_weight, s.used_weight FROM ams_assignments aa LEFT JOIN spools s ON aa.spool_id = s.id WHERE aa.printer_id = ? AND aa.tray_id = ?',
    [pid, trayId],
    (err, row) => {
      if (!err && row && row.spool_id) {
        const spoolId = row.spool_id;
        const totalWeight = row.total_weight || 0;
        const currentUsed = row.used_weight || 0;
        const remaining = Math.max(0, totalWeight - currentUsed);

        // If this spool was marked as run out or has 0g remaining, route to takeover tray if available
        if (state.runoutSpools?.[trayId] === spoolId || remaining <= 0.001) {
          const takeoverTray = Object.keys(state.takeoverMap || {}).find(t => state.takeoverMap[t] === trayId);
          if (takeoverTray && takeoverTray !== trayId) {
            console.log(`[MQTT ${pid}] Spool ${spoolId} in ${trayId} depleted; routing ${grams.toFixed(2)}g to takeover tray ${takeoverTray}`);
            return deductFilamentForTray(pid, state, takeoverTray, grams, slotIdx);
          }
        }

        // Cap deduction if spool runs out on this layer
        let actualDeduct = grams;
        let overflow = 0;
        if (remaining > 0 && grams > remaining) {
          actualDeduct = remaining;
          overflow = grams - remaining;
          if (!state.runoutSpools) state.runoutSpools = {};
          state.runoutSpools[trayId] = spoolId;
          console.log(`[MQTT ${pid}] Spool ${spoolId} in ${trayId} reached 0g during layer; overflow of ${overflow.toFixed(2)}g will route to takeover roll`);
        }

        db.run(
          'UPDATE spools SET used_weight = used_weight + ?, last_used_at = CURRENT_TIMESTAMP, last_print_name = ? WHERE id = ?',
          [actualDeduct, state.name, spoolId],
          (updateErr) => {
            if (!updateErr) {
              if (!state.spoolDeductedGrams) state.spoolDeductedGrams = {};
              state.spoolDeductedGrams[spoolId] = (state.spoolDeductedGrams[spoolId] || 0) + actualDeduct;
              state.totalGramsDeducted = (state.totalGramsDeducted || 0) + actualDeduct;
              if (slotIdx !== undefined && slotIdx !== null) {
                if (!state.slotDeductedGrams) state.slotDeductedGrams = {};
                state.slotDeductedGrams[slotIdx] = (state.slotDeductedGrams[slotIdx] || 0) + actualDeduct;
              }

              // Emit updated spool to all connected clients
              db.get('SELECT * FROM spools WHERE id = ?', [spoolId], (e, updatedSpool) => {
                if (!e && updatedSpool && ioInstance) {
                  ioInstance.emit('spool_updated', updatedSpool);
                }
              });
            }
          }
        );

        // Route any overflow to the takeover roll
        if (overflow > 0) {
          const takeoverTray = Object.keys(state.takeoverMap || {}).find(t => state.takeoverMap[t] === trayId);
          if (takeoverTray && takeoverTray !== trayId) {
            deductFilamentForTray(pid, state, takeoverTray, overflow, slotIdx);
          }
        }
      }
    }
  );
};

/**
 * Deduct filament layer-by-layer from fromLayer to toLayer.
 */
const processLayerDeductions = (pid, state, fromLayer, toLayer) => {
  if (!state.predictedWeights || state.predictedWeights.length === 0) return;
  for (let l = fromLayer; l <= toLayer; l++) {
    if (state.layerFilamentMap && state.layerFilamentMap[l]) {
      const activeFilaments = state.layerFilamentMap[l];
      for (const fIdx of activeFilaments) {
        const filamentWeight = state.predictedWeights[fIdx] || 0;
        const count = (state.layerCounts && state.layerCounts[fIdx]) || 1;
        const layerGrams = count > 0 ? (filamentWeight / count) : 0;
        if (layerGrams > 0) {
          const targetTray = state.activeSlotTrays?.[fIdx] || state.activeTrays?.[fIdx] || state.currentTrayId;
          if (targetTray) {
            deductFilamentForTray(pid, state, targetTray, layerGrams, fIdx);
          }
        }
      }
    } else if (state.predictedWeights.length === 1) {
      // Single filament print fallback: distribute total print weight evenly across total layers
      const totalWeight = state.predictedWeights[0];
      const totalLayers = Math.max(1, state.totalLayerNum || 100);
      const layerGrams = totalWeight / totalLayers;
      if (layerGrams > 0) {
        const targetTray = state.activeSlotTrays?.[0] || state.activeTrays?.[0] || state.currentTrayId;
        if (targetTray) {
          deductFilamentForTray(pid, state, targetTray, layerGrams, 0);
        }
      }
    } else {
      // Multi-colour print without layer map:
      // Attribute layer consumption to the tray currently printing (state.currentTrayId)
      const targetTray = state.currentTrayId || state.activeTrays?.[0];
      let fIdx = 0;
      if (state.activeSlotTrays) {
        const foundSlot = Object.keys(state.activeSlotTrays).find(slot => state.activeSlotTrays[slot] === targetTray);
        if (foundSlot !== undefined) fIdx = parseInt(foundSlot, 10);
      } else if (state.activeTrays) {
        const idx = state.activeTrays.indexOf(targetTray);
        if (idx !== -1) fIdx = idx;
      }
      const filamentWeight = state.predictedWeights[fIdx] || (state.predictedWeights[0] || 0);
      const totalLayers = Math.max(1, state.totalLayerNum || 100);
      const layerGrams = totalLayers > 0 ? (filamentWeight / totalLayers) : 0;
      if (layerGrams > 0 && targetTray) {
        deductFilamentForTray(pid, state, targetTray, layerGrams, fIdx);
      }
    }
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

  if (printData.device?.extruder?.state !== undefined) {
    state.activeExtruder = (printData.device.extruder.state >> 8) & 1;
  }
  if (printData.device?.extruder?.info && Array.isArray(printData.device.extruder.info)) {
    state.extruderInfo = printData.device.extruder.info;
  }
  const activeExtruder = state.activeExtruder || 0;
  const extruderInfo = state.extruderInfo;

  if (printData.stg_cur === 6 || printData.stg_cur === "6") {
    state.sawRunoutStage = true;
  }

  const decodeTrayId = (m, activeExt = 0) => {
    if (m === 255 || m === 65535 || m === 65279 || (m & 0xFF) === 255) return null;
    
    if (m === 254 || m === -1) {
      // 254 (or -1 from slicer mapping) is generic external spool.
      if (activeExt === 0 && extruderInfo?.length > 1) {
        return '255-0';
      }
      return '254-0';
    }
    
    // AMS HT units use IDs 128 to 135 (single slot)
    if (m >= 128 && m <= 135) return `${m}-0`;
    
    // Snow encoded values (e.g. from ams_mapping)
    if (m >= 256) {
      const unit = m >> 8;
      const slot = m & 0xFF;
      if (slot === 255 || unit === 255) return null;
      return `${unit}-${slot}`;
    }
    
    // Regular AMS slots (0-15)
    return `${Math.floor(m / 4)}-${m % 4}`;
  };

  const mappingArray = printData.mapping || printData.ams_mapping;
  if (mappingArray && Array.isArray(mappingArray)) {
    const validTrays = mappingArray.map(m => decodeTrayId(m, activeExtruder)).filter(Boolean);
    if (validTrays.length > 0) {
      state.activeTrays = validTrays;
      if (!state.activeSlotTrays) state.activeSlotTrays = {};
      validTrays.forEach((tId, idx) => {
        if (!state.activeSlotTrays[idx]) {
          state.activeSlotTrays[idx] = tId;
        }
      });
    }
  } else if (printData.vt_tray && printData.vt_tray.id !== 255) {
    const vtId = `0-${printData.vt_tray.id}`;
    if (!state.activeTrays || state.activeTrays.length === 0) {
      state.activeTrays = [vtId];
    }
    if (!state.activeSlotTrays) state.activeSlotTrays = {};
    if (!state.activeSlotTrays[0]) state.activeSlotTrays[0] = vtId;
  }

  const previousTrayId = state.currentTrayId;

  // On dual-nozzle printers (X2D/H2D), extruderInfo[activeExtruder].snow is the authoritative global tray ID.
  // Do NOT allow delta packets with only printData.ams.tray_now (which only reports the 4-slot AMS selector)
  // to overwrite an active snow tray (such as 128-0 on the other nozzle).
  if (extruderInfo && extruderInfo.length > 1) {
    const snowTray = extruderInfo[activeExtruder]?.snow;
    if (snowTray !== undefined && snowTray !== null && snowTray !== 255 && snowTray !== 65535 && snowTray !== 65279 && (snowTray & 0xFF) !== 255) {
      state.currentTrayId = decodeTrayId(snowTray, activeExtruder);
    } else if (snowTray === 255 || snowTray === 65535 || snowTray === 65279 || (snowTray & 0xFF) === 255) {
      // Active extruder has no filament loaded
      state.currentTrayId = null;
    }
  } else if (printData.ams && printData.ams.tray_now !== undefined) {
    let m = parseInt(printData.ams.tray_now, 10);
    state.currentTrayId = !isNaN(m) ? decodeTrayId(m, activeExtruder) : null;
  }
  
  if (state.currentTrayId && state.activeTrays && !state.activeTrays.includes(state.currentTrayId)) {
    state.activeTrays.push(state.currentTrayId);
  }

  // --- Real-time Extrusion & Progress Tracking per Tray ---
  if (state.status === 'RUNNING' && state.currentTrayId) {
    const curProg = Math.max(0, Math.min(100, state.progress || 0));
    const prevProg = state.lastTrackedProgress !== undefined ? state.lastTrackedProgress : curProg;
    const delta = curProg - prevProg;
    if (delta > 0) {
      if (!state.trayProgress) state.trayProgress = {};
      state.trayProgress[state.currentTrayId] = (state.trayProgress[state.currentTrayId] || 0) + delta;
      state.lastTrackedProgress = curProg;
    } else if (state.lastTrackedProgress === undefined) {
      state.lastTrackedProgress = curProg;
    }
  }

  // --- Spool Takeover & Switch Detection ---
  const isValidTray = (t) => t && typeof t === 'string' && !t.includes('255');

  if (state.status === 'RUNNING' && isValidTray(previousTrayId) && isValidTray(state.currentTrayId) && previousTrayId !== state.currentTrayId) {
    console.log(`[MQTT ${pid}] Spool Switch detected: from tray ${previousTrayId} to ${state.currentTrayId} at ${state.progress}%`);

    const isActivelyPrinting = (state.progress || 0) > 0 || (state.layerNum || 0) > 0;

    // If the new tray is already assigned to one of the print's slicer slots, this is a normal multi-colour/multi-tool swap
    const mappedSlotTrays = Object.values(state.activeSlotTrays || {});
    const isNormalSlotSwap = mappedSlotTrays.includes(state.currentTrayId) && mappedSlotTrays.includes(previousTrayId);

    // Check if the previous tray physically became empty in amsDataMap (do NOT check t.remain === 0 as non-RFID spools always report 0)
    const amsList = amsDataMap[pid] || [];
    let isPrevPhysicallyEmpty = false;
    for (const unit of amsList) {
      if (unit.tray) {
        for (const t of unit.tray) {
          if (`${unit.id}-${t.id}` === previousTrayId && (!t.tray_type || t.tray_type === '' || t.id === 255)) {
            isPrevPhysicallyEmpty = true;
            break;
          }
        }
      }
    }

    const hadRunoutPause = state.sawRunoutStage || printData.stg_cur === 6 || printData.stg_cur === "6";

    if (!isNormalSlotSwap && isActivelyPrinting) {
      db.get('SELECT aa.spool_id, s.total_weight, s.used_weight FROM ams_assignments aa LEFT JOIN spools s ON aa.spool_id = s.id WHERE aa.printer_id = ? AND aa.tray_id = ?', [pid, previousTrayId], (err, row) => {
        const spoolRemaining = (row && row.total_weight && row.used_weight !== undefined) ? Math.max(0, row.total_weight - row.used_weight) : null;
        // Confirm depletion only if Stage 6 runout occurred, or tray physically went empty while spool was low, or tracked weight reached 0g
        const spoolDepleted = hadRunoutPause || (isPrevPhysicallyEmpty && (spoolRemaining === null || spoolRemaining <= 100)) || (spoolRemaining !== null && spoolRemaining <= 0.5);

        if (spoolDepleted) {
          state.sawRunoutStage = false;
          if (!err && row && row.spool_id) {
            if (!state.runoutSpools) state.runoutSpools = {};
            state.runoutSpools[previousTrayId] = row.spool_id;
            console.log(`[MQTT ${pid}] Spool ${row.spool_id} in tray ${previousTrayId} ran out during print (remaining tracked: ${spoolRemaining !== null ? spoolRemaining.toFixed(1) + 'g' : 'unknown'}).`);
            if (ioInstance) {
              ioInstance.emit('spool_runout', {
                printer_id: pid,
                tray_id: previousTrayId,
                spool_id: row.spool_id,
                progress: state.progress
              });
            }
          }

          console.log(`[MQTT ${pid}] Auto-refill takeover confirmed: from tray ${previousTrayId} to ${state.currentTrayId} at ${state.progress}%`);
          if (!state.takeovers) state.takeovers = [];
          state.takeovers.push({
            fromTray: previousTrayId,
            toTray: state.currentTrayId,
            progress: state.progress || 0,
            timestamp: new Date().toISOString()
          });

          if (!state.takeoverMap) state.takeoverMap = {};
          state.takeoverMap[state.currentTrayId] = previousTrayId;

          // Update activeSlotTrays for any slot that was using the previous tray
          if (state.activeSlotTrays) {
            for (const [slot, tId] of Object.entries(state.activeSlotTrays)) {
              if (tId === previousTrayId) {
                state.activeSlotTrays[slot] = state.currentTrayId;
                console.log(`[MQTT ${pid}] Auto-refill takeover: slot ${slot} (${previousTrayId}) taken over by ${state.currentTrayId}`);
              }
            }
          }

          if (ioInstance) {
            ioInstance.emit('spool_takeover', {
              printer_id: pid,
              from_tray: previousTrayId,
              to_tray: state.currentTrayId,
              progress: state.progress
            });
          }
        }
      });
    }
  }

  // --- Stage 6: Filament Runout Pause Detection ---
  if (printData.stg_cur === 6 || printData.stg_cur === "6") {
    if (state.currentTrayId) {
      console.log(`[MQTT ${pid}] Stage 6: Filament Runout detected on tray ${state.currentTrayId} at ${state.progress}%`);
      db.get('SELECT aa.spool_id, s.total_weight, s.used_weight FROM ams_assignments aa LEFT JOIN spools s ON aa.spool_id = s.id WHERE aa.printer_id = ? AND aa.tray_id = ?', [pid, state.currentTrayId], (err, row) => {
        if (!err && row && row.spool_id) {
          if (!state.runoutSpools) state.runoutSpools = {};
          state.runoutSpools[state.currentTrayId] = row.spool_id;
          if (ioInstance) {
            ioInstance.emit('spool_runout', {
              printer_id: pid,
              tray_id: state.currentTrayId,
              spool_id: row.spool_id,
              progress: state.progress
            });
          }
        }
      });
    }
  }

  // --- Real-time Layer-by-Layer Filament Deduction ---
  if (state.status === 'RUNNING' && state.layerNum !== undefined && state.layerNum > 0) {
    if (state.lastDeductedLayer === undefined) {
      state.lastDeductedLayer = 0;
    }
    if (state.predictedWeights && state.predictedWeights.length > 0) {
      const targetCompletedLayer = state.layerNum - 1;
      if (targetCompletedLayer >= state.lastDeductedLayer) {
        processLayerDeductions(pid, state, state.lastDeductedLayer, targetCompletedLayer);
        state.lastDeductedLayer = targetCompletedLayer + 1;
      }
    }
  }

  if (newStatus && newStatus !== state.status) {
    console.log(`[MQTT ${pid}] Print status changed from ${state.status} to ${newStatus}`);
    
    if (newStatus === 'RUNNING' && state.status !== 'RUNNING' && state.status !== 'PAUSE') {
      state.status = 'RUNNING';
      state.name = subTaskName || 'Unknown Print';
      state.startTime = new Date();
      state.startEnergy = await getPrinterEnergyUsage();
      state.currentEnergy = 0;
      state.currentEnergyCost = 0;
      try {
        const { getEnergyRate } = require('./ha');
        state.energyRate = await getEnergyRate();
      } catch (e) {
        state.energyRate = 0;
      }
      state.predictedWeights = [];
      state.slicerFilaments = [];
      state.layerFilamentMap = null;
      state.layerCounts = null;
      state.activeSlotTrays = {};
      state.takeoverMap = {};
      state.runoutSpools = {};
      state.spoolDeductedGrams = {};
      state.slotDeductedGrams = {};
      state.totalGramsDeducted = 0;
      state.lastDeductedLayer = 0;
      state.activeTrays = [];
      state.trayProgress = {};
      state.lastTrackedProgress = 0;
      state.takeovers = [];
      state.sawRunoutStage = false;

      const runMapping = printData.mapping || printData.ams_mapping;
      if (runMapping && Array.isArray(runMapping)) {
        const validTrays = runMapping.map(m => decodeTrayId(m, activeExtruder)).filter(Boolean);
        if (validTrays.length > 0) {
          state.activeTrays = validTrays;
          validTrays.forEach((tId, idx) => {
            state.activeSlotTrays[idx] = tId;
          });
        }
      } else if (printData.vt_tray && printData.vt_tray.id !== 255) {
        state.activeTrays = [`0-${printData.vt_tray.id}`];
        state.activeSlotTrays[0] = state.activeTrays[0];
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
                state.slicerFilaments = res.filaments || [];
                state.layerFilamentMap = res.layerMap || null;
                state.layerCounts = res.layerCounts || null;
                if (res.path) state.activeGcodeFile = res.path;
                console.log(`[MQTT ${pid}] Successfully extracted predicted weights:`, res.weights);

                // If print has already progressed past layer 0, immediately deduct completed layers
                if (state.layerNum > 0 && state.lastDeductedLayer === 0) {
                  const targetCompleted = state.layerNum - 1;
                  if (targetCompleted >= 0) {
                    console.log(`[MQTT ${pid}] Catching up initial layer deductions 0 to ${targetCompleted}`);
                    processLayerDeductions(pid, state, 0, targetCompleted);
                    state.lastDeductedLayer = targetCompleted + 1;
                  }
                }
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
      state.status = newStatus;
      
      if (!state.name) state.name = subTaskName || 'Unknown Print';
      if (!state.startTime) state.startTime = new Date();
      if (state.startEnergy === undefined) state.startEnergy = await getPrinterEnergyUsage();
      
      if (!state.activeTrays || state.activeTrays.length === 0 || !state.activeSlotTrays || Object.keys(state.activeSlotTrays).length === 0) {
        const finishMapping = printData.mapping || printData.ams_mapping;
        if (finishMapping && Array.isArray(finishMapping)) {
          const validTrays = finishMapping.map(m => decodeTrayId(m, activeExtruder)).filter(Boolean);
          if (validTrays.length > 0) {
            state.activeTrays = validTrays;
            if (!state.activeSlotTrays) state.activeSlotTrays = {};
            validTrays.forEach((tId, idx) => {
              state.activeSlotTrays[idx] = tId;
            });
          }
        } else if (printData.vt_tray && printData.vt_tray.id !== 255) {
          state.activeTrays = [`0-${printData.vt_tray.id}`];
          if (!state.activeSlotTrays) state.activeSlotTrays = {};
          state.activeSlotTrays[0] = state.activeTrays[0];
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

      // If finished, complete any remaining layers up to totalLayerNum
      if (newStatus === 'FINISH' && state.totalLayerNum > 0 && state.lastDeductedLayer < state.totalLayerNum) {
        processLayerDeductions(pid, state, state.lastDeductedLayer, state.totalLayerNum - 1);
        state.lastDeductedLayer = state.totalLayerNum;
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

        // Include any spools that ran out during this print
        if (archivedState.runoutSpools) {
          for (const [tId, sId] of Object.entries(archivedState.runoutSpools)) {
            if (!assignMap[tId]) assignMap[tId] = sId;
          }
        }

        const totalPredictedWeight = (archivedState.predictedWeights.reduce((a, b) => a + b, 0) || 0) * percentCompleted;

        if (!archivedState.spoolDeductedGrams) archivedState.spoolDeductedGrams = {};
        if (!archivedState.slotDeductedGrams) archivedState.slotDeductedGrams = {};

        // If we have slicer predicted weights per slot, reconcile each slot against its assigned spool
        if (archivedState.predictedWeights && archivedState.predictedWeights.length > 0) {
          archivedState.predictedWeights.forEach((predWeight, slotIdx) => {
            const expectedWeight = (predWeight || 0) * percentCompleted;
            const alreadyDeducted = archivedState.slotDeductedGrams[slotIdx] || 0;
            const delta = expectedWeight - alreadyDeducted;
            const targetTray = archivedState.activeSlotTrays?.[slotIdx] || archivedState.activeTrays?.[slotIdx] || (slotIdx === 0 ? archivedState.currentTrayId : null);
            const spoolId = targetTray ? assignMap[targetTray] : null;

            if (spoolId) {
              if (delta > 0.001) {
                console.log(`[MQTT ${pid}] Reconciling slot ${slotIdx} (tray ${targetTray}, spool ${spoolId}): deducting remaining ${delta.toFixed(2)}g (expected ${expectedWeight.toFixed(2)}g, live was ${alreadyDeducted.toFixed(2)}g)`);
                archivedState.spoolDeductedGrams[spoolId] = (archivedState.spoolDeductedGrams[spoolId] || 0) + delta;
                archivedState.slotDeductedGrams[slotIdx] = alreadyDeducted + delta;
                db.run('UPDATE spools SET used_weight = MIN(total_weight, used_weight + ?), last_used_at = CURRENT_TIMESTAMP, last_print_name = ? WHERE id = ?',
                  [delta, archivedState.name, spoolId]);
              } else if (delta < -0.001 && newStatus === 'FINISH' && Math.abs(delta) < 2.0) {
                console.log(`[MQTT ${pid}] Adjusting slot ${slotIdx} rounding delta ${delta.toFixed(2)}g on spool ${spoolId}`);
                archivedState.spoolDeductedGrams[spoolId] = Math.max(0, (archivedState.spoolDeductedGrams[spoolId] || 0) + delta);
                db.run('UPDATE spools SET used_weight = MAX(0, used_weight + ?) WHERE id = ?', [delta, spoolId]);
              }
            } else if (expectedWeight > 0) {
              console.log(`[MQTT ${pid}] Warning: No spool assigned to tray ${targetTray} for slot ${slotIdx} (${expectedWeight.toFixed(2)}g expected)`);
            }
          });

          for (const [sIdStr, weight] of Object.entries(archivedState.spoolDeductedGrams)) {
            const spoolId = parseInt(sIdStr, 10);
            if (weight > 0) {
              filamentUsed += weight;
              filamentCost += weight * (costMap[spoolId] || 0);
              spoolDeductions.push({ spoolId, predicted: weight });
            }
          }
        } else {
          // Fallback if predictedWeights were never available (e.g. FTP failed)
          const trayProgress = archivedState.trayProgress || {};
          const totalTrackedProg = Object.values(trayProgress).reduce((a, b) => a + b, 0);
          const allTraysUsed = Array.from(new Set([...archivedState.activeTrays, ...Object.keys(trayProgress)]));
          const hasTakeover = (archivedState.takeovers && archivedState.takeovers.length > 0) || (allTraysUsed.length > 1 && totalTrackedProg > 0);

          if (hasTakeover && totalTrackedProg > 0 && totalPredictedWeight > 0) {
            console.log(`[MQTT ${pid}] Distributing ${totalPredictedWeight.toFixed(1)}g proportionately across takeover trays:`, trayProgress);
            allTraysUsed.forEach(trayId => {
              const prog = trayProgress[trayId] || 0;
              if (prog > 0) {
                const trayRatio = prog / totalTrackedProg;
                const weightUsed = totalPredictedWeight * trayRatio;
                filamentUsed += weightUsed;
                const spoolId = assignMap[trayId];
                if (spoolId) {
                  db.run('UPDATE spools SET used_weight = MIN(total_weight, used_weight + ?), last_used_at = CURRENT_TIMESTAMP, last_print_name = ? WHERE id = ?',
                    [weightUsed, archivedState.name, spoolId]);
                  spoolDeductions.push({ spoolId, predicted: weightUsed });
                  filamentCost += weightUsed * (costMap[spoolId] || 0);
                }
              }
            });
          } else {
            archivedState.activeTrays.forEach((trayId, idx) => {
              const predicted = (archivedState.predictedWeights[idx] || 0) * percentCompleted;
              if (predicted > 0) {
                filamentUsed += predicted;
                const spoolId = assignMap[trayId];
                if (spoolId) {
                  db.run('UPDATE spools SET used_weight = MIN(total_weight, used_weight + ?), last_used_at = CURRENT_TIMESTAMP, last_print_name = ? WHERE id = ?',
                    [predicted, archivedState.name, spoolId]);
                  spoolDeductions.push({ spoolId, predicted });
                  filamentCost += predicted * (costMap[spoolId] || 0);
                }
              }
            });
          }
        }

        if (filamentUsed === 0 && archivedState.predictedWeights.length > 0) {
          filamentUsed = totalPredictedWeight;
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
          // If state.archiveId is null, the container might have restarted mid-print. Look for an orphaned "In Progress" record.
          db.get('SELECT id FROM archives WHERE printer_id = ? AND status = "In Progress" ORDER BY id DESC LIMIT 1', [pid], (err, row) => {
            if (row && row.id) {
              db.run(`
                UPDATE archives SET status = ?, duration_seconds = ?, energy_kwh = ?, energy_cost = ?, filament_used_g = ?, filament_cost = ?, total_cost = ?, thumbnail_path = COALESCE(?, thumbnail_path)
                WHERE id = ?
              `, [newStatus, durationSeconds, energyUsed, energyCost, filamentUsed, filamentCost, totalCost, archivedState.thumbnailPath || null, row.id], function(err) {
                handleArchiveSave(err, row.id);
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
        }
      });
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

  // Force progress to 0% if the print has finished or failed
  if (state.status === 'FINISH' || state.status === 'FAILED') {
    state.progress = 0;
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
        // 1. Look up if this RFID is known (in spools.rfid or spool_rfids table)
        let spool = await getQuery(`
          SELECT s.id, s.brand_id, s.material_id, s.color, s.subtype, s.rfid
          FROM spools s
          LEFT JOIN spool_rfids sr ON sr.spool_id = s.id
          WHERE s.rfid = ? OR sr.rfid = ?
          LIMIT 1
        `, [tagUid, tagUid]);
        let spoolId;
        
        // Hoist the existing assignment check
        const existingAssign = await getQuery('SELECT spool_id FROM ams_assignments WHERE printer_id = ? AND tray_id = ?', [pid, trayId]);
        
        // --- RFID Adoption / Dual-Tag Linking Logic ---
        if (!spool && existingAssign) {
          let assignedSpool = await getQuery('SELECT id, rfid FROM spools WHERE id = ?', [existingAssign.spool_id]);
          if (assignedSpool) {
            if (!assignedSpool.rfid) {
              await runQuery('UPDATE spools SET rfid = ? WHERE id = ?', [tagUid, assignedSpool.id]);
            }
            await runQuery('INSERT OR IGNORE INTO spool_rfids (spool_id, rfid) VALUES (?, ?)', [assignedSpool.id, tagUid]);
            spool = assignedSpool;
            console.log(`[MQTT] Linked tag ${tagUid} to existing assigned spool ${assignedSpool.id}`);
            
            // Notify frontend that this spool got updated
            if (ioInstance) ioInstance.emit('spool_updated', { id: spool.id, rfid: tagUid });
          }
        }

        // --- Match single active unassigned Bambu spool of exact material & color (handles 2nd RFID tag on unassigned spool) ---
        if (!spool && tray.tray_type) {
          const hexColor = tray.tray_color ? `#${tray.tray_color.substring(0, 6)}` : '#FFFFFF';
          const candidates = await allQuery(`
            SELECT s.id, s.rfid
            FROM spools s
            JOIN brands b ON s.brand_id = b.id
            JOIN materials m ON s.material_id = m.id
            WHERE (b.name = 'Bambu' OR b.name = 'Bambu Lab')
              AND m.name = ?
              AND UPPER(s.color) = UPPER(?)
              AND s.archived = 0
              AND s.id NOT IN (SELECT spool_id FROM ams_assignments WHERE spool_id IS NOT NULL)
          `, [tray.tray_type, hexColor]);

          if (candidates && candidates.length === 1) {
            const matched = candidates[0];
            console.log(`[MQTT] Auto-linking secondary RFID ${tagUid} to single matching active Bambu spool ${matched.id}`);
            await runQuery('INSERT OR IGNORE INTO spool_rfids (spool_id, rfid) VALUES (?, ?)', [matched.id, tagUid]);
            if (!matched.rfid) {
              await runQuery('UPDATE spools SET rfid = ? WHERE id = ?', [tagUid, matched.id]);
            }
            spool = matched;
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
          await runQuery('INSERT OR IGNORE INTO spool_rfids (spool_id, rfid) VALUES (?, ?)', [spoolId, tagUid]);
          
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

// Poll energy usage and cost for running prints every 30 seconds
setInterval(async () => {
  for (const pid of Object.keys(printStates)) {
    const state = printStates[pid];
    if (state.status === 'RUNNING' && state.startEnergy !== undefined) {
      try {
        const { getPrinterEnergyUsage, getEnergyRate } = require('./ha');
        const currentTotal = await getPrinterEnergyUsage();
        if (currentTotal !== undefined && currentTotal !== null) {
          state.currentEnergy = Math.max(0, currentTotal - state.startEnergy);
          const rate = await getEnergyRate();
          state.energyRate = rate;
          state.currentEnergyCost = state.currentEnergy * rate;
          if (ioInstance) {
            ioInstance.emit('print_state_update', { printer_id: pid, state });
          }
        }
      } catch (e) {
        console.error('[MQTT] Live energy polling error:', e.message);
      }
    }
  }
}, 30000);

module.exports = {
  connectMqtt,
  connectPrinter,
  reconnectPrinter,
  disconnectPrinter,
  getAmsStatus,
  getPrintState,
  setIo
};
