"use strict";

const fs = require("fs");
const path = require("path");

const SETTINGS_FILE = "zernix-network.json";

/** @param {import("electron").App} app */
function settingsPath(app) {
  return path.join(app.getPath("userData"), SETTINGS_FILE);
}

/** @param {import("electron").App} app */
function loadNetworkSettings(app) {
  const defaults = {
    serveAsHost: false,
    serverPort: 3000,
    remoteServerUrl: "",
    apiKey: "",
  };
  try {
    const p = settingsPath(app);
    if (fs.existsSync(p)) {
      const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
      return { ...defaults, ...parsed };
    }
  } catch (e) {
    console.error("[ZERNIX] network settings load:", e);
  }
  return { ...defaults };
}

/** @param {import("electron").App} app */
function saveNetworkSettings(app, data) {
  fs.writeFileSync(settingsPath(app), JSON.stringify(data, null, 2), "utf8");
}

/** Добавляет https:// если схемы нет (для туннелей loca.lt и т.п.). */
function normalizeBaseUrl(url) {
  let u = String(url).trim().replace(/\/$/, "");
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) {
    u = `https://${u}`;
  }
  return u;
}

/**
 * Приоритет: переменная окружения REMOTE_SERVER_URL, затем сохранённый адрес.
 * @param {{ remoteServerUrl?: string }} settings
 */
function getEffectiveRemoteUrl(settings) {
  const env = process.env.REMOTE_SERVER_URL;
  if (env != null && String(env).trim()) {
    return normalizeBaseUrl(String(env).trim());
  }
  const u = settings.remoteServerUrl;
  if (u != null && String(u).trim()) {
    return normalizeBaseUrl(String(u).trim());
  }
  return "";
}

/**
 * Ключ для клиента к удалённому серверу: ZERNIX_API_KEY или сохранённый apiKey.
 * @param {{ apiKey?: string }} settings
 */
function getEffectiveApiKey(settings) {
  const env = process.env.ZERNIX_API_KEY;
  if (env != null && String(env).length > 0) {
    return String(env);
  }
  return settings.apiKey != null ? String(settings.apiKey) : "";
}

module.exports = {
  loadNetworkSettings,
  saveNetworkSettings,
  getEffectiveRemoteUrl,
  getEffectiveApiKey,
  normalizeBaseUrl,
};
