#!/usr/bin/env node
/**
 * 15 прогонов session prep на каждый биом — DM 5.5 проверка правдоподобности.
 * npm run smoke:session-biomes
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { runSessionPrepMarkdown } = await import(
  new URL("../electron/loot-core.mjs", import.meta.url).href
);

const BIOMES = [
  "any",
  "coastal",
  "cave",
  "forest",
  "mountain",
  "dungeon",
  "urban",
  "arctic",
  "swamp",
];
const RUNS = 15;

/** Городская стража / двор — не должны доминировать в диких биомах. */
/** Городская стража — не «ветеран» в отряде бандитов и не стража в лесу. */
const URBAN_GARRISON_RE =
  /(капитан страж|captain of the guard|(?:^|\s)guard(?:\s|$)|(?:^|\s)страж(?:\s|$)|(?:^|\s)knight(?:\s|$)|(?:^|\s)рыцар(?:\s|$)|дворянин|noble|шпион|spy|гладиатор|gladiator)/i;

const WILD_BIOMES = new Set(["forest", "swamp", "mountain", "arctic", "coastal"]);

/** Ожидаемая «правдоподобность» для отчёта мастера (не RNG-порог, а DM-ориентир). */
const DM_EXPECT = {
  forest: "звери, fey, растения, монстры; не городская стража",
  swamp: "слизи, болотные твари, культисты/контрабанда; не стража",
  mountain: "великаны, драконы, элементали; не стража",
  arctic: "звери, элементали, нежить севера; не стража",
  coastal: "морские твари, пираты, контрабанда; не капитан стражи",
  urban: "humanoid, стража, бандиты, интриги",
  dungeon: "нежить, аберрации, конструкты",
  cave: "слизи, нежить, аберрации",
  any: "смешанный пул без доминирования одного типа",
};

function mainThreat(enemies) {
  const line = Array.isArray(enemies) ? enemies.join(" | ") : String(enemies ?? "");
  const m = /Главная угроза:\s*([^|]+)/i.exec(line);
  return (m?.[1] ?? line).trim();
}

function isUrbanGarrison(threatLine) {
  return URBAN_GARRISON_RE.test(threatLine);
}

function stats(lines) {
  const freq = new Map();
  for (const x of lines) freq.set(x, (freq.get(x) ?? 0) + 1);
  let max = 0;
  let top = "";
  for (const [k, v] of freq) {
    if (v > max) {
      max = v;
      top = k;
    }
  }
  return { max, top, unique: freq.size, freq };
}

/** @type {Record<string, { lines: string[], garrison: number, stats: ReturnType<typeof stats> }>} */
const report = {};

console.log(`DM smoke: ${RUNS}×${BIOMES.length} биомов\n`);

for (const biome of BIOMES) {
  const lines = [];
  let garrison = 0;
  for (let i = 0; i < RUNS; i += 1) {
    const level = 3 + (i % 12);
    const res = await runSessionPrepMarkdown({
      partyLevel: level,
      playerCount: 4,
      difficulty: "moderate",
      packCount: 2,
      chestCount: 1,
      environmentKey: biome,
      environmentText: `Патруль у ${biome}, уровень ${level}.`,
      onlyMagic: false,
    });
    const threat = mainThreat(res?.sessionBrief?.enemies);
    lines.push(threat);
    if (isUrbanGarrison(threat)) garrison += 1;
  }
  const st = stats(lines);
  report[biome] = { lines, garrison, stats: st };
  const gFlag = WILD_BIOMES.has(biome) && garrison > 1 ? " ⚠️ стража" : "";
  console.log(
    `${biome.padEnd(10)} uniq=${String(st.unique).padStart(2)}/${RUNS} max=${st.max} garrison=${garrison}${gFlag}`,
  );
  console.log(`           top: ${st.top}`);
}

const outDir = path.join(root, "tmp");
fs.mkdirSync(outDir, { recursive: true });

const md = [
  "# Session prep — DM 5.5 smoke по биомам",
  "",
  `Дата: ${new Date().toISOString()}`,
  "",
  "## Логика вероятности (ориентир мастера)",
  "",
  "Движок использует `biome-creature-weights.mjs`:",
  "",
  "| Тип существа | Лес | Болото | Город | Подземелье |",
  "|--------------|-----|--------|-------|------------|",
  "| beast/plant/fey | ++ | + | −− | − |",
  "| ooze/monstrosity | + | ++ | −− | + |",
  "| humanoid (стража) | −− | −− | ++ | + |",
  "| undead | − | −− | 0 | ++ |",
  "",
  "Городская стража (Guard, Knight, Captain of the Guard, Veteran) **жёстко отсеивается** в лес/болото/горы/север/побережье.",
  "",
  "## Результаты (15 прогонов / биом)",
  "",
  "| Биом | Уник. | Макс.повтор | Стража/двор | Ожидание DM |",
  "|------|-------|-------------|-------------|-------------|",
  ...BIOMES.map((b) => {
    const r = report[b];
    return `| ${b} | ${r.stats.unique}/${RUNS} | ${r.stats.max} | ${r.garrison} | ${DM_EXPECT[b] ?? "—"} |`;
  }),
  "",
  "## Лес (детали)",
  "",
  ...report.forest.lines.map((l, i) => `${i + 1}. ${l}`),
  "",
  "## Болото (детали)",
  "",
  ...report.swamp.lines.map((l, i) => `${i + 1}. ${l}`),
  "",
].join("\n");

const outPath = path.join(outDir, "session-biome-smoke.md");
fs.writeFileSync(outPath, md, "utf8");
console.log(`\nОтчёт: ${outPath}`);

const fails = [];
for (const b of WILD_BIOMES) {
  if (report[b].garrison > 1) fails.push(`${b}: стража ${report[b].garrison}/${RUNS}`);
}
for (const b of BIOMES) {
  if (report[b].stats.max >= 8) fails.push(`${b}: maxRepeat ${report[b].stats.max}`);
}

if (fails.length) {
  console.error(`\nFAIL:\n- ${fails.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("\nOK: дикие биомы — не более 1 стражи на 15 прогонов; нет 8+ повторов");
}
