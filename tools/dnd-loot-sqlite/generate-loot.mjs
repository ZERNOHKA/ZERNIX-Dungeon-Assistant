import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __genDir = dirname(__filename);
const require = createRequire(import.meta.url);

/**
 * Electron — другой ABI, чем у системного `node`: для приложения грузим `better-sqlite3` из корня репозитория.
 * Обычный `node` (CLI, смоук-тесты) — сначала локальный `tools/dnd-loot-sqlite/node_modules`, иначе падаем на ABI Electron из корня.
 *
 * @returns {typeof import('better-sqlite3')}
 */
function loadBetterSqlite3() {
  const rootCandidate = join(__genDir, '..', '..', 'node_modules', 'better-sqlite3');
  const localCandidate = join(__genDir, 'node_modules', 'better-sqlite3');

  if (process.versions.electron) {
    try {
      return require(rootCandidate);
    } catch {
      return require('better-sqlite3');
    }
  }

  try {
    return require(localCandidate);
  } catch {
    try {
      return require(rootCandidate);
    } catch {
      return require('better-sqlite3');
    }
  }
}

const Database = loadBetterSqlite3();
import { dbgLootSql } from './lib/lootSqlDebug.mjs';
import { joinContentLines, tableToReadableText } from './lib/parsers.mjs';
import { slugify } from './lib/text-utils.mjs';
import {
  generateHumanoidNpcLoot,
  inferNpcEquipmentRole,
  isHumanoidMonster,
  generateTreasureHoardLoot,
  generateLootHybrid,
  generateIndividualTreasureLoot,
  generateLootHybridDiceOnly,
  applyNatureContextToHybridPicks,
  partyTreasureSoftCapGp,
  clipLootTotalsToWealthCap,
  resolveTreasureCrNumeric,
  isAdventuringPackExcluded,
  approximateIndividualCoinsGp,
  pickMundaneHoardItems,
  extractSpellNamesFromStatblock,
  buildSpellQuickRefLines,
  extractCombatEssentials,
  applyHoardGoldFloor,
  guaranteeHoardFallbackItems,
  rollWorldState,
  normalizeWorldState,
  formatWorldStateLabelRuEn,
  generateDeathRattle,
  extractTagsFromTrace,
} from './lib/loot-generator-55.mjs';
import {
  buildEncounterFromDatabase,
  dominantCreatureTagsFromRoster,
  environmentLabelRu,
  formatMonsterCrDisplay,
} from './lib/encounter-build.mjs';
import { difficultyLabelRu } from './lib/encounterXpBudget.mjs';
import { analyzeSessionPrepDescription } from './lib/session-prep-keywords.mjs';
import {
  generatePersonalLoot,
  generateEnvironmentLoot,
  generateHoard,
  magicItemQuirk,
} from './lib/zernix-legacy-loot-ultra.mjs';
import {
  ensureLocalizationTable,
  seedLocalizationDefaults,
  translate,
  translateMonsterTypeLine,
  translateAbilitySummary,
  translateItemRarityForReport,
  translateItemCategoryForReport,
  translateItemNameForReport,
  translateItemDescriptionForReport,
  formatCreatureTagsLocalized,
  formatLocalizedWithOriginalSuffix,
  formatMonsterDisplayNameRuEn,
  formatMonsterHeadingRuEnCr,
} from './lib/db-localization.mjs';
import { SQL_ITEMS_LOCALIZED_FROM, SQL_ITEMS_LOCALIZED_SELECT } from './lib/sql-items-localized.mjs';
import { generateSceneStashes } from './lib/scene-loot.mjs';

const LOOT_DEBUG = process.env.ZERNIX_LOOT_DEBUG === '1';

/** Единое имя продукта в Markdown-отчётах и заголовках генератора. */
const MD_BRAND = 'ZERNIX Dungeon Assistant';

/**
 * Шкала угрозы в отчёте (глубина подземелья).
 * @param {number} floorDepth
 */
function renderThreatSkulls(floorDepth) {
  const d = Math.max(0, Math.floor(Number(floorDepth) || 0));
  const n = Math.min(8, 1 + d);
  return '💀'.repeat(n);
}

/** Связующий лут (10% в карманах) — упрощает следующий бой. */
const DUNGEON_LINK_POCKET_ITEMS = Object.freeze([
  {
    ru: 'Склянка с ароматным маслом — легенда утверждает, что **гидра** засыпает, если нанести на все головы.',
    en: 'A flask of scented oil — lore claims a **hydra** slumbers if anointed across every head.',
  },
  {
    ru: 'Кусок магнетита на шнурке — **конструкт** на один раунд действует с помехой, если приложить к корпусу (СЛ 13).',
    en: 'A lodestone on a cord — a **construct** acts with disadvantage for 1 round if pressed to its chassis (DC 13).',
  },
  {
    ru: 'Солёная отмычка — **нежить** с костяным телом на 1 ход получает помеху к Уклонению от вашей атаки.',
    en: 'A salt-etched pick — **undead** with bone frames take disadvantage on one dodge vs your attack.',
  },
  {
    ru: 'Серебряная игла в пробке — **оборотень** на один удар считает ваше оружие серебряным.',
    en: 'A silver needle in cork — for one strike your weapon counts as silver against a **lycanthrope**.',
  },
  {
    ru: 'Пепел святыни в кляпе — **фея** или иллюзия на 1 раунд слабее против вашей Воли (преимущество на спасбросок).',
    en: 'Relic ash in wax — **fey** or illusion magic is weaker vs your will for 1 round (advantage on one save).',
  },
]);

/** Лог только при `ZERNIX_LOOT_DEBUG=1` (иначе засорение консоли и кракозябры в WIN cp866). */
function lootDebug(...args) {
  if (!LOOT_DEBUG) return;
  // eslint-disable-next-line no-console -- отладочный вывод по флагу
  console.log(...args);
}

/** @type {string|null} */
let configuredLootDatabasePath = null;

/**
 * Задаёт путь к файлу SQLite для `generateLoot` (приоритетнее `DND_LOOT_DB`).
 *
 * @param {string|null|undefined} absoluteOrRelativePath
 */
export function setLootDatabasePath(absoluteOrRelativePath) {
  if (absoluteOrRelativePath == null || String(absoluteOrRelativePath).length === 0) {
    configuredLootDatabasePath = null;
    return;
  }
  configuredLootDatabasePath = resolve(String(absoluteOrRelativePath));
}

/**
 * @returns {string}
 */
export function getLootDatabasePath() {
  return resolveLootDatabasePath();
}

/**
 * @returns {string}
 */
function resolveLootDatabasePath() {
  if (configuredLootDatabasePath) {
    return configuredLootDatabasePath;
  }
  if (process.env.DND_LOOT_DB && process.env.DND_LOOT_DB.length > 0) {
    return resolve(process.env.DND_LOOT_DB);
  }
  return resolve(join(process.cwd(), 'dnd-loot.sqlite'));
}

/**
 * Открывает SQLite в режиме чтения/записи.
 *
 * @param {string} filePath
 * @returns {import('better-sqlite3').Database}
 */
export function openLootDatabase(filePath) {
  const abs = resolve(String(filePath));
  lootDebug('DEBUG: Открываю базу по пути:', abs);
  const database = new Database(abs);
  database.pragma('foreign_keys = ON');
  validateLootDatabaseOrThrow(database, abs);
  return database;
}

const MIN_ITEMS_ROW_COUNT = 500;

/**
 * @param {import('better-sqlite3').Database} database
 * @param {string} absPath
 */
function validateLootDatabaseOrThrow(database, absPath) {
  const row = database.prepare(`SELECT COUNT(*) AS c FROM items`).get();
  const raw = row && /** @type {{ c?: unknown }} */ (row).c;
  const c = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(c) || c <= MIN_ITEMS_ROW_COUNT) {
    throw new Error(
      `FATAL ERROR: Database is empty or wrong file path (items count=${c}, need > ${MIN_ITEMS_ROW_COUNT}). File: ${absPath}`,
    );
  }
  ensureLocalizationTable(database);
  seedLocalizationDefaults(database);
}

/**
 * Заклинание для блока «атмосфера»: в приоритете 1-й уровень из БД.
 *
 * @param {import('better-sqlite3').Database} database
 * @returns {Record<string, unknown>|undefined}
 */
function fetchAtmosphereSpell(database) {
  let row = database
    .prepare(`SELECT * FROM spells WHERE level_num = 1 ORDER BY RANDOM() LIMIT 1`)
    .get();
  if (!row) {
    row = database.prepare(`SELECT * FROM spells ORDER BY RANDOM() LIMIT 1`).get();
  }
  if (!row) {
    row = database
      .prepare(
        `SELECT * FROM spells WHERE level_label IS NOT NULL AND (
          instr(lower(level_label), 'level 1') > 0 OR instr(level_label, '1') > 0
        ) ORDER BY RANDOM() LIMIT 1`,
      )
      .get();
  }
  return /** @type {Record<string, unknown>|undefined} */ (row);
}

/**
 * Находит `locations.id` по `name`, `display_name`, `slug` или `slugify(ввод)`.
 *
 * @param {import('better-sqlite3').Database} database
 * @param {string} locationName
 * @returns {number|null}
 */
export function resolveLocationId(database, locationName) {
  const trimmed = String(locationName).trim();
  if (trimmed.length === 0) {
    return null;
  }
  const slugGuess = slugify(trimmed);
  const primary = database
    .prepare(
      `
      SELECT id FROM locations
      WHERE name = ? OR display_name = ? OR slug = ?
      LIMIT 1
    `,
    )
    .get(trimmed, trimmed, trimmed);
  if (primary) {
    return /** @type {{ id: number }} */ (primary).id;
  }
  if (slugGuess.length > 0) {
    const bySlug = database
      .prepare(`SELECT id FROM locations WHERE slug = ? LIMIT 1`)
      .get(slugGuess);
    if (bySlug) {
      return /** @type {{ id: number }} */ (bySlug).id;
    }
  }
  return null;
}

/**
 * @param {{ weight: number }[]} rows
 * @param {() => number} randomUniformUnitInterval Returns uniform float in [0,1)
 * @returns {number} index into rows
 */
export function weightedRandomIndex(rows, randomUniformUnitInterval) {
  if (rows.length === 0) {
    return -1;
  }
  const totalWeight = rows.reduce((accumulator, row) => accumulator + row.weight, 0);
  if (totalWeight <= 0) {
    return rows.length - 1;
  }
  let threshold = randomUniformUnitInterval() * totalWeight;
  for (let index = 0; index < rows.length; index += 1) {
    threshold -= rows[index].weight;
    if (threshold <= 0) {
      return index;
    }
  }
  return rows.length - 1;
}

/**
 * Выбор индекса взвешенной строки методом накопленных весов (инверсия CDF).
 *
 * @template T
 * @param {T[]} rows
 * @param {(row: T) => number} getWeight
 * @param {() => number} randomUniformUnitInterval uniform in [0, 1)
 * @returns {number}
 */
export function pickWeightedIndexCumulative(rows, getWeight, randomUniformUnitInterval) {
  if (rows.length === 0) {
    return -1;
  }
  /** @type {number[]} */
  const prefix = [];
  let total = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const weight = Math.max(0, Number(getWeight(rows[index])) || 0);
    total += weight;
    prefix.push(total);
  }
  if (total <= 0) {
    return rows.length - 1;
  }
  const roll = randomUniformUnitInterval() * total;
  for (let index = 0; index < prefix.length; index += 1) {
    if (roll < prefix[index]) {
      return index;
    }
  }
  return rows.length - 1;
}

/**
 * @param {import('better-sqlite3').Database} database
 * @param {'monster'|'item'} entityType
 * @param {number} entityId
 * @returns {Record<string, unknown>|undefined}
 */
function fetchEntityRecord(database, entityType, entityId) {
  if (entityType === 'monster') {
    return database.prepare(`SELECT * FROM monsters WHERE id = ?`).get(entityId);
  }
  if (entityType === 'item') {
    return database
      .prepare(
        `SELECT ${SQL_ITEMS_LOCALIZED_SELECT} FROM ${SQL_ITEMS_LOCALIZED_FROM} WHERE i.id = ?`,
      )
      .get(entityId);
  }
  return undefined;
}

