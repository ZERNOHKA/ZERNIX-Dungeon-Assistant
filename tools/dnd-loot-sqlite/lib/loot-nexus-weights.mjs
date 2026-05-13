/**
 * Вероятностные веса предметов и контекстные теги (urban | dungeon | wilderness | …).
 * Стратифицированная выборка: при заданном contextTag часть пула гарантированно из строк с тегом.
 */

/** @param {unknown} row */
export function readItemLootWeight(row) {
  const r = /** @type {Record<string, unknown>} */ (row);
  const w = r.loot_weight ?? r.weight;
  const n = Number(w);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 100;
}

/**
 * @param {unknown} row
 * @returns {string[]}
 */
export function parseTagsField(row) {
  const r = /** @type {Record<string, unknown>} */ (row);
  const raw = r.tags != null ? String(r.tags) : '';
  if (!raw.trim()) return [];
  return raw
    .split(/[,;|\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * @param {unknown} row
 * @param {string|null|undefined} contextTag
 * @param {number} [tagBoost]
 * @param {string[]|null|undefined} [themeTags] — пересечение с `items.tags` / `monsters.tags` усиливает вес
 */
export function effectiveItemPickWeight(row, contextTag, tagBoost = 2.4, themeTags) {
  const base = readItemLootWeight(row);
  const tags = parseTagsField(row);
  let w = base;
  const tag = contextTag != null ? String(contextTag).trim().toLowerCase() : '';
  if (tag && tags.includes(tag)) {
    w = Math.round(w * tagBoost);
  }
  const tt = Array.isArray(themeTags)
    ? themeTags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
    : [];
  if (tt.length && tags.length) {
    const hits = tt.filter((t) => tags.includes(t)).length;
    if (hits >= 2) w = Math.round(w * 2.15);
    else if (hits === 1) w = Math.round(w * 1.55);
  }
  return Math.max(1, w);
}

/**
 * @template T
 * @param {T[]} pool
 * @param {(row: T) => number} getWeight
 * @param {() => number} rng
 * @returns {T|undefined}
 */
export function pickWeightedRow(pool, getWeight, rng) {
  if (!pool.length) return undefined;
  /** @type {number[]} */
  const w = pool.map((row) => Math.max(0, Number(getWeight(row)) || 0));
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    return pool[Math.floor(rng() * pool.length)];
  }
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i += 1) {
    roll -= w[i];
    if (roll < 0) {
      return pool[i];
    }
  }
  return pool[pool.length - 1];
}

/**
 * Случайная подвыборка + взвешенный выбор.
 * При непустом `contextTag`: двухэтапная выборка — сначала до N строк с тегом, затем добор до cap без дубликатов.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} sqlBase — SQL `SELECT … FROM … WHERE …` (алиас строки предмета — `i`)
 * @param {unknown[]} params
 * @param {string|null|undefined} contextTag
 * @param {() => number} rng
 * @param {number} [sampleCap]
 * @param {string[]|null|undefined} [themeTags]
 * @returns {Record<string, unknown>|undefined}
 */
export function pickRandomItemRowWeighted(
  db,
  sqlBase,
  params,
  contextTag,
  rng,
  sampleCap = 420,
  themeTags,
) {
  const cap = Math.max(40, Math.min(800, Math.floor(sampleCap)));
  const tag = contextTag != null ? String(contextTag).trim().toLowerCase() : '';

  /** @type {Array<Record<string, unknown>>} */
  let pool = [];

  if (!tag) {
    const wrapped = `
    SELECT * FROM (
      ${sqlBase}
      ORDER BY RANDOM()
      LIMIT ${cap}
    )`;
    pool = /** @type {Array<Record<string, unknown>>} */ (db.prepare(wrapped).all(...params));
  } else {
    const nTag = Math.max(12, Math.min(Math.floor(cap * 0.35), 200));
    const tagSql = `${sqlBase} AND (lower(ifnull(i.tags,'')) LIKE '%' || lower(?) || '%')`;
    const taggedWrap = `
    SELECT * FROM (
      ${tagSql}
      ORDER BY RANDOM()
      LIMIT ${nTag}
    )`;
    const tagged = /** @type {Array<Record<string, unknown>>} */ (
      db.prepare(taggedWrap).all(...params, tag)
    );

    const rem = Math.max(0, cap - tagged.length);
    /** @type {Array<Record<string, unknown>>} */
    let filler = [];
    if (rem > 0) {
      const ids = tagged.map((r) => r.id).filter((id) => id != null);
      if (ids.length === 0) {
        const w2 = `
        SELECT * FROM (
          ${sqlBase}
          ORDER BY RANDOM()
          LIMIT ${rem}
        )`;
        filler = /** @type {Array<Record<string, unknown>>} */ (db.prepare(w2).all(...params));
      } else {
        const placeholders = ids.map(() => '?').join(', ');
        const exclSql = `${sqlBase} AND i.id NOT IN (${placeholders})`;
        const w2 = `
        SELECT * FROM (
          ${exclSql}
          ORDER BY RANDOM()
          LIMIT ${rem}
        )`;
        filler = /** @type {Array<Record<string, unknown>>} */ (db.prepare(w2).all(...params, ...ids));
      }
    }

    const seen = new Set();
    for (const row of tagged) {
      const id = row.id;
      if (id == null) {
        pool.push(row);
      } else if (!seen.has(id)) {
        seen.add(id);
        pool.push(row);
      }
    }
    for (const row of filler) {
      const id = row.id;
      if (id == null) {
        pool.push(row);
      } else if (!seen.has(id)) {
        seen.add(id);
        pool.push(row);
      }
    }
  }

  if (pool.length === 0) return undefined;
  return /** @type {Record<string, unknown>} */ (
    pickWeightedRow(pool, (row) => effectiveItemPickWeight(row, contextTag, 2.4, themeTags), rng)
  );
}
