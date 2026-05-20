/**
 * ZERNIX — смоук-тест трёх генераторов (Loot / NPC / Session).
 * Цель: пройтись по матрице входов и собрать метрики качества
 * (дубли, пустые поля, диапазоны, NaN), сравнить BEFORE ↔ AFTER.
 *
 * Запуск:  node scripts/smoke-generators.mjs [report-path]
 *
 * - Loot: вызывает реальный `generateLootAsync` из src/services/mocks/database.mjs.
 * - NPC: повторяет в Node-окружении тот же путь, что и `resolveNpcCard` без IPC
 *        (выбор шаблона из app-content.json + сборка карточки), плюс
 *        вычисление narrative-полей через бандл npcNarrativeCompose.
 * - Session: вызывает в Node моки `runMockSessionGeneration` через бандл
 *        zernix/generators/sessionBridge.ts + composeSessionEnvironmentText.
 */

import { build as esbuild } from "esbuild";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const TMP = path.join(ROOT, "tmp");
const BUNDLES_DIR = path.join(TMP, "_smoke-bundles");

const REPORT_PATH = process.argv[2]
  ? path.resolve(ROOT, process.argv[2])
  : path.join(TMP, "generators-audit.md");

const LOOT_DB_URL = pathToFileURL(path.join(ROOT, "src/services/mocks/database.mjs")).href;
const APP_CONTENT_PATH = path.join(ROOT, "public/data/app-content.json");

// ─── Утилиты ──────────────────────────────────────────────────────────────

const CYRILLIC_RE = /[А-Яа-яЁё]/;
const LATIN_WORD_RE = /\b[a-zA-Z]{3,}\b/;

function isEmpty(v) {
  if (v == null) return true;
  if (typeof v === "string") return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function isBad(v) {
  if (v == null) return true;
  if (typeof v === "number") return !Number.isFinite(v);
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return true;
    if (/\bundefined\b|\bnull\b|^NaN$/i.test(t)) return true;
  }
  return false;
}

function mkBucket() {
  return {
    count: 0,
    empty: {},
    bad: {},
    duplicates: 0,
    cyrillicMismatch: 0,
    latinLeak: 0,
    lengths: {},
    issues: [],
  };
}

function trackField(bucket, field, value, opts = {}) {
  if (isEmpty(value)) {
    bucket.empty[field] = (bucket.empty[field] ?? 0) + 1;
  }
  if (isBad(value)) {
    bucket.bad[field] = (bucket.bad[field] ?? 0) + 1;
  }
  if (typeof value === "string" && value.trim()) {
    const len = value.trim().length;
    const stats = bucket.lengths[field] ?? { min: Infinity, max: 0, sum: 0, n: 0 };
    stats.min = Math.min(stats.min, len);
    stats.max = Math.max(stats.max, len);
    stats.sum += len;
    stats.n += 1;
    bucket.lengths[field] = stats;
    if (opts.expectCyrillic && !CYRILLIC_RE.test(value)) bucket.cyrillicMismatch += 1;
    if (opts.expectCyrillic && LATIN_WORD_RE.test(value) && !/D&D|XP|HP|CR|gp/i.test(value)) {
      const latinHits = value.match(/\b[a-zA-Z]{3,}\b/g) ?? [];
      const allowList = new Set([
        // D&D-сленг и валидные аббревиатуры в русских текстах
        "npc", "dnd", "dmg", "phb", "srd", "lvl", "ttrpg",
        // Ключи моделей сложности
        "low", "high", "medium", "moderate", "deadly", "any", "easy", "hard",
        // Биомы (легитимны как маркеры зон в технических подписях)
        "dungeon", "city", "wild", "urban", "forest", "cave", "ruins",
        "coastal", "mountain", "arctic", "swamp",
        // Технические маркеры в footer-сообщениях моков
        "mock", "json", "ipc",
      ]);
      const flagged = latinHits.filter((w) => !allowList.has(w.toLowerCase()));
      if (flagged.length > 0) bucket.latinLeak += 1;
    }
  }
}

function avgLen(stats) {
  if (!stats || !stats.n) return 0;
  return Math.round(stats.sum / stats.n);
}

// ─── Bundle a TS module via esbuild ───────────────────────────────────────

