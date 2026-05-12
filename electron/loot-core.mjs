/**
 * Мост Electron ↔ `tools/dnd-loot-sqlite/generate-loot.mjs`.
 *
 * Оптовая подготовка / лут: уровень группы (1–20), сложность (easy|medium|hard|deadly
 * в UI сессии → те же строки в SQLite-логике; в экране лута — low|moderate|high|deadly),
 * биом (cave|forest|dungeon|urban|…). Монстры и предметы только из SQLite (`monsters`,
 * `items`); бюджет XP — таблица DMG 2024 в `encounterXpBudget.mjs`.
 *
 * Контекстный поиск: после расчёта лута по DMG/SQLite текст обогащается «местом», DC,
 * навыком, эхом предмета и сенсорикой (`loot-context-data.mjs`).
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { app } from "electron";
import {
  openLootDatabase,
  setLootDatabasePath,
  buildLootOnlyDataset,
  formatLootItemDisplayLine,
  formatHybridLootMarkdownReport,
  formatSessionPrepMarkdownReport,
  formatSceneLootMarkdownReport,
} from "../tools/dnd-loot-sqlite/generate-loot.mjs";
import {
  pickSensoryDetail,
  pickItemNarrative,
  resolveSituationBucket,
  pickSituation,
  defaultSearchBonus,
  rollVsDc,
  pickItemTwist,
  rollIntegrityDamaged,
  MASTER_HIDDEN_LOGIC,
  FORGE_CITIES,
  scaleSaveDc,
} from "./loot-context-data.mjs";
import {
  beginLootSqlDebug,
  endLootSqlDebug,
} from "../tools/dnd-loot-sqlite/lib/lootSqlDebug.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MD_BRAND = "ZERNIX Dungeon Assistant";

/** Золотой разделитель для markdown-экспорта */
const MD_DIVIDER = "\n\n✦ **───────────────** ✦\n\n";

/**
 * «Эхо мастера» — 10 % шанс клеймо из npc-engine NPC_NAMES + город кузницы.
 *
 * @param {Record<string, Record<string, string[]>>} NPC_NAMES
 * @param {() => number} rng
 */
function formatMakerStamp(NPC_NAMES, rng) {
  const races = Object.keys(NPC_NAMES);
  const race = races[Math.floor(rng() * races.length)];
  const gender = rng() < 0.5 ? "male" : "female";
  const pool = NPC_NAMES[race]?.[gender] ?? NPC_NAMES.human?.male ?? [];
  if (!Array.isArray(pool) || pool.length === 0) {
    return "";
  }
  const name = pool[Math.floor(rng() * pool.length)];
  const city = FORGE_CITIES[Math.floor(rng() * FORGE_CITIES.length)];
  return `На гарде выбито личное клеймо мастера **${name}**. Ходят слухи о торговых связях с **${city}**.`;
}

/**
 * Сборка связного текста + скрытый слой ГМ (Master's Insight), износ, повороты предмета.
 *
 * @param {import("better-sqlite3").Database} database
 * @param {ReturnType<typeof buildLootOnlyDataset>} d
 * @param {string} environment
 * @param {() => number} rng
 * @param {number} partyLevel
 */
