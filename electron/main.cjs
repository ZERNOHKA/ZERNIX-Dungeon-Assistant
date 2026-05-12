"use strict";

const fs = require("fs");
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");

const {
  loadNetworkSettings,
  saveNetworkSettings,
  getEffectiveRemoteUrl,
  getEffectiveApiKey,
} = require("./network-settings.cjs");

const CLIENT_REMOTE_REQUIRED_MSG = "Подключитесь к серверу хоста";

function localEnginesPresent() {
  const lootCorePath = path.join(__dirname, "loot-core.mjs");
  const npcPath = path.join(__dirname, "..", "npc-engine.mjs");
  try {
    return fs.existsSync(lootCorePath) && fs.existsSync(npcPath);
  } catch {
    return false;
  }
}

function clientRequiresRemoteOnly() {
  return !localEnginesPresent();
}

let mainWindow = null;
let lootCoreHref = null;
let npcEngineHref = null;
let apiServerHandle = null;
let networkSettings = {
  serveAsHost: false,
  serverPort: 3000,
  remoteServerUrl: "",
  apiKey: "",
};

async function loadLootCore() {
  if (!lootCoreHref) {
    const lootCorePath = path.join(__dirname, "loot-core.mjs");
    lootCoreHref = pathToFileURL(lootCorePath).href;
  }
  return import(lootCoreHref);
}

async function loadNpcEngine() {
  if (!npcEngineHref) {
    const npcPath = path.join(__dirname, "..", "npc-engine.mjs");
    npcEngineHref = pathToFileURL(npcPath).href;
  }
  return import(npcEngineHref);
}

async function invokeGenerateLoot(payload) {
  const mod = await loadLootCore();
  return mod.runGenerateLootMarkdown(
    typeof payload === "object" && payload !== null ? payload : {},
  );
}

async function invokeSessionPrep(payload) {
  const mod = await loadLootCore();
  return mod.runSessionPrepMarkdown(
    typeof payload === "object" && payload !== null ? payload : {},
  );
}

async function invokeSceneLoot(payload) {
  const mod = await loadLootCore();
  return mod.runSceneLootMarkdown(
    typeof payload === "object" && payload !== null ? payload : {},
  );
}

async function invokeGenerateNpc(payload) {
  const mod = await loadNpcEngine();
  const opts = typeof payload === "object" && payload !== null ? payload : {};
  const result = mod.generateNPC(opts);
  return {
    ok: true,
    data: result.data,
    markdown: result.markdown,
  };
}