/**
 * @param {import('better-sqlite3').Database} database
 * @param {number} locationId
 * @param {string[]|undefined} tagsAny
 */
export function fetchWeightedLootRows(database, locationId, tagsAny) {
  const rows = database
    .prepare(
      `
      SELECT id AS map_row_id,
             location_id,
             entity_type,
             entity_id,
             weight,
             tags_json,
             notes
      FROM location_loot_map
      WHERE location_id = ?
    `,
    )
    .all(locationId);
  if (!tagsAny || tagsAny.length === 0) {
    return rows;
  }
  const wanted = new Set(tagsAny.map((tag) => String(tag).toLowerCase()));
  return rows.filter((row) => {
    if (!row.tags_json) {
      return false;
    }
    try {
      const tags = /** @type {unknown} */ (JSON.parse(row.tags_json));
      if (!Array.isArray(tags)) {
        return false;
      }
      return tags.some((tag) => wanted.has(String(tag).toLowerCase()));
    } catch {
      return false;
    }
  });
}

/**
 * Сужает пул строк `location_loot_map` по типу сущности и (для монстров) по `monsters.entry_type`.
 *
 * @param {import('better-sqlite3').Database} database
 * @param {Array<{
 *   map_row_id: number,
 *   location_id: number,
 *   entity_type: string,
 *   entity_id: number,
 *   weight: number,
 *   tags_json: string|null,
 *   notes: string|null,
 * }>} pool
 * @param {('monster'|'equipment'|'magic_item')[]|undefined} entityTypes
 * @param {string[]|undefined} monsterEntryTypes — например `['lore']`, `['statblock']`
 */
export function filterLootPoolByEntity(database, pool, entityTypes, monsterEntryTypes) {
  void database;
  void monsterEntryTypes;
  /** @type {typeof pool} */
  let filtered = pool;
  if (entityTypes && entityTypes.length > 0) {
    const allowedEntityTypes = new Set(entityTypes);
    filtered = filtered.filter((row) =>
      allowedEntityTypes.has(/** @type {'monster'|'item'} */ (row.entity_type)),
    );
  }
  return filtered;
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>|Array<unknown>|string|null}
 */
function parseJsonSafe(value) {
  if (typeof value !== 'string') {
    return null;
  }
  try {
    return /** @type {Record<string, unknown>|Array<unknown>|string} */ (JSON.parse(value));
  } catch {
    return null;
  }
}

/**
 * @param {unknown} rawContentJsonColumn
 * @returns {string}
 */
function monsterNarrativeTextFromRaw(rawContentJsonColumn) {
  const parsed = parseJsonSafe(rawContentJsonColumn);
  if (parsed == null) {
    return '';
  }
  if (typeof parsed === 'string') {
    return parsed;
  }
  if (Array.isArray(parsed)) {
    return joinContentLines(parsed);
  }
  if (typeof parsed === 'object' && parsed !== null && 'content' in parsed) {
    return joinContentLines(/** @type {{ content: unknown }} */ (parsed).content);
  }
  return '';
}

/**
 * @param {unknown} content
 * @returns {string}
 */
function firstTableTextFromContentArray(content) {
  if (!Array.isArray(content)) {
    return '';
  }
  for (const part of content) {
    if (
      part &&
      typeof part === 'object' &&
      !Array.isArray(part) &&
      'table' in part
    ) {
      const tableObject = /** @type {{ table: unknown }} */ (part).table;
      if (tableObject && typeof tableObject === 'object') {
        return tableToReadableText(
          /** @type {Record<string, string[]>} */ (tableObject),
        );
      }
    }
  }
  return '';
}

/**
 * @param {unknown} rawContentJsonColumn
 * @returns {string}
 */
function monsterTableTextFromRaw(rawContentJsonColumn) {
  const parsed = parseJsonSafe(rawContentJsonColumn);
  if (parsed == null) {
    return '';
  }
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
    if (
      'joined_text' in parsed &&
      typeof /** @type {{ joined_text: unknown }} */ (parsed).joined_text === 'string'
    ) {
      return /** @type {{ joined_text: string }} */ (parsed).joined_text;
    }
    if ('table_json' in parsed) {
      const tableJson = /** @type {{ table_json: unknown }} */ (parsed).table_json;
      if (tableJson && typeof tableJson === 'object') {
        return tableToReadableText(/** @type {Record<string, string[]>} */ (tableJson));
      }
    }
    if ('table' in parsed) {
      const tableObject = /** @type {{ table: unknown }} */ (parsed).table;
      if (tableObject && typeof tableObject === 'object') {
        return tableToReadableText(/** @type {Record<string, string[]>} */ (tableObject));
      }
    }
    if ('content' in parsed) {
      const fromContent = firstTableTextFromContentArray(
        /** @type {{ content: unknown }} */ (parsed).content,
      );
      if (fromContent.length > 0) {
        return fromContent;
      }
    }
  }
  if (Array.isArray(parsed)) {
    const fromArray = firstTableTextFromContentArray(parsed);
    if (fromArray.length > 0) {
      return fromArray;
    }
    return joinContentLines(parsed);
  }
  return '';
}

/**
 * @param {Record<string, unknown>} monsterRow
 * @returns {{
 *   kind: 'statblock',
 *   entityType: 'monster',
 *   name: string,
 *   slug: string,
 *   armorClass: string|null,
 *   hitPoints: string|null,
 *   speed: string|null,
 *   challengeRating: string|null,
 *   experiencePoints: number|null,
 *   abilitySummary: string,
 *   typeLine: string|null,
 * }}
 */
function formatMonsterLoot(monsterRow) {
  const name = String(monsterRow.name ?? '');
  const slug = String(monsterRow.slug ?? '');
  return {
    kind: 'statblock',
    entityType: 'monster',
    name,
    slug,
    armorClass:
      monsterRow.armor_class == null ? null : String(monsterRow.armor_class),
    hitPoints:
      monsterRow.hit_points == null ? null : String(monsterRow.hit_points),
    speed: monsterRow.speed == null ? null : String(monsterRow.speed),
    challengeRating:
      monsterRow.challenge_rating == null
        ? null
        : String(monsterRow.challenge_rating),
    experiencePoints:
      typeof monsterRow.xp === 'number' && Number.isFinite(monsterRow.xp)
        ? monsterRow.xp
        : null,
    abilitySummary: '',
    typeLine: monsterRow.type_line == null ? null : String(monsterRow.type_line),
  };
}

/**
 * @param {Record<string, unknown>} itemRow строка из `items` (опционально с `name_ru` / `desc_ru` из JOIN)
 * @param {import('better-sqlite3').Database|null} [database] для fallback через `translate` при отсутствии JOIN
 * @returns {Record<string, unknown>}
 */
function formatItemLoot(itemRow, database = null) {
  const isMagic = Number(itemRow.is_magic) === 1;
  const nameEn = String(itemRow.name ?? '').trim();
  const nameRuJoin = itemRow.name_ru;
  const joinTrim =
    nameRuJoin != null && String(nameRuJoin).trim() !== '' ? String(nameRuJoin).trim() : '';
  /* Строка в БД с ru = англ. имени не считается переводом — берём словарь/транслитерацию. */
  const ruOnly =
    joinTrim !== '' && joinTrim !== nameEn
      ? joinTrim
      : database != null
        ? translateItemNameForReport(database, nameEn)
        : nameEn;
  const name = formatLocalizedWithOriginalSuffix(ruOnly, nameEn);
  const descEn = itemRow.description_md == null ? '' : String(itemRow.description_md);
  const descRuJoin = itemRow.desc_ru;
  const desc =
    descRuJoin != null && String(descRuJoin).trim() !== ''
      ? String(descRuJoin).trim()
      : database != null
        ? translateItemDescriptionForReport(database, descEn, String(itemRow.slug ?? ''))
        : descEn;
  return {
    kind: isMagic ? 'magic_item' : 'equipment',
    entityType: 'item',
    name,
    nameEn,
    nameRu: ruOnly,
    slug: String(itemRow.slug ?? ''),
    category: String(itemRow.category ?? ''),
    subcategory:
      itemRow.subcategory == null ? null : String(itemRow.subcategory),
    cost: itemRow.cost_raw == null ? null : String(itemRow.cost_raw),
    costGp: itemRow.cost_gp == null ? null : Number(itemRow.cost_gp),
    weight: itemRow.weight_raw == null ? null : String(itemRow.weight_raw),
    masteryProperty:
      itemRow.mastery_property == null ? null : String(itemRow.mastery_property),
    consumableUseAction:
      itemRow.consumable_use_action == null
        ? null
        : String(itemRow.consumable_use_action),
    typeLine: itemRow.type_line == null ? null : String(itemRow.type_line),
    rarity: itemRow.rarity == null ? null : String(itemRow.rarity),
    requiresAttunement: Number(itemRow.attunement) === 1,
    description: desc,
  };
}

/**
 * @param {Record<string, unknown>} record
 * @param {'monster'|'item'} entityType
 * @param {import('better-sqlite3').Database|null} [database]
 * @returns {Record<string, unknown>}
 */
function formatLootRecord(record, entityType, database = null) {
  if (entityType === 'monster') {
    return formatMonsterLoot(/** @type {Record<string, unknown>} */ (record));
  }
  return formatItemLoot(/** @type {Record<string, unknown>} */ (record), database);
}

/**
 * @param {Record<string, unknown>} spellRow
 * @returns {Record<string, unknown>}
 */
function formatSpellSnippet(spellRow) {
  return {
    kind: 'spell',
    entityType: 'spell',
    name: String(spellRow.name ?? ''),
    slug: String(spellRow.slug ?? ''),
    levelLabel: spellRow.level_label == null ? null : String(spellRow.level_label),
    school: spellRow.school == null ? null : String(spellRow.school),
    content: String(spellRow.description_md ?? '').slice(0, 1200),
  };
}

/**
 * Основной API: взвешенная выборка и типизированный вывод для импорта в основной проект.
 *
 * @param {string} locationName
 * @param {number} count
 * @param {object} [options]
 * @param {string[]} [options.tagsAny]
 * @param {('monster'|'item')[]} [options.entityTypes]
 * @param {string[]} [options.monsterEntryTypes] — устарело; игнорируется
 * @param {() => number} [options.random] uniform in [0, 1), по умолчанию `Math.random`
 * @returns {Array<Record<string, unknown>>}
 */
export function generateLoot(locationName, count, options = {}) {
  const databasePath = resolveLootDatabasePath();
  const database = openLootDatabase(databasePath);
  try {
    return generateLootWithDatabase(database, locationName, count, options);
  } finally {
    database.close();
  }
}

/**
 * То же, что `generateLoot`, но с уже открытым подключением (пул соединений, сервер, тесты).
 *
 * @param {import('better-sqlite3').Database} database
 * @param {string} locationName
 * @param {number} count
 * @param {object} [options]
 * @param {string[]} [options.tagsAny]
 * @param {('monster'|'item')[]} [options.entityTypes]
 * @param {string[]} [options.monsterEntryTypes] — устарело; игнорируется
 * @param {() => number} [options.random]
 * @returns {Array<Record<string, unknown>>}
 */
