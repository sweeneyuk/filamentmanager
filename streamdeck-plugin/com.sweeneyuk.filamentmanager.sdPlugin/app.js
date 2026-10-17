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

// Stream Deck connection parameters for reconnects
let sdPort = null;
let sdRegisterEvent = null;
let sdInfo = null;
let sdActionInfo = null;

let hasReceivedGlobalSettings = false;
let loginAbortController = null;

function connectElgatoStreamDeckSocket(port, uuid, registerEvent, info, actionInfo) {
  sdPort = port;
  pluginUUID = uuid;
  sdRegisterEvent = registerEvent;
  sdInfo = info;
  sdActionInfo = actionInfo;

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

  websocket.onclose = function(e) {
    console.log("[StreamDeck WS] Closed:", e);
    setTimeout(() => {
      if (sdPort && (!websocket || websocket.readyState === WebSocket.CLOSED)) {
        connectElgatoStreamDeckSocket(sdPort, pluginUUID, sdRegisterEvent, sdInfo, sdActionInfo);
      }
    }, 3000);
  };

  websocket.onerror = function(e) {
    console.error("[StreamDeck WS] Error:", e);
  };

  websocket.onmessage = function(evt) {
    try {
      const jsonObj = JSON.parse(evt.data);
      const event = jsonObj.event;
      const action = jsonObj.action;
      const context = jsonObj.context;

      if (event === "systemDidWakeUp") {
        console.log("[Lifecycle] systemDidWakeUp received from Stream Deck");
        handleWakeUp("systemDidWakeUp");
      } else if (event === "didReceiveGlobalSettings") {
        const payload = jsonObj.payload.settings;
        if (payload) {
          if (payload.serverUrl) serverUrl = payload.serverUrl;
          if (payload.username) apiUsername = payload.username;
          if (payload.password) apiPassword = payload.password;
        }
        hasReceivedGlobalSettings = true;
        connectSocketIO("didReceiveGlobalSettings");
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
    } catch (err) {
      console.error("[StreamDeck WS] onmessage error:", err);
    }
  };
}

async function connectSocketIO(reason = "manual") {
  if (!hasReceivedGlobalSettings && reason !== "didReceiveGlobalSettings") {
    console.log(`[Socket.IO] Skipping connect (${reason}): waiting for global settings`);
    return;
  }

  console.log(`[Socket.IO] Connecting to ${serverUrl} (trigger: ${reason})...`);

  // Cancel any in-flight login request
  if (loginAbortController) {
    try { loginAbortController.abort(); } catch (e) {}
    loginAbortController = null;
  }

  try {
    if (ioClient) {
      try {
        ioClient.removeAllListeners();
        ioClient.disconnect();
      } catch (e) {}
      ioClient = null;
    }
    
    if (!serverUrl.startsWith("http://") && !serverUrl.startsWith("https://")) {
      serverUrl = "http://" + serverUrl;
    }
    
    let token = null;

    // Try to login if username and password are provided
    if (apiUsername && apiPassword) {
      try {
        loginAbortController = new AbortController();
        const response = await fetch(serverUrl + '/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: apiUsername, password: apiPassword }),
          signal: loginAbortController.signal
        });
        const data = await response.json();
        if (data.success && data.token) {
          token = data.token;
        } else {
          console.error("[Socket.IO] Login failed:", data.error);
        }
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error("[Socket.IO] Login fetch error:", e.message || e);
        }
      } finally {
        loginAbortController = null;
      }
    }

    const ioOptions = {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000
    };
    if (token) {
      ioOptions.auth = { token: token };
    }

    ioClient = io(serverUrl, ioOptions);

    ioClient.on("connect", () => {
      console.log("[Socket.IO] Connected to Filament Manager backend");
      disconnectedSince = 0;
      updateAllKeys();
    });

    ioClient.on("connect_error", (err) => {
      console.error("[Socket.IO] Connection error:", err.message);
    });

    ioClient.on("disconnect", (reason) => {
      console.log("[Socket.IO] Disconnected:", reason);
      if (disconnectedSince === 0) disconnectedSince = Date.now();
    });

    ioClient.on("print_state_update", (data) => {
      printStates[data.printer_id] = data.state;
      updateAllKeys();
    });

    ioClient.on("ams_update", (data) => {
      amsData[data.printer_id] = data.ams;
      updateAllKeys();
    });
  } catch (err) {
    console.error("[Socket.IO] Error during connect:", err);
  }
}