async function buildContextualNarrativeLoot(database, d, environment, rng, partyLevel) {
  const bonus = defaultSearchBonus(d.partyLevel);
  const bucket = resolveSituationBucket(environment, rng);

  /** @type {Record<string, Record<string, string[]>> | null} */
  let NPC_NAMES = null;
  try {
    const href = pathToFileURL(path.join(__dirname, "..", "npc-engine.mjs")).href;
    const mod = await import(href);
    NPC_NAMES = mod.NPC_NAMES ?? null;
  } catch {
    NPC_NAMES = null;
  }

  /** @type {string[]} */
  const storyLines = [];
  /** @type {string[]} */
  const gmChunks = [];

  /** @type {{ displayLine: string, needsRepair: boolean, statusLine?: string }[]} */
  const mundaneDigest = [];
  /** @type {{ displayLine: string, needsRepair: boolean, statusLine?: string }[]} */
  const magicDigest = [];

  /**
   * @param {Record<string, unknown>} row
   * @param {boolean} isMagic
   * @param {'mundane'|'magic'} slot
   */
  function processRow(row, isMagic, slot) {
    const label = formatLootItemDisplayLine(database, row);
    const sit = pickSituation(bucket, rng);
    const roll = rollVsDc(sit.difficulty, bonus, rng);
    const echo = pickItemNarrative(rng);
    const echoLower = echo.charAt(0).toLowerCase() + echo.slice(1);
    const damaged = rollIntegrityDamaged(bucket, rng);
    const twist = pickItemTwist(rng);
    const sensory = pickSensoryDetail(rng, isMagic, twist.kind === "curse" ? "curse" : null);

    const twistLead =
      twist.kind === "curse"
        ? ` Что-то в предмете не спит: ${twist.flavorRu}`
        : ` Заметка мира: ${twist.flavorRu}`;

    const makerEcho = NPC_NAMES && rng() < 0.1 ? formatMakerStamp(NPC_NAMES, rng) : "";

    let playerLine = "";
    if (roll.success) {
      playerLine = isMagic
        ? `Внимательно осмотрев **${sit.location}**, вы после проверки **${sit.skill}** **DC ${sit.difficulty}** *(d20 ${roll.d20} + ${roll.bonus} = **${roll.total}**)* выводите на свет **${label}**. Он ${echoLower}${twistLead} Руки считывают силу: ${sensory}`
        : `Внимательно осмотрев **${sit.location}**, вы после проверки **${sit.skill}** **DC ${sit.difficulty}** *(d20 ${roll.d20} + ${roll.bonus} = **${roll.total}**)* обнаружили **${label}**. Он ${echoLower}${twistLead} Прикосновение: ${sensory}`;
    } else if (
      (!isMagic && (sit.skill === "Ловкость рук" || rng() < 0.3)) ||
      (isMagic && (sit.skill === "Магия" || rng() < 0.35))
    ) {
      playerLine = !isMagic
        ? `Проверка **${sit.skill}** **DC ${sit.difficulty}** *(d20 ${roll.d20} + ${roll.bonus} = ${roll.total})* даёт **провал** — ловушка щёлкнула бы раньше пальцев; **${label}** мог бы уцелеть ценой крови (**Мастер:** 1к4 колющего). Вы всё же выходите сухими: предмет ${echoLower}${twistLead} Кожа ловит: ${sensory}`
        : `На **${sit.skill}** **DC ${sit.difficulty}** *(d20 ${roll.d20} + ${roll.bonus} = ${roll.total})* — **провал**: резонанс мог бы обжечь ладони (**Мастер:** 1к6 некротического по решению Мастера). **${label}** удержан: он ${echoLower}${twistLead} Нервы дрожат: ${sensory}`;
    } else {
      playerLine = !isMagic
        ? `Проверка **${sit.skill}** **DC ${sit.difficulty}** *(d20 ${roll.d20} + ${roll.bonus} = ${roll.total})* — **провал**: без успеха **${label}** растворился бы в тени **${sit.location}**. Вы цепляетесь за деталь: он ${echoLower}${twistLead} Альтернативное ощущение: ${sensory}`
        : `Проверка **${sit.skill}** **DC ${sit.difficulty}** *(d20 ${roll.d20} + ${roll.bonus} = ${roll.total})* не проходит — **${label}** почти ускользает из фокуса. Интуиция спасает: он ${echoLower}${twistLead} Искажение реальности на коже: ${sensory}`;
    }

    storyLines.push(playerLine);

    const digestEntry = {
      displayLine: label,
      needsRepair: damaged,
      statusLine: damaged ? "Состояние: Ветхое / Требуется ремонт" : undefined,
    };
    if (slot === "mundane") {
      mundaneDigest.push(digestEntry);
    } else {
      magicDigest.push(digestEntry);
    }

    const saveDc = twist.save ? scaleSaveDc(twist.save.dc, partyLevel) : null;
    const gmParts = [
      `### Скрытый слой — ${isMagic ? "магический предмет" : "предмет"}`,
      `- **Предмет:** ${label}`,
      damaged
        ? `- **Износ:** повреждён (влага канализации / подземной сырости). ${MASTER_HIDDEN_LOGIC.REPAIR_NOTE_RU}`
        : `- **Износ:** без критического износа`,
      `- **Поворот (${twist.kind}):** ${twist.flavorRu}`,
      `- ${twist.gmRu}`,
    ];
    if (twist.save != null && saveDc != null) {
      gmParts.push(
        `- **Мастер — активное использование:** Спасбросок **${twist.save.ability} СЛ ${saveDc}**, иначе ${twist.save.fail}`,
      );
    }
    if (makerEcho) {
      gmParts.push(`- **Эхо мастера (NPC-связь):** ${makerEcho}`);
    }
    gmChunks.push(gmParts.join("\n"));
  }

  for (const row of d.mundaneRows) {
    processRow(row, false, "mundane");
  }
  for (const row of d.magicRows) {
    processRow(row, true, "magic");
  }

  if (storyLines.length === 0 && d.anyGold) {
    storyLines.push(
      "Монеты холодно звенят в ладони — больше ничего не откликается на осмотр; только металл и горечь того, что могло остаться в тени.",
    );
  }

  const playerBlock =
    storyLines.length > 0
      ? storyLines.map((line) => `- ${line}`).join("\n\n")
      : "_Нет предметов для истории — только монеты или тишина._";

  const gmBlock =
    gmChunks.length > 0
      ? gmChunks.join("\n\n✦ **···** ✦\n\n")
      : "_Скрытых поворотов нет — только монеты._";

  const narrativeBlock = `${playerBlock}\n\n[MASTER_ONLY]\n\n${gmBlock}`;

  const needsRepair = mundaneDigest.some((x) => x.needsRepair) || magicDigest.some((x) => x.needsRepair);

  const lootDigest = {
    needsRepair,
    labGold: d.labGold,
    labItems: d.labItems,
    labMagic: d.labMagic,
    goldLine: d.goldLine,
    mundane: mundaneDigest,
    magic: magicDigest,
  };

  return { storyLines, narrativeBlock, lootDigest, needsRepair };
}