async function ipcLootResult(payload) {
  try {
    const result = await invokeGenerateLoot(payload);
    if (result && typeof result === "object" && "markdown" in result) {
      return {
        ok: true,
        markdown: result.markdown,
        sqlLog: result.sqlLog,
        narrativeBlock: result.narrativeBlock,
        lootDigest: result.lootDigest,
        needsRepair: result.needsRepair,
      };
    }
    return { ok: true, markdown: String(result), sqlLog: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

async function ipcSessionPrepResult(payload) {
  try {
    const result = await invokeSessionPrep(payload);
    if (result && typeof result === "object" && "markdown" in result) {
      return {
        ok: true,
        markdown: result.markdown,
        meta: result.meta,
      };
    }
    return { ok: true, markdown: String(result), meta: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

async function ipcSceneLootResult(payload) {
  try {
    const markdown = await invokeSceneLoot(payload);
    return { ok: true, markdown };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

async function ipcNpcResult(payload) {
  try {
    return await invokeGenerateNpc(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

async function remoteFetch(pathSuffix, payload) {
  const base = getEffectiveRemoteUrl(networkSettings);
  const key = getEffectiveApiKey(networkSettings);
  if (!base) {
    return { ok: false, error: "Не задан адрес удалённого сервера (REMOTE_SERVER_URL или настройки)." };
  }
  const url = `${base}${pathSuffix}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "X-Zernix-Api-Key": key } : {}),
    },
    body: JSON.stringify(payload ?? {}),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: text.slice(0, 400) || `HTTP ${res.status}`,
    };
  }
  return json;
}

async function dispatchLoot(payload) {
  if (getEffectiveRemoteUrl(networkSettings)) {
    return remoteFetch("/api/v1/generate-loot", payload);
  }
  if (clientRequiresRemoteOnly()) {
    return { ok: false, error: CLIENT_REMOTE_REQUIRED_MSG };
  }
  return ipcLootResult(payload);
}

async function dispatchSessionPrep(payload) {
  if (getEffectiveRemoteUrl(networkSettings)) {
    return remoteFetch("/api/v1/session-prep-generate", payload);
  }
  if (clientRequiresRemoteOnly()) {
    return { ok: false, error: CLIENT_REMOTE_REQUIRED_MSG };
  }
  return ipcSessionPrepResult(payload);
}

async function dispatchSceneLoot(payload) {
  if (getEffectiveRemoteUrl(networkSettings)) {
    return remoteFetch("/api/v1/scene-loot-generate", payload);
  }
  if (clientRequiresRemoteOnly()) {
    return { ok: false, error: CLIENT_REMOTE_REQUIRED_MSG };
  }
  return ipcSceneLootResult(payload);
}

async function dispatchNpc(payload) {
  if (getEffectiveRemoteUrl(networkSettings)) {
    return remoteFetch("/api/v1/invoke-generate-npc", payload);
  }
  if (clientRequiresRemoteOnly()) {
    return { ok: false, error: CLIENT_REMOTE_REQUIRED_MSG };
  }
  return ipcNpcResult(payload);
}

async function stopApiServer() {
  if (apiServerHandle) {
    try {
      await apiServerHandle.close();
    } catch (e) {
      console.warn("[ZERNIX] API server stop:", e);
    }
    apiServerHandle = null;
  }
}

async function maybeStartApiServer() {
  await stopApiServer();
  if (!localEnginesPresent()) {
    console.warn("[ZERNIX] Локальные движки отсутствуют — встроенный HTTP API не запускается.");
    return;
  }
  networkSettings = loadNetworkSettings(app);
  const key = networkSettings.apiKey != null ? String(networkSettings.apiKey).trim() : "";
  if (!networkSettings.serveAsHost || !key) {
    if (networkSettings.serveAsHost && !key) {
      console.warn("[ZERNIX] Режим сервера включён, но API-ключ пуст — HTTP не запущен.");
    }
    return;
  }
  const port = Number(networkSettings.serverPort) || 3000;
  try {
    const { startZernixApiServer } = require("./zernix-api-server.cjs");
    apiServerHandle = await startZernixApiServer({
      port,
      apiKey: key,
      handlers: {
        generateLoot: ipcLootResult,
        generateNpc: ipcNpcResult,
        sessionPrep: ipcSessionPrepResult,
        sceneLoot: ipcSceneLootResult,
      },
    });
  } catch (e) {
    console.error("[ZERNIX] Не удалось запустить HTTP API:", e);
    apiServerHandle = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: "#0c0d10",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const indexPath = path.join(__dirname, "..", "dist", "index.html");
  mainWindow.loadFile(indexPath).catch((err) => {
    console.error("Failed to load index.html:", err);
  });

  mainWindow.webContents.once("did-finish-load", () => {
    networkSettings = loadNetworkSettings(app);
    if (clientRequiresRemoteOnly() && !getEffectiveRemoteUrl(networkSettings)) {
      mainWindow?.webContents.send("zernix-require-remote-config", {
        message: CLIENT_REMOTE_REQUIRED_MSG,
      });
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpcHandlers() {
  ipcMain.handle("network-settings-get", () => {
    networkSettings = loadNetworkSettings(app);
    const engines = localEnginesPresent();
    const remoteOk = Boolean(getEffectiveRemoteUrl(networkSettings));
    return {
      ...networkSettings,
      effectiveRemoteUrl: getEffectiveRemoteUrl(networkSettings),
      envRemoteOverride: Boolean(process.env.REMOTE_SERVER_URL && String(process.env.REMOTE_SERVER_URL).trim()),
      serving: Boolean(apiServerHandle),
      localEnginesPresent: engines,
      needsHostConnection: !engines && !remoteOk,
      clientRemoteRequiredMessage: CLIENT_REMOTE_REQUIRED_MSG,
    };
  });

  ipcMain.handle("network-settings-set", async (_event, partial) => {
    networkSettings = { ...loadNetworkSettings(app), ...(typeof partial === "object" && partial ? partial : {}) };
    saveNetworkSettings(app, networkSettings);
    await maybeStartApiServer();
    const engines = localEnginesPresent();
    const remoteOk = Boolean(getEffectiveRemoteUrl(networkSettings));
    return {
      ok: true,
      settings: {
        ...networkSettings,
        effectiveRemoteUrl: getEffectiveRemoteUrl(networkSettings),
        serving: Boolean(apiServerHandle),
        localEnginesPresent: engines,
        needsHostConnection: !engines && !remoteOk,
        clientRemoteRequiredMessage: CLIENT_REMOTE_REQUIRED_MSG,
      },
    };
  });

  ipcMain.handle("generate-loot", async (_event, payload) => {
    return dispatchLoot(payload);
  });

  ipcMain.handle("session-prep-generate", async (_event, payload) => {
    return dispatchSessionPrep(payload);
  });

  ipcMain.handle("scene-loot-generate", async (_event, payload) => {
    return dispatchSceneLoot(payload);
  });

  ipcMain.handle("invoke-generate-npc", async (_event, payload) => {
    return dispatchNpc(payload);
  });
}

app.whenReady().then(async () => {
  networkSettings = loadNetworkSettings(app);
  registerIpcHandlers();
  await maybeStartApiServer();
  createWindow();
});

app.on("window-all-closed", async () => {
  await stopApiServer();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", async () => {
  await stopApiServer();
});
