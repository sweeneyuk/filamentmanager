let websocket = null;
let pluginUUID = null;
let actionInfo = {};

function connectElgatoStreamDeckSocket(port, uuid, registerEvent, info, actionInfoStr) {
  pluginUUID = uuid;
  actionInfo = JSON.parse(actionInfoStr);
  const action = actionInfo.action;

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

    if (event === "didReceiveGlobalSettings") {
      const settings = jsonObj.payload.settings;
      if (settings.serverUrl) document.getElementById("serverUrl").value = settings.serverUrl;
      if (settings.username) document.getElementById("username").value = settings.username;
      if (settings.password) document.getElementById("password").value = settings.password;
    }
  };

  // Show segment dropdown only for progress action
  if (action === "com.sweeneyuk.filamentmanager.progress") {
    document.getElementById("segmentWrapper").style.display = "flex";
    const settings = actionInfo.payload.settings;
    if (settings && settings.segment) {
      document.getElementById("segment").value = settings.segment;
    }
  }

  document.getElementById("saveBtn").addEventListener("click", () => {
    const serverUrl = document.getElementById("serverUrl").value || "http://localhost:3000";
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    
    // Save Global Settings
    websocket.send(JSON.stringify({
      event: "setGlobalSettings",
      context: pluginUUID,
      payload: {
        serverUrl: serverUrl,
        username: username,
        password: password
      }
    }));

    // Save Action Settings (if applicable)
    let payload = {};
    if (action === "com.sweeneyuk.filamentmanager.progress") {
      payload.segment = document.getElementById("segment").value;
    }
    
    websocket.send(JSON.stringify({
      event: "setSettings",
      context: pluginUUID,
      payload: payload
    }));
  });
}
