/**
 * «Лут по сцене»: шаблоны (JSON) → выборка из `items` по подстрокам имени/категории.
 * Для мастера: не заменяет сундуки/встречи, а даёт находки «на полке», «под камнем», «в ящике».
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SQL_ITEMS_LOCALIZED_FROM, SQL_ITEMS_LOCALIZED_SELECT } from './sql-items-localized.mjs';
import { isAdventuringPackExcluded } from './loot-generator-55.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));

/** @type {unknown[]|null} */
let cachedTemplates = null;

export function loadSceneLootTemplates() {
  if (cachedTemplates) {
    return /** @type {SceneLootTemplate[]} */ (cachedTemplates);
  }
  const p = path.join(__dir, '..', 'data', 'scene-loot-templates.json');
  const raw = fs.readFileSync(p, 'utf8');
  cachedTemplates = JSON.parse(raw);
  return /** @type {SceneLootTemplate[]} */ (cachedTemplates);
}

/**
 * @typedef {{
 *   id: string,
 *   titleRu: string,
 *   sceneRu?: string,
 *   hidden?: boolean,
 *   biomes?: string[],
 *   slots: SceneLootSlot[],
 * }} SceneLootTemplate
 *
 * @typedef {{
 *   labelRu: string,
 *   isMagic: 0|1,
 *   nameContainsAny?: string[],
 *   maxCostGp?: number,
 *   fallbackNameContainsAny?: string[],
 *   fallbackCategoryContainsAny?: string[],
 *   optional?: boolean,
 * }} SceneLootSlot
 */

/**
 * @param {string[]} subjects
 * @param {string[]} cols SQL expr per column
 */
function sqlLikeOrLower(subjects, cols) {
  const parts = [];
  for (const raw of subjects) {
    const s = String(raw).replace(/'/g, "''").toLowerCase();
    if (!s) continue;
    for (const col of cols) {
      parts.push(`lower(${col}) LIKE '%${s}%'`);
    }
  }
  return parts.length > 0 ? `(${parts.join(' OR ')})` : null;
}

const PACK_EXCLUDE_SQL = `NOT (lower(ifnull(i.name,'')) LIKE '%explorer%' AND lower(ifnull(i.name,'')) LIKE '%pack%')
  AND NOT (lower(ifnull(i.name,'')) LIKE '%dungeoneer%' AND lower(ifnull(i.name,'')) LIKE '%pack%')`;

/**
 * @param {import('better-sqlite3').Database} db
 * @param {SceneLootSlot} slot
 */
export function pickItemForSceneSlot(db, slot) {
  const isMagic = Number(slot.isMagic) === 1 ? 1 : 0;
  const maxGp = slot.maxCostGp != null && Number.isFinite(Number(slot.maxCostGp)) ? Number(slot.maxCostGp) : 5000;

  const nameCols = [`ifnull(i.name,'')`, `ifnull(i.slug,'')`];
  const catCols = [`ifnull(i.category,'')`, `ifnull(i.subcategory,'')`];

  /** @type {(string|null)[]} */
  const tries = [];
  const n1 = slot.nameContainsAny?.length
    ? sqlLikeOrLower(slot.nameContainsAny, nameCols)
    : null;
  if (n1) tries.push(n1);
  const n2 = slot.fallbackNameContainsAny?.length
    ? sqlLikeOrLower(slot.fallbackNameContainsAny, nameCols)
    : null;
  if (n2) tries.push(n2);
  const c1 = slot.fallbackCategoryContainsAny?.length
    ? sqlLikeOrLower(slot.fallbackCategoryContainsAny, catCols)
    : null;
  if (c1) tries.push(c1);

  for (const extra of tries) {
    const whereExtra = extra != null ? `AND ${extra}` : '';
    const sql = `SELECT ${SQL_ITEMS_LOCALIZED_SELECT} FROM ${SQL_ITEMS_LOCALIZED_FROM}
      WHERE ifnull(i.is_magic,0) = @isMagic
        AND (i.cost_gp IS NULL OR i.cost_gp <= @maxGp)
        AND ${PACK_EXCLUDE_SQL}
        ${whereExtra}
      ORDER BY RANDOM() LIMIT 1`;
    const row = db.prepare(sql).get({ isMagic, maxGp });
    if (row && !isAdventuringPackExcluded(/** @type {Record<string, unknown>} */ (row))) {
      return /** @type {Record<string, unknown>} */ (row);
    }
  }
  return null;
}

/**
 * @param {SceneLootTemplate[]} templates
 * @param {string} biome
 */
export function filterSceneTemplatesByBiome(templates, biome) {
  const b = String(biome ?? 'any').toLowerCase();
  return templates.filter((t) => {
    const bio = t.biomes;
    if (!bio || !Array.isArray(bio) || bio.length === 0) {
      return true;
    }
    const set = new Set(bio.map((x) => String(x).toLowerCase()));
    return set.has(b) || set.has('any');
  });
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {object} [opts]
 * @param {string} [opts.environmentKey] cave|forest|…|any
 * @param {number} [opts.stashCount] число разных точек на сцену (1–8)
 * @param {() => number} [opts.rng]
 * @returns {Array<{ template: SceneLootTemplate, picks: Array<{ labelRu: string, row: Record<string, unknown>|null, skipped?: boolean }> }>}
 */
export function generateSceneStashes(db, opts = {}) {
  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
  const stashCount = Math.max(1, Math.min(8, Math.floor(Number(opts.stashCount) || 3)));
  const env = String(opts.environmentKey ?? 'any').toLowerCase();
  const all = loadSceneLootTemplates();
  const pool = filterSceneTemplatesByBiome(all, env);
  if (pool.length === 0) {
    return [];
  }

  /** @type {Array<{ template: SceneLootTemplate, picks: Array<{ labelRu: string, row: Record<string, unknown>|null, skipped?: boolean }> }>} */
  const out = [];
  for (let i = 0; i < stashCount; i += 1) {
    const t = pool[Math.floor(rng() * pool.length)];
    const picks = [];
    for (const slot of t.slots || []) {
      if (slot.optional && rng() > 0.42) {
        picks.push({ labelRu: slot.labelRu, row: null, skipped: true });
        continue;
      }
      picks.push({ labelRu: slot.labelRu, row: pickItemForSceneSlot(db, slot) });
    }
    out.push({ template: t, picks });
  }
  return out;
}
