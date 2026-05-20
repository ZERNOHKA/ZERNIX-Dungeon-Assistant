"use strict";

/**
 * Удаляет dist_electron/win-unpacked перед electron-builder.
 * Иначе на Windows: "cannot access dnd-loot.sqlite — used by another process"
 * (приложение из этой папки, Cursor с открытым .sqlite, DBCode и т.д.).
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "dist_electron");
const winUnpacked = path.join(outDir, "win-unpacked");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function rmWithRetries(p, attempts = 6, delayMs = 800) {
  if (!fs.existsSync(p)) return;
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      fs.rmSync(p, { recursive: true, force: true });
      console.log("[clean-electron-main-out] removed:", p);
      return;
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        await sleep(delayMs);
      }
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  console.error("[clean-electron-main-out] failed:", msg);
  console.error(
    "Закройте: запущенный ZERNIX из dist_electron\\win-unpacked, вкладки с dnd-loot.sqlite в редакторе, SQLite-браузер к этому файлу. Затем повторите сборку.",
  );
  process.exit(1);
}

rmWithRetries(winUnpacked).catch((e) => {
  console.error(e);
  process.exit(1);
});