function handleWakeUp(trigger) {
  console.log(`[Lifecycle] Wake detected via: ${trigger}`);
  disconnectedSince = 0;

  // Request fresh global settings from Stream Deck if websocket is open
  if (websocket && websocket.readyState === WebSocket.OPEN && pluginUUID) {
    try {
      websocket.send(JSON.stringify({
        event: "getGlobalSettings",
        context: pluginUUID
      }));
    } catch (e) {}
  }

  connectSocketIO(`wake-${trigger}`);
}

// Watchdog: detect system sleep via heartbeat gap & monitor connection health
let lastHeartbeat = Date.now();
let disconnectedSince = 0;

setInterval(() => {
  const now = Date.now();
  const diff = now - lastHeartbeat;
  lastHeartbeat = now;

  // If >6 seconds elapsed during a 2-second interval, computer was sleeping/suspended
  if (diff > 6000) {
    console.log(`[Watchdog] Time gap of ${diff}ms detected, PC woke from sleep`);
    handleWakeUp("sleep-timer-gap");
  } else if (hasReceivedGlobalSettings && (!ioClient || !ioClient.connected)) {
    if (disconnectedSince === 0) {
      disconnectedSince = now;
    } else if (now - disconnectedSince > 10000) {
      console.log("[Watchdog] Connection down for >10s, triggering reconnect");
      disconnectedSince = now;
      connectSocketIO("watchdog-timeout");
    }
  } else {
    disconnectedSince = 0;
  }
}, 2000);

window.addEventListener("online", () => {
  console.log("[Network] Browser went online");
  handleWakeUp("network-online");
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    if (!ioClient || !ioClient.connected) {
      handleWakeUp("visibilitychange");
    }
  }
});

function getActivePrinterState() {
  const ids = Object.keys(printStates);
  if (ids.length > 0) {
    // Prefer RUNNING printer
    for (let id of ids) {
      if (printStates[id].status === "RUNNING") return printStates[id];
    }
    return printStates[ids[0]];
  }

  // Fallback initial state so buttons immediately draw their cards rather than staying blank
  return {
    status: (ioClient && ioClient.connected) ? "IDLE" : "CONNECTING...",
    name: "None",
    progress: 0,
    remainingTime: 0,
    layerNum: 0,
    totalLayerNum: 0,
    stage: (ioClient && ioClient.connected) ? "Idle" : "Connecting...",
    nozzleTemp: 0,
    nozzleTarget: 0,
    bedTemp: 0,
    bedTarget: 0,
    chamberTemp: 0,
    currentEnergy: 0,
    currentEnergyCost: 0,
    totalGramsDeducted: 0
  };
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
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    try {
      websocket.send(JSON.stringify({
        event: "setImage",
        context: context,
        payload: {
          image: dataUrl,
          target: 0
        }
      }));
    } catch (e) {
      console.error("[StreamDeck WS] sendImage error:", e);
    }
  }
}

function sendTitleToContext(context, title) {
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    try {
      websocket.send(JSON.stringify({
        event: "setTitle",
        context: context,
        payload: {
          title: title,
          target: 0
        }
      }));
    } catch (e) {
      console.error("[StreamDeck WS] sendTitle error:", e);
    }
  }
}

function drawScaledText(ctx, text, y, maxFontSize, color, maxWidth = 130, isBold = true) {
  let fontSize = maxFontSize;
  ctx.fillStyle = color;
  ctx.font = `${isBold ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
  while (ctx.measureText(text).width > maxWidth && fontSize > 14) {
    fontSize -= 2;
    ctx.font = `${isBold ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
  }
  ctx.fillText(text, 72, y);
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
    drawScaledText(ctx, "Nozzle", 30, 28, "#00c853");
    drawScaledText(ctx, `${state.nozzleTemp || 0}°C`, 75, 32, "#ececec");
    drawScaledText(ctx, `Tgt: ${state.nozzleTarget || 0}°C`, 115, 18, "#888888", 130, false);
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
