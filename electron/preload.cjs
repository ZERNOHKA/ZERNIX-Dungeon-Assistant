"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getNetworkSettings: () => ipcRenderer.invoke("network-settings-get"),
  setNetworkSettings: (partial) => ipcRenderer.invoke("network-settings-set", partial),
  /** Клиент без локальных движков: main шлёт при отсутствии URL хоста */
  onRequireRemoteConfig: (callback) => {
    const channel = "zernix-require-remote-config";
    const listener = (_event, payload) => {
      callback(payload ?? {});
    };
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  /**
   * @param {{
   *   gold: number,
   *   categories?: string[],
   *   partyLevel: number,
   *   playerCount: number,
   *   difficulty: string,
   *   environment: string,
   *   onlyMagic?: boolean,
   *   chestCount?: number,
   * }} payload
   */
  generateLoot: (payload) => ipcRenderer.invoke("generate-loot", payload),
  /**
   * @param {{
   *   partyLevel: number,
   *   playerCount: number,
   *   difficulty: string,
   *   packCount: number,
   *   chestCount: number,
   *   environmentText: string,
   *   environmentKey?: string,
   *   onlyMagic?: boolean,
   * }} payload
   */
  generateSessionPrep: (payload) => ipcRenderer.invoke("session-prep-generate", payload),
  /**
   * @param {{
   *   environment?: string,
   *   environmentKey?: string,
   *   stashCount?: number,
   * }} payload
   */
  generateSceneLoot: (payload) => ipcRenderer.invoke("scene-loot-generate", payload),
  /**
   * Генерация NPC через npc-engine.mjs — можно передать partyRoleLabelRu с формы.
   * @param {Record<string, unknown>} payload
   */
  generateNpc: (payload) => ipcRenderer.invoke("invoke-generate-npc", payload),
});
