/**
 * Recursive parsers for BTMorton-style nested JSON (content arrays, inline tables).
 * Combines narrative fragments, normalizes coin weights, and emits rows for SQLite import.
 */

import { abilityModifierFromScore } from './abilities.mjs';
import { parseCostToCp } from './pricing.mjs';
import {
  findBoldLine,
  normalizeAsciiMinus,
  slugify,
  uniqueSlug,
} from './text-utils.mjs';

/**
 * @typedef {object} ParseStats
 * @property {number} potentialEntityNodes Objects that expose `content` and/or `table`.
 * @property {number} rowsEmitted Rows successfully prepared for INSERT.
 * @property {Array<{ entityName: string, path: string, reason: string }>} parseFailures
 */

const MAGIC_RARITY_ORDER = [
  'artifact',
  'varies',
  'legendary',
  'very rare',
  'rare',
  'uncommon',
  'common',
];

/**
 * Depth-first walk: visits every object (including those nested inside arrays).
 *
 * @param {unknown} value
 * @param {string[]} pathKeys
 * @param {(obj: Record<string, unknown>, path: string[]) => void} onObject
 */
export function deepWalk(value, pathKeys, onObject) {
  if (value === null || value === undefined) {
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      deepWalk(value[i], [...pathKeys, `[${i}]`], onObject);
    }
    return;
  }
  if (typeof value === 'object') {
    onObject(/** @type {Record<string, unknown>} */ (value), pathKeys);
    for (const [childKey, childVal] of Object.entries(
      /** @type {Record<string, unknown>} */ (value),
    )) {
      deepWalk(childVal, [...pathKeys, childKey], onObject);
    }
  }
}

/**
 * @param {string[]} pathKeys
 * @returns {string}
 */
export function pathToDisplayString(pathKeys) {
  return pathKeys.filter(Boolean).join(' / ');
}

/**
 * @param {string[]} pathKeys
 * @returns {string}
 */
export function lastNonIndexedPathKey(pathKeys) {
  for (let i = pathKeys.length - 1; i >= 0; i -= 1) {
    const segment = pathKeys[i];
    if (!/^\[\d+\]$/.test(segment)) {
      return segment;
    }
  }
  return '';
}

const STRUCTURAL_PATH_SEGMENTS = new Set([
  'content',
  'Monsters',
  'Equipment',
  'Magic Items',
]);

/**
 * Path segments like `content` or `[3]` are ignored so that inline tables inside
 * `content: [ { table }, ... ]` still inherit the human-readable item name
 * (e.g. `Bag of Beans` instead of `content`).
 *
 * @param {string[]} pathKeys
 * @returns {string}
 */
export function deriveEntityName(pathKeys) {
  for (let i = pathKeys.length - 1; i >= 0; i -= 1) {
    const segment = pathKeys[i];
    if (/^\[\d+\]$/.test(segment)) {
      continue;
    }
    if (STRUCTURAL_PATH_SEGMENTS.has(segment)) {
      continue;
    }
    return segment;
  }
  return '';
}

/**
 * Стабильный slug по полному пути ключей (например monsters-monsters-a-aboleth-i3).
 *
 * @param {string[]} pathKeys
 * @returns {string}
 */
export function pathKeysToSlug(pathKeys) {
  const parts = [];
  for (const segment of pathKeys) {
    if (segment === '' || segment == null) {
      continue;
    }
    if (/^\[\d+\]$/.test(segment)) {
      parts.push(`i${segment.slice(1, -1)}`);
      continue;
    }
    const piece = slugify(segment);
    if (piece && piece !== 'unknown') {
      parts.push(piece);
    }
  }
  if (parts.length === 0) {
    return 'monsters-root';
  }
  return parts.join('-');
}

/**
 * Какие сегменты пути в SRD / BTMorton относятся к правилам главы «Monsters»,
 * а не к отдельной «легенде» о существе.
 */
const MONSTERS_INFO_PATH_MARKERS = new Set([
  'Size',
  'Type',
  'Alignment',
  'Ability Scores',
  'Armor Class',
  'Hit Points',
  'Speed',
  'Saving Throws',
  'Skills',
  'Vulnerabilities, Resistances, and Immunities',
  'Senses',
  'Languages',
  'Challenge',
  'Special Traits',
  'Actions',
  'Reactions',
  'Limited Usage',
  'Equipment',
  'Legendary Creatures',
  'Modifying Creatures',
]);