export function generateLootWithDatabase(database, locationName, count, options = {}) {
  const tagsAny = options.tagsAny;
  const entityTypes = options.entityTypes;
  const monsterEntryTypes = options.monsterEntryTypes;
  const randomUniformUnitInterval =
    typeof options.random === 'function' ? options.random : Math.random;
  const pickCount = Math.max(0, Math.floor(Number(count)));
  const locationId = resolveLocationId(database, locationName);
  if (locationId == null) {
    throw new Error(
      `Локация не найдена: "${locationName}". Сначала создайте её в таблице locations.`,
    );
  }
  const basePool = fetchWeightedLootRows(database, locationId, tagsAny);
  const pool = filterLootPoolByEntity(
    database,
    basePool,
    entityTypes,
    monsterEntryTypes,
  );
  if (pool.length === 0 || pickCount === 0) {
    return [];
  }

  /** @type {Array<Record<string, unknown>>} */
  const results = [];
  for (let pickIndex = 0; pickIndex < pickCount; pickIndex += 1) {
    const index = pickWeightedIndexCumulative(
      pool,
      (row) => row.weight,
      randomUniformUnitInterval,
    );
    const row = pool[index];
    const entityType = /** @type {'monster'|'item'} */ (row.entity_type);
    const record = fetchEntityRecord(database, entityType, row.entity_id);
    if (!record) {
      continue;
    }
    const formatted = formatLootRecord(
      /** @type {Record<string, unknown>} */ (record),
      entityType,
      database,
    );
    results.push(formatted);
  }
  return results;
}

/**
 * Обратная совместимость: открывает базу по `DND_LOOT_DB` или `dnd-loot.sqlite` рядом с модулем.
 *
 * @param {string} locationName
 * @param {object} [options]
 * @param {number} [options.picks]
 * @param {string[]} [options.tagsAny]
 * @param {('monster'|'item')[]} [options.entityTypes]
 * @param {string[]} [options.monsterEntryTypes] — устарело; игнорируется
 * @param {() => number} [options.rng]
 * @returns {Array<Record<string, unknown>>}
 */
export function generateLootAuto(locationName, options = {}) {
  const picks = options.picks != null ? Number(options.picks) : 5;
  const random = typeof options.rng === 'function' ? options.rng : undefined;
  return generateLoot(locationName, picks, {
    tagsAny: options.tagsAny,
    random,
    entityTypes: options.entityTypes,
    monsterEntryTypes: options.monsterEntryTypes,
  });
}

/**
 * @typedef {{
 *   locationLabel: string,
 *   lore: Record<string, unknown>,
 *   monster: Record<string, unknown>,
 *   item: Record<string, unknown>,
 *   npcGear: Array<Record<string, unknown>>,
 *   npcRole: string|null,
 *   npcAppearance: {
 *     clothes_color: string,
 *     physical_detail: string,
 *     behavioral_quirk: string,
 *     description: string,
 *     feature: string,
 *     quirk: string,
 *   }|null,
 * }} EncounterPack
 */

/**
 * Три независимые взвешенные выборки `generateLoot`: lore, statblock, предмет (equipment или magic_item).
 *
 * `equipment` / `magic_item` должны присутствовать в `location_loot_map` для этой локации
 * (для «Леса» при базовом seed добавьте связи вручную или расширьте `seed-logic.mjs`).
 *
 * @param {string} locationName
 * @param {object} [options]
 * @param {string[]} [options.tagsAny]
 * @param {() => number} [options.random]
 * @param {boolean} [options.attachNpcLoot]
 * @returns {EncounterPack}
 */
export function generateEncounter(locationName, options = {}) {
  const databasePath = resolveLootDatabasePath();
  const database = openLootDatabase(databasePath);
  try {
    return generateEncounterWithDatabase(database, locationName, options);
  } finally {
    database.close();
  }
}

/**
 * @param {import('better-sqlite3').Database} database
 * @param {string} locationName
 * @param {object} [options]
 * @param {string[]} [options.tagsAny]
 * @param {() => number} [options.random]
 * @param {boolean} [options.attachNpcLoot] — снаряжение гуманоида из `items` (по умолчанию true)
 * @returns {EncounterPack}
 */
export function generateEncounterWithDatabase(database, locationName, options = {}) {
  const randomUniformUnitInterval =
    typeof options.random === 'function' ? options.random : Math.random;
  const attachNpcLoot = options.attachNpcLoot !== false;
  const sharedLootOptions = {
    tagsAny: options.tagsAny,
    random: randomUniformUnitInterval,
  };

  const spellRow = fetchAtmosphereSpell(database);
  const loreSamples = spellRow
    ? [formatSpellSnippet(/** @type {Record<string, unknown>} */ (spellRow))]
    : [
        {
          kind: 'spell',
          entityType: 'spell',
          name: '—',
          levelLabel: null,
          school: null,
          content:
            'В таблице spells нет строк; импортируйте данные (import-srd-docs.mjs).',
        },
      ];

  const monsterSamples = generateLootWithDatabase(database, locationName, 1, {
    ...sharedLootOptions,
    entityTypes: ['monster'],
  });
  if (monsterSamples.length === 0) {
    throw new Error(
      `Нет монстров в location_loot_map для локации "${locationName}". Запустите seed-logic или import-srd-docs с демо-сидом.`,
    );
  }

  const itemSamples = generateLootWithDatabase(database, locationName, 1, {
    ...sharedLootOptions,
    entityTypes: ['item'],
  });
  if (itemSamples.length === 0) {
    throw new Error(
      `Нет предметов (item) в location_loot_map для локации "${locationName}". Запустите seed-logic.`,
    );
  }

  /** @type {Array<Record<string, unknown>>} */
  let npcGear = [];
  /** @type {string|null} */
  let npcRole = null;
  /** @type {EncounterPack['npcAppearance']} */
  let npcAppearance = null;
  const monsterPiece = monsterSamples[0];
  if (
    attachNpcLoot &&
    monsterPiece &&
    typeof monsterPiece.slug === 'string' &&
    monsterPiece.slug.length > 0
  ) {
    const rawMonster = database
      .prepare(`SELECT * FROM monsters WHERE slug = ?`)
      .get(monsterPiece.slug);
    if (rawMonster && isHumanoidMonster(/** @type {Record<string, unknown>} */ (rawMonster))) {
      npcRole = inferNpcEquipmentRole(/** @type {Record<string, unknown>} */ (rawMonster));
      const pack = generateHumanoidNpcLoot(
        database,
        /** @type {Record<string, unknown>} */ (rawMonster),
        randomUniformUnitInterval,
      );
      npcGear = pack.gear.map((row) =>
        formatItemLoot(/** @type {Record<string, unknown>} */ (row), database),
      );
      npcAppearance = pack.appearance;
    }
  }

  return {
    locationLabel: String(locationName),
    lore: loreSamples[0],
    monster: monsterSamples[0],
    item: itemSamples[0],
    npcGear,
    npcRole,
    npcAppearance,
  };
}

/**
 * Склеивает пакет встречи в один Markdown-текст с разделителями `---`.
 *
 * @param {EncounterPack} encounter
 * @param {import('better-sqlite3').Database|null} [database] для локализации statblock
 * @returns {string}
 */
export function formatEncounterToMarkdown(encounter, database = null) {
  const loreSection = formatLoreSection(encounter.lore);
  const appearanceForThreat =
    'npcAppearance' in encounter && encounter.npcAppearance != null
      ? encounter.npcAppearance
      : null;
  const hasAppearanceBlock =
    appearanceForThreat &&
    (appearanceForThreat.description ||
      appearanceForThreat.feature ||
      appearanceForThreat.quirk ||
      appearanceForThreat.clothes_color ||
      appearanceForThreat.physical_detail ||
      appearanceForThreat.behavioral_quirk);

  /** @type {string} */
  let monsterBlock = formatMonsterSection(encounter.monster, database);
  if (hasAppearanceBlock) {
    /** @type {Record<string, unknown>} */
    const app = /** @type {Record<string, unknown>} */ (appearanceForThreat);
    monsterBlock += '\n\n### Внешний вид и манеры\n\n';
    if (typeof app.description === 'string' && app.description.length > 0) {
      monsterBlock += `${app.description}\n\n`;
    }
    const feat =
      typeof app.feature === 'string' && app.feature.length > 0
        ? app.feature
        : typeof app.physical_detail === 'string'
          ? app.physical_detail
          : '';
    const q =
      typeof app.quirk === 'string' && app.quirk.length > 0
        ? app.quirk
        : typeof app.behavioral_quirk === 'string'
          ? app.behavioral_quirk
          : '';
    if (feat.length > 0) {
      monsterBlock += `- **Яркая деталь:** ${feat}\n`;
    }
    if (q.length > 0) {
      monsterBlock += `- **Особенность поведения:** ${q}\n`;
    }
    monsterBlock += '';
  }

  const itemSection = formatItemSection(encounter.item, database);
  /** @type {string[]} */
  const chunks = [
    `# ${MD_BRAND} — Сцена: ${encounter.locationLabel}`,
    '',
    '## Атмосфера',
    '',
    loreSection,
    '',
    '---',
    '',
    '## Угроза',
    '',
    monsterBlock,
    '',
    '---',
    '',
    '## Находка',
    '',
    itemSection,
    '',
  ];

  const gear =
    'npcGear' in encounter &&
    Array.isArray(encounter.npcGear) &&
    encounter.npcGear.length > 0
      ? encounter.npcGear
      : null;
  if (gear) {
    const roleLine =
      'npcRole' in encounter && encounter.npcRole != null && String(encounter.npcRole).length > 0
        ? `_Роль снаряжения: ${String(encounter.npcRole)}_`
        : '';
    chunks.push('---', '', '## Снаряжение NPC', '', roleLine, '');
    for (const piece of gear) {
      chunks.push(
        formatItemSection(/** @type {Record<string, unknown>} */ (piece), database),
        '',
        '---',
        '',
      );
    }
  }

  return chunks.join('\n');
}

/**
 * Markdown-отчёт по гибридному луту (`generateLootHybrid`: бюджет gp + веса редкости по CR).
 *
 * @param {import('better-sqlite3').Database} database
 * @param {number} goldLimitGp
 * @param {number} crValue
 * @param {string[]} [categories] подстроки для `items.category` / `subcategory` (пусто = все)
 * @param {() => number} [rng]
 * @returns {string}
 */
export function formatHybridLootMarkdownReport(
  database,
  goldLimitGp,
  crValue,
  categories = [],
  rng = Math.random,
) {
  const hybrid = generateLootHybrid(database, goldLimitGp, crValue, categories, rng);
  /** @type {string[]} */
  const lines = [
    `# ${MD_BRAND} — Гибридный лут (SRD SQLite)`,
    '',
    `- **CR:** ${crValue}`,
    `- **Лимит золота:** ${goldLimitGp} зм`,
    `- **Фильтр типов (подстроки):** ${categories.length ? categories.join(', ') : 'все магические'}`,
    `- **Ярус:** ${hybrid.tier}`,
    `- **Смещение редкости:** ${
      hybrid.bias_rarities.length
        ? hybrid.bias_rarities.map((x) => translateItemRarityForReport(database, x)).join(', ')
        : '—'
    }`,
    '',
    '---',
    '',
  ];
  if (hybrid.picks.length === 0) {
    lines.push('_Нет выбранных предметов (проверьте таблицу encounters или лимит gp)._', '');
    return lines.join('\n');
  }
  for (let index = 0; index < hybrid.picks.length; index += 1) {
    const piece = formatItemLoot(/** @type {Record<string, unknown>} */ (hybrid.picks[index]), database);
    lines.push(`## Предмет ${index + 1}`, '', formatItemSection(piece, database), '', '---', '');
  }
  return lines.join('\n');
}

/**
 * Парсинг числа сундуков: пусто / null → 0 (Individual Treasure).
 *
 * @param {unknown} raw
 */
