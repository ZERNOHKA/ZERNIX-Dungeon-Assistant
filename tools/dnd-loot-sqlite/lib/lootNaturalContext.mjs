/**
 * Контекст лута: корректировки по типам монстров и окружению (данные из SQLite).
 */

import { SQL_ITEMS_LOCALIZED_FROM, SQL_ITEMS_LOCALIZED_SELECT } from './sql-items-localized.mjs';

/** Слова — «городской»/технический лут, часто неуместен у зверей/растений */
const URBAN_TECH_SUBSTRINGS = [
  'thieves',
  "thieves'",
  'lock pick',
  'lockpick',
  'forgery',
  "navigator's",
  'cartographer',
  'gaming set',
  'instrument',
  'vehicles',
  'vehicle',
  'ship',
  'airship',
];

/**
 * @param {Record<string, unknown>} row
 */
export function itemLooksUrbanOrTechnical(row) {
  const blob = `${row.category ?? ''} ${row.subcategory ?? ''} ${row.name ?? ''}`.toLowerCase();
  return URBAN_TECH_SUBSTRINGS.some((s) => blob.includes(s.toLowerCase()));
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {number} targetGp
 * @param {() => number} rng
 * @returns {Record<string, unknown>|undefined}
 */
export function pickNaturalTrophyOrGem(db, targetGp, rng = Math.random) {
  void rng;
  const cap = Math.max(10, Math.floor(Number(targetGp) || 15));
  let row = /** @type {Record<string, unknown>|undefined} */ (
    db
      .prepare(
        `
      SELECT ${SQL_ITEMS_LOCALIZED_SELECT} FROM ${SQL_ITEMS_LOCALIZED_FROM}
      WHERE ifnull(i.is_magic,0) = 0
        AND i.cost_gp IS NOT NULL AND i.cost_gp > 0 AND i.cost_gp <= ?
        AND (
          lower(ifnull(i.category,'')) LIKE '%trade%'
          OR lower(ifnull(i.category,'')) LIKE '%gem%'
          OR lower(ifnull(i.subcategory,'')) LIKE '%gem%'
          OR lower(ifnull(i.name,'')) LIKE '%hide%'
          OR lower(ifnull(i.name,'')) LIKE '%fur%'
          OR lower(ifnull(i.name,'')) LIKE '%horn%'
          OR lower(ifnull(i.name,'')) LIKE '%ivory%'
          OR lower(ifnull(i.name,'')) LIKE '%feather%'
          OR lower(ifnull(i.name,'')) LIKE '%spore%'
          OR lower(ifnull(i.name,'')) LIKE '%dust%'
          OR lower(ifnull(i.name,'')) LIKE '%scale%'
        )
      ORDER BY RANDOM()
      LIMIT 1
    `,
      )
      .get(cap)
  );
  if (!row) {
    row = /** @type {Record<string, unknown>|undefined} */ (
      db
        .prepare(
          `
        SELECT ${SQL_ITEMS_LOCALIZED_SELECT} FROM ${SQL_ITEMS_LOCALIZED_FROM}
        WHERE ifnull(i.is_magic,0) = 0 AND i.category NOT IN ('Services')
          AND i.cost_gp IS NOT NULL AND i.cost_gp > 0 AND i.cost_gp <= ?
        ORDER BY RANDOM()
        LIMIT 1
      `,
        )
        .get(cap)
    );
  }
  return row;
}

/**
 * @param {Record<string, unknown>} row
 * @param {'cave'} [envBoost]
 */
export function isGemOrOreLike(row, envBoost) {
  const blob = `${row.category ?? ''} ${row.subcategory ?? ''} ${row.name ?? ''}`.toLowerCase();
  const ore = /\b(gem|ore|ruby|emerald|diamond|crystal)\b/i.test(blob);
  if (envBoost === 'cave' && ore) {
    return true;
  }
  return /\b(gem|ruby|emerald|diamond|crystal)\b/i.test(blob);
}

const PACK_EXCLUDE_SQL = `NOT (lower(ifnull(i.name,'')) LIKE '%explorer%' AND lower(ifnull(i.name,'')) LIKE '%pack%')
  AND NOT (lower(ifnull(i.name,'')) LIKE '%dungeoneer%' AND lower(ifnull(i.name,'')) LIKE '%pack%')`;

/**
 * Чернила / перо / пергамент — «канцелярия»; в чисто зверином гибриде уже меняется, здесь — для нежити/слизи без людей.
 *
 * @param {Record<string, unknown>} row
 */
export function itemLooksWritingSupplies(row) {
  const n = String(row.name ?? '').toLowerCase();
  if (n.includes('calligrapher')) return true;
  if (n.includes('quill')) return true;
  if (n.includes('parchment')) return true;
  if (n.includes('ink pen')) return true;
  if (/\bink\b/.test(n)) return true;
  return false;
}

/**
 * Отряд без гуманоидов, но с нежитью или слизью — маловероятно, что у них «рабочий стол писца».
 *
 * @param {Set<string>|Iterable<string>} creatureTags
 */
export function rosterTagsSuggestNoWritingDesk(creatureTags) {
  const tags = creatureTags instanceof Set ? creatureTags : new Set(creatureTags ?? []);
  if (tags.has('humanoid')) return false;
  return tags.has('undead') || tags.has('ooze');
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {number} maxGp
 * @param {() => number} rng
 * @returns {Record<string, unknown>|undefined}
 */
export function pickDungeonCorridorMundaneReplacement(db, maxGp, rng = Math.random) {
  void rng;
  const cap = Math.max(5, Math.min(500, Math.floor(Number(maxGp) || 25)));
  return /** @type {Record<string, unknown>|undefined} */ (
    db
      .prepare(
        `
      SELECT ${SQL_ITEMS_LOCALIZED_SELECT} FROM ${SQL_ITEMS_LOCALIZED_FROM}
      WHERE ifnull(i.is_magic,0) = 0
        AND (i.cost_gp IS NULL OR i.cost_gp <= @cap)
        AND ${PACK_EXCLUDE_SQL}
        AND (
          lower(ifnull(i.name,'')) LIKE '%torch%'
          OR lower(ifnull(i.name,'')) LIKE '%rations%'
          OR lower(ifnull(i.name,'')) LIKE '%hempen rope%'
          OR lower(ifnull(i.name,'')) LIKE '%silk rope%'
          OR lower(ifnull(i.name,'')) LIKE '%candle%'
          OR lower(ifnull(i.name,'')) LIKE '%piton%'
          OR lower(ifnull(i.name,'')) LIKE '%holy water%'
          OR lower(ifnull(i.name,'')) LIKE '%crowbar%'
          OR lower(ifnull(i.name,'')) LIKE '%chalk%'
          OR lower(ifnull(i.name,'')) LIKE '%oil (flask%'
        )
      ORDER BY RANDOM()
      LIMIT 1
    `,
      )
      .get({ cap })
  );
}
