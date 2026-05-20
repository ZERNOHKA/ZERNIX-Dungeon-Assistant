/** Desktop shell (Electron preload exposes `window.electronAPI`). */
export function isElectron(): boolean {
  return typeof window !== "undefined" && Boolean(window.electronAPI);
}
