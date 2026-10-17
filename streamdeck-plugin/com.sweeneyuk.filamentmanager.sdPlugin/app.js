// Polyfill for roundRect on older CEF versions
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.moveTo(x+r, y);
    this.arcTo(x+w, y,   x+w, y+h, r);
    this.arcTo(x+w, y+h, x,   y+h, r);
    this.arcTo(x,   y+h, x,   y,   r);
    this.arcTo(x,   y,   x+w, y,   r);
    return this;
  }
}

let websocket = null;
let pluginUUID = null;
let ioClient = null;
let serverUrl = "http://localhost:3000";
let apiUsername = "";
let apiPassword = "";
let activeContexts = {}; // uuid -> { action, context, settings }
let printStates = {}; // printer_id -> state
let amsData = {}; // printer_id -> ams

// Canvas for drawing images
const canvas = document.createElement("canvas");
canvas.width = 144;
canvas.height = 144;
const ctx = canvas.getContext("2d");

function connectElgatoStreamDeckSocket(port, uuid, registerEvent, info, actionInfo) {
  pluginUUID = uuid;
  websocket = new WebSocket("ws://127.0.0.1:" + port);

  websocket.onopen = function() {
    websocket.send(JSON.stringify({
      event: registerEvent,
      uuid: pluginUUID
    }));
    // Request global settings
    websocket.send(JSON.stringify({
      event: "getGlobalSettings",
      context: pluginUUID
    }));
  };

  websocket.onmessage = function(evt) {
    const jsonObj = JSON.parse(evt.data);
    const event = jsonObj.event;
    const action = jsonObj.action;
    const context = jsonObj.context;

    if (event === "didReceiveGlobalSettings") {
      const payload = jsonObj.payload.settings;
      if (payload) {
        if (payload.serverUrl) serverUrl = payload.serverUrl;
        if (payload.username) apiUsername = payload.username;
        if (payload.password) apiPassword = payload.password;
      }
      connectSocketIO();
    } else if (event === "willAppear") {
      const settings = jsonObj.payload.settings;
      activeContexts[context] = { action, context, settings };
      updateAllKeys();
    } else if (event === "willDisappear") {
      delete activeContexts[context];
    } else if (event === "didReceiveSettings") {
      if (activeContexts[context]) {
        activeContexts[context].settings = jsonObj.payload.settings;
        updateAllKeys();
      }
    } else if (event === "keyUp") {
      // No interactive actions currently
    }
  };
}

async function connectSocketIO() {
  if (ioClient) {
    ioClient.disconnect();
  }
  
  if (!serverUrl.startsWith("http")) {
    serverUrl = "http://" + serverUrl;
  }
  
  let token = null;

  // Try to login if username and password are provided
  if (apiUsername && apiPassword) {
    try {
      const response = await fetch(serverUrl + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: apiUsername, password: apiPassword })
      });
      const data = await response.json();
      if (data.success && data.token) {
        token = data.token;
      } else {
        console.error("Login failed:", data.error);
      }
    } catch (e) {
      console.error("Login fetch error:", e);
    }
  }

  const ioOptions = {};
  if (token) {
    ioOptions.auth = { token: token };
  }

  ioClient = io(serverUrl, ioOptions);

  ioClient.on("connect", () => {
    console.log("Connected to Filament Manager Socket.IO");
  });

  ioClient.on("print_state_update", (data) => {
    printStates[data.printer_id] = data.state;
    updateAllKeys();
  });

  ioClient.on("ams_update", (data) => {
    amsData[data.printer_id] = data.ams;
    updateAllKeys();
  });
}

function getActivePrinterState() {
  const ids = Object.keys(printStates);
  if (ids.length === 0) return null;
  // Prefer RUNNING printer
  for (let id of ids) {
    if (printStates[id].status === "RUNNING") return printStates[id];
  }
  return printStates[ids[0]];
}

function getActiveAms() {
  const ids = Object.keys(amsData);
  if (ids.length === 0) return null;
  return amsData[ids[0]];
}

function updateAllKeys() {
  const state = getActivePrinterState();
  if (!state) return;

  for (let ctxId in activeContexts) {
    const act = activeContexts[ctxId];
    drawKey(act.context, act.action, act.settings, state);
  }
}

function sendImageToContext(context, dataUrl) {
  if (websocket) {
    websocket.send(JSON.stringify({
      event: "setImage",
      context: context,
      payload: {
        image: dataUrl,
        target: 0
      }
    }));
  }
}

function sendTitleToContext(context, title) {
  if (websocket) {
    websocket.send(JSON.stringify({
      event: "setTitle",
      context: context,
      payload: {
        title: title,
        target: 0
      }
    }));
  }
}

function drawScaledText(ctx, text, y, maxFontSize, color, maxWidth = 130, isBold = true, customX = 72) {
  let fontSize = maxFontSize;
  ctx.fillStyle = color;
  ctx.font = `${isBold ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
  while (ctx.measureText(text).width > maxWidth && fontSize > 10) {
    fontSize -= 2;
    ctx.font = `${isBold ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
  }
  ctx.fillText(text, customX, y);
}