async function bundleTs(entry, outName) {
  await mkdir(BUNDLES_DIR, { recursive: true });
  const outFile = path.join(BUNDLES_DIR, outName);
  await esbuild({
    entryPoints: [entry],
    outfile: outFile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "es2022",
    logLevel: "silent",
    sourcemap: false,
    external: ["react", "react-dom", "lucide-react", "react-markdown", "rehype-raw", "remark-breaks"],
    define: {
      "import.meta.env.MODE": '"production"',
      "import.meta.env.DEV": "false",
      "import.meta.env.PROD": "true",
    },
  });
  return pathToFileURL(outFile).href;
}

// ─── Loot smoke ───────────────────────────────────────────────────────────

const LOOT_ENVS = ["dungeon", "ruins", "city", "wild"]; // values understood by mock
const LOOT_DIFFS = ["low", "moderate", "high"]; // mock recognises these
const LOOT_LEVELS = [1, 5, 10, 17];
const LOOT_TYPE_IDS = ["weapon", "armor", "potion", "scroll", "trinket", "misc"];

const RARITY_FOR_LEVEL = (lv) => {
  if (lv <= 4) return new Set(["common", "uncommon"]);
  if (lv <= 8) return new Set(["common", "uncommon", "rare"]);
  if (lv <= 12) return new Set(["uncommon", "rare", "very rare"]);
  if (lv <= 16) return new Set(["rare", "very rare", "legendary"]);
  return new Set(["very rare", "legendary"]);
};

async function runLootSmoke() {
  const lootMod = await import(LOOT_DB_URL);
  const generateLootAsync = lootMod.generateLootAsync;
  const dataset = lootMod.LOOT_DATASET;
  const datasetSize = Array.isArray(dataset) ? dataset.length : 0;

  const bucket = mkBucket();
  const seenSeq = []; // last 6 names — для проверки дедупа
  const goldLineSamples = [];

  let recentDupHits = 0;
  let rarityMismatch = 0;
  const kindCounts = {};

  // 20 итераций по матрице
  let idx = 0;
  for (const lv of LOOT_LEVELS) {
    for (const diff of LOOT_DIFFS) {
      for (const env of LOOT_ENVS) {
        if (bucket.count >= 24) break;
        const res = await generateLootAsync({
          partyLevel: lv,
          playerCount: 4,
          difficulty: diff,
          environment: env,
          onlyMagic: idx % 4 === 0,
          selectedTypeIds: idx % 3 === 0 ? [LOOT_TYPE_IDS[idx % LOOT_TYPE_IDS.length]] : [],
        });
        idx += 1;
        bucket.count += 1;
        trackField(bucket, "name", res.name, { expectCyrillic: true });
        trackField(bucket, "description", res.description, { expectCyrillic: true });
        trackField(bucket, "rarity", res.rarity);
        trackField(bucket, "kind", res.kind);
        trackField(bucket, "goldLine", res.goldLine);
        kindCounts[res.kind ?? "?"] = (kindCounts[res.kind ?? "?"] ?? 0) + 1;
        // Соответствие редкости уровню (с поправкой на high → шаг вверх и legendary lv17+)
        const allowed = RARITY_FOR_LEVEL(lv);
        // mock делает шаг вверх для high → допустим legendary с 13 и т.д. — расширяем мягко
        if (diff === "high") {
          if (lv >= 1) allowed.add("rare");
          if (lv >= 5) allowed.add("very rare");
          if (lv >= 9) allowed.add("legendary");
        }
        if (!allowed.has(res.rarity)) {
          rarityMismatch += 1;
          bucket.issues.push(
            `[loot] rarity=${res.rarity} не входит в допустимый набор для lv=${lv}, diff=${diff} (item="${res.name}")`,
          );
        }
        if (seenSeq.includes(res.name)) {
          recentDupHits += 1;
          bucket.duplicates += 1;
          bucket.issues.push(`[loot] dedup-окно нарушено (window=6): "${res.name}"`);
        }
        seenSeq.push(res.name);
        if (seenSeq.length > 6) seenSeq.shift();
        if (goldLineSamples.length < 6) goldLineSamples.push(`${lv}/${diff}: ${res.goldLine}`);
      }
    }
  }

  return {
    bucket,
    datasetSize,
    recentDupHits,
    rarityMismatch,
    kindCounts,
    goldLineSamples,
  };
}