export function resolveLootSqlitePathForElectron() {
  if (process.env.DND_LOOT_DB && String(process.env.DND_LOOT_DB).trim().length > 0) {
    return path.resolve(process.env.DND_LOOT_DB);
  }
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "dnd-loot.sqlite");
  }
  return path.join(__dirname, "..", "tools", "dnd-loot-sqlite", "dnd-loot.sqlite");
}

/**
 * Legacy: только гибрид по CR + gp.
 *
 * @param {number} cr
 * @param {number} gold
 * @param {string[]} [categories]
 */
export async function runGenerateHybridMarkdown(cr, gold, categories = []) {
  const dbPath = resolveLootSqlitePathForElectron();
  setLootDatabasePath(dbPath);
  const db = openLootDatabase(dbPath);
  try {
    return formatHybridLootMarkdownReport(db, gold, cr, categories, Math.random);
  } finally {
    db.close();
  }
}

/**
 * @typedef {{
 *   partyLevel?: number,
 *   playerCount?: number,
 *   difficulty?: string,
 *   environment?: string,
 *   gold?: number,
 *   categories?: string[],
 *   onlyMagic?: boolean,
 *   chestCount?: number,
 *   legacyHybrid?: boolean,
 *   debugSql?: boolean,
 * }} LootGenPayload
 */

/**
 * Основной генератор: встреча + hoard + гибрид. `legacyHybrid: true` — только старый блок гибрида (cr + gp).
 *
 * @param {LootGenPayload} payload
 */
