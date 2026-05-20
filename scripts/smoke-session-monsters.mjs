/**
 * 20 прогонов session prep — ищем повтор «3× Druid».
 * npx electron scripts/smoke-session-monsters.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { runSessionPrepMarkdown } = await import(
  new URL("../electron/loot-core.mjs", import.meta.url).href
);

const envs = ["forest", "dungeon", "coastal", "urban", "swamp", "cave", "mountain"];
let druidTriples = 0;
const mains = [];

for (let i = 0; i < 20; i += 1) {
  const env = envs[i % envs.length];
  const level = 3 + (i % 10);
  const res = await runSessionPrepMarkdown({
    partyLevel: level,
    playerCount: 4,
    difficulty: "moderate",
    packCount: 2,
    chestCount: 1,
    environmentKey: env,
    environmentText: `Сгенерируй связную игровую сцену. Партия: уровень ${level}. Биом: ${env}. Опорный конфликт: патруль у старой дороги.`,
    onlyMagic: false,
  });
  const lines = res?.sessionBrief?.enemies ?? [];
  const line = Array.isArray(lines) ? lines.join(" | ") : String(lines);
  mains.push(line);
  if (/druid|друид/i.test(line) && /(?:×|x)\s*3|3\s+друид|3\s+druid/i.test(line)) {
    druidTriples += 1;
  }
  console.log(`${i + 1}. [${env} lv${level}] ${line.slice(0, 120)}`);
}

console.log(`\nТройных друидов: ${druidTriples}/20`);
console.log(`Уникальных строк: ${new Set(mains).size}/20`);