// ─── NPC smoke ────────────────────────────────────────────────────────────

async function runNpcSmoke() {
  const npcModuleUrl = await bundleTs(
    path.join(ROOT, "src/lib/npcSummon.ts"),
    "npc-summon.mjs",
  );
  const narrativeUrl = await bundleTs(
    path.join(ROOT, "src/zernix/npcNarrativeCompose.ts"),
    "npc-narrative.mjs",
  );

  const { resolveNpcCard } = await import(npcModuleUrl);
  const { narrativeFieldsFromResolvedNpc } = await import(narrativeUrl);

  const appContent = JSON.parse(await readFile(APP_CONTENT_PATH, "utf8"));
  const npc = appContent.npc;

  const races = npc.races.map((r) => r.value);
  const occupations = npc.occupations.map((o) => o.value);
  const roles = npc.roles.map((r) => r.value);
  const genders = ["male", "female", "random"];

  const bucket = mkBucket();
  const raceMismatches = []; // имя из шаблона ≠ запрошенной расе (legacy-метрика)
  const raceLabelMismatches = []; // более строгая: card.raceRu ≠ ожидаемому labelRu
  const motivationSecretConflicts = [];
  const previewCards = [];

  // Сопоставление: имена-якоря в шаблонах → раса (для проверки «гном Аэлин» и т. п.)
  const templateRaceByName = new Map();
  for (const tmpl of npc.templates) {
    templateRaceByName.set(tmpl.name.trim(), tmpl.raceKey);
  }
  const raceLabelByValue = new Map();
  for (const r of npc.races) {
    raceLabelByValue.set(r.value, r.labelRu);
  }

  let idx = 0;
  const iterations = 30;
  for (let i = 0; i < iterations; i += 1) {
    const race = races[idx % races.length];
    const occupation = occupations[(idx * 3) % occupations.length];
    const role = roles[(idx * 5) % roles.length];
    const gender = genders[idx % genders.length];
    idx += 1;
    const { card, error } = await resolveNpcCard(npc, {
      race,
      occupationValue: occupation,
      role,
      genderId: gender,
    });
    if (!card) {
      bucket.issues.push(`[npc] iteration ${i}: card=null, error="${error ?? "—"}"`);
      bucket.count += 1;
      bucket.bad["card"] = (bucket.bad["card"] ?? 0) + 1;
      continue;
    }
    bucket.count += 1;

    trackField(bucket, "name", card.name, { expectCyrillic: true });
    trackField(bucket, "raceRu", card.raceRu, { expectCyrillic: true });
    trackField(bucket, "occupationRu", card.occupationRu, { expectCyrillic: true });
    trackField(bucket, "appearance", card.appearance, { expectCyrillic: true });
    trackField(bucket, "motivation", card.motivation, { expectCyrillic: true });
    trackField(bucket, "secret", card.secret, { expectCyrillic: true });
    trackField(bucket, "manner", card.manner, { expectCyrillic: true });
    trackField(bucket, "catchphrase", card.catchphrase, { expectCyrillic: true });
    trackField(bucket, "inventory", card.inventory, { expectCyrillic: true });

    // Соответствие расы шаблону (старая метрика — имя ↔ raceKey шаблона)
    const trueRace = templateRaceByName.get(card.name?.trim());
    if (trueRace && trueRace !== race) {
      raceMismatches.push(`requested=${race}, template=${trueRace}, name="${card.name}"`);
    }
    // Строгая проверка: card.raceRu должна совпадать с labelRu выбранной расы
    const expectedRaceLabel = raceLabelByValue.get(race);
    if (expectedRaceLabel && card.raceRu?.trim() !== expectedRaceLabel) {
      raceLabelMismatches.push(`requested=${race} (${expectedRaceLabel}), got="${card.raceRu}", name="${card.name}"`);
    }

    // motivation/secret не должны совпадать друг с другом
    if (card.motivation && card.secret && card.motivation.trim() === card.secret.trim()) {
      motivationSecretConflicts.push(`iter=${i}: motivation==secret для "${card.name}"`);
    }

    // narrative compose
    const narr = narrativeFieldsFromResolvedNpc(card, { entropyMs: i * 137 });
    trackField(bucket, "visualTrait", narr.visualTrait, { expectCyrillic: true });
    trackField(bucket, "wantLine", narr.wantLine, { expectCyrillic: true });
    trackField(bucket, "avoidLine", narr.avoidLine, { expectCyrillic: true });
    trackField(bucket, "secretLine", narr.secretLine, { expectCyrillic: true });

    if (i < 4) {
      previewCards.push({
        name: card.name,
        race: card.raceRu,
        occupation: card.occupationRu,
        motivation: card.motivation.slice(0, 80),
        secret: card.secret.slice(0, 80),
        narr,
      });
    }
  }

  return {
    bucket,
    raceMismatches,
    raceLabelMismatches,
    motivationSecretConflicts,
    previewCards,
  };
}