/**
 * @param {string[]} pathKeys
 * @param {boolean} isStatBlock
 * @returns {'statblock'|'lore'|'info'}
 */
function classifyProseEntryType(pathKeys, isStatBlock) {
  if (isStatBlock) {
    return 'statblock';
  }
  for (const seg of pathKeys) {
    if (MONSTERS_INFO_PATH_MARKERS.has(seg)) {
      return 'info';
    }
  }
  return 'lore';
}

/**
 * Приводит поле content монстра к массиву фрагментов (строка → один элемент).
 *
 * @param {unknown} value
 * @returns {Array<unknown>|null} null если ключ логически «нет» (undefined).
 */
function normalizeMonsterContentField(value) {
  if (value === undefined) {
    return null;
  }
  if (value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return [value];
  }
  if (typeof value === 'object') {
    return [value];
  }
  return [String(value)];
}

/**
 * @param {Array<unknown>} contentArr
 * @returns {boolean}
 */
function monsterContentHasNonWhitespaceText(contentArr) {
  if (!Array.isArray(contentArr) || contentArr.length === 0) {
    return false;
  }
  return contentArr.some((part) => {
    if (typeof part === 'string') {
      return part.trim().length > 0;
    }
    if (part == null) {
      return false;
    }
    if (typeof part === 'object') {
      return true;
    }
    return String(part).trim().length > 0;
  });
}

/**
 * @param {Array<unknown>} contentArr
 * @returns {string|null}
 */
function firstItalicLineInContent(contentArr) {
  if (!Array.isArray(contentArr)) {
    return null;
  }
  for (const entry of contentArr) {
    if (typeof entry === 'string' && entry.trim().startsWith('*')) {
      return entry.trim();
    }
  }
  return null;
}

/**
 * Тело таблицы BTMorton: только столбцы-массивы (без обёртки `{ table: ... }`).
 *
 * @param {Record<string, unknown>} obj
 * @returns {boolean}
 */
function isLikelyBareTableColumnMap(obj) {
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    return false;
  }
  return keys.every((k) =>
    Array.isArray(/** @type {Record<string, unknown>} */ (obj)[k]),
  );
}

/**
 * Registers table objects that already appear inside a `content` array so that
 * a later deep-walk visit to `{ table: ... }` does not emit duplicate rows.
 *
 * @param {Array<unknown>|null|undefined} contentArr
 * @param {WeakSet<object>} sink
 */
function registerEmbeddedTablesFromContent(contentArr, sink) {
  if (!Array.isArray(contentArr)) {
    return;
  }
  for (const part of contentArr) {
    if (
      part &&
      typeof part === 'object' &&
      !Array.isArray(part) &&
      'table' in part
    ) {
      const tbl = /** @type {{ table: unknown }} */ (part).table;
      if (tbl && typeof tbl === 'object') {
        sink.add(/** @type {object} */ (tbl));
      }
    }
  }
}

/**
 * @param {Record<string, string[]>} table
 * @returns {string}
 */
export function tableToReadableText(table) {
  if (!table || typeof table !== 'object') {
    return '';
  }
  const columns = Object.keys(table);
  if (columns.length === 0) {
    return '';
  }
  const lengths = columns.map((col) =>
    Array.isArray(table[col]) ? table[col].length : 0,
  );
  const rowCount = Math.max(0, ...lengths);
  const header = columns.join('\t');
  const lines = [header];
  for (let r = 0; r < rowCount; r += 1) {
    const cells = columns.map((col) => {
      const cellsArr = table[col];
      if (!Array.isArray(cellsArr) || cellsArr[r] === undefined) {
        return '';
      }
      return String(cellsArr[r]).replace(/\t/g, ' ');
    });
    lines.push(cells.join('\t'));
  }
  return lines.join('\n');
}

/**
 * @param {unknown} part
 * @returns {string}
 */