function parseLootChestCount(raw) {
  if (raw === '' || raw == null) {
    return 0;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.max(0, Math.min(24, Math.floor(n)));
}

/**
 * Компактная подпись предмета для loot-only (без блоков statblock).
 *
 * @param {Record<string, unknown>} piece
 */
/**
 * @param {import('better-sqlite3').Database|null} database
 * @param {Record<string, unknown>} piece
 */
function formatLootItemOneLiner(database, piece) {
  const name = typeof piece.name === 'string' ? piece.name : '';
  const rarityRaw =
    piece.rarity != null && String(piece.rarity).length > 0 ? String(piece.rarity) : '';
  const rRu = rarityRaw ? translateItemRarityForReport(database, rarityRaw) : '';
  const r = rRu ? ` (${rRu})` : '';
  return name ? `${name}${r}` : '—';
}

/**
 * Компактная подпись предмета по строке SQLite (для Electron `loot-core.mjs`, контекстный лут).
 *
 * @param {import('better-sqlite3').Database|null} database
 * @param {Record<string, unknown>} row
 */
export function formatLootItemDisplayLine(database, row) {
  return formatLootItemOneLiner(
    database,
    formatItemLoot(/** @type {Record<string, unknown>} */ (row), database),
  );
}

/**
 * Только лут обыска: монстры считаются для CR в фоне, в отчёт не попадают.
 * Магия — не более 2 предметов на весь результат; без добора по лимиту gp.
 *
 * @param {import('better-sqlite3').Database} database
 * @param {object} opts
 * @param {unknown} [opts.chestCount] 0 или пусто → Individual Treasure; ≥1 → Treasure Hoard по CR
 * @param {boolean} [opts.debugSql] — лог SQL в `lootSqlDebug` (включается из Electron с реролла)
 */
/**
 * Сырые данные лута «только обыск» (DMG 2024 + SQLite) без контекстной новеллизации.
 * Используется Electron `loot-core.mjs` для связного текста «контекстного поиска».
 *
 * @param {import('better-sqlite3').Database} database
 * @param {object} opts — те же опции, что у `formatEncounterAndLootMarkdownReport` при `lootOnly: true`
 */
export function buildLootOnlyDataset(database, opts) {
  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
  const partyLevel = Math.min(20, Math.max(1, Math.floor(Number(opts.partyLevel) || 1)));
  const playerCount = Math.min(12, Math.max(1, Math.floor(Number(opts.playerCount) || 4)));
  const difficultyRaw = String(opts.difficulty ?? 'moderate');
  const environment = String(opts.environment || 'any').toLowerCase();
  const categories = Array.isArray(opts.categories)
    ? opts.categories.map((x) => String(x)).filter((s) => s.length > 0)
    : [];
  const onlyMagic = Boolean(opts.onlyMagic);
  const chestCount = parseLootChestCount(opts.chestCount);

  const enc = buildEncounterFromDatabase(database, {
    partyLevel,
    playerCount,
    difficulty: difficultyRaw,
    environment,
    rng,
    worldState: normalizeWorldState(opts.worldState) ?? undefined,
    nextEncounterHint: String(opts.nextEncounterHint ?? ''),
  });

  const tags = dominantCreatureTagsFromRoster(enc.roster);
  const crLoot = resolveTreasureCrNumeric(database, partyLevel, enc.totalCr);
  if (opts.debugSql) {
    dbgLootSql('loot_only', 'resolveTreasureCrNumeric', {
      partyLevel,
      encounterTotalCr: enc.totalCr,
      crLoot,
    });
  }
  const caveBias = environment === 'cave' ? 0.62 : environment === 'dungeon' ? 0.22 : 0.1;

  /** ±30% к оценке монет при каждом броске (реролл). */
  function applyGoldJitter(gp) {
    const n = Number(gp);
    if (!Number.isFinite(n) || n <= 0) {
      return 0;
    }
    const j = 0.7 + rng() * 0.6;
    return Math.max(0, Math.round(n * j));
  }

  let totalGoldGp = 0;
  let anyGold = false;

  /** @type {Record<string, unknown>[]} */
  const mundaneRows = [];
  /** @type {Record<string, unknown>[]} */
  const magicRows = [];
  const MAX_MAGIC = chestCount > 0 ? Math.min(12, chestCount * 2) : 2;

  function pushMagic(row) {
    if (magicRows.length >= MAX_MAGIC) {
      return;
    }
    magicRows.push(row);
  }

  function runHybridForChest(skipMundaneHybrid) {
    const hybridDice = generateLootHybridDiceOnly(
      database,
      crLoot,
      categories,
      rng,
      onlyMagic,
      caveBias,
      skipMundaneHybrid,
    );
    const hybridMundane = applyNatureContextToHybridPicks(
      database,
      hybridDice.mundaneItems,
      tags,
      rng,
    );
    mundaneRows.push(...hybridMundane);
    for (const row of hybridDice.magicItems) {
      pushMagic(/** @type {Record<string, unknown>} */ (row));
    }
  }

  if (chestCount === 0) {
    const ind = generateIndividualTreasureLoot(database, {
      totalCr: crLoot,
      categories,
      excludeCommonMagic: onlyMagic,
      caveGemBias: caveBias,
      rng,
      includeCoins: true,
      partyLevel,
      playerCount,
    });
    if (ind.coinsApproxGp != null) {
      totalGoldGp += applyGoldJitter(ind.coinsApproxGp);
      anyGold = true;
    }
    mundaneRows.push(...ind.mundaneItems);
    for (const row of ind.magicItems) {
      pushMagic(/** @type {Record<string, unknown>} */ (row));
    }
    runHybridForChest(false);
  } else {
    for (let c = 0; c < chestCount; c += 1) {
      const h = generateTreasureHoardLoot(database, {
        totalCr: crLoot,
        goldLimitGp: null,
        categories,
        includeCoins: true,
        includeMundane: false,
        treasureChest: true,
        excludeCommonMagic: onlyMagic,
        caveGemBias: caveBias,
        rng,
        partyLevel,
        playerCount,
      });
      if (h.coinsApproxGp != null) {
        totalGoldGp += applyGoldJitter(h.coinsApproxGp);
        anyGold = true;
      }
      mundaneRows.push(...h.mundaneItems);
      for (const row of h.magicItems) {
        pushMagic(/** @type {Record<string, unknown>} */ (row));
      }
      /* Сундук-hoard при treasureChest не даёт «бытовой» немагики — её даёт гибрид-кости; skipMundane нельзя включать. */
      runHybridForChest(false);
    }
  }

  for (let i = mundaneRows.length - 1; i >= 0; i -= 1) {
    if (isAdventuringPackExcluded(/** @type {Record<string, unknown>} */ (mundaneRows[i]))) {
      mundaneRows.splice(i, 1);
    }
  }
  if (magicRows.length === 0 && chestCount > 0) {
    totalGoldGp = Math.round(totalGoldGp * 1.25);
    anyGold = totalGoldGp > 0;
  }

  /* 0 сундуков: при полном «промахе» d100 — не оставляем отчёт из одних «—» (до обрезки по капу богатства). */
  if (chestCount === 0 && mundaneRows.length === 0 && magicRows.length === 0) {
    if (!anyGold || totalGoldGp <= 0) {
      const c = approximateIndividualCoinsGp(database, crLoot, rng);
      totalGoldGp = applyGoldJitter(c);
      anyGold = totalGoldGp > 0;
    }
    const rescue = pickMundaneHoardItems(database, 2, categories, rng, {
      caveGemBias: caveBias,
      qualityTargetCr: crLoot,
    });
    for (const r of rescue) {
      if (!isAdventuringPackExcluded(r)) {
        mundaneRows.push(r);
        break;
      }
    }
  }

  const wealthCap = partyTreasureSoftCapGp(partyLevel, playerCount);
  const clippedLoot = clipLootTotalsToWealthCap(magicRows, mundaneRows, totalGoldGp, wealthCap);
  magicRows.splice(0, magicRows.length, ...clippedLoot.magic);
  mundaneRows.splice(0, mundaneRows.length, ...clippedLoot.mundane);
  if (clippedLoot.coins != null) {
    totalGoldGp = clippedLoot.coins;
    anyGold = clippedLoot.coins > 0;
  }

  const goldLine = anyGold ? `~${totalGoldGp} зм` : '—';
  const mundaneLines = mundaneRows.map((row) =>
    formatLootItemOneLiner(database, formatItemLoot(/** @type {Record<string, unknown>} */ (row), database)),
  );
  const mundaneLine = mundaneLines.length > 0 ? mundaneLines.join('; ') : '—';
  const magicLines = magicRows.map((row) =>
    formatLootItemOneLiner(database, formatItemLoot(/** @type {Record<string, unknown>} */ (row), database)),
  );
  const magicLine = magicLines.length > 0 ? magicLines.join('; ') : '—';

  const labGold = translate(database, 'loot.gold', 'ui');
  const labItems = translate(database, 'loot.items', 'ui');
  const labMagic = translate(database, 'loot.magic', 'ui');

  return {
    partyLevel,
    playerCount,
    difficultyRaw,
    environment,
    encTotalCr: enc.totalCr,
    crLoot,
    chestCount,
    totalGoldGp,
    anyGold,
    mundaneRows,
    magicRows,
    mundaneLines,
    magicLines,
    goldLine,
    mundaneLine,
    magicLine,
    labGold,
    labItems,
    labMagic,
  };
}

function formatLootOnlyMarkdownReport(database, opts) {
  const d = buildLootOnlyDataset(database, opts);
  return [
    `# ${MD_BRAND} — Результат поиска сокровищ`,
    '',
    `**${d.labGold}:** ${d.goldLine}`,
    '',
    `**${d.labItems}:** ${d.mundaneLine}`,
    '',
    `**${d.labMagic}:** ${d.magicLine}`,
    '',
  ].join('\n');
}

/**
 * Лут «по карте сцены»: полки, столы, закопки — из шаблонов `data/scene-loot-templates.json` и таблицы `items`.
 *
 * @param {import('better-sqlite3').Database} database
 * @param {object} [opts]
 * @param {string} [opts.environmentKey] биом UI (`forest`, `dungeon`, …) — фильтр шаблонов
 * @param {number} [opts.stashCount] сколько разных точек сгенерировать (1–8, по умолчанию 3)
 * @param {() => number} [opts.rng]
 * @returns {string}
 */
export function formatSceneLootMarkdownReport(database, opts = {}) {
  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
  const env = String(opts.environmentKey ?? opts.environment ?? 'any').toLowerCase();
  const stashCount = Number(opts.stashCount);
  const stashes = generateSceneStashes(database, {
    environmentKey: env,
    stashCount: Number.isFinite(stashCount) ? stashCount : 3,
    rng,
  });
  /** @type {string[]} */
  const lines = [
    `# ${MD_BRAND} — Лут по сцене`,
    '',
    '_Находки на мебели, в нишах и под предметами (не сундук и не трофей с тела). Можно читать вслух при осмотре._',
    '',
  ];
  if (stashes.length === 0) {
    lines.push(
      '_(Нет шаблонов для выбранного биома — в `scene-loot-templates.json` добавьте `any` в `biomes` или новые шаблоны.)_',
      '',
    );
    return lines.join('\n');
  }
  let n = 1;
  for (const { template, picks } of stashes) {
    const hidden = template.hidden ? ' _(скрыто)_' : '';
    lines.push(`## ${n}. ${template.titleRu}${hidden}`, '');
    if (template.sceneRu) {
      lines.push(`_${String(template.sceneRu)}_`, '');
    }
    for (const p of picks) {
      if (p.skipped) {
        lines.push(`- **${p.labelRu}:** _(пусто — не нашли или не стали искать)_`);
        continue;
      }
      if (!p.row) {
        lines.push(
          `- **${p.labelRu}:** _(под фильтр шаблона не подошёл ни один предмет в SQLite — ослабьте \`nameContainsAny\` в JSON)_`,
        );
        continue;
      }
      const piece = formatItemLoot(/** @type {Record<string, unknown>} */ (p.row), database);
      lines.push(`- **${p.labelRu}:** ${formatLootItemOneLiner(database, piece)}`);
    }
    lines.push('', '---', '');
    n += 1;
  }
  return lines.join('\n').trimEnd();
}

/**
 * Полный отчёт: XP-бюджет DMG 2024 → монстры из SQLite → сокровищница по суммарному CR → гибрид по gp.
 *
 * @param {import('better-sqlite3').Database} database
 * @param {object} opts
 * @param {number} opts.partyLevel 1–20
 * @param {number} opts.playerCount
 * @param {string} opts.difficulty low|moderate|high (или legacy easy/medium/hard/deadly)
 * @param {string} opts.environment forest|cave|dungeon|urban|coastal|arctic|swamp|any
 * @param {number} opts.goldLimitGp
 * @param {string[]} [opts.categories]
 * @param {boolean} [opts.onlyMagic] только Uncommon+ для магии в SQL
 * @param {boolean} [opts.lootOnly] только золото / предметы / магия (экран «Генератор лута»)
 * @param {number} [opts.chestCount] при lootOnly — число отдельных hoard-бросков
 * @param {() => number} [opts.rng]
 * @param {boolean} [opts.debugSql] — лог SQL и CR в `lootSqlDebug`
 */
export function formatEncounterAndLootMarkdownReport(database, opts) {
  const lootOnly = Boolean(opts.lootOnly);
  if (lootOnly) {
    return formatLootOnlyMarkdownReport(database, opts);
  }

  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
  const partyLevel = Math.min(20, Math.max(1, Math.floor(Number(opts.partyLevel) || 1)));
  const playerCount = Math.min(12, Math.max(1, Math.floor(Number(opts.playerCount) || 4)));
  const difficultyRaw = String(opts.difficulty ?? 'moderate');
  const environment = String(opts.environment || 'any').toLowerCase();
  const goldLimitGp = Number(opts.goldLimitGp);
  const categories = Array.isArray(opts.categories)
    ? opts.categories.map((x) => String(x)).filter((s) => s.length > 0)
    : [];
  const onlyMagic = Boolean(opts.onlyMagic);

  const enc = buildEncounterFromDatabase(database, {
    partyLevel,
    playerCount,
    difficulty: difficultyRaw,
    environment,
    rng,
    environmentExtraText: String(opts.environmentExtraText ?? opts.environmentText ?? ''),
    worldState: normalizeWorldState(opts.worldState) ?? undefined,
    nextEncounterHint: String(opts.nextEncounterHint ?? ''),
  });

  const tags = dominantCreatureTagsFromRoster(enc.roster);
  const crLoot = resolveTreasureCrNumeric(database, partyLevel, enc.totalCr);
  if (opts.debugSql) {
    dbgLootSql('encounter_loot', 'resolveTreasureCrNumeric', {
      partyLevel,
      encounterTotalCr: enc.totalCr,
      crLoot,
    });
  }

  const caveBias = environment === 'cave' ? 0.62 : environment === 'dungeon' ? 0.22 : 0.1;

  const hoard = generateTreasureHoardLoot(database, {
    totalCr: crLoot,
    goldLimitGp: null,
    categories,
    includeCoins: true,
    includeMundane: true,
    excludeCommonMagic: onlyMagic,
    caveGemBias: caveBias,
    rng,
    partyLevel,
    playerCount,
  });

  const gpCap = Number.isFinite(goldLimitGp) && goldLimitGp > 0 ? goldLimitGp : 200;
  let hybrid = generateLootHybrid(database, gpCap, crLoot, categories, rng, onlyMagic);
  const adjustedPicks = applyNatureContextToHybridPicks(database, hybrid.picks, tags, rng);

  const spellRow = fetchAtmosphereSpell(database);
  const spellPiece = spellRow
    ? formatSpellSnippet(/** @type {Record<string, unknown>} */ (spellRow))
    : {
        kind: 'lore',
        name: 'Атмосфера',
        content: '_(в БД нет подходящего заклинания для вставки)._',
      };

  const diffRu = difficultyLabelRu(difficultyRaw);
  const envRu = environmentLabelRu(
    /** @type {import('./lib/encounter-build.mjs').EncounterEnvironmentKey} */ (environment),
  );

  /** @type {string[]} */
  const lines = [];

  const enemySummary = enc.roster.length
    ? enc.roster
        .map((e) => `${formatMonsterDisplayNameRuEn(database, String(e.row.name ?? ''))} ×${e.count}`)
        .join(', ')
    : '—';

  lines.push(`# ${MD_BRAND} — Встреча и лут (SRD SQLite · D&D 5.5)`, '');
  lines.push('---', '');
  if (enc.worldStateLabel) {
    lines.push(`**Состояние мира:** ${enc.worldStateLabel}`, '');
  }
  lines.push(`**Тип встречи:** ${enc.archetypeLabel ?? '—'}`, '');
  lines.push(`**Тактика (манёвры):** ${enc.flavourText ?? '—'}`, '');
  if (enc.narrative && typeof enc.narrative === 'object') {
    const n = /** @type {Record<string, unknown>} */ (enc.narrative);
    if (n.encounterEcologyTactics) {
      lines.push(
        `**Экология отряда (${String(n.encounterRoleLabelRu ?? enc.encounterRoleLabelRu ?? '—')}):** ${n.encounterEcologyTactics}`,
        '',
      );
    }
    if (n.battlefieldHeightSummary) {
      lines.push(`**Полигон (3D):** ${n.battlefieldHeightSummary}`, '');
    }
    if (n.environmentalHazardLine) {
      lines.push(`**Архитектурная опасность:** ${n.environmentalHazardLine}`, '');
    }
    if (n.darknessCombatNote) {
      lines.push(`**Тьма / слух:** ${n.darknessCombatNote}`, '');
    }
    if (n.battleCry) lines.push(`**Боевой клич:** ${n.battleCry}`, '');
    if (n.morale) lines.push(`**Мораль:** ${n.morale}`, '');
    if (n.interactable) lines.push(`**Окружение (интерактив):** ${n.interactable}`, '');
    if (n.stormEnvironmentNote) lines.push(`**Буря (эффект):** ${n.stormEnvironmentNote}`, '');
    if (n.npcInventoryNote) lines.push(`**Деталь NPC:** ${n.npcInventoryNote}`, '');
    if (n.encounterTrace) {
      lines.push(`> **След (после боя):** ${n.encounterTrace}`, '');
    }
    if (n.legendarySolo) {
      lines.push(
        '_**Legendary (экономия действий):** один враг против группы — усилен под бюджет XP; добавьте legendary actions по вкусу._',
        '',
      );
    }
    const fm = n.firstMoves;
    if (Array.isArray(fm) && fm.length) {
      lines.push('**Первый ход (подсказки мастеру):**', ...fm.map((t) => `- ${t}`), '');
    }
  }
  lines.push('---', '');
  lines.push(
    `**Битва для группы ${partyLevel} уровня (${diffRu}).** Игроков: ${playerCount}. **Враги:** ${enemySummary}. **Окружение:** ${envRu}.`,
    '',
  );
  lines.push(
    `- **Бюджет XP (DMG 2024, сумма без множителя за число монстров):** ${enc.budgetXp}`,
    `- **Набрано XP:** ~${enc.actualXp}`,
    `- **Суммарный CR для сокровищ:** ${crLoot.toFixed(2)}`,
    `- **Типы в встрече:** ${formatCreatureTagsLocalized(database, tags)}`,
    `- **Только магия не-Common (SQL):** ${onlyMagic ? 'да' : 'нет'}`,
    '',
    '---',
    '',
  );

  lines.push('## Враги', '');
  if (enc.roster.length === 0) {
    lines.push('_Не удалось собрать монстров из БД._', '');
  } else {
    for (const { row, count, injured, isLegendarySolo, leaderVisualTrait } of enc.roster) {
      const piece = /** @type {Record<string, unknown>} */ (formatMonsterLoot(row));
      const heading = formatMonsterHeadingRuEnCr(
        database,
        String(piece.name ?? ''),
        formatMonsterCrDisplay(row),
      );
      lines.push(`### ${heading} ×${count}`, '');
      lines.push(formatMonsterSection(piece, database, row, rng, enc.encounterRole), '');
      if (injured) {
        lines.push(
          '',
          '_**Ранение:** начало боя с ~70% HP; ведёт себя агрессивнее (на усмотрение Мастера)._',
        );
      }
      if (isLegendarySolo) {
        lines.push('', '_**Legendary:** усилен для баланса «1 против многих»._');
      }
      if (leaderVisualTrait) {
        lines.push('', `**Визуальная черта лидера:** _${leaderVisualTrait}_`);
      }
      lines.push('', '---', '');
    }
  }

  lines.push('## Атмосфера', '');
  lines.push(formatLoreSection(/** @type {Record<string, unknown>} */ (spellPiece)), '', '---', '');

  lines.push('## 💎 **Сокровищница** (The Hoard — масштаб по суммарному CR)', '');
  lines.push(
    `- **План по CR (d100 магия):** маг. слотов ≈ ${hoard.rollPlan.magicItemRolls}${
      hoard.rollPlan.magicRarityBuckets?.length
        ? ` · редкости: ${hoard.rollPlan.magicRarityBuckets.map((rb) => translateItemRarityForReport(database, rb)).join('/')}`
        : ''
    }, обычные предметы ≈ ${hoard.rollPlan.mundanePicks}, монеты (пакеты) ≈ ${hoard.rollPlan.coinBundleRolls}.`,
    '',
  );
  const hoardCoinsAdj = applyHoardGoldFloor(hoard.coinsApproxGp, partyLevel, rng);
  const hoardUltraEnc = generateHoard(rng() < 0.06 ? 'desecrated' : 'normal', crLoot, hoardCoinsAdj.gp, rng);
  lines.push(`- **Монеты (ZERNIX Legacy Loot Ultra):** ${hoardUltraEnc.currencyFlavorLine}`, '');
  if (hoardUltraEnc.greedCurseLine) {
    lines.push(`- ${hoardUltraEnc.greedCurseLine}`, '');
  }
  let hi = 1;
  for (const row of hoard.magicItems) {
    const piece = formatItemLoot(/** @type {Record<string, unknown>} */ (row), database);
    lines.push(`### Сокровище: магия ${hi}`, '', formatItemSection(piece, database), '');
    const quirks = magicItemQuirk(piece, rng);
    if (quirks.markdownBlock) {
      lines.push(quirks.markdownBlock, '');
    }
    lines.push('---', '');
    hi += 1;
  }
  // Гарантия: если CR 5+ и магические предметы не выпали — добавляем минимум
  if (hoard.magicItems.length === 0 && crLoot >= 5) {
    const fallback = guaranteeHoardFallbackItems(crLoot, rng);
    if (fallback.length) {
      lines.push('### Гарантированный лут (магия не выпала)', '');
      for (const fl of fallback) lines.push(`- ${fl}`);
      lines.push('');
    }
  }
  let mi = 1;
  for (const row of hoard.mundaneItems) {
    const piece = formatItemLoot(/** @type {Record<string, unknown>} */ (row), database);
    lines.push(`### Сокровище: прочее ${mi}`, '', formatItemSection(piece, database), '', '---', '');
    mi += 1;
  }

  lines.push('## Доп. магический лут (лимит gp, гибрид)', '');
  lines.push(
    `- **Лимит золота (зм):** ${gpCap}`,
    `- **Фильтр категорий:** ${categories.length ? categories.join(', ') : 'все'}`,
    `- **Ярус / смещение:** ${hybrid.tier} · ${
      hybrid.bias_rarities.length
        ? hybrid.bias_rarities.map((x) => translateItemRarityForReport(database, x)).join(', ')
        : '—'
    }`,
    '',
  );
  if (!adjustedPicks.length) {
    lines.push('_Под гибрид не подобрано предметов (проверьте лимит gp и таблицу encounters)._', '');
  } else {
    for (let idx = 0; idx < adjustedPicks.length; idx += 1) {
      const piece = formatItemLoot(/** @type {Record<string, unknown>} */ (adjustedPicks[idx]), database);
      lines.push(`### Гибрид №${idx + 1}`, '', formatItemSection(piece, database), '');
      const quirks = magicItemQuirk(piece, rng);
      if (quirks.markdownBlock) {
        lines.push(quirks.markdownBlock, '');
      }
      lines.push('---', '');
    }
  }

  return lines.join('\n');
}

/**
 * @param {Array<{ row: Record<string, unknown>, count: number }>} roster
 * @returns {'goblin'|'orc'|null}
 */
function detectTribalFromRoster(roster) {
  for (const { row } of roster) {
    const blob = `${String(row.name ?? '')} ${String(row.type_line ?? '')}`.toLowerCase();
    if (/\bgoblin\b/.test(blob)) return 'goblin';
    if (/\borc\b/.test(blob)) return 'orc';
  }
  return null;
}

/**
 * Склонение «гоблин» в имени (первое вхождение) для фразы «N гоблин/гоблина/гоблинов».
 * @param {string} nameRu
 * @param {number} n
 */
function applyGoblinDeclensionInNameRu(nameRu, n) {
  const mod100 = n % 100;
  const mod10 = n % 10;
  /** @type {'гоблин'|'гоблина'|'гоблинов'} */
  let form = 'гоблинов';
  if (mod10 === 1 && mod100 !== 11) form = 'гоблин';
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) form = 'гоблина';
  let done = false;
  return nameRu.replace(/гоблин/gi, (m) => {
    if (done) return m;
    done = true;
    const cap = /^[А-ЯЁA-Z]/.test(m);
    const w = cap ? form.charAt(0).toUpperCase() + form.slice(1) : form;
    return w;
  });
}

