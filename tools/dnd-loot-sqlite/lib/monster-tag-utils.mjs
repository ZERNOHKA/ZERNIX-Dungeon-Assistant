/**
 * Тематические теги монстров (SQLite `monsters.tags`, CSV lowercase).
 * Кураторский слой поверх SRD: веса и фильтры для сцен.
 */

/**
 * @param {import('better-sqlite3').Database} db
 */
export function ensureMonsterTagsColumn(db) {
  const cols = /** @type {Array<{ name: string }>} */ (db.prepare(`PRAGMA table_info(monsters)`).all());
  if (cols.some((c) => String(c.name).toLowerCase() === 'tags')) {
    return;
  }
  db.exec(`ALTER TABLE monsters ADD COLUMN tags TEXT NOT NULL DEFAULT ''`);
}

/**
 * @param {Record<string, unknown>} row
 * @returns {string[]}
 */
export function parseMonsterTagsRow(row) {
  const raw = row.tags != null ? String(row.tags) : '';
  if (!raw.trim()) return [];
  return raw
    .split(/[,;|\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Число пересечений тегов строки с темой (0…n).
 *
 * @param {Record<string, unknown>} row
 * @param {string[]|null|undefined} themeTags
 */
export function monsterThemeTagScore(row, themeTags) {
  if (!themeTags || !themeTags.length) return 0;
  const rowTags = new Set(parseMonsterTagsRow(row));
  if (!rowTags.size) return 0;
  let n = 0;
  for (const t of themeTags) {
    const k = String(t).trim().toLowerCase();
    if (k && rowTags.has(k)) n += 1;
  }
  return n;
}

/**
 * Существо с любым из «запрещённых» тегов темы (лаборатория ≠ друид и т.п.).
 *
 * @param {Record<string, unknown>} row
 * @param {string[]|null|undefined} blocklist
 */
export function monsterHasBlockedTag(row, blocklist) {
  if (!blocklist || !blocklist.length) return false;
  const tags = parseMonsterTagsRow(row);
  const set = new Set(tags);
  for (const b of blocklist) {
    const k = String(b).trim().toLowerCase();
    if (k && set.has(k)) return true;
  }
  return false;
}

/**
 * 70% ядро (≥2 совпадения), 20% вторичные (1), 10% аномалия (0).
 *
 * @param {Array<Record<string, unknown>>} subset
 * @param {string[]|null|undefined} themeTags
 * @param {() => number} rng
 * @returns {Record<string, unknown>|undefined}
 */
export function pickThematicWeightedMonsterFromSubset(subset, themeTags, rng) {
  if (!subset.length) return undefined;
  if (!themeTags || !themeTags.length) {
    return subset[Math.floor(rng() * subset.length)];
  }
  const r = rng();
  if (r < 0.7) {
    const a = subset.filter((m) => monsterThemeTagScore(m, themeTags) >= 2);
    if (a.length) return a[Math.floor(rng() * a.length)];
    const b = subset.filter((m) => monsterThemeTagScore(m, themeTags) === 1);
    if (b.length) return b[Math.floor(rng() * b.length)];
  } else if (r < 0.9) {
    const b = subset.filter((m) => monsterThemeTagScore(m, themeTags) === 1);
    if (b.length) return b[Math.floor(rng() * b.length)];
    const a = subset.filter((m) => monsterThemeTagScore(m, themeTags) >= 2);
    if (a.length) return a[Math.floor(rng() * a.length)];
  } else {
    const c = subset.filter((m) => monsterThemeTagScore(m, themeTags) === 0);
    if (c.length) return c[Math.floor(rng() * c.length)];
  }
  return subset[Math.floor(rng() * subset.length)];
}
