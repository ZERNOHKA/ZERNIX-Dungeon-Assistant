/**
 * После `vite build`: дополнительная обфускация JS в dist/ перед electron-builder.
 * Electron ≠ Python: это не машинный код (как Nuitka), а усложнение reverse engineering.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JavaScriptObfuscator from "javascript-obfuscator";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const assetsDir = path.join(root, "dist", "assets");

/** Настройки без controlFlow/selfDefending — меньше шанс сломать React/Vite-бандл. */
const obfuscatorOptions = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  debugProtectionInterval: 0,
  disableConsoleOutput: false,
  identifierNamesGenerator: "hexadecimal",
  log: false,
  numbersToExpressions: false,
  renameGlobals: false,
  selfDefending: false,
  simplify: true,
  splitStrings: false,
  stringArray: true,
  stringArrayCallsTransform: false,
  stringArrayEncoding: ["base64"],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 1,
  stringArrayWrappersChainedCalls: false,
  stringArrayWrappersParametersMaxCount: 2,
  stringArrayWrappersType: "variable",
  stringArrayThreshold: 0.65,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
};

function obfuscateFile(absPath) {
  const src = fs.readFileSync(absPath, "utf8");
  const out = JavaScriptObfuscator.obfuscate(src, obfuscatorOptions).getObfuscatedCode();
  fs.writeFileSync(absPath, out, "utf8");
}

function main() {
  if (!fs.existsSync(assetsDir)) {
    console.error("[obfuscate-for-pack] Нет папки dist/assets. Сначала: npm run build");
    process.exit(1);
  }
  const names = fs.readdirSync(assetsDir).filter((n) => n.endsWith(".js"));
  if (!names.length) {
    console.error("[obfuscate-for-pack] В dist/assets нет .js файлов.");
    process.exit(1);
  }
  for (const name of names) {
    const abs = path.join(assetsDir, name);
    const stat = fs.statSync(abs);
    if (!stat.isFile() || stat.size < 500) continue;
    process.stdout.write(`[obfuscate-for-pack] ${name} (${Math.round(stat.size / 1024)} KiB)… `);
    obfuscateFile(abs);
    console.log("ok");
  }
}

main();