/**
 * «N Имя» без ×; для прочих существительных — число + имя из локализации как в БД.
 * @param {number} n
 * @param {string} nameRu
 */
function ruMeetCreatureCountPhrase(n, nameRu) {
  const count = Math.max(1, Math.floor(Number(n) || 1));
  if (nameRu.toLowerCase().includes('гоблин')) {
    return `${count} ${applyGoblinDeclensionInNameRu(nameRu, count)}`;
  }
  return `${count} ${nameRu}`;
}

/**
 * @param {import('better-sqlite3').Database} database
 * @param {Array<{ row: Record<string, unknown>, count: number }>} roster
 */
function formatSquadMeetLineRu(database, roster) {
  if (!roster.length) {
    return '';
  }
  /** @type {Map<string, number>} */
  const merged = new Map();
  for (const { row, count } of roster) {
    const enName = String(row.name ?? '');
    const crDisp = formatMonsterCrDisplay(row);
    const k = `${enName}\0${crDisp}`;
    merged.set(k, (merged.get(k) ?? 0) + count);
  }
  const parts = [];
  for (const [k, c] of merged) {
    const [enName, crDisp] = k.split('\0');
    const disp = formatMonsterDisplayNameRuEn(database, enName);
    parts.push(`${ruMeetCreatureCountPhrase(c, disp)} (CR ${crDisp})`);
  }
  return `**Вы встретили:** ${parts.join(' и ')}.`;
}

