"use strict";

/**
 * Удаляет предыдущий win-unpacked перед electron-builder.
 * На Windows иначе часто: EBUSY / "used by another process" на app.asar.
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "dist_electron_client");
const winUnpacked = path.join(outDir, "win-unpacked");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function rmWithRetries(p, attempts = 5, delayMs = 600) {
  if (!fs.existsSync(p)) return;
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      fs.rmSync(p, { recursive: true, force: true });
      console.log("[clean-electron-client-out] removed:", p);
      return;
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        await sleep(delayMs);
      }
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  console.error("[clean-electron-client-out] failed:", msg);
  console.error(
    "Закройте запущенный ZERNIX из этой папки, проводник в dist_electron_client, Cursor если открыт app.asar — и повторите.",
  );
  process.exit(1);
}

rmWithRetries(winUnpacked).catch((e) => {
  console.error(e);
  process.exit(1);
});