export async function runGenerateLootMarkdown(payload) {
  const p =
    typeof payload === "object" && payload !== null
      ? payload
      : { partyLevel: 5, playerCount: 4, gold: 300, categories: [] };

  if (p.legacyHybrid === true && p.cr != null && p.gold != null) {
    const cr = Number(p.cr);
    const gold = Number(p.gold ?? 300);
    const categories = Array.isArray(p.categories)
      ? p.categories.map((x) => String(x)).filter((s) => s.length > 0)
      : [];
    const markdown = await runGenerateHybridMarkdown(cr, gold, categories);
    return { markdown, sqlLog: undefined };
  }

  const dbPath = resolveLootSqlitePathForElectron();
  setLootDatabasePath(dbPath);
  const db = openLootDatabase(dbPath);
  const debugSql = Boolean(p.debugSql);
  if (debugSql) {
    beginLootSqlDebug();
  }
  try {
    const rawChest = p.chestCount;
    let chestCount = 0;
    if (rawChest !== "" && rawChest != null) {
      const n = Number(rawChest);
      if (Number.isFinite(n)) {
        chestCount = Math.max(0, Math.min(24, Math.floor(n)));
      }
    }

    const lootOpts = {
      partyLevel: Number(p.partyLevel ?? p.cr ?? 5),
      playerCount: Number(p.playerCount ?? 4),
      difficulty: String(p.difficulty ?? "moderate"),
      environment: String(p.environment ?? "any"),
      goldLimitGp: Number(p.gold ?? 300),
      categories: Array.isArray(p.categories)
        ? p.categories.map((x) => String(x)).filter((s) => s.length > 0)
        : [],
      onlyMagic: Boolean(p.onlyMagic),
      lootOnly: true,
      chestCount,
      rng: Math.random,
      debugSql,
    };

    const rng = typeof lootOpts.rng === "function" ? lootOpts.rng : Math.random;
    const dataset = buildLootOnlyDataset(db, lootOpts);
    const env = dataset.environment;
    const { narrativeBlock, lootDigest, needsRepair } = await buildContextualNarrativeLoot(
      db,
      dataset,
      env,
      rng,
      dataset.partyLevel,
    );

    const fmtDigestLine = (e) =>
      e.needsRepair ? `${e.displayLine} _(ветхое — ремонт у ремесленника NPC)_` : e.displayLine;
    const mundaneLine =
      lootDigest.mundane.length > 0 ? lootDigest.mundane.map(fmtDigestLine).join("; ") : "—";
    const magicLine =
      lootDigest.magic.length > 0 ? lootDigest.magic.map(fmtDigestLine).join("; ") : "—";

    /** Сводка для списков золота / предметов; связный текст — в `narrativeBlock` (карточка истории). */
    const markdown = [
      `# ${MD_BRAND} — Результат поиска сокровищ`,
      "",
      MD_DIVIDER.trim(),
      "",
      `**${dataset.labGold}:** ${dataset.goldLine}`,
      "",
      MD_DIVIDER.trim(),
      "",
      `**${dataset.labItems}:** ${mundaneLine}`,
      "",
      `**${dataset.labMagic}:** ${magicLine}`,
      "",
      "_Таблицы сокровищ и CR — по DMG 2024 / D&D 5.5; предметы из SQLite SRD._",
      "",
    ].join("\n");

    return {
      markdown,
      narrativeBlock,
      lootDigest,
      needsRepair,
      sqlLog: debugSql ? endLootSqlDebug() : undefined,
    };
  } catch (err) {
    if (debugSql) {
      endLootSqlDebug();
    }
    throw err;
  } finally {
    db.close();
  }
}

/**
 * Подготовка сессии: отряды по XP + сундуки-hoard + орочье/гоблинское снаряжение.
 *
 * @param {object} payload
 * @param {number} payload.partyLevel
 * @param {number} payload.playerCount
 * @param {string} payload.difficulty
 * @param {number} payload.packCount
 * @param {number} payload.chestCount
 * @param {string} payload.environmentText
 * @param {string} [payload.environmentKey] cave|forest|dungeon|urban|any — приоритет над выводом из текста
 * @param {boolean} [payload.onlyMagic]
 */
/**
 * Лут по сцене (полки, столы, закопки) — см. `tools/dnd-loot-sqlite/data/scene-loot-templates.json`.
 *
 * @param {object} [payload]
 * @param {string} [payload.environment] forest|cave|dungeon|…
 * @param {number} [payload.stashCount] 1–8, по умолчанию 3
 */
export async function runSceneLootMarkdown(payload) {
  const p = typeof payload === "object" && payload !== null ? payload : {};
  const dbPath = resolveLootSqlitePathForElectron();
  setLootDatabasePath(dbPath);
  const db = openLootDatabase(dbPath);
  try {
    return formatSceneLootMarkdownReport(db, {
      environmentKey: String(p.environment ?? p.environmentKey ?? "any"),
      stashCount: Number(p.stashCount ?? 3),
      rng: Math.random,
    });
  } finally {
    db.close();
  }
}

export async function runSessionPrepMarkdown(payload) {
  const p = typeof payload === "object" && payload !== null ? payload : {};
  const dbPath = resolveLootSqlitePathForElectron();
  setLootDatabasePath(dbPath);
  const db = openLootDatabase(dbPath);
  try {
    return formatSessionPrepMarkdownReport(db, {
      partyLevel: Number(p.partyLevel ?? 5),
      playerCount: Number(p.playerCount ?? 4),
      difficulty: String(p.difficulty ?? "moderate"),
      packCount: Number(p.packCount ?? 0),
      chestCount: Number(p.chestCount ?? 0),
      environmentText: String(p.environmentText ?? ""),
      environmentKey:
        p.environmentKey != null && String(p.environmentKey).trim().length > 0
          ? String(p.environmentKey).trim().toLowerCase()
          : undefined,
      onlyMagic: Boolean(p.onlyMagic),
      rng: Math.random,
      dungeonSession:
        p.dungeonSession != null && typeof p.dungeonSession === "object" ? p.dungeonSession : undefined,
      hoardOrigin:
        p.hoardOrigin != null && String(p.hoardOrigin).trim().length > 0
          ? String(p.hoardOrigin).trim()
          : undefined,
    });
  } finally {
    db.close();
  }
}