/**
 * «Подготовка сессии»: отряды по XP-бюджету + сундуки как отдельные сокровищницы по CR + грубое снаряжение орков/гоблинов.
 *
 * @param {import('better-sqlite3').Database} database
 * @param {object} opts
 * @param {number} opts.partyLevel
 * @param {number} opts.playerCount
 * @param {string} opts.difficulty
 * @param {number} opts.packCount групп монстров (отрядов)
 * @param {number} opts.chestCount сундуков — каждый = полный набор hoard по CR
 * @param {string} opts.environmentText свободное описание
 * @param {string} [opts.environmentKey] явный биом: cave|forest|dungeon|urban|any (имеет приоритет над выводом из текста)
 * @param {boolean} [opts.onlyMagic]
 * @param {() => number} [opts.rng]
 * @param {'day'|'night'|'storm'} [opts.worldState] состояние мира для тактики и окружения (иначе случайный бросок на отчёт)
 * @param {string} [opts.nextEncounterHint] подсказка для поля «След (после боя)»
 * @param {{
 *   floorDepth?: number,
 *   persistentTags?: string[],
 *   difficultyBias?: number,
 *   previousTraceForHeader?: string|null,
 *   transitionMarkdown?: string|null,
 * }} [opts.dungeonSession] память подземелья (ZERNIX NEXUS)
 * @param {string} [opts.hoardOrigin] `desecrated` | `normal` — для ZERNIX Legacy Loot Ultra (иначе ~6% случайного осквернения)
 */
