/**
 * SHA-256 артефактов в dist_electron/ (после electron-builder).
 * Аналог идеи zernix.integrity.json из Python-сборки — проверка целостности у себя/у пользователя.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "dist_electron");
const manifestPath = path.join(outDir, "zernix-dungeon-assistant.integrity.json");

function sha256File(abs) {
  const h = crypto.createHash("sha256");
  h.update(fs.readFileSync(abs));
  return h.digest("hex");
}

function collectFiles(dir, acc, relBase = "") {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(relBase, ent.name);
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      collectFiles(abs, acc, rel);
    } else if (/\.(exe|dll|asar)$/i.test(ent.name)) {
      acc.push({ path: rel.replace(/\\/g, "/"), sha256: sha256File(abs), bytes: fs.statSync(abs).size });
    }
  }
}

function main() {
  if (!fs.existsSync(outDir)) {
    console.error("[integrity] Нет dist_electron/. Сначала: npm run dist или electron-builder.");
    process.exit(1);
  }
  const files = [];
  collectFiles(outDir, files);
  if (!files.length) {
    console.warn("[integrity] Не найдено .exe/.dll/.asar в dist_electron — манифест пустой.");
  }
  const manifest = {
    product: "ZERNIX Dungeon Assistant",
    generatedAt: new Date().toISOString(),
    note: "Проверка: sha256 файла должен совпадать. Это не шифрование и не защита от намеренной модификации.",
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`[integrity] Записано: ${path.relative(root, manifestPath)} (${manifest.files.length} файлов)`);
}

main();