// ─── Session smoke ────────────────────────────────────────────────────────

async function runSessionSmoke() {
  const sessionBridgeUrl = await bundleTs(
    path.join(ROOT, "src/zernix/generators/sessionBridge.ts"),
    "session-bridge.mjs",
  );
  const sessionEnvUrl = await bundleTs(
    path.join(ROOT, "src/zernix/sessionAutoEnvironmentText.ts"),
    "session-env.mjs",
  );
  const sessionHooksUrl = await bundleTs(
    path.join(ROOT, "src/zernix/sessionHookLines.ts"),
    "session-hooks.mjs",
  );

  const { runSessionGeneration } = await import(sessionBridgeUrl);
  const { composeSessionEnvironmentText } = await import(sessionEnvUrl);
  const { pickRandomSessionHook, SESSION_HOOK_LINES } = await import(sessionHooksUrl);

  const bucket = mkBucket();

  const scenarios = [
    { partyLevel: 1, playerCount: 3, difficulty: "low",      environmentKey: "dungeon", environmentText: "" },
    { partyLevel: 1, playerCount: 4, difficulty: "moderate", environmentKey: "forest",  environmentText: "Старый храм у реки." },
    { partyLevel: 3, playerCount: 4, difficulty: "high",     environmentKey: "cave",    environmentText: "" },
    { partyLevel: 5, playerCount: 4, difficulty: "moderate", environmentKey: "urban",   environmentText: "Тёмный квартал, ночь, дождь." },
    { partyLevel: 8, playerCount: 5, difficulty: "high",     environmentKey: "dungeon", environmentText: "" },
    { partyLevel: 10, playerCount: 4, difficulty: "moderate", environmentKey: "any",    environmentText: "Развалины бывшей библиотеки." },
    { partyLevel: 12, playerCount: 4, difficulty: "high",    environmentKey: "coastal", environmentText: "" },
    { partyLevel: 15, playerCount: 5, difficulty: "high",    environmentKey: "mountain", environmentText: "Перевал, метель, заброшенный форт." },
    { partyLevel: 17, playerCount: 4, difficulty: "deadly",  environmentKey: "arctic",   environmentText: "" },
    { partyLevel: 20, playerCount: 6, difficulty: "deadly",  environmentKey: "swamp",    environmentText: "" },
  ];

  const worldHints = {
    currentLocation: "Старая крепость на холме",
    activeFaction: "Орден Серого Рассвета",
    currentThreat: "Эхо разлома между планами",
    lastNpcName: "Аэлин Сребролист",
    lastHookLine: "На пороге лежит чужая перчатка с песком и солью.",
  };

  const sampleScenes = [];
  const hooksSeen = new Set();
  const hookDupes = [];

  for (let i = 0; i < scenarios.length; i += 1) {
    const sc = scenarios[i];
    const sessionForm = {
      partyLevel: sc.partyLevel,
      playerCount: sc.playerCount,
      difficulty: sc.difficulty,
      packCount: 2 + (i % 3),
      chestCount: 1 + (i % 4),
      environmentText: sc.environmentText,
      environmentKey: sc.environmentKey,
      onlyMagic: i % 2 === 0,
    };

    const envBody = composeSessionEnvironmentText(sessionForm, worldHints, 1700000000000 + i * 9991);
    trackField(bucket, "envBody", envBody, { expectCyrillic: true });

    const merged = { ...sessionForm, environmentText: envBody };
    const res = await runSessionGeneration(merged);
    bucket.count += 1;

    if (!res.ok) {
      bucket.issues.push(`[session] scenario ${i}: ok=false, error="${res.error}"`);
      bucket.bad["sessionResult"] = (bucket.bad["sessionResult"] ?? 0) + 1;
      continue;
    }

    const md = res.markdown ?? "";
    const brief = res.sessionBrief;
    const preview = res.preview;

    trackField(bucket, "markdown", md, { expectCyrillic: true });
    trackField(bucket, "preview.title", preview?.title, { expectCyrillic: true });
    trackField(bucket, "preview.excerpt", preview?.excerpt, { expectCyrillic: true });
    if (brief) {
      trackField(bucket, "brief.title", brief.title, { expectCyrillic: true });
      trackField(bucket, "brief.location", brief.location, { expectCyrillic: true });
      trackField(bucket, "brief.atmosphere", brief.atmosphere, { expectCyrillic: true });
      trackField(bucket, "brief.danger", brief.danger, { expectCyrillic: true });
      trackField(bucket, "brief.hook", brief.hook, { expectCyrillic: true });
      trackField(bucket, "brief.encounterPitch", brief.encounterPitch, { expectCyrillic: true });
      trackField(bucket, "brief.worldSummary", brief.worldSummary, { expectCyrillic: true });
      for (let k = 0; k < (brief.enemies?.length ?? 0); k += 1) {
        trackField(bucket, `brief.enemies[${k}]`, brief.enemies[k], { expectCyrillic: true });
      }
      for (let k = 0; k < (brief.rewardLines?.length ?? 0); k += 1) {
        trackField(bucket, `brief.rewardLines[${k}]`, brief.rewardLines[k], { expectCyrillic: true });
      }
    }

    // hook reuse — реальный pickRandomSessionHook
    const h = pickRandomSessionHook();
    if (hooksSeen.has(h)) hookDupes.push(h);
    hooksSeen.add(h);

    if (sampleScenes.length < 3) {
      sampleScenes.push({
        scenario: sc,
        title: preview?.title,
        excerpt: preview?.excerpt?.slice(0, 140),
        biomeLabel: brief?.biomeLabel,
        hook: brief?.hook?.slice(0, 140),
        danger: brief?.danger?.slice(0, 140),
      });
    }
  }

  // Биом-влияние: проверим, что hooks pool достаточно велик
  return {
    bucket,
    sampleScenes,
    hookDupes,
    hookPoolSize: SESSION_HOOK_LINES.length,
  };
}