export function formatSessionPrepMarkdownReport(database, opts) {
  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
  const hoardOriginOpt =
    typeof /** @type {*} */ (opts).hoardOrigin === 'string'
      ? String(/** @type {*} */ (opts).hoardOrigin).trim()
      : '';
  const sessionWorldState = normalizeWorldState(opts.worldState) ?? rollWorldState(rng);
  const sessionWorldLabel = formatWorldStateLabelRuEn(sessionWorldState);
  const nextTraceHint = String(opts.nextEncounterHint ?? '');
  const dsRaw = opts.dungeonSession;
  const dungeonSession =
    dsRaw != null && typeof dsRaw === 'object'
      ? {
          floorDepth: Math.max(0, Math.floor(Number(/** @type {*} */ (dsRaw).floorDepth) || 0)),
          persistentTags: Array.isArray(/** @type {*} */ (dsRaw).persistentTags)
            ? /** @type {string[]} */ (/** @type {*} */ (dsRaw).persistentTags)
                .map((x) => String(x).trim().toLowerCase())
                .filter((s) => s.length > 0)
            : [],
          difficultyBias: Math.max(0, Number(/** @type {*} */ (dsRaw).difficultyBias) || 0),
          previousTraceForHeader:
            /** @type {*} */ (dsRaw).previousTraceForHeader != null
              ? String(/** @type {*} */ (dsRaw).previousTraceForHeader)
              : null,
          transitionMarkdown:
            /** @type {*} */ (dsRaw).transitionMarkdown != null &&
            String(/** @type {*} */ (dsRaw).transitionMarkdown).trim().length > 0
              ? String(/** @type {*} */ (dsRaw).transitionMarkdown).trim()
              : null,
        }
      : null;

  const partyLevel = Math.min(20, Math.max(1, Math.floor(Number(opts.partyLevel) || 1)));
  const playerCount = Math.min(12, Math.max(1, Math.floor(Number(opts.playerCount) || 4)));
  const difficultyRaw = String(opts.difficulty ?? 'moderate');
  const packCount = Math.max(0, Math.min(24, Math.floor(Number(opts.packCount) || 0)));
  const chestCount = Math.max(0, Math.min(24, Math.floor(Number(opts.chestCount) || 0)));
  const environmentText = String(opts.environmentText ?? '');
  const onlyMagic = Boolean(opts.onlyMagic);

  const { fragments, tribal } = analyzeSessionPrepDescription(environmentText);
  const explicitEnv = String(opts.environmentKey ?? '')
    .trim()
    .toLowerCase();
  const allowedEnv = new Set([
    'any',
    'cave',
    'forest',
    'dungeon',
    'urban',
    'coastal',
    'arctic',
    'swamp',
    'mountain',
    'crypt',
  ]);
  let envKey = /** @type {import('./lib/encounter-build.mjs').EncounterEnvironmentKey} */ ('any');
  if (explicitEnv && allowedEnv.has(explicitEnv)) {
    envKey = /** @type {import('./lib/encounter-build.mjs').EncounterEnvironmentKey} */ (explicitEnv);
  }

  const diffRu = difficultyLabelRu(difficultyRaw);
  const envRu = environmentLabelRu(envKey);

  /** @type {string[]} */
  const lines = [];

  lines.push(`# ${MD_BRAND} — Подготовка сессии (SRD SQLite · D&D 5.5)`, '');
  lines.push(
    `**Группа:** ${partyLevel} уровень, **игроков:** ${playerCount}, **сложность встреч:** ${diffRu}. **Локация (выпадающий список → SQLite):** ${envRu}. **Состояние мира:** ${sessionWorldLabel}. **Доп. текст окружения (фильтр по подстрокам, опционально):** ${environmentText.trim() || '—'}`,
    '',
  );
  if (dungeonSession) {
    const skulls = renderThreatSkulls(dungeonSession.floorDepth);
    lines.push(
      `> **[ ПОДЗЕМЕЛЬЕ: УРОВЕНЬ ${dungeonSession.floorDepth} ]**`,
      `> **Угроза:** ${skulls} _(чем глубже, тем плотнее зло)_`,
      dungeonSession.previousTraceForHeader
        ? `> **Контекст:** Предыдущий след — *"${dungeonSession.previousTraceForHeader}"*`
        : '> **Контекст:** _первая комната — следа ещё нет_',
      dungeonSession.difficultyBias > 0
        ? `> **Напряжение:** Сложность повышена! (бюджет XP +${Math.round(dungeonSession.difficultyBias * 100)}%)`
        : '> **Напряжение:** Стандартно',
      '',
    );
    if (dungeonSession.transitionMarkdown) {
      lines.push(`_${dungeonSession.transitionMarkdown}_`, '');
    }
    lines.push('---', '');
  }
  /** @type {string[]} */
  const filterLines = [
    `- **Ключевые фильтры монстров (по тексту):** ${fragments.length ? fragments.join(', ') : '_(нет)_'}`,
    `- **Биом для запросов к SQLite:** ${envRu} (\`${envKey}\`)`,
  ];
  if (dungeonSession?.persistentTags?.length) {
    filterLines.push(`- **Память подземелья (теги отряда):** ${dungeonSession.persistentTags.join(', ')}`);
  }
  lines.push(...filterLines, '', '---', '');

  const envUltra = generateEnvironmentLoot(environmentText, dungeonSession?.floorDepth ?? 0, rng);
  lines.push(...envUltra.markdownLines, '---', '');

  /** @type {number} */
  let maxSquadCr = 0;
  const squads = [];

  for (let p = 1; p <= packCount; p += 1) {
    const enc = buildEncounterFromDatabase(database, {
      partyLevel,
      playerCount,
      difficulty: difficultyRaw,
      environment: envKey,
      keywordFragments: fragments,
      rng,
      environmentExtraText: environmentText,
      worldState: sessionWorldState,
      nextEncounterHint: nextTraceHint,
      persistentMonsterTags: dungeonSession?.persistentTags ?? [],
      dungeonXpBudgetMultiplier: dungeonSession?.difficultyBias ?? 0,
      floorDepth: dungeonSession?.floorDepth ?? 0,
    });
    maxSquadCr = Math.max(maxSquadCr, enc.totalCr);
    squads.push(enc);
  }

  const effectiveHoardCr = resolveTreasureCrNumeric(
    database,
    partyLevel,
    maxSquadCr > 0 ? maxSquadCr : partyLevel / 4,
  );
  const caveBias = envKey === 'cave' ? 0.62 : envKey === 'dungeon' ? 0.22 : 0.12;

  /** @type {Set<string>} */
  const sessionCreatureTags = new Set();
  for (const enc of squads) {
    for (const t of dominantCreatureTagsFromRoster(enc.roster)) {
      sessionCreatureTags.add(t);
    }
  }

  lines.push('## Отряды монстров', '');
  if (packCount === 0) {
    lines.push('_Группы монстров не запрошены (число = 0)._', '', '---', '');
  } else {
    for (let i = 0; i < squads.length; i += 1) {
      const enc = squads[i];
      const meetLine = formatSquadMeetLineRu(database, enc.roster);
      const enemySummary = enc.roster.length
        ? enc.roster
            .map((e) => `${formatMonsterDisplayNameRuEn(database, String(e.row.name ?? ''))} ×${e.count}`)
            .join(', ')
        : '—';
      lines.push(
        `### Отряд ${i + 1}`,
        '',
        '---',
        '',
        `**Тип встречи:** ${enc.archetypeLabel ?? '—'}`,
        '',
        `**Тактика (манёвры):** ${enc.flavourText ?? '—'}`,
        '',
      );
      if (enc.narrative && typeof enc.narrative === 'object') {
        const n = /** @type {Record<string, unknown>} */ (enc.narrative);
        if (n.encounterEcologyTactics) {
          lines.push(
            `**Экология отряда (${String(n.encounterRoleLabelRu ?? enc.encounterRoleLabelRu ?? '—')}):** ${n.encounterEcologyTactics}`,
            '',
          );
        }
        if (n.battlefieldHeightSummary) {
          lines.push(`**Полигон (3D):** ${n.battlefieldHeightSummary}`, '');
        }
        if (n.environmentalHazardLine) {
          lines.push(`**Архитектурная опасность:** ${n.environmentalHazardLine}`, '');
        }
        if (n.darknessCombatNote) {
          lines.push(`**Тьма / слух:** ${n.darknessCombatNote}`, '');
        }
        if (n.battleCry) lines.push(`**Боевой клич:** ${n.battleCry}`, '');
        if (n.morale) lines.push(`**Мораль:** ${n.morale}`, '');
        if (n.interactable) lines.push(`**Окружение (интерактив):** ${n.interactable}`, '');
        if (n.stormEnvironmentNote) lines.push(`**Буря (эффект):** ${n.stormEnvironmentNote}`, '');
        if (n.npcInventoryNote) lines.push(`**Деталь NPC (руки / мелочь):** ${n.npcInventoryNote}`, '');
        if (n.encounterTrace) {
          lines.push(`> **След (после боя):** ${n.encounterTrace}`, '');
        }
        if (n.legendarySolo) {
          lines.push(
            '_**Legendary:** один враг против группы — CR подобран жёстче под экономику действий._',
            '',
          );
        }
        const fm = n.firstMoves;
        if (Array.isArray(fm) && fm.length) {
          lines.push('**Первый ход (мастеру):**', ...fm.map((t) => `- ${t}`), '');
        }
      }
      lines.push('---', '');
      lines.push(
        meetLine || `**Состав:** ${enemySummary}`,
        '',
        `- **Бюджет XP (таблица DMG 2024 × игроков, из SQLite):** ${enc.budgetXp}`,
        `- **Набрано XP (сумма xp монстров из таблицы monsters):** ~${enc.actualXp}`,
        `- **Суммарный CR отряда:** ${enc.totalCr.toFixed(2)}`,
        '',
      );
      if (enc.roster.length === 0) {
        lines.push('_Пусто — проверьте фильтры или базу._', '', '---', '');
        continue;
      }
      for (const { row, count, injured, isLegendarySolo, leaderVisualTrait } of enc.roster) {
        const piece = /** @type {Record<string, unknown>} */ (formatMonsterLoot(row));
        const heading = formatMonsterHeadingRuEnCr(
          database,
          String(piece.name ?? ''),
          formatMonsterCrDisplay(row),
        );
        lines.push(
          `#### ${heading} ×${count}`,
          '',
          formatMonsterSection(piece, database, row, rng, enc.encounterRole),
          '',
        );
        if (injured) {
          lines.push(
            '_**Ранение:** ~70% HP в начале боя; агрессивнее._',
            '',
          );
        }
        if (isLegendarySolo) {
          lines.push('_**Legendary:** усилен под «один против группы»._', '');
        }
        if (leaderVisualTrait) {
          lines.push(`**Черта лидера:** _${leaderVisualTrait}_`, '');
        }
      }
      lines.push('---', '');
    }
  }

  let tribalKind = tribal;
  if (!tribalKind && squads.length) {
    for (const enc of squads) {
      const t = detectTribalFromRoster(enc.roster);
      if (t) {
        tribalKind = t;
        break;
      }
    }
  }
  if (tribalKind) {
    const gearRows = pickTribalRusticGear(database, tribalKind, 4, rng);
    lines.push(`## Грубое / самодельное снаряжение (${tribalKind === 'orc' ? 'орки' : 'гоблины'} — выборка из items в SQLite)`, '');
    if (!gearRows.length) {
      lines.push('_В БД не найдено подходящих немагических предметов._', '');
    } else {
      for (const row of gearRows) {
        const piece = formatItemLoot(/** @type {Record<string, unknown>} */ (row), database);
        lines.push(`### ${piece.name}`, '', formatItemSection(piece, database), '', '---', '');
      }
    }
    lines.push('');
  }

  lines.push('## 💎 **Сокровищница** (The Hoard) — сундуки по CR', '');
  lines.push(
    `_Каждый сундук — отдельный набор по правилам hoard: эффективный CR **${effectiveHoardCr.toFixed(2)}** (макс. CR среди отрядов или уровень/4)._`,
    '',
    '_Здесь **не** действуют фильтры типов предметов с экрана «Генератор лута» — в сундук попадают все немагические категории из таблиц (включая ремесло: свитки писца, материалы и т.п.) и магия по CR._',
    '',
    '_**ZERNIX Legacy Loot Ultra:** валюта описана разнообразно; редкая куча может быть **осквернена** (проклятие жадности)._',
    '',
  );
  if (chestCount === 0) {
    lines.push('_Сундуки не запрошены._', '');
  }
  for (let c = 1; c <= chestCount; c += 1) {
    const hoard = generateTreasureHoardLoot(database, {
      totalCr: effectiveHoardCr,
      goldLimitGp: null,
      categories: [],
      includeCoins: true,
      includeMundane: true,
      treasureChest: false,
      excludeCommonMagic: onlyMagic,
      caveGemBias: caveBias,
      rng,
      partyLevel,
      playerCount,
    });
    const mundaneForChest = applyNatureContextToHybridPicks(
      database,
      hoard.mundaneItems,
      sessionCreatureTags,
      rng,
    );
    const hoardCoins = applyHoardGoldFloor(hoard.coinsApproxGp, partyLevel, rng);
    const hoardOrigin =
      hoardOriginOpt ||
      (rng() < 0.06 ? 'desecrated' : 'normal');
    const hoardUltra = generateHoard(hoardOrigin, effectiveHoardCr, hoardCoins.gp, rng);
    lines.push(`### Сундук ${c}`, '');
    lines.push(`- **Монеты (оценка, ZERNIX Ultra):** ${hoardUltra.currencyFlavorLine}`, '');
    if (hoardUltra.greedCurseLine) {
      lines.push(`- ${hoardUltra.greedCurseLine}`, '');
    }
    let mi = 1;
    for (const row of hoard.magicItems) {
      const piece = formatItemLoot(/** @type {Record<string, unknown>} */ (row), database);
      lines.push(`#### Магия ${mi}`, '', formatItemSection(piece, database), '');
      const quirks = magicItemQuirk(piece, rng);
      if (quirks.markdownBlock) {
        lines.push(quirks.markdownBlock, '');
      }
      mi += 1;
    }
    // Гарантия: если CR 5+ и магические предметы не выпали
    if (hoard.magicItems.length === 0 && effectiveHoardCr >= 5) {
      const fallback = guaranteeHoardFallbackItems(effectiveHoardCr, rng);
      if (fallback.length) {
        lines.push('**⚠ Гарантированный лут (магия не выпала):**', '');
        for (const fl of fallback) lines.push(`- ${fl}`);
        lines.push('');
      }
    }
    let ni = 1;
    for (const row of mundaneForChest) {
      const piece = formatItemLoot(/** @type {Record<string, unknown>} */ (row), database);
      lines.push(`#### Прочее ${ni}`, '', formatItemSection(piece, database), '');
      ni += 1;
    }
    lines.push('---', '');
  }

  lines.push(
    '_Лут NPC из JSON и заклинания атмосферы можно добавить отдельно в интерфейсе приложения._',
    '',
  );

  let primaryEncounterTrace = '';
  if (squads.length > 0 && squads[0].narrative && typeof squads[0].narrative === 'object') {
    const tr = /** @type {Record<string, unknown>} */ (squads[0].narrative).encounterTrace;
    if (tr != null) primaryEncounterTrace = String(tr);
  }
  const chainTagsFromPrimaryTrace = primaryEncounterTrace
    ? extractTagsFromTrace(primaryEncounterTrace)
    : [];
  const scoutAlarmNextRoomXpBonus =
    squads.length > 0 ? Number(/** @type {*} */ (squads[0]).scoutAlarmXpBonusNextRoom) || 0 : 0;

  return {
    markdown: lines.join('\n'),
    meta: {
      primaryEncounterTrace,
      chainTagsFromPrimaryTrace,
      floorDepthEcho: dungeonSession?.floorDepth ?? 0,
      scoutAlarmNextRoomXpBonus,
    },
  };
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {'orc'|'goblin'} tribal
 * @param {number} count
 * @param {() => number} rng
 */
function pickTribalRusticGear(db, tribal, count, rng) {
  void rng;
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];
  const tribalSql =
    tribal === 'orc'
      ? `(instr(lower(ifnull(i.name,'')),'orc') > 0 OR instr(lower(ifnull(i.type_line,'')),'orc') > 0)`
      : `(instr(lower(ifnull(i.name,'')),'goblin') > 0 OR instr(lower(ifnull(i.type_line,'')),'goblin') > 0)`;
  const rows = /** @type {Array<Record<string, unknown>>} */ (
    db
      .prepare(
        `
      SELECT ${SQL_ITEMS_LOCALIZED_SELECT} FROM ${SQL_ITEMS_LOCALIZED_FROM}
      WHERE ifnull(i.is_magic,0) = 0
        AND i.category NOT IN ('Services')
        AND i.cost_gp IS NOT NULL AND i.cost_gp > 0 AND i.cost_gp <= 350
        AND (
          ${tribalSql}
          OR (
            lower(ifnull(i.category,'')) LIKE '%weapon%'
            AND (
              instr(lower(ifnull(i.name,'')),'club') OR instr(lower(ifnull(i.name,'')),'spear')
              OR instr(lower(ifnull(i.name,'')),'javelin') OR instr(lower(ifnull(i.name,'')),'axe')
              OR instr(lower(ifnull(i.name,'')),'bow') OR instr(lower(ifnull(i.name,'')),'crossbow')
            )
          )
          OR lower(ifnull(i.category,'')) LIKE '%currency%'
        )
      ORDER BY RANDOM()
      LIMIT ?
    `,
      )
      .all(n)
  );
  return rows;
}

/**
 * Сокровищница: броски по числу из суммарного CR, плюс опциональный общий лимит GP на магию.
 *
 * @param {import('better-sqlite3').Database} database
 * @param {object} options
 * @param {number} options.totalCr
 * @param {number} [options.goldLimitGp]
 * @param {string[]} [options.categories]
 * @param {boolean} [options.includeCoins]
 * @param {boolean} [options.includeMundane]
 * @param {() => number} [options.rng]
 */
export function generateTreasureHoardPackWithDatabase(database, options) {
  const raw = generateTreasureHoardLoot(database, options);
  return {
    rollPlan: raw.rollPlan,
    coinsApproxGp: raw.coinsApproxGp,
    magicItems: raw.magicItems.map((row) =>
      formatItemLoot(/** @type {Record<string, unknown>} */ (row), database),
    ),
    mundaneItems: raw.mundaneItems.map((row) =>
      formatItemLoot(/** @type {Record<string, unknown>} */ (row), database),
    ),
  };
}

/**
 * @param {object} options
 * @param {number} options.totalCr
 * @param {number} [options.goldLimitGp]
 * @param {string[]} [options.categories]
 * @param {boolean} [options.includeCoins]
 * @param {boolean} [options.includeMundane]
 * @param {() => number} [options.rng]
 */
export function generateTreasureHoardPack(options) {
  const databasePath = resolveLootDatabasePath();
  const database = openLootDatabase(databasePath);
  try {
    return generateTreasureHoardPackWithDatabase(database, options);
  } finally {
    database.close();
  }
}

/**
 * @param {Record<string, unknown>} piece
 * @returns {string}
 */
function formatLoreSection(piece) {
  if (piece.kind === 'spell') {
    const title =
      typeof piece.name === 'string' && piece.name.length > 0 ? piece.name : 'Заклинание';
    const meta = [
      piece.levelLabel != null && String(piece.levelLabel).length > 0
        ? `Уровень: ${piece.levelLabel}`
        : null,
      piece.school != null && String(piece.school).length > 0
        ? `Школа: ${piece.school}`
        : null,
    ]
      .filter(Boolean)
      .join(' · ');
    const body =
      typeof piece.content === 'string' && piece.content.length > 0
        ? piece.content
        : '_(описание заклинания отсутствует в БД)_';
    return meta.length > 0 ? `_${title}_ (${meta})\n\n${body}` : `_${title}_\n\n${body}`;
  }
  const title = typeof piece.name === 'string' ? piece.name : 'Фрагмент';
  const body =
    typeof piece.content === 'string' && piece.content.length > 0
      ? piece.content
      : '_(нет текста)_';
  return `_${title}_\n\n${body}`;
}