function stringifyContentPart(part) {
  if (typeof part === 'string') {
    return part;
  }
  if (part && typeof part === 'object' && !Array.isArray(part)) {
    if (
      'table' in part &&
      /** @type {{ table: unknown }} */ (part).table &&
      typeof /** @type {{ table: unknown }} */ (part).table === 'object'
    ) {
      const tbl = /** @type {Record<string, string[]>} */ (
        /** @type {{ table: unknown }} */ (part).table
      );
      return tableToReadableText(tbl);
    }
    return JSON.stringify(part);
  }
  if (Array.isArray(part)) {
    return JSON.stringify(part);
  }
  if (part === null || part === undefined) {
    return '';
  }
  return String(part);
}

/**
 * Joins a BTMorton `content` array into a single multiline string (per user request).
 *
 * @param {unknown} content
 * @returns {string}
 */
export function joinContentLines(content) {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content.map(stringifyContentPart).filter(Boolean).join('\n');
}

/**
 * Stable JSON for extra_json: keeps tables as both readable and raw JSON.
 *
 * @param {Record<string, unknown>} payload
 * @returns {string}
 */
export function buildExtraJson(payload) {
  return JSON.stringify(payload);
}

/**
 * @param {unknown} content
 * @returns {boolean}
 */
export function isMonsterStatBlockContent(content) {
  if (!Array.isArray(content)) {
    return false;
  }
  return content.some(
    (line) => typeof line === 'string' && line.includes('**Armor Class**'),
  );
}

/**
 * @param {Array<unknown>} content
 * @returns {Record<string, { score: number|null; modFromBlock: number|null }>}
 */
export function parseAbilityTableFromContent(content) {
  const empty = {
    str: { score: null, modFromBlock: null },
    dex: { score: null, modFromBlock: null },
    con: { score: null, modFromBlock: null },
    int: { score: null, modFromBlock: null },
    wis: { score: null, modFromBlock: null },
    cha: { score: null, modFromBlock: null },
  };
  if (!Array.isArray(content)) {
    return empty;
  }
  const tableWrapper = content.find(
    (e) =>
      e &&
      typeof e === 'object' &&
      'table' in e &&
      /** @type {{ table: unknown }} */ (e).table &&
      typeof /** @type {{ table: unknown }} */ (e).table === 'object',
  );
  if (!tableWrapper) {
    return empty;
  }
  const table = /** @type {{ table: Record<string, string[]> }} */ (
    /** @type {{ table: unknown }} */ (tableWrapper).table
  );
  const readCell = (column) => {
    const cellArr = table[column];
    if (!cellArr || !cellArr[0]) {
      return { score: null, modFromBlock: null };
    }
    const raw = normalizeAsciiMinus(String(cellArr[0]));
    const paired = raw.match(/^(\d+)\s*\(([+-]?\d+)\)/);
    if (paired) {
      return {
        score: Number.parseInt(paired[1], 10),
        modFromBlock: Number.parseInt(paired[2], 10),
      };
    }
    const scoreOnly = raw.match(/^(\d+)\s*$/);
    if (scoreOnly) {
      return {
        score: Number.parseInt(scoreOnly[1], 10),
        modFromBlock: null,
      };
    }
    return { score: null, modFromBlock: null };
  };
  return {
    str: readCell('STR'),
    dex: readCell('DEX'),
    con: readCell('CON'),
    int: readCell('INT'),
    wis: readCell('WIS'),
    cha: readCell('CHA'),
  };
}

/**
 * @param {string|null|undefined} line
 * @returns {{ cr: string|null; xp: number|null }}
 */
export function parseChallengeLine(line) {
  if (!line) {
    return { cr: null, xp: null };
  }
  const text = normalizeAsciiMinus(line.trim());
  let crMatch = text.match(/\*\*Challenge\*\*\s*([^\s(]+)\s*\(([^)]+)\)/);
  if (!crMatch) {
    crMatch = text.match(/^([^\s(]+)\s*\(([^)]+)\)\s*$/);
  }
  if (!crMatch) {
    return { cr: null, xp: null };
  }
  const cr = crMatch[1].trim();
  const xpPart = crMatch[2].replace(/,/g, '');
  const xpNumMatch = xpPart.match(/(\d+)/);
  const xp = xpNumMatch ? Number.parseInt(xpNumMatch[1], 10) : null;
  return { cr, xp };
}

/**
 * @param {unknown} raw
 * @returns {number|null}
 */