// ─── Отчёт ─────────────────────────────────────────────────────────────────

function fmtCounts(map) {
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
}

function fmtLengths(map) {
  const rows = [];
  for (const [k, v] of Object.entries(map)) {
    rows.push(`- ${k}: min=${v.min === Infinity ? "—" : v.min}, avg=${avgLen(v)}, max=${v.max} (n=${v.n})`);
  }
  return rows.length ? rows.join("\n") : "—";
}

function fmtBucket(name, b) {
  return [
    `### ${name}`,
    `- Итераций: ${b.count}`,
    `- Дубли (внутри окна дедуп): ${b.duplicates}`,
    `- Пустые поля: ${fmtCounts(b.empty)}`,
    `- Битые значения (undefined/null/NaN): ${fmtCounts(b.bad)}`,
    `- Русские поля без кириллицы: ${b.cyrillicMismatch}`,
    `- Латинские «протечки» в текстах: ${b.latinLeak}`,
    "",
    "**Длины строк (символов):**",
    fmtLengths(b.lengths),
    "",
    b.issues.length
      ? `**Замечания (${b.issues.length}):**\n${b.issues.map((x) => `- ${x}`).join("\n")}`
      : "_Замечаний нет._",
  ].join("\n");
}

async function main() {
  await mkdir(TMP, { recursive: true });
  const startedAt = new Date().toISOString();

  if (!existsSync(APP_CONTENT_PATH)) {
    console.error("[smoke] нет файла app-content.json — отмена");
    process.exit(1);
  }

  console.log("[smoke] LOOT …");
  const loot = await runLootSmoke();
  console.log("[smoke] NPC …");
  const npc = await runNpcSmoke();
  console.log("[smoke] SESSION …");
  const session = await runSessionSmoke();

  const report = [
    `# ZERNIX — отчёт смоук-теста генераторов`,
    "",
    `Запуск: ${startedAt}`,
    `Файл: ${path.relative(ROOT, REPORT_PATH)}`,
    "",
    "## LOOT",
    `- Размер каталога LOOT_DATASET: **${loot.datasetSize}** позиций`,
    `- Несовпадений редкости с уровнем: **${loot.rarityMismatch}**`,
    `- Срабатываний дедуп-окна (повтор в окне=6): **${loot.recentDupHits}**`,
    `- Распределение kind: ${fmtCounts(loot.kindCounts)}`,
    "",
    "**Примеры goldLine:**",
    loot.goldLineSamples.map((s) => `- ${s}`).join("\n") || "—",
    "",
    fmtBucket("LOOT — метрики полей", loot.bucket),
    "",
    "## NPC",
    `- Несовпадений раса↔шаблон (legacy, по имени шаблона): **${npc.raceMismatches.length}**`,
    npc.raceMismatches.length
      ? npc.raceMismatches.map((x) => `  - ${x}`).join("\n")
      : "  - _нет_",
    `- Несовпадений card.raceRu ↔ запрошенной (строгая): **${npc.raceLabelMismatches.length}**`,
    npc.raceLabelMismatches.length
      ? npc.raceLabelMismatches.slice(0, 20).map((x) => `  - ${x}`).join("\n")
      : "  - _нет_",
    `- motivation == secret: **${npc.motivationSecretConflicts.length}**`,
    npc.motivationSecretConflicts.length
      ? npc.motivationSecretConflicts.map((x) => `  - ${x}`).join("\n")
      : "  - _нет_",
    "",
    "**Превью первых карточек:**",
    npc.previewCards
      .map(
        (c, i) =>
          `- (${i + 1}) **${c.name}** · ${c.race} · ${c.occupation}\n` +
          `  - motivation: ${c.motivation}\n` +
          `  - secret: ${c.secret}\n` +
          `  - narr.visualTrait: ${c.narr.visualTrait}\n` +
          `  - narr.wantLine: ${c.narr.wantLine}\n` +
          `  - narr.avoidLine: ${c.narr.avoidLine}\n` +
          `  - narr.secretLine: ${c.narr.secretLine}`,
      )
      .join("\n"),
    "",
    fmtBucket("NPC — метрики полей", npc.bucket),
    "",
    "## SESSION",
    `- Пул крючков (SESSION_HOOK_LINES): ${session.hookPoolSize}`,
    `- Повторов pickRandomSessionHook (по серии запусков): **${session.hookDupes.length}**`,
    "",
    "**Сэмплы сцен:**",
    session.sampleScenes
      .map(
        (s, i) =>
          `- (${i + 1}) lv${s.scenario.partyLevel}/${s.scenario.difficulty}/${s.scenario.environmentKey}\n` +
          `  - title: ${s.title}\n` +
          `  - biome: ${s.biomeLabel}\n` +
          `  - excerpt: ${s.excerpt}\n` +
          `  - hook: ${s.hook}\n` +
          `  - danger: ${s.danger}`,
      )
      .join("\n"),
    "",
    fmtBucket("SESSION — метрики полей", session.bucket),
    "",
    "---",
    "_Сгенерировано scripts/smoke-generators.mjs_",
    "",
  ].join("\n");

  await writeFile(REPORT_PATH, report, "utf8");

  console.log(`\n[smoke] отчёт: ${REPORT_PATH}`);
  console.log(`[smoke] LOOT: count=${loot.bucket.count}, dup=${loot.bucket.duplicates}, rarityMiss=${loot.rarityMismatch}, datasetSize=${loot.datasetSize}`);
  console.log(`[smoke] NPC: count=${npc.bucket.count}, nameRaceMismatch=${npc.raceMismatches.length}, labelRaceMismatch=${npc.raceLabelMismatches.length}, mot==secret=${npc.motivationSecretConflicts.length}`);
  console.log(`[smoke] SESSION: count=${session.bucket.count}, hookDup=${session.hookDupes.length}`);
}

main().catch((e) => {
  console.error("[smoke] FATAL:", e?.stack ?? e);
  process.exit(2);
});