/**
 * @param {Record<string, unknown>} piece
 * @returns {string}
 */
/**
 * @param {Record<string, unknown>} piece
 * @param {import('better-sqlite3').Database|null} [database]
 */
/**
 * @param {Record<string, unknown>} piece
 * @param {import('better-sqlite3').Database|null} [database]
 * @param {Record<string, unknown>|null} [rawRow] оригинальная строка из таблицы `monsters` (для pocket loot, заклинаний, traits)
 * @param {() => number} [rng]
 */
/**
 * @param {Record<string, unknown>} piece
 * @param {import('better-sqlite3').Database|null} [database]
 * @param {Record<string, unknown>|null} [rawRow]
 * @param {() => number} [rng]
 * @param {import('./lib/loot-generator-55.mjs').EncounterEcologyRoleId|null} [encounterEcologyRole]
 * @param {string|null} [killerElement] тип урона добивания (`fire`, `acid`, …) — огонь/кислота ухудшают часть трофеев
 */
function formatMonsterSection(
  piece,
  database = null,
  rawRow = null,
  rng = Math.random,
  encounterEcologyRole = null,
  killerElement = null,
) {
  const rawName = typeof piece.name === 'string' ? piece.name : 'Существо';
  const name = formatMonsterDisplayNameRuEn(database, rawName);
  const lines = [`**${name}**`, ''];
  if (piece.kind === 'statblock') {
    if (piece.typeLine != null && String(piece.typeLine).length > 0) {
      const tl = translateMonsterTypeLine(database, String(piece.typeLine));
      lines.push(`- **Тип:** ${tl}`);
    }
    if (piece.armorClass != null) {
      lines.push(
        `- **Класс брони:** ${translateMonsterTypeLine(database, String(piece.armorClass))}`,
      );
    }
    if (piece.hitPoints != null) {
      lines.push(`- **Хиты:** ${translateMonsterTypeLine(database, String(piece.hitPoints))}`);
    }
    if (piece.speed != null) {
      lines.push(`- **Скорость:** ${translateMonsterTypeLine(database, String(piece.speed))}`);
    }
    if (piece.challengeRating != null) {
      lines.push(`- **Испытание (CR):** ${piece.challengeRating}`);
    }
    if (
      typeof piece.experiencePoints === 'number' &&
      Number.isFinite(piece.experiencePoints)
    ) {
      lines.push(`- **Опыт (XP):** ${piece.experiencePoints}`);
    }
    if (
      typeof piece.abilitySummary === 'string' &&
      piece.abilitySummary.length > 0
    ) {
      lines.push(`- **Характеристики:** ${translateAbilitySummary(database, piece.abilitySummary)}`);
    }

    // ── Pocket Loot, Spell Quick-Ref, Combat Essentials ──
    if (rawRow != null) {
      const typeLine = String(rawRow.type_line ?? piece.typeLine ?? '');
      const crNum = Number(rawRow.cr_numeric ?? 0);
      const md = String(rawRow.raw_statblock_md ?? '');

      // Карманный лут — ZERNIX Legacy Loot Ultra (трофеи с тел)
      const personal = generatePersonalLoot(typeLine, crNum, killerElement, rng);
      for (const ln of personal.markdownLines) {
        if (ln.length) lines.push(ln);
      }

      // Боевые заклинания
      if (/Spellcasting|Innate Spellcasting/i.test(md)) {
        const spellNames = extractSpellNamesFromStatblock(md);
        const spellLines = buildSpellQuickRefLines(spellNames);
        if (spellLines.length) {
          lines.push(`- **Магия в бою:**`);
          for (const sl of spellLines) {
            lines.push(`  - ${sl}`);
          }
        }
      }

      // Боевые черты
      const essentials = extractCombatEssentials(md);
      if (essentials.length) {
        lines.push(`- **Важно:** ${essentials.join(' · ')}`);
      }

      const death = generateDeathRattle(
        /** @type {Record<string, unknown>} */ (rawRow),
        rng,
        encounterEcologyRole,
      );
      if (death && death.display) {
        lines.push(`- **Последние слова:** ${death.display}`);
        if (death.mechanical) {
          lines.push(`  - _${death.mechanical}_`);
        }
      }

      if (rng() < 0.1) {
        const dk = DUNGEON_LINK_POCKET_ITEMS[Math.floor(rng() * DUNGEON_LINK_POCKET_ITEMS.length)];
        lines.push(`- **Связующий ключ подземелья (10%):** ${formatLocalizedWithOriginalSuffix(dk.ru, dk.en)}`);
      }
    }

    return lines.join('\n');
  }
  return lines.concat(['_(ожидался statblock)_', '']).join('\n');
}

/**
 * @param {Record<string, unknown>} piece
 * @param {import('better-sqlite3').Database|null} [database]
 * @returns {string}
 */
function formatItemSection(piece, database = null) {
  if (piece.kind === 'equipment' || piece.kind === 'magic_item') {
    const name = typeof piece.name === 'string' ? piece.name : 'Предмет';
    const lines = [`**${name}**`, ''];
    if (piece.typeLine != null && String(piece.typeLine).length > 0) {
      lines.push(`${translateMonsterTypeLine(database, String(piece.typeLine))}`);
      lines.push('');
    }
    if (typeof piece.category === 'string' && piece.category.length > 0) {
      lines.push(`- **Категория:** ${translateItemCategoryForReport(database, piece.category)}`);
    }
    if (piece.subcategory != null && String(piece.subcategory).length > 0) {
      lines.push(
        `- **Подкатегория:** ${translateItemCategoryForReport(database, String(piece.subcategory))}`,
      );
    }
    const catLower = String(piece.category ?? '').toLowerCase();
    const isWeapon =
      catLower.includes('weapon') || String(piece.subcategory ?? '').toLowerCase().includes('weapon');
    if (piece.masteryProperty != null && String(piece.masteryProperty).length > 0) {
      if (isWeapon) {
        lines.push(`- **Владение оружием:** ${piece.masteryProperty}`);
      } else {
        lines.push(`- **Особенность владения:** ${piece.masteryProperty}`);
      }
    }
    if (piece.costGp != null && Number.isFinite(Number(piece.costGp))) {
      lines.push(`- **Оценочная стоимость:** ${piece.costGp} зм`);
    }
    if (piece.cost != null && String(piece.cost).length > 0) {
      lines.push(`- **Цена (SRD):** ${piece.cost}`);
    }
    if (piece.weight != null && String(piece.weight).length > 0) {
      lines.push(`- **Вес:** ${piece.weight}`);
    }
    if (piece.rarity != null && String(piece.rarity).length > 0) {
      lines.push(`- **Редкость:** ${translateItemRarityForReport(database, String(piece.rarity))}`);
    }
    if (piece.requiresAttunement === true) {
      lines.push('- **Настройка:** требуется');
    }
    if (piece.consumableUseAction != null && String(piece.consumableUseAction).length > 0) {
      lines.push(`- **Активация / использование:** ${piece.consumableUseAction}`);
    }
    if (
      typeof piece.description === 'string' &&
      piece.description.length > 0
    ) {
      lines.push('');
      lines.push(piece.description);
    }
    return lines.join('\n');
  }
  return '_(неизвестный тип находки)_';
}

function isLaunchedAsCliTest() {
  if (!process.argv.includes('--test')) {
    return false;
  }
  const entryPath = process.argv[1];
  if (entryPath == null || entryPath.length === 0) {
    return false;
  }
  try {
    return fileURLToPath(import.meta.url) === resolve(entryPath);
  } catch {
    return false;
  }
}

/**
 * @param {string[]} argv
 * @returns {{ cr: number|null, gold: number|null }}
 */
function parseLootCliArgv(argv = process.argv) {
  /** @type {number|null} */
  let cr = null;
  /** @type {number|null} */
  let gold = null;
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--cr' && i + 1 < argv.length) {
      cr = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (token === '--gold' && i + 1 < argv.length) {
      gold = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    const eqCr = token.match(/^--cr[=](.+)$/);
    if (eqCr) {
      cr = Number(eqCr[1]);
      continue;
    }
    const eqGold = token.match(/^--gold[=](.+)$/);
    if (eqGold) {
      gold = Number(eqGold[1]);
    }
  }
  if (cr != null && !Number.isFinite(cr)) {
    cr = null;
  }
  if (gold != null && !Number.isFinite(gold)) {
    gold = null;
  }
  return { cr, gold };
}

function runCliTest() {
  const { cr, gold } = parseLootCliArgv();
  lootDebug('DEBUG: Аргументы получены:', { cr, gold });

  const dbPath = resolveLootDatabasePath();
  lootDebug('DEBUG: resolveLootDatabasePath():', resolve(dbPath));

  const database = openLootDatabase(dbPath);
  try {
    const itemsRow = database.prepare(`SELECT COUNT(*) AS c FROM items`).get();
    const spellsRow = database.prepare(`SELECT COUNT(*) AS c FROM spells`).get();
    const monstersRow = database.prepare(`SELECT COUNT(*) AS c FROM monsters`).get();
    const i = /** @type {{ c: number }} */ (itemsRow).c;
    const s = /** @type {{ c: number }} */ (spellsRow).c;
    const m = /** @type {{ c: number }} */ (monstersRow).c;
    lootDebug(
      `DEBUG: Данные из SQLite (файл на диске после открытия): items=${i}, spells=${s}, monsters=${m}`,
    );

    if (cr != null && gold != null) {
      const hybrid = generateLootHybrid(database, gold, cr, [], Math.random);
      lootDebug('DEBUG: generateLootHybrid:', {
        tier: hybrid.tier,
        bias_rarities: hybrid.bias_rarities,
        pickCount: hybrid.picks.length,
      });
    }

    const markdown = formatEncounterToMarkdown(
      generateEncounterWithDatabase(database, 'Лес', {}),
      database,
    );
    console.log(markdown);
  } finally {
    database.close();
  }
}

if (isLaunchedAsCliTest()) {
  try {
    runCliTest();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    if (message.includes('предметов')) {
      console.error(
        'Подсказка: добавьте в location_loot_map строки с entity_type item.',
      );
    }
    process.exitCode = 1;
  }
}

export {
  generateLootByBudget,
  generateLootByCR,
  generateLootHybrid,
  generateLootHybridDiceOnly,
  generateIndividualTreasureLoot,
  tierFromCr,
  treasureHoardRollPlanFromGroupCr,
  rollHoardMagicItemCount,
  approximateHoardCoinsGp,
  approximateIndividualCoinsGp,
  pickMundaneHoardItems,
  generateTreasureHoardLoot,
  generateHumanoidNpcLoot,
  inferNpcEquipmentRole,
  isHumanoidMonster,
  maxRarityIndexForCr,
  resolveTreasureCrNumeric,
  pickOneMagicItemForBudgetAndCr,
  fillMagicItemsTreasureHoard,
  treasureHoardGoldFloorGp,
  translate,
  translateMonsterNameForReport,
  translateItemRarityForReport,
  translateItemNameForReport,
  translateItemDescriptionForReport,
} from './lib/loot-generator-55.mjs';
export {
  ensureLocalizationTable,
  seedLocalizationDefaults,
  translateMonsterTypeLine,
  translateAbilitySummary,
  translateItemCategoryForReport,
  formatCreatureTagsLocalized,
  displayNamesAreSameForOriginalSuffix,
  formatLocalizedWithOriginalSuffix,
  formatMonsterDisplayNameRuEn,
  formatMonsterHeadingRuEnCr,
} from './lib/db-localization.mjs';
export { generateNpcProfile } from './lib/npc-appearance.mjs';
export {
  generatePersonalLoot,
  generateEnvironmentLoot,
  generateHoard,
  magicItemQuirk,
} from './lib/zernix-legacy-loot-ultra.mjs';