export function parseWeightLb(raw) {
  if (raw == null) {
    return null;
  }
  const s = String(raw).trim();
  if (s === '' || s === '—' || s === '\u2014' || s === '-') {
    return null;
  }
  const normalized = normalizeAsciiMinus(s).replace(/,/g, '');
  const lower = normalized.toLowerCase();
  if (
    lower.includes('full') ||
    lower === '*' ||
    lower === '×2' ||
    lower === '×4'
  ) {
    return null;
  }
  const frac = normalized.match(/^([0-9]+)\s*\/\s*([0-9]+)\s*lb\.?$/i);
  if (frac) {
    const a = Number.parseInt(frac[1], 10);
    const b = Number.parseInt(frac[2], 10);
    if (b !== 0) {
      return a / b;
    }
    return null;
  }
  const dec = normalized.match(/^([0-9]+(?:\.[0-9]+)?)\s*lb\.?/i);
  if (dec) {
    return Number.parseFloat(dec[1]);
  }
  return null;
}

/**
 * @param {unknown} value
 * @returns {Array<unknown>|null}
 */
function normalizeToContentArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return [value];
  }
  return null;
}

/**
 * @param {string|null|undefined} typeLine
 * @returns {string|null}
 */
export function parseMagicRarity(typeLine) {
  if (!typeLine) {
    return null;
  }
  const line = normalizeAsciiMinus(typeLine).toLowerCase();
  for (const rarity of MAGIC_RARITY_ORDER) {
    if (line.includes(rarity)) {
      return rarity;
    }
  }
  return null;
}

/**
 * @param {string|null|undefined} typeLine
 * @returns {boolean}
 */
export function parseAttunement(typeLine) {
  if (!typeLine) {
    return false;
  }
  return /requires\s+attunement/i.test(typeLine);
}

/**
 * @param {Array<unknown>} content
 * @returns {string|null}
 */
function firstMagicTypeLineFromContent(content) {
  if (!Array.isArray(content)) {
    return null;
  }
  for (const entry of content) {
    if (typeof entry === 'string' && entry.trim().startsWith('*')) {
      return entry.trim();
    }
  }
  return null;
}

/**
 * @param {Array<unknown>} content
 * @returns {number|null}
 */
function scanMagicContentForPriceCp(content) {
  if (!Array.isArray(content)) {
    return null;
  }
  let best = null;
  const re = /\b([0-9,]+(?:\.[0-9]+)?)\s*(pp|gp|ep|sp|cp)\b/gi;
  for (const entry of content) {
    if (typeof entry !== 'string') {
      continue;
    }
    const matches = entry.matchAll(re);
    for (const match of matches) {
      const cp = parseCostToCp(
        `${match[1].replace(/,/g, '')} ${match[2].toLowerCase()}`,
      );
      if (cp != null && cp > 0) {
        best = best == null ? cp : Math.max(best, cp);
      }
    }
  }
  return best;
}

/**
 * @param {Record<string, unknown>} table
 * @returns {string|null}
 */
function detectEquipmentNameColumn(table) {
  if (table.Armor) {
    return 'Armor';
  }
  if (table.Name) {
    return 'Name';
  }
  if (table.Item) {
    return 'Item';
  }
  if (table.Weapon) {
    return 'Weapon';
  }
  if (table.Goods) {
    return 'Goods';
  }
  if (table.Container) {
    return 'Container';
  }
  if (table.Lifestyle) {
    return 'Lifestyle';
  }
  if (table.Category) {
    return 'Category';
  }
  const keys = Object.keys(table);
  if (keys.length > 0) {
    return keys[0];
  }
  return null;
}

/**
 * «Всеядный» разбор главы Monsters: любой непустой content и любой table попадает в БД.
 * slug строится по полному пути ключей; entry_type отличает статблок, лор, правила и таблицы.
 *
 * @param {Record<string, unknown>} monstersRoot
 * @param {{ logSkips?: boolean }} [options]
 * @returns {{ rows: Array<Record<string, unknown>>, stats: ParseStats }}
 */
