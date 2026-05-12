"use strict";

/**
 * Скачивает готовый better_sqlite3.node для той же версии Electron, что в package.json.
 * Не требует Visual Studio (в отличие от electron-rebuild / node-gyp).
 * Новые Electron (например 41) могут ещё не иметь prebuild — держим Electron на LTS-ветке с артефактами.
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const electronPkg = path.join(root, "node_modules", "electron", "package.json");
const betterDir = path.join(root, "node_modules", "better-sqlite3");

if (!fs.existsSync(electronPkg)) {
  console.warn("[prebuild] electron не установлен — пропуск.");
  process.exit(0);
}
if (!fs.existsSync(betterDir)) {
  console.warn("[prebuild] better-sqlite3 не установлен — пропуск.");
  process.exit(0);
}

const { version: electronVersion } = JSON.parse(fs.readFileSync(electronPkg, "utf8"));
const prebuildBin = path.join(root, "node_modules", "prebuild-install", "bin.js");
if (!fs.existsSync(prebuildBin)) {
  console.error("[prebuild] Не найден prebuild-install. Выполните npm install.");
  process.exit(1);
}

try {
  execFileSync(
    process.execPath,
    [prebuildBin, "--runtime", "electron", "--target", electronVersion, "--verbose"],
    { cwd: betterDir, stdio: "inherit" },
  );
} catch (err) {
  console.error(
    "\n[prebuild] Не удалось скачать бинарник better-sqlite3 для Electron",
    electronVersion + ".",
    "\nЧастые причины: слишком новая версия Electron (ещё нет артефакта на GitHub) или нет сети.",
    "\nРешения: понизить electron до ^36 в package.json, либо установить Visual Studio Build Tools и собрать модуль.",
  );
  process.exit(1);
}