function drawKey(context, action, settings, state) {
  ctx.clearRect(0, 0, 144, 144);
  ctx.fillStyle = "#222226"; // card-bg
  ctx.fillRect(0, 0, 144, 144);
  
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (action === "com.sweeneyuk.filamentmanager.state") {
    drawScaledText(ctx, "Status", 35, 32, "#00c853");
    let statusText = state.status || "UNKNOWN";
    if (statusText === "RUNNING" && state.stage) {
      statusText = state.stage;
    }
    drawScaledText(ctx, statusText, 95, 26, "#ececec");
  } 
  else if (action === "com.sweeneyuk.filamentmanager.name") {
    drawScaledText(ctx, "Print", 35, 32, "#00c853");
    let name = state.name || "None";
    drawScaledText(ctx, name, 95, 24, "#ececec", 130, false);
  }
  else if (action === "com.sweeneyuk.filamentmanager.layer") {
    drawScaledText(ctx, "Layer", 35, 32, "#00c853");
    drawScaledText(ctx, `${state.layerNum || 0} / ${state.totalLayerNum || 0}`, 95, 32, "#ececec");
  }
  else if (action === "com.sweeneyuk.filamentmanager.spool") {
    drawScaledText(ctx, "Spool", 30, 32, "#00c853");
    
    // Attempt to find the color and name
    let hexColor = "#ffffff";
    let spoolName = "Unknown";
    const ams = getActiveAms();
    if (ams && state.currentTrayId) {
      const [unitId, trayIdx] = state.currentTrayId.split('-');
      const unit = ams.find(a => a.id === unitId);
      if (unit && unit.tray) {
        const tray = unit.tray.find(t => t.id === trayIdx);
        if (tray && tray.tray_color) {
          hexColor = "#" + tray.tray_color.substring(0, 6);
        }
        if (tray && tray.tray_type) {
          spoolName = tray.tray_type;
        }
      }
    }
    
    ctx.fillStyle = hexColor;
    ctx.beginPath();
    ctx.arc(72, 75, 20, 0, 2 * Math.PI);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.stroke();

    drawScaledText(ctx, spoolName, 120, 16, "#ececec", 135, false);
  }
  else if (action === "com.sweeneyuk.filamentmanager.eta") {
    drawScaledText(ctx, "ETA", 30, 32, "#00c853");
    
    let minutesLeft = state.remainingTime || 0;
    if (state.status === "IDLE" || state.status === "FINISH" || state.status === "FAILED") {
      drawScaledText(ctx, "--", 75, 32, "#ececec");
    } else {
      let hours = Math.floor(minutesLeft / 60);
      let mins = minutesLeft % 60;
      let text = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      drawScaledText(ctx, text, 75, 32, "#ececec");
      
      let d = new Date();
      d.setMinutes(d.getMinutes() + minutesLeft);
      let timeStr = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      drawScaledText(ctx, timeStr, 115, 20, "#999999", 130, false);
    }
  }
  else if (action === "com.sweeneyuk.filamentmanager.progress") {
    let seg = parseInt(settings.segment || "1");
    // total bar is 5 segments wide (144 * 5 = 720px)
    let totalWidth = 144 * 5;
    let progress = Math.max(0, Math.min(100, state.progress || 0)) / 100;
    let filledWidth = totalWidth * progress;
    
    let xOffset = (seg - 1) * 144;
    
    ctx.fillStyle = "#1a1a1f";
    ctx.fillRect(0, 0, 144, 144);
    
    ctx.save();
    ctx.translate(-xOffset, 0);
    
    // Clip path for rounded corners
    ctx.beginPath();
    ctx.roundRect(10, 50, totalWidth - 20, 44, 22);
    ctx.save();
    ctx.clip();

    // Draw the active portion
    ctx.fillStyle = "#00c853";
    ctx.fillRect(10, 50, filledWidth, 44);
    
    ctx.restore(); // remove clip
    
    // Border
    ctx.strokeStyle = "#333338";
    ctx.lineWidth = 4;
    ctx.stroke();
    
    ctx.restore(); // remove translate

    // If segment 3, draw text (center)
    if (seg === 3) {
      drawScaledText(ctx, `${Math.round(state.progress || 0)}%`, 72, 32, "#ffffff", 130, true);
    }
  }
  else if (action === "com.sweeneyuk.filamentmanager.tempnozzle") {
    let isDual = false;
    let leftTemp = state.nozzleLeftTemp;
    let rightTemp = state.nozzleRightTemp;
    let leftTarget = state.nozzleLeftTarget;
    let rightTarget = state.nozzleRightTarget;

    if (state.extruderInfo && Array.isArray(state.extruderInfo) && state.extruderInfo.length > 1) {
      isDual = true;
      const left = state.extruderInfo.find(e => e.id === 0);
      const right = state.extruderInfo.find(e => e.id === 1);
      if (left && left.temp !== undefined) {
        leftTemp = left.temp > 1000 ? ((left.temp >> 16) & 0xFFFF) : left.temp;
        const tgt = left.temp & 0xFFFF;
        leftTarget = (tgt <= 350 && left.temp > 1000) ? tgt : (state.activeExtruder === 0 ? state.nozzleTarget : 0);
      }
      if (right && right.temp !== undefined) {
        rightTemp = right.temp > 1000 ? ((right.temp >> 16) & 0xFFFF) : right.temp;
        const tgt = right.temp & 0xFFFF;
        rightTarget = (tgt <= 350 && right.temp > 1000) ? tgt : (state.activeExtruder === 1 ? state.nozzleTarget : 0);
      }
    } else if (leftTemp !== undefined && rightTemp !== undefined) {
      isDual = true;
    }

    if (isDual) {
      drawScaledText(ctx, "Nozzles", 20, 20, "#00c853");

      // Divider line down the middle
      ctx.strokeStyle = "#38383f";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(72, 34);
      ctx.lineTo(72, 134);
      ctx.stroke();

      const activeExt = state.activeExtruder || 0;

      // Left nozzle column (center x=36)
      const leftCol = activeExt === 0 ? "#00c853" : "#888888";
      drawScaledText(ctx, "Left", 45, 15, leftCol, 60, true, 36);
      drawScaledText(ctx, `${leftTemp || 0}°C`, 78, 22, "#ececec", 60, true, 36);
      const leftTgtStr = (leftTarget !== undefined && leftTarget > 0) ? `Tgt: ${leftTarget}°` : "Off";
      drawScaledText(ctx, leftTgtStr, 114, 14, "#888888", 62, false, 36);

      // Right nozzle column (center x=108)
      const rightCol = activeExt === 1 ? "#00c853" : "#888888";
      drawScaledText(ctx, "Right", 45, 15, rightCol, 60, true, 108);
      drawScaledText(ctx, `${rightTemp || 0}°C`, 78, 22, "#ececec", 60, true, 108);
      const rightTgtStr = (rightTarget !== undefined && rightTarget > 0) ? `Tgt: ${rightTarget}°` : "Off";
      drawScaledText(ctx, rightTgtStr, 114, 14, "#888888", 62, false, 108);
    } else {
      drawScaledText(ctx, "Nozzle", 30, 28, "#00c853");
      drawScaledText(ctx, `${state.nozzleTemp || 0}°C`, 75, 32, "#ececec");
      drawScaledText(ctx, `Tgt: ${state.nozzleTarget || 0}°C`, 115, 18, "#888888", 130, false);
    }
  }
  else if (action === "com.sweeneyuk.filamentmanager.tempbed") {
    drawScaledText(ctx, "Bed", 30, 28, "#00c853");
    drawScaledText(ctx, `${state.bedTemp || 0}°C`, 75, 32, "#ececec");
    drawScaledText(ctx, `Tgt: ${state.bedTarget || 0}°C`, 115, 18, "#888888", 130, false);
  }
  else if (action === "com.sweeneyuk.filamentmanager.tempchamber") {
    drawScaledText(ctx, "Chamber", 35, 28, "#00c853");
    drawScaledText(ctx, `${state.chamberTemp || 0}°C`, 95, 32, "#ececec");
  }
  else if (action === "com.sweeneyuk.filamentmanager.energy") {
    drawScaledText(ctx, "Energy", 28, 24, "#00c853");
    
    let kwh = state.currentEnergy !== undefined ? state.currentEnergy : 0;
    let energyText = `${kwh.toFixed(2)}kWh`;
    drawScaledText(ctx, energyText, 68, 26, "#ececec", 130, true);

    let cost = 0;
    if (state.currentEnergyCost !== undefined && state.currentEnergyCost > 0) {
      cost = state.currentEnergyCost;
    } else if (kwh > 0 && state.energyRate > 0) {
      cost = kwh * state.energyRate;
    }
    drawScaledText(ctx, `£${cost.toFixed(2)}`, 112, 22, "#fbbf24", 130, true);
  }
  else if (action === "com.sweeneyuk.filamentmanager.cost" || action === "com.sweeneyuk.filamentmanager.filament") {
    drawScaledText(ctx, "Filament", 28, 24, "#00c853");
    
    let usedGrams = 0;
    if (state.totalGramsDeducted !== undefined && state.totalGramsDeducted > 0) {
      usedGrams = state.totalGramsDeducted;
    } else if (state.predictedWeights && state.predictedWeights.length > 0) {
      let progress = Math.max(0, Math.min(100, state.progress || 0)) / 100;
      let totalPred = state.predictedWeights.reduce((a, b) => a + b, 0);
      usedGrams = totalPred * progress;
    }
    
    drawScaledText(ctx, `${usedGrams.toFixed(1)}g`, 68, 28, "#ececec", 130, true);

    let totalTarget = (state.predictedWeights && state.predictedWeights.length > 0)
      ? state.predictedWeights.reduce((a, b) => a + b, 0)
      : 0;

    if (totalTarget > 0) {
      drawScaledText(ctx, `/ ${totalTarget.toFixed(0)}g`, 112, 18, "#888888", 130, false);
    }
  }

  sendImageToContext(context, canvas.toDataURL("image/png"));
}