export function parseMonstersDocument(monstersRoot, options = {}) {
  const logSkips = options.logSkips !== false;
  /** @type {ParseStats} */
  const stats = {
    potentialEntityNodes: 0,
    rowsEmitted: 0,
    parseFailures: [],
  };
  /** @type {Array<Record<string, unknown>>} */
  const rows = [];
  const usedSlugs = new Set();

  deepWalk(monstersRoot, ['Monsters'], (obj, pathKeys) => {
    const hasContentKey =
      Object.prototype.hasOwnProperty.call(obj, 'content') &&
      /** @type {Record<string, unknown>} */ (obj).content !== undefined;
    const hasTableKey =
      Object.prototype.hasOwnProperty.call(obj, 'table') &&
      obj.table &&
      typeof obj.table === 'object';
    const fullPath = pathToDisplayString(pathKeys);
    const skippedKeyLabel =
      deriveEntityName(pathKeys) ||
      lastNonIndexedPathKey(pathKeys) ||
      pathKeys[pathKeys.length - 1] ||
      '(без имени)';

    if (!hasContentKey && !hasTableKey) {
      if (!isLikelyBareTableColumnMap(obj) && logSkips) {
        console.log(
          `[monsters] ПРОПУСК | ключ/узел: "${skippedKeyLabel}" | путь: ${fullPath} | причина: нет полей content и table у объекта`,
        );
      }
      return;
    }

    const contentArr = hasContentKey
      ? normalizeMonsterContentField(
          /** @type {Record<string, unknown>} */ (obj).content,
        )
      : null;
    const hasUsableContent = monsterContentHasNonWhitespaceText(
      contentArr != null ? contentArr : [],
    );

    if (!hasUsableContent && !hasTableKey) {
      if (logSkips) {
        console.log(
          `[monsters] ПРОПУСК | ключ/узел: "${skippedKeyLabel}" | путь: ${fullPath} | причина: content отсутствует, пустой или только пробелы; table нет`,
        );
      }
      return;
    }

    stats.potentialEntityNodes += 1;
    const sourcePath = fullPath;
    const entityName =
      deriveEntityName(pathKeys) ||
      skippedKeyLabel ||
      `node-${stats.potentialEntityNodes}`;
    const pathSlugBase = pathKeysToSlug(pathKeys);

    try {
      if (hasUsableContent && contentArr != null) {
        const isStat = isMonsterStatBlockContent(contentArr);
        let strScore = null;
        let dexScore = null;
        let conScore = null;
        let intScore = null;
        let wisScore = null;
        let chaScore = null;
        let strMod = null;
        let dexMod = null;
        let conMod = null;
        let intMod = null;
        let wisMod = null;
        let chaMod = null;
        let challengeParsed = { cr: null, xp: null };
        let typeLineEntry = null;
        if (isStat) {
          const abilities = parseAbilityTableFromContent(contentArr);
          strScore = abilities.str.score;
          dexScore = abilities.dex.score;
          conScore = abilities.con.score;
          intScore = abilities.int.score;
          wisScore = abilities.wis.score;
          chaScore = abilities.cha.score;
          strMod =
            strScore != null ? abilityModifierFromScore(strScore) : null;
          dexMod =
            dexScore != null ? abilityModifierFromScore(dexScore) : null;
          conMod =
            conScore != null ? abilityModifierFromScore(conScore) : null;
          intMod =
            intScore != null ? abilityModifierFromScore(intScore) : null;
          wisMod =
            wisScore != null ? abilityModifierFromScore(wisScore) : null;
          chaMod =
            chaScore != null ? abilityModifierFromScore(chaScore) : null;
          const challengeFromBold = findBoldLine(contentArr, 'Challenge');
          const challengeFullLine =
            typeof challengeFromBold === 'string'
              ? challengeFromBold
              : contentArr.find(
                  (e) => typeof e === 'string' && e.includes('**Challenge**'),
                ) || null;
          challengeParsed = parseChallengeLine(
            typeof challengeFullLine === 'string' ? challengeFullLine : null,
          );
          const commaType = contentArr.find(
            (e) =>
              typeof e === 'string' && e.startsWith('*') && e.includes(','),
          );
          typeLineEntry =
            typeof commaType === 'string' ? commaType : null;
        } else {
          typeLineEntry = firstItalicLineInContent(contentArr);
          const challengeFromBold = findBoldLine(contentArr, 'Challenge');
          const challengeFullLine =
            typeof challengeFromBold === 'string'
              ? challengeFromBold
              : contentArr.find(
                  (e) => typeof e === 'string' && e.includes('**Challenge**'),
                ) || null;
          challengeParsed = parseChallengeLine(
            typeof challengeFullLine === 'string' ? challengeFullLine : null,
          );
        }

        const entry_type = classifyProseEntryType(pathKeys, isStat);
        const slug = uniqueSlug(pathSlugBase, usedSlugs);

        /** @type {unknown} */
        let rawPayload;
        if (hasTableKey) {
          rawPayload = {
            content: contentArr,
            table: /** @type {Record<string, unknown>} */ (
              /** @type {Record<string, unknown>} */ (obj).table
            ),
          };
        } else {
          rawPayload = contentArr;
        }

        rows.push({
          slug,
          name: entityName,
          entry_type,
          source_path: sourcePath,
          type_line: typeLineEntry,
          armor_class: findBoldLine(contentArr, 'Armor Class'),
          hit_points: findBoldLine(contentArr, 'Hit Points'),
          speed: findBoldLine(contentArr, 'Speed'),
          str_score: strScore,
          dex_score: dexScore,
          con_score: conScore,
          int_score: intScore,
          wis_score: wisScore,
          cha_score: chaScore,
          str_mod: strMod,
          dex_mod: dexMod,
          con_mod: conMod,
          int_mod: intMod,
          wis_mod: wisMod,
          cha_mod: chaMod,
          saving_throws: findBoldLine(contentArr, 'Saving Throws'),
          skills: findBoldLine(contentArr, 'Skills'),
          senses: findBoldLine(contentArr, 'Senses'),
          languages: findBoldLine(contentArr, 'Languages'),
          challenge_rating: challengeParsed.cr,
          xp: challengeParsed.xp,
          raw_content_json: JSON.stringify(rawPayload),
        });
        stats.rowsEmitted += 1;
      }

      if (!hasUsableContent && hasTableKey) {
        const tbl = /** @type {Record<string, string[]>} */ (
          /** @type {{ table: unknown }} */ (
            /** @type {Record<string, unknown>} */ (obj)
          ).table
        );
        const readable = tableToReadableText(tbl);
        const slug = uniqueSlug(`${pathSlugBase}-table`, usedSlugs);
        rows.push({
          slug,
          name: `${entityName} (table)`,
          entry_type: 'table',
          source_path: sourcePath,
          type_line: null,
          armor_class: null,
          hit_points: null,
          speed: null,
          str_score: null,
          dex_score: null,
          con_score: null,
          int_score: null,
          wis_score: null,
          cha_score: null,
          str_mod: null,
          dex_mod: null,
          con_mod: null,
          int_mod: null,
          wis_mod: null,
          cha_mod: null,
          saving_throws: null,
          skills: null,
          senses: null,
          languages: null,
          challenge_rating: null,
          xp: null,
          raw_content_json: JSON.stringify({
            source: 'table_only',
            joined_text: readable,
            table_json: tbl,
          }),
        });
        stats.rowsEmitted += 1;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (logSkips) {
        console.log(
          `[monsters] ПРОПУСК (исключение) | ключ/узел: "${skippedKeyLabel}" | путь: ${fullPath} | причина: ${msg}`,
        );
      }
      stats.parseFailures.push({
        entityName: skippedKeyLabel,
        path: fullPath,
        reason: msg,
      });
    }
  });

  return { rows, stats };
}

/**
 * Expands a single table object into equipment rows (never skips empty cost/weight).
 *
 * @param {Record<string, string[]>} table
 * @param {string} categoryPath
 * @param {string} subName
 * @param {Set<string>} usedSlugs
 * @param {Array<Record<string, unknown>>} outRows
 * @param {ParseStats} stats
 */
function expandEquipmentTable(
  table,
  categoryPath,
  subName,
  usedSlugs,
  outRows,
  stats,
) {
  const nameCol = detectEquipmentNameColumn(table);
  if (!nameCol) {
    stats.parseFailures.push({
      entityName: subName,
      path: categoryPath,
      reason:
        'Equipment table skipped: could not detect a name column (Armor / Name / Item / …).',
    });
    return;
  }
  const columns = Object.keys(table);
  const lengths = columns.map((c) =>
    Array.isArray(table[c]) ? table[c].length : 0,
  );
  const rowCount = Math.max(0, ...lengths);
  if (rowCount === 0) {
    stats.parseFailures.push({
      entityName: subName,
      path: categoryPath,
      reason: 'Equipment table has zero rows.',
    });
    return;
  }
  for (let r = 0; r < rowCount; r += 1) {
    const nameCell = table[nameCol] && table[nameCol][r] != null
      ? String(table[nameCol][r]).trim()
      : '';
    const displayName =
      nameCell.length > 0
        ? nameCell
        : `Unnamed row ${r + 1} @ ${subName}`;
    const rowObj = {};
    for (const col of columns) {
      const arr = table[col];
      rowObj[col] =
        Array.isArray(arr) && arr[r] !== undefined ? arr[r] : null;
    }
    const costRaw =
      typeof rowObj['Cost'] === 'string'
        ? rowObj['Cost'].trim()
        : rowObj['Cost'] != null
          ? String(rowObj['Cost'])
          : '';
    const weightRaw =
      typeof rowObj['Weight'] === 'string'
        ? rowObj['Weight'].trim()
        : rowObj['Weight'] != null
          ? String(rowObj['Weight'])
          : '';
    const priceCp =
      costRaw === '' || costRaw === '—' || costRaw === '-'
        ? null
        : parseCostToCp(costRaw);
    const weightLb =
      weightRaw === '' || weightRaw === '—' || weightRaw === '-'
        ? null
        : parseWeightLb(weightRaw);
    const extraPayload = {
      source: 'table_row',
      table_context: subName,
      row_index: r,
      columns: rowObj,
      table_readable: tableToReadableText(table),
      table_json: table,
    };
    outRows.push({
      slug: uniqueSlug(slugify(displayName), usedSlugs),
      name: displayName,
      category: categoryPath,
      subcategory: subName,
      cost_raw: costRaw === '' ? null : costRaw,
      price_cp: priceCp,
      weight_raw: weightRaw === '' ? null : weightRaw,
      weight_lb: weightLb,
      extra_json: buildExtraJson(extraPayload),
    });
    stats.rowsEmitted += 1;
  }
}

/**
 * @param {Record<string, unknown>} equipmentRoot
 * @returns {{ rows: Array<Record<string, unknown>>, stats: ParseStats }}
 */
export function parseEquipmentDocument(equipmentRoot) {
  /** @type {ParseStats} */
  const stats = {
    potentialEntityNodes: 0,
    rowsEmitted: 0,
    parseFailures: [],
  };
  /** @type {Array<Record<string, unknown>>} */
  const rows = [];
  const usedSlugs = new Set();
  const processedTables = new WeakSet();

  deepWalk(equipmentRoot, ['Equipment'], (obj, pathKeys) => {
    const hasContentKey = Object.prototype.hasOwnProperty.call(obj, 'content');
    const hasTableKey =
      Object.prototype.hasOwnProperty.call(obj, 'table') &&
      obj.table &&
      typeof obj.table === 'object';
    if (!hasContentKey && !hasTableKey) {
      return;
    }
    const normalizedEarly = normalizeToContentArray(obj.content);
    const contentConsideredEmpty =
      normalizedEarly == null || normalizedEarly.length === 0;
    if (contentConsideredEmpty && !hasTableKey) {
      return;
    }
    stats.potentialEntityNodes += 1;
    const entityName =
      deriveEntityName(pathKeys) ||
      `equipment-${stats.potentialEntityNodes}`;
    const fullPath = pathToDisplayString(pathKeys);
    const categoryPath = pathKeys
      .filter((p) => p !== 'Equipment' && !/^\[\d+\]$/.test(p))
      .join(' > ');
    try {
      if (hasTableKey) {
        const tableObj = /** @type {Record<string, string[]>} */ (
          /** @type {{ table: unknown }} */ (
            /** @type {Record<string, unknown>} */ (obj)
          ).table
        );
        if (!processedTables.has(tableObj)) {
          processedTables.add(tableObj);
          expandEquipmentTable(
            tableObj,
            categoryPath || 'misc',
            entityName,
            usedSlugs,
            rows,
            stats,
          );
        }
      }
      const contentArr = normalizedEarly;
      if (contentArr && contentArr.length > 0) {
        const joined = joinContentLines(contentArr);
        rows.push({
          slug: uniqueSlug(slugify(`${entityName}-prose`), usedSlugs),
          name: entityName,
          category: categoryPath || 'prose',
          subcategory: 'content_block',
          cost_raw: null,
          price_cp: null,
          weight_raw: null,
          weight_lb: null,
          extra_json: buildExtraJson({
            source: 'content_block',
            joined_text: joined,
            original_content: contentArr,
          }),
        });
        stats.rowsEmitted += 1;
      }
    } catch (err) {
      stats.parseFailures.push({
        entityName,
        path: fullPath,
        reason:
          err instanceof Error ? err.message : String(err),
      });
    }
  });

  return { rows, stats };
}

/**
 * @param {Record<string, unknown>} magicRoot
 * @returns {{ rows: Array<Record<string, unknown>>, stats: ParseStats }}
 */
export function parseMagicItemsDocument(magicRoot) {
  /** @type {ParseStats} */
  const stats = {
    potentialEntityNodes: 0,
    rowsEmitted: 0,
    parseFailures: [],
  };
  /** @type {Array<Record<string, unknown>>} */
  const rows = [];
  const usedSlugs = new Set();
  const processedTables = new WeakSet();
  const embeddedMagicTables = new WeakSet();

  deepWalk(magicRoot, ['Magic Items'], (obj, pathKeys) => {
    const hasContentKey = Object.prototype.hasOwnProperty.call(obj, 'content');
    const hasTableKey =
      Object.prototype.hasOwnProperty.call(obj, 'table') &&
      obj.table &&
      typeof obj.table === 'object';
    if (!hasContentKey && !hasTableKey) {
      return;
    }
    const normalizedEarly = normalizeToContentArray(obj.content);
    const contentConsideredEmpty =
      normalizedEarly == null || normalizedEarly.length === 0;
    if (contentConsideredEmpty && !hasTableKey) {
      return;
    }
    stats.potentialEntityNodes += 1;
    const entityName =
      deriveEntityName(pathKeys) ||
      `magic-${stats.potentialEntityNodes}`;
    const fullPath = pathToDisplayString(pathKeys);
    try {
      const contentArr = normalizedEarly;
      if (contentArr && contentArr.length > 0) {
        registerEmbeddedTablesFromContent(contentArr, embeddedMagicTables);
        const joined = joinContentLines(contentArr);
        const typeLine = firstMagicTypeLineFromContent(contentArr);
        const rarity = parseMagicRarity(typeLine);
        const attunement = parseAttunement(typeLine) ? 1 : 0;
        const priceCp = scanMagicContentForPriceCp(contentArr);
        rows.push({
          slug: uniqueSlug(slugify(entityName), usedSlugs),
          name: entityName,
          type_line: typeLine,
          rarity,
          attunement,
          price_cp: priceCp,
          description_json: JSON.stringify({
            joined_text: joined,
            original_content: contentArr,
          }),
        });
        stats.rowsEmitted += 1;
      } else if (hasTableKey) {
        const tbl = /** @type {Record<string, string[]>} */ (
          /** @type {{ table: unknown }} */ (
            /** @type {Record<string, unknown>} */ (obj)
          ).table
        );
        if (embeddedMagicTables.has(/** @type {unknown} */ (tbl))) {
          return;
        }
        if (!processedTables.has(tbl)) {
          processedTables.add(tbl);
          const readable = tableToReadableText(tbl);
          rows.push({
            slug: uniqueSlug(slugify(`${entityName}-table`), usedSlugs),
            name: `${entityName} (table)`,
            type_line: null,
            rarity: null,
            attunement: 0,
            price_cp: null,
            description_json: JSON.stringify({
              source: 'table_only',
              joined_text: readable,
              table_json: tbl,
            }),
          });
          stats.rowsEmitted += 1;
        }
      }
    } catch (err) {
      stats.parseFailures.push({
        entityName,
        path: fullPath,
        reason:
          err instanceof Error ? err.message : String(err),
      });
    }
  });

  return { rows, stats };
}
