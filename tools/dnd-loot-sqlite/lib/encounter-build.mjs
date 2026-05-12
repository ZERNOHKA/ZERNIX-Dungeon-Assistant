/**
 * Подбор монстров из SQLite под бюджет XP и окружение (фильтр по type_line).
 * Сценарные архетипы, связь по ключевым словам в statblock, нарратив — см. loot-generator-55.mjs.
 */

import { normalizeEncounterThreat, totalEncounterXpBudget } from './encounterXpBudget.mjs';
import {
  rollEncounterArchetype,
  rowContradictsBiome,
  maxCreaturesForArchetype,
  auditEncounterRoster,
  applyInjuryVarianceToRoster,
  buildScenarioNarrativeBundle,
  buildEncounterFlavourTextPair,
  fetchMonstersMentioningLeaderKeywords,
  pickLeaderIndexInRoster,
  pickLeaderUniqueTraitLocalized,
  formatArchetypeLabelRuEn,
  formatLocalizedWithOriginalSuffix,
  rollWorldState,
  normalizeWorldState,
  formatWorldStateLabelRuEn,
  dungeonTagsToSqlFragments,
  inferEncounterEcologyRole,
  rollBattlefieldHeightProfile,
  rollEnvironmentalHazard,
  formatEncounterEcologyTacticsLocalized,
  formatEncounterEcologyRoleLabelRu,
} from './loot-generator-55.mjs';

/**
 * Подстроки для поиска в `monsters.type_line` (без жёсткой схемы типов — SRD текстовое поле).
 * @typedef {'forest'|'cave'|'dungeon'|'crypt'|'urban'|'coastal'|'arctic'|'swamp'|'mountain'|'any'} EncounterEnvironmentKey
 */

/** @type {Readonly<Record<EncounterEnvironmentKey, readonly string[]>>} */
export const ENVIRONMENT_TYPE_SUBSTRINGS = Object.freeze({
  cave: Object.freeze([
    'goblin',
    'kobold',
    'monstrosity',
    'ooze',
    'dragon',
    'aberration',
    'undead',
    'humanoid',
  ]),
  forest: Object.freeze(['beast', 'plant', 'fey', 'humanoid', 'monstrosity']),
  dungeon: Object.freeze(['undead', 'construct', 'aberration', 'humanoid', 'monstrosity', 'fiend']),
  crypt: Object.freeze(['undead', 'fiend', 'construct', 'aberration']),
  urban: Object.freeze(['humanoid', 'fiend', 'celestial', 'plant', 'shapechanger']),
  coastal: Object.freeze(['beast', 'elemental', 'monstrosity', 'humanoid', 'dragon']),
  arctic: Object.freeze(['beast', 'elemental', 'monstrosity', 'humanoid', 'undead']),
  swamp: Object.freeze(['beast', 'plant', 'ooze', 'monstrosity', 'humanoid', 'dragon']),
  mountain: Object.freeze(['giant', 'dragon', 'monstrosity', 'beast', 'elemental', 'humanoid']),
  any: Object.freeze([]),
});

const KNOWN_CREATURE_TYPES = Object.freeze([
  'beast',
  'plant',
  'humanoid',
  'undead',
  'monstrosity',
  'ooze',
  'dragon',
  'giant',
  'fey',
  'elemental',
  'fiend',
  'celestial',
  'construct',
  'aberration',
]);

/** Пары с максимальной тематической связью (SRD-типы в `type_line`). */
const SYNERGY_HIGH_PAIRS = Object.freeze([
  ['undead', 'fiend'],
  ['beast', 'humanoid'],
  ['construct', 'elemental'],
]);

const DEFAULT_SYNERGY = 0.55;
const COMPATIBLE_SYNERGY_MIN = 0.85;

/**
 * Матрица совместимости типов для «Synergy Engine»: веса 0–1 для подбора отряда.
 * Высокая связь 1.0 — заданные пары; конфликт 0.1 — лорные антагонисты.
 */
export const SynergyMatrix = Object.freeze({
  /**
   * @param {string|null|undefined} typeA
   * @param {string|null|undefined} typeB
   * @returns {number}
   */
  score(typeA, typeB) {
    const a = typeA ? String(typeA).toLowerCase() : '';
    const b = typeB ? String(typeB).toLowerCase() : '';
    if (!a || !b) return 0.7;
    if (a === b) return 1;
    for (const [x, y] of SYNERGY_HIGH_PAIRS) {
      if ((a === x && b === y) || (a === y && b === x)) return 1;
    }
    if ((a === 'celestial' && b === 'undead') || (a === 'undead' && b === 'celestial')) return 0.1;
    if ((a === 'dragon' && b === 'giant') || (a === 'giant' && b === 'dragon')) return 0.1;
    return DEFAULT_SYNERGY;
  },
});

/**
 * @param {Record<string, unknown>} row
 */
function rowLooksLikeGiant(row) {
  const tl = String(row.type_line ?? '').toLowerCase();
  const nm = String(row.name ?? '').toLowerCase();
  return /\bgiant\b/.test(tl) || /\bgiant\b/.test(nm) || /\bettin\b/.test(nm);
}

/**
 * @param {Record<string, unknown>} row
 */
function rowLooksLikeDragon(row) {
  return String(row.type_line ?? '').toLowerCase().includes('dragon');
}

/**
 * Ключевые слова окружения «Crypt» имеют приоритет над общим биомом.
 *
 * @param {string[]} keywordFragments
 */
export function inferCryptEnvironmentFromKeywords(keywordFragments) {
  if (!keywordFragments || keywordFragments.length === 0) return false;
  return keywordFragments.some((k) =>
    /crypt|склеп|руин|catacomb|catacombs|tomb|necropolis|mausoleum|sepulch|burial\s*chamber|ossuar|undercroft|ruins?\b/i.test(
      String(k),
    ),
  );
}

/**
 * Имя существа из SRD, которое проходит токен «monstrosity»/«beast» для `dungeon`, но не вписывается в руины/склеп.
 * (Например, зимний волк — арктические открытые просторы, не катакомбы.)
 *
 * @param {Record<string, unknown>} row
 */
function rowLooksLikeOutdoorWildernessNotDungeonRuins(row) {
  const nm = String(row.name ?? '').toLowerCase();
  /** @type {readonly string[]} */
  const needles = [
    'winter wolf',
    'polar bear',
    'mammoth',
    'killer whale',
    'sperm whale',
    'giant octopus',
    'reef shark',
    'hunter shark',
    'giant sea horse',
    'giant eagle',
    'pteranodon',
    'plesiosaurus',
  ];
  return needles.some((s) => nm.includes(s));
}

/** Текст для биома склепа: имя, тип, начало statblock. */
function rowTextForCryptBiome(row) {
  const raw = String(row.raw_statblock_md ?? '').slice(0, 2500);
  return `${String(row.name ?? '')} ${String(row.type_line ?? '')} ${raw}`.toLowerCase();
}

/**
 * Склеп: только нежить ИЛИ явное подземелье/склеп в данных существа.
 *
 * @param {Record<string, unknown>} row
 */
export function rowMatchesCryptBiome(row) {
  if (isCryptExcludedCreature(row)) return false;
  const types = extractCreatureTypes(row);
  if (types.has('undead')) return true;
  const blob = rowTextForCryptBiome(row);
  return (
    /\bcrypt\b|\btomb\b|\bgrave\b|\bmausoleum\b|\bnecropolis\b|\bcatacomb\b|\bburial\b|\bsepulch|\bossuary\b|\bundercroft\b|\bdungeon\b|\bvault\b|\bsarcophag|\bcatacombs\b/i.test(
      blob,
    ) || /склеп|гробниц|склепа|могил|некропол/i.test(blob)
  );
}

/**
 * Сатиры, гарпии и прочие «не-склеп» даже при подходящем CR.
 *
 * @param {Record<string, unknown>} row
 */
export function isCryptExcludedCreature(row) {
  const nm = String(row.name ?? '').toLowerCase();
  const tl = String(row.type_line ?? '').toLowerCase();
  const blob = `${nm} ${tl}`;
  if (/\bsatyr\b/i.test(nm) || /\bsatyr\b/i.test(tl)) return true;
  if (/\bharpy\b/i.test(nm) || /\bharpy\b/i.test(tl)) return true;
  if (/\bmerrow\b/i.test(nm) || /\bsahuagin\b/i.test(nm) || /\blocathah\b/i.test(nm)) return true;
  if (/sea\s+hag|coastal|marine|aquatic/i.test(blob) && /\bfey\b|\bhumanoid\b/i.test(tl)) return true;
  return false;
}

/**
 * Якорь — нежить: живые humanoid-стражи/бандиты не сочетаются, кроме культистов/некромантов.
 *
 * @param {Record<string, unknown>} anchorRow
 * @param {Record<string, unknown>} candidateRow
 */
function blocksUndeadAnchorLivingHumanoid(anchorRow, candidateRow) {
  const aTypes = extractCreatureTypes(anchorRow);
  const anchorUndead = aTypes.has('undead') || primaryCreatureType(anchorRow) === 'undead';
  if (!anchorUndead) return false;
  const cTypes = extractCreatureTypes(candidateRow);
  if (!cTypes.has('humanoid') || cTypes.has('undead')) return false;
  const blob = `${String(candidateRow.name ?? '')} ${String(candidateRow.type_line ?? '')} ${String(
    candidateRow.raw_statblock_md ?? '',
  )
    .slice(0, 1200)
    .toLowerCase()}`;
  if (/necromancer|\bcultist\b|cult\s+fanatic|death\s+cult|necromantic/i.test(blob)) {
    return false;
  }
  return true;
}

/**
 * Лорный «жёсткий» конфликт пары существ.
 *
 * @param {Record<string, unknown>} anchorRow
 * @param {Record<string, unknown>} candidateRow
 */
function hasHardLoreConflict(anchorRow, candidateRow) {
  const at = primaryCreatureType(anchorRow);
  const ct = primaryCreatureType(candidateRow);
  const aTypes = extractCreatureTypes(anchorRow);
  const cTypes = extractCreatureTypes(candidateRow);
  if (aTypes.has('celestial') && cTypes.has('undead')) return true;
  if (aTypes.has('undead') && cTypes.has('celestial')) return true;
  if (at === 'celestial' && ct === 'undead') return true;
  if (at === 'undead' && ct === 'celestial') return true;
  if (aTypes.has('celestial') && cTypes.has('fiend')) return true;
  if (aTypes.has('fiend') && cTypes.has('celestial')) return true;
  if (rowLooksLikeDragon(anchorRow) && rowLooksLikeGiant(candidateRow)) return true;
  if (rowLooksLikeGiant(anchorRow) && rowLooksLikeDragon(candidateRow)) return true;
  return false;
}

/**
 * @param {EncounterEnvironmentKey} env
 */
/**
 * SQL-фильтр биома: только совпадения по токенам в `type_line` (SRD), без «угадывания» по имени —
 * выпадающий список биома задаёт тематику отряда; ключевые слова — отдельное пересечение пула.
 */
function whereClauseForEnvironment(env) {
  const keys = ENVIRONMENT_TYPE_SUBSTRINGS[env];
  if (!keys || keys.length === 0) {
    return { sql: '(1 = 1)', params: /** @type {string[]} */ ([]) };
  }
  /** @type {string[]} */
  const parts = [];
  /** @type {string[]} */
  const params = [];
  for (const fragment of keys) {
    parts.push(`instr(lower(ifnull(type_line,'')), lower(?)) > 0`);
    params.push(fragment);
  }
  return { sql: `(${parts.join(' OR ')})`, params };
}

/**
 * @param {Record<string, unknown>} row
 * @returns {Set<string>}
 */
function extractCreatureTypes(row) {
  const tl = String(row.type_line ?? '').toLowerCase();
  /** @type {Set<string>} */
  const out = new Set();
  for (const t of KNOWN_CREATURE_TYPES) {
    if (tl.includes(t)) out.add(t);
  }
  return out;
}

/**
 * @param {Record<string, unknown>} row
 * @returns {string|null}
 */
function primaryCreatureType(row) {
  const types = extractCreatureTypes(row);
  for (const t of KNOWN_CREATURE_TYPES) {
    if (types.has(t)) return t;
  }
  return null;
}

/**
 * Smart Fallback: если пул слишком мал, расширяем поиск по «ближайшим» тегам SRD.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {EncounterEnvironmentKey} env
 * @param {string[]} [keywordFragments]
 */
function expandMonsterPoolSmartFallback(db, env, keywordFragments) {
  const merged = new Map();
  for (const row of fetchMonsterPoolForEnvironment(db, env)) {
    merged.set(row.slug != null ? String(row.slug) : Number(row.id), row);
  }
  const extraTags =
    env === 'crypt'
      ? [
          'undead',
          'zombie',
          'skeleton',
          'ghoul',
          'wight',
          'specter',
          'ghost',
          'wraith',
          'mummy',
          'vampire',
          'lich',
          'necromancer',
          'cultist',
        ]
      : env === 'mountain'
        ? ['giant', 'ogre', 'troll', 'griffon', 'wyvern', 'dragon', 'humanoid']
        : ['humanoid', 'warrior', 'guard', 'soldier', 'bandit', 'scout'];
  for (const row of fetchMonstersByKeywordFragments(db, extraTags)) {
    const k = row.slug != null ? String(row.slug) : Number(row.id);
    if (!merged.has(k)) merged.set(k, row);
  }
  if (keywordFragments && keywordFragments.length > 0) {
    for (const row of fetchMonstersByKeywordFragments(db, keywordFragments)) {
      const k = row.slug != null ? String(row.slug) : Number(row.id);
      if (!merged.has(k)) merged.set(k, row);
    }
  }
  return [...merged.values()];
}

/**
 * @param {Record<string, unknown>[]} affordableThematic
 * @param {Record<string, unknown>[]} affordableHardOnly
 * @param {Record<string, unknown>} anchor
 * @param {string|null} anchorType
 * @param {boolean} leaderMode
 * @param {() => number} rng
 */
function pickSquadSubset(affordableThematic, affordableHardOnly, anchor, anchorType, leaderMode, rng) {
  if (!affordableThematic.length && !affordableHardOnly.length) return affordableThematic;
  if (!leaderMode || anchorType == null) {
    return affordableThematic.length ? affordableThematic : affordableHardOnly;
  }

  const roll = rng();
  const mode = roll < 0.7 ? 'same' : roll < 0.9 ? 'compatible' : 'wildcard';

  if (mode === 'wildcard') {
    return affordableHardOnly.length ? affordableHardOnly : affordableThematic;
  }

  const base = affordableThematic.length ? affordableThematic : affordableHardOnly;
  if (mode === 'same') {
    const same = base.filter((m) => primaryCreatureType(m) === anchorType);
    return same.length ? same : base;
  }
  const compat = base.filter((m) => {
    const pt = primaryCreatureType(m);
    if (!pt) return true;
    return SynergyMatrix.score(anchorType, pt) >= COMPATIBLE_SYNERGY_MIN;
  });
  if (compat.length) return compat;
  const relaxed = base.filter((m) => {
    const pt = primaryCreatureType(m);
    if (!pt) return true;
    return SynergyMatrix.score(anchorType, pt) >= 0.35;
  });
  return relaxed.length ? relaxed : base;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {EncounterEnvironmentKey} env
 * @returns {Array<Record<string, unknown>>}
 */
export function fetchMonsterPoolForEnvironment(db, env) {
  const { sql, params } = whereClauseForEnvironment(env);
  const query = `
    SELECT * FROM monsters
    WHERE xp IS NOT NULL AND cast(xp as real) > 0
      AND cr_numeric IS NOT NULL AND cast(cr_numeric as real) >= 0
      AND ${sql}
  `;
  return /** @type {Array<Record<string, unknown>>} */ (db.prepare(query).all(...params));
}

/**
 * @param {import('better-sqlite3').Database} db
 * @returns {Array<Record<string, unknown>>}
 */
export function fetchAllMonstersWithXp(db) {
  return /** @type {Array<Record<string, unknown>>} */ (
    db
      .prepare(
        `
    SELECT * FROM monsters
    WHERE xp IS NOT NULL AND cast(xp as real) > 0
      AND cr_numeric IS NOT NULL AND cast(cr_numeric as real) >= 0
  `,
      )
      .all()
  );
}

/**
 * Фильтр по свободному тексту: любое совпадение в name или type_line.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string[]} fragments подстроки (латиница/кириллица)
 */
export function fetchMonstersByKeywordFragments(db, fragments) {
  const list = fragments.map((f) => String(f).trim()).filter((s) => s.length > 0);
  if (list.length === 0) {
    return [];
  }
  const parts = [];
  /** @type {string[]} */
  const params = [];
  for (const f of list) {
    const q = `%${f.toLowerCase()}%`;
    parts.push(
      `(instr(lower(ifnull(name,'')), ?) > 0 OR instr(lower(ifnull(type_line,'')), ?) > 0 OR instr(lower(ifnull(raw_statblock_md,'')), ?) > 0)`,
    );
    params.push(q, q, q);
  }
  const sql = `
    SELECT * FROM monsters
    WHERE xp IS NOT NULL AND cast(xp as real) > 0
      AND cr_numeric IS NOT NULL AND cast(cr_numeric as real) >= 0
      AND (${parts.join(' OR ')})
  `;
  return /** @type {Array<Record<string, unknown>>} */ (db.prepare(sql).all(...params));
}

/**
 * Сужает пул монстров по «памяти подземелья»; при слишком узком запросе ослабляет теги (сначала старые).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {Array<Record<string, unknown>>} pool
 * @param {string[]} semanticTags
 * @param {number} [minKeep]
 * @returns {Array<Record<string, unknown>>}
 */
export function applyPersistentTagPoolNarrowing(db, pool, semanticTags, minKeep = 5) {
  const tags = Array.isArray(semanticTags)
    ? semanticTags.map((t) => String(t).trim().toLowerCase()).filter((s) => s.length > 0)
    : [];
  if (!tags.length || !pool.length) return pool;

  function rowId(row) {
    return row.slug != null && String(row.slug).length > 0 ? String(row.slug) : Number(row.id);
  }

  /**
   * @param {string[]} frags
   */
  function intersectWithFragments(frags) {
    if (!frags.length) return null;
    const hits = fetchMonstersByKeywordFragments(db, frags);
    if (!hits.length) return null;
    const idSet = new Set(hits.map(rowId));
    const narrowed = pool.filter((r) => idSet.has(rowId(r)));
    return narrowed.length >= minKeep ? narrowed : narrowed.length >= 3 ? narrowed : null;
  }

  for (let drop = 0; drop < tags.length; drop += 1) {
    const subset = tags.slice(drop);
    const frags = dungeonTagsToSqlFragments(subset);
    const narrowed = intersectWithFragments(frags);
    if (narrowed) return narrowed;
  }
  return pool;
}

/**
 * Пересечение пула биома с монстрами по ключевым словам (точнее, чем замена пула целиком).
 *
 * @param {Array<Record<string, unknown>>} pool
 * @param {Array<Record<string, unknown>>} keywordHits
 */
function intersectPoolByKeywordHits(pool, keywordHits) {
  if (!keywordHits.length) {
    return pool;
  }
  const idSet = new Set(
    keywordHits.map((r) => (r.slug != null && String(r.slug).length > 0 ? String(r.slug) : Number(r.id))),
  );
  const hit = pool.filter((r) => idSet.has(r.slug != null && String(r.slug).length > 0 ? String(r.slug) : Number(r.id)));
  return hit.length >= 3 ? hit : pool;
}

/**
 * Множитель численности встречи (DMG / D&D 5): скорректированный XP vs бюджет.
 * @param {number} monsterCount число существ в отряде (сумма count)
 */
function encounterSizeXpMultiplier(monsterCount) {
  const n = Math.max(0, Math.floor(Number(monsterCount) || 0));
  if (n <= 1) return 1;
  if (n === 2) return 1.5;
  if (n <= 6) return 2;
  if (n <= 10) return 2.5;
  if (n <= 14) return 3;
  return 4;
}

/**
 * @param {BuiltEncounter['roster']} roster
 */
function rosterTotalMonsterCount(roster) {
  let s = 0;
  for (const e of roster) {
    s += Math.max(0, Math.floor(Number(e.count) || 0));
  }
  return s;
}

/**
 * @param {BuiltEncounter['roster']} roster
 * @returns {Set<string>}
 */
function uniquePrimaryCreatureTypes(roster) {
  /** @type {Set<string>} */
  const out = new Set();
  for (const { row, count } of roster) {
    if (!count) continue;
    const pt = primaryCreatureType(row);
    if (pt) out.add(pt);
  }
  return out;
}

/**
 * Не более 3 разных «главных» типов в отряде (beast / undead / …).
 *
 * @param {BuiltEncounter['roster']} roster
 * @param {Record<string, unknown>} candidateRow
 */
function monsterFitsDiversityCap(roster, candidateRow) {
  const types = uniquePrimaryCreatureTypes(roster);
  if (types.size < 3) return true;
  const pt = primaryCreatureType(candidateRow);
  if (!pt) return true;
  return types.has(pt);
}

/**
 * @template T
 * @param {T[]} arr
 * @param {() => number} rng
 */
function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * @param {Record<string, unknown>} row
 */
function monsterXp(row) {
  return Number(row.xp);
}

/**
 * @param {Record<string, unknown>} row
 */
function monsterCr(row) {
  return Number(row.cr_numeric);
}

/**
 * Строка CR для отчётов (данные из SQLite: challenge_rating или cr_numeric).
 *
 * @param {Record<string, unknown>} row
 * @returns {string}
 */
export function formatMonsterCrDisplay(row) {
  const cr = String(row.challenge_rating ?? '').trim();
  if (cr) {
    return cr.replace(/^CR\s*/i, '').trim();
  }
  const n = Number(row.cr_numeric);
  if (!Number.isFinite(n)) {
    return '?';
  }
  if (n === 0.125) return '1/8';
  if (n === 0.25) return '1/4';
  if (n === 0.5) return '1/2';
  if (Math.abs(n - Math.round(n)) < 1e-6) {
    return String(Math.round(n));
  }
  const s = String(n);
  return s.length > 6 ? n.toFixed(2) : s;
}

/** @type {readonly string[]} */
const NEST_FAMILY_WORDS = Object.freeze([
  'spider',
  'warg',
  'wolf',
  'goblin',
  'orc',
  'kobold',
  'zombie',
  'skeleton',
  'bear',
  'rat',
  'snake',
  'octopus',
  'shark',
  'eagle',
  'stirge',
  'bandit',
  'guard',
  'cultist',
  'troll',
  'ogre',
  'giant',
]);

/**
 * @param {Record<string, unknown>} row
 */
function nestFamilyTokenFromRow(row) {
  const nm = String(row.name ?? '').toLowerCase();
  for (const t of NEST_FAMILY_WORDS) {
    if (nm.includes(t)) return t;
  }
  const part = nm
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 4)[0];
  return part || 'creature';
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} token
 */
function rowMatchesNestToken(row, token) {
  return String(row.name ?? '').toLowerCase().includes(token);
}

/**
 * @param {string|null} anchorType
 * @param {() => number} rng
 */
function pickSymbiosisPartnerType(anchorType, rng) {
  if (!anchorType) return null;
  const candidates = KNOWN_CREATURE_TYPES.filter(
    (t) => t !== anchorType && SynergyMatrix.score(anchorType, t) >= 0.55,
  );
  if (!candidates.length) return null;
  return candidates[Math.floor(rng() * candidates.length)];
}

/**
 * @typedef {'nest'|'patrol'|'symbiosis'|'boss_minions'|'horde'} EncounterArchetypeId
 */

/**
 * @typedef {{
 *   roster: Array<{
 *     row: Record<string, unknown>,
 *     count: number,
 *     injured?: boolean,
 *     isLegendarySolo?: boolean,
 *     leaderVisualTrait?: string,
 *   }>,
 *   budgetXp: number,
 *   actualXp: number,
 *   totalCr: number,
 *   environment: EncounterEnvironmentKey,
 *   partyLevel: number,
 *   playerCount: number,
 *   difficulty: string,
 *   archetype: EncounterArchetypeId,
 *   archetypeLabel: string,
 *   flavourText: string,
 *   narrative: Record<string, unknown>,
 *   worldState: 'day'|'night'|'storm',
 *   worldStateLabel: string,
 *   encounterRole: import('./loot-generator-55.mjs').EncounterEcologyRoleId,
 *   encounterRoleLabelRu: string,
 *   battlefieldHeightLevel: import('./loot-generator-55.mjs').BattlefieldHeightId,
 *   battlefieldHeightSummary: string,
 *   environmentalHazard: { label: string, dc: number, saveRu: string, saveEn: string },
 *   scoutAlarmXpBonusNextRoom: number,
 * }} BuiltEncounter
 */

/**
 * Собирает встречу под архетип (гнездо, патруль, симбиоз, босс+миньоны, орда), бюджет XP и экологию биома.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} opts
 * @param {number} opts.partyLevel
 * @param {number} opts.playerCount
 * @param {string} opts.difficulty угроза 5.5 (low/moderate/high) или legacy
 * @param {EncounterEnvironmentKey} opts.environment
 * @param {string[]} [opts.keywordFragments] подстроки из описания — сужают пул монстров
 * @param {string} [opts.environmentExtraText] доп. текст окружения (вода, огонь, тьма…) — модификатор тактики
 * @param {() => number} [opts.rng]
 * @param {'day'|'night'|'storm'} [opts.worldState] день / ночь / буря (иначе случайный бросок)
 * @param {string} [opts.nextEncounterHint] подсказка для поля «След» в нарративе
 * @param {string[]} [opts.persistentMonsterTags] теги из «памяти подземелья» (undead, cultist…)
 * @param {number} [opts.dungeonXpBudgetMultiplier] множитель к XP-бюджету (напр. 0.1 = +10%)
 * @param {number} [opts.floorDepth] глубина подземелья (DC опасностей)
 * @returns {BuiltEncounter}
 */
export function buildEncounterFromDatabase(db, opts) {
  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
  const worldState = normalizeWorldState(opts.worldState) ?? rollWorldState(rng);
  const worldStateLabel = formatWorldStateLabelRuEn(worldState);
  const extraText = String(opts.environmentExtraText ?? '');
  const partyLevel = Math.min(20, Math.max(1, Math.floor(Number(opts.partyLevel) || 1)));
  const playerCount = Math.min(12, Math.max(1, Math.floor(Number(opts.playerCount) || 4)));
  const difficultyRaw = String(opts.difficulty || 'moderate').toLowerCase();
  const autoThreat = partyLevel <= 4 ? 'low' : partyLevel <= 10 ? 'moderate' : 'high';
  let normalizedDifficultyInput =
    difficultyRaw === 'auto' || difficultyRaw === 'default' ? autoThreat : difficultyRaw;
  /** DMG 2024: на 1–4 уровне только Low / Moderate — High для бюджета XP не применяем. */
  if (partyLevel <= 4 && normalizeEncounterThreat(normalizedDifficultyInput) === 'high') {
    normalizedDifficultyInput = 'moderate';
  }
  const isDeadly = normalizedDifficultyInput === 'deadly';
  const difficulty = normalizeEncounterThreat(normalizedDifficultyInput);
  let environment = /** @type {EncounterEnvironmentKey} */ (
    String(opts.environment || 'any').toLowerCase() in ENVIRONMENT_TYPE_SUBSTRINGS
      ? String(opts.environment).toLowerCase()
      : 'any'
  );

  const floorDepth = Math.max(0, Math.floor(Number(opts.floorDepth) || 0));
  const biasXp = Math.max(0, Number(opts.dungeonXpBudgetMultiplier) || 0);
  const baseBudgetXp = totalEncounterXpBudget(partyLevel, playerCount, normalizedDifficultyInput);
  const budgetXp = Math.round(baseBudgetXp * (1 + biasXp));

  const kw = Array.isArray(opts.keywordFragments)
    ? opts.keywordFragments.map((x) => String(x).trim()).filter((s) => s.length > 0)
    : [];

  /** Biome supremacy: ключ «Crypt» / склеп переопределяет окружение. */
  if (inferCryptEnvironmentFromKeywords(kw) || /^crypt$/i.test(String(opts.environment || '').trim())) {
    environment = 'crypt';
  }

  let pool =
    environment === 'any' ? fetchAllMonstersWithXp(db) : fetchMonsterPoolForEnvironment(db, environment);
  if (pool.length < 8) {
    pool = fetchAllMonstersWithXp(db);
  }
  if (kw.length > 0) {
    const keywordHits = fetchMonstersByKeywordFragments(db, kw);
    pool = intersectPoolByKeywordHits(pool, keywordHits);
  }

  const persistentMonsterTags = Array.isArray(opts.persistentMonsterTags)
    ? opts.persistentMonsterTags.map((x) => String(x).trim().toLowerCase()).filter((s) => s.length > 0)
    : [];
  if (persistentMonsterTags.length > 0) {
    pool = applyPersistentTagPoolNarrowing(db, pool, persistentMonsterTags, 5);
  }

  const maxMonsterCr = Math.min(30, partyLevel + 2);
  const totalCrCap = Math.max(0.125, partyLevel * 1.3);
  pool = pool.filter((r) => monsterCr(r) <= maxMonsterCr && Number.isFinite(monsterCr(r)));
  if (pool.length < 8) {
    pool = fetchAllMonstersWithXp(db).filter((r) => monsterCr(r) <= maxMonsterCr && Number.isFinite(monsterCr(r)));
  }
  if (environment === 'crypt') {
    const strict = pool.filter((r) => rowMatchesCryptBiome(r));
    const broad =
      strict.length >= 5
        ? strict
        : fetchAllMonstersWithXp(db).filter((r) => rowMatchesCryptBiome(r) && !isCryptExcludedCreature(r));
    pool = broad.length >= 3 ? broad : strict.length ? strict : pool.filter((r) => rowMatchesCryptBiome(r));
    if (pool.length < 4) {
      const undeadOnly = fetchMonstersByKeywordFragments(db, ['undead']).filter(
        (r) => !isCryptExcludedCreature(r),
      );
      if (undeadOnly.length >= 3) pool = undeadOnly;
    }
  }
  if (pool.length < 12) {
    pool = expandMonsterPoolSmartFallback(db, environment, kw);
  }
  if (environment === 'crypt') {
    pool = pool.filter((r) => rowMatchesCryptBiome(r));
  }
  if (environment === 'crypt' && pool.length === 0) {
    pool = fetchMonstersByKeywordFragments(db, ['undead', 'skeleton', 'zombie']).filter(
      (r) => !isCryptExcludedCreature(r),
    );
  }

  pool = pool.filter((r) => monsterCr(r) <= maxMonsterCr && Number.isFinite(monsterCr(r)));
  if (pool.length === 0) {
    pool = fetchAllMonstersWithXp(db).filter((r) => monsterCr(r) <= maxMonsterCr && Number.isFinite(monsterCr(r)));
  }

  if (environment === 'dungeon') {
    const culled = pool.filter((r) => !rowLooksLikeOutdoorWildernessNotDungeonRuins(r));
    if (culled.length >= 8) {
      pool = culled;
    }
  }

  pool = [...pool];
  const poolBio = pool.filter((r) => !rowContradictsBiome(environment, r));
  if (poolBio.length >= 10) {
    pool = poolBio;
  }

  /** @type {'nest'|'patrol'|'symbiosis'|'boss_minions'|'horde'} */
  let archetype = 'patrol';
  /** @type {BuiltEncounter['roster']} */
  let roster = [];
  /** @type {Record<string, unknown>|undefined} */
  let anchor;
  let actualXp = 0;

  function rowKey(row) {
    return row.slug != null ? String(row.slug) : Number(row.id);
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    shuffleInPlace(pool, rng);
    archetype = rollEncounterArchetype(rng);
    // Horde sanity-check: нужно минимум 5 существ; если бюджет не позволяет — переключаем
    if (archetype === 'horde') {
      const weakPool = pool.filter((r) => monsterXp(r) > 0);
      const cheapestXp = weakPool.length
        ? Math.min(...weakPool.map((r) => monsterXp(r)))
        : budgetXp;
      const estimatedCount = cheapestXp > 0 ? Math.floor(budgetXp / cheapestXp) : 0;
      if (estimatedCount < 5) {
        archetype = /** @type {import('./loot-generator-55.mjs').EncounterArchetypeId} */ (
          rng() < 0.5 ? 'patrol' : 'boss_minions'
        );
      }
    }
    const maxMonsters = maxCreaturesForArchetype(playerCount, archetype);
    const xpMult = playerCount >= 4 ? 1.12 : 1;
    const ceilBudget = budgetXp * 1.08 * xpMult;
    const floorStop = budgetXp * 0.06;

    const targetBossCr = Math.min(
      maxMonsterCr,
      Math.max(
        0.125,
        Number(partyLevel) / 4 +
          (difficulty === 'high' ? (isDeadly ? 3 : 2) : difficulty === 'moderate' ? 1 : 0),
      ),
    );
    const anchorTargetCr =
      archetype === 'boss_minions'
        ? Math.min(maxMonsterCr, partyLevel / 4 + 2)
        : targetBossCr;

    let scanPool = pool;
    if (archetype === 'patrol') {
      const hp = pool.filter((r) => String(r.type_line ?? '').toLowerCase().includes('humanoid'));
      if (hp.length >= 4) {
        scanPool = hp;
      }
    }

    anchor = undefined;
    let bestGap = Infinity;
    for (const row of scanPool) {
      const g = Math.abs(monsterCr(row) - anchorTargetCr);
      if (g < bestGap || (anchor == null && g === bestGap)) {
        anchor = row;
        bestGap = g;
        if (g < 0.25) break;
      }
    }
    if (!anchor && pool.length) {
      anchor = pool[Math.floor(rng() * pool.length)];
    }
    const anchorType = anchor ? primaryCreatureType(anchor) : null;
    const leaderMode = Boolean(anchor && monsterCr(anchor) > 3);

    const nestToken = archetype === 'nest' && anchor ? nestFamilyTokenFromRow(anchor) : '';
    const symSecond =
      archetype === 'symbiosis' && anchor ? pickSymbiosisPartnerType(anchorType, rng) : null;
    /** @type {Array<Record<string, unknown>>} */
    let linkedPatrol = [];
    if (archetype === 'patrol' && anchor) {
      linkedPatrol = fetchMonstersMentioningLeaderKeywords(db, anchor, maxMonsterCr, 36);
    }

    roster =
      anchor != null
        ? [
            {
              row: anchor,
              count: 1,
            },
          ]
        : [];
    actualXp = anchor ? monsterXp(anchor) : 0;

    let guard = 0;
    while (actualXp + 1 < ceilBudget && guard < 40) {
      guard += 1;
      if (rosterTotalMonsterCount(roster) >= maxMonsters) {
        break;
      }
      const slack = ceilBudget - actualXp;
      if (slack < floorStop) break;

      const affordable = pool.filter((m) => monsterXp(m) <= slack && monsterXp(m) > 0);
      const affordableHard = anchor
        ? affordable.filter(
            (m) =>
              !hasHardLoreConflict(/** @type {Record<string, unknown>} */ (anchor), m) &&
              !blocksUndeadAnchorLivingHumanoid(/** @type {Record<string, unknown>} */ (anchor), m),
          )
        : affordable;
      const thematicAffordable = affordableHard.filter((m) => {
        if (!anchorType) return true;
        const pt = primaryCreatureType(m);
        if (!pt) return true;
        if (anchorType === 'celestial' && (pt === 'undead' || String(m.name ?? '').toLowerCase().includes('goblin'))) {
          return false;
        }
        if (anchorType === 'undead' && pt === 'celestial') return false;
        return SynergyMatrix.score(anchorType, pt) > 0.15;
      });
      const diversityFiltered = thematicAffordable.filter((m) => monsterFitsDiversityCap(roster, m));
      const squadPool = pickSquadSubset(
        diversityFiltered.length ? diversityFiltered : thematicAffordable.length
          ? thematicAffordable
          : affordableHard,
        affordableHard.length ? affordableHard : affordable,
        /** @type {Record<string, unknown>} */ (anchor),
        anchorType,
        leaderMode,
        rng,
      );
      let subset = squadPool.length ? squadPool : affordable.length ? affordable : pool;
      subset = subset.filter((m) => monsterFitsDiversityCap(roster, m));
      if (!subset.length) {
        subset = squadPool.length ? squadPool : affordable.length ? affordable : pool;
      }

      if (archetype === 'nest' && nestToken) {
        const nestOnly = subset.filter((m) => rowMatchesNestToken(m, nestToken));
        if (nestOnly.length) subset = nestOnly;
      }
      if (archetype === 'symbiosis' && symSecond && anchorType) {
        const symOnly = subset.filter((m) => {
          const pt = primaryCreatureType(m);
          return pt === anchorType || pt === symSecond;
        });
        if (symOnly.length) subset = symOnly;
      }
      if (archetype === 'boss_minions' && anchor) {
        const ak = rowKey(anchor);
        const weakOnly = subset.filter((m) => rowKey(m) === ak || monsterCr(m) <= 0.5);
        if (weakOnly.length) subset = weakOnly;
      }
      if (archetype === 'horde') {
        const soft = subset.filter((m) => monsterCr(m) <= Math.min(4, partyLevel / 2 + 1));
        if (soft.length) subset = soft;
      }

      if (archetype === 'patrol' && linkedPatrol.length && rng() < 0.42) {
        const keyAff = new Set(affordableHard.map((m) => rowKey(m)));
        const linkedPick = linkedPatrol.filter((m) => keyAff.has(rowKey(m)));
        if (linkedPick.length) {
          subset = linkedPick.filter((m) => monsterFitsDiversityCap(roster, m));
          if (!subset.length) subset = linkedPick;
        }
      }

      let choice = subset[Math.floor(rng() * subset.length)];
      if (!choice) break;
      const k = rowKey(choice);

      const slot = roster.find((r) => rowKey(r.row) === k);
      const nAfter = rosterTotalMonsterCount(roster) + 1;
      const rawXpAfter = actualXp + monsterXp(choice);
      const multAfter = encounterSizeXpMultiplier(nAfter);
      if (rawXpAfter * multAfter > ceilBudget) {
        break;
      }
      const currentCrSum = roster.reduce((s, e) => s + monsterCr(e.row) * e.count, 0);
      const crAfter = currentCrSum + monsterCr(choice);
      if (crAfter > totalCrCap + 1e-6) {
        break;
      }

      if (slot) {
        slot.count += 1;
      } else {
        roster.push({ row: choice, count: 1 });
      }
      actualXp += monsterXp(choice);

      const dupRoll = archetype === 'horde' ? 0.38 : 0.72;
      const dupCap = archetype === 'horde' ? 10 : 14;
      if (rng() > dupRoll && roster.length <= dupCap && rosterTotalMonsterCount(roster) < maxMonsters) {
        const nDup = rosterTotalMonsterCount(roster) + 1;
        const rawDup = actualXp + monsterXp(choice);
        if (rawDup * encounterSizeXpMultiplier(nDup) <= ceilBudget) {
          const crDup = roster.reduce((s, e) => s + monsterCr(e.row) * e.count, 0) + monsterCr(choice);
          if (crDup <= totalCrCap + 1e-6) {
            const again = roster.find((r) => rowKey(r.row) === k);
            if (again) {
              again.count += 1;
              actualXp += monsterXp(choice);
            }
          }
        }
      }
    }

    const audit = auditEncounterRoster(roster, totalCrCap, partyLevel);
    if (audit.ok || attempt === 3) {
      break;
    }
    roster = [];
    actualXp = 0;
  }

  /** Legendary / action economy: один враг против 4+ героев — усилить якорь по XP-бюджету. */
  let isLegendarySolo = false;
  if (
    playerCount >= 4 &&
    roster.length === 1 &&
    roster[0].count === 1 &&
    archetype !== 'horde'
  ) {
    const ceilBudgetSolo = budgetXp * 1.08 * 1.22;
    const cur = roster[0].row;
    const better = pool
      .filter(
        (m) =>
          monsterXp(m) <= ceilBudgetSolo &&
          monsterCr(m) > monsterCr(cur) &&
          !rowContradictsBiome(environment, m),
      )
      .sort((a, b) => monsterCr(b) - monsterCr(a));
    if (better[0]) {
      roster[0].row = better[0];
      roster[0].isLegendarySolo = true;
      isLegendarySolo = true;
      actualXp = monsterXp(better[0]);
    }
  }

  applyInjuryVarianceToRoster(roster, rng);
  const leadIdx = pickLeaderIndexInRoster(roster);
  if (roster[leadIdx]) {
    roster[leadIdx].leaderVisualTrait = pickLeaderUniqueTraitLocalized(rng);
  }

  actualXp = roster.reduce((s, e) => s + monsterXp(e.row) * Math.max(0, Math.floor(Number(e.count) || 0)), 0);

  const totalCr = roster.reduce((s, e) => s + monsterCr(e.row) * e.count, 0);
  const pair = buildEncounterFlavourTextPair(roster, leadIdx, extraText);
  const flavourText = formatLocalizedWithOriginalSuffix(pair.ru, pair.en);
  const encounterRole = inferEncounterEcologyRole(roster, partyLevel, rng);
  const scoutAlarmXpBonusNextRoom = encounterRole === 'scout' ? 0.15 : 0;
  const bf = rollBattlefieldHeightProfile(rng);
  const haz = rollEnvironmentalHazard(floorDepth, rng);
  const ecologyTactics = formatEncounterEcologyTacticsLocalized(encounterRole);
  const narrative = buildScenarioNarrativeBundle(db, {
    archetype,
    roster,
    environmentKey: environment,
    environmentExtraText: extraText,
    isLegendarySolo,
    rng,
    worldState,
    nextEncounterHint: String(opts.nextEncounterHint ?? ''),
    encounterRole,
    ecologyTactics,
    battlefieldHeightSummary: bf.summary,
    environmentalHazardLine: haz.label,
  });

  return {
    roster,
    budgetXp,
    actualXp,
    totalCr: Number.isFinite(totalCr) ? totalCr : partyLevel / 4,
    environment,
    partyLevel,
    playerCount,
    difficulty,
    archetype,
    archetypeLabel: formatArchetypeLabelRuEn(archetype),
    flavourText,
    narrative,
    worldState,
    worldStateLabel,
    encounterRole,
    encounterRoleLabelRu: formatEncounterEcologyRoleLabelRu(encounterRole),
    battlefieldHeightLevel: bf.heightLevel,
    battlefieldHeightSummary: bf.summary,
    environmentalHazard: haz,
    scoutAlarmXpBonusNextRoom,
  };
}

/**
 * @param {BuiltEncounter['roster']} roster
 * @returns {Set<string>}
 */
export function dominantCreatureTagsFromRoster(roster) {
  /** @type {Set<string>} */
  const out = new Set();
  const known = KNOWN_CREATURE_TYPES;
  for (const { row } of roster) {
    const tl = String(row.type_line ?? '').toLowerCase();
    for (const k of known) {
      if (tl.includes(k)) out.add(k);
    }
  }
  return out;
}

export function environmentLabelRu(key) {
  switch (key) {
    case 'forest':
      return 'Лес';
    case 'cave':
      return 'Пещера / подземелье';
    case 'dungeon':
      return 'Руины / склеп';
    case 'crypt':
      return 'Склеп';
    case 'urban':
      return 'Город';
    case 'coastal':
      return 'Побережье';
    case 'arctic':
      return 'Север / тундра';
    case 'swamp':
      return 'Болото';
    case 'mountain':
      return 'Горы';
    case 'any':
      return 'Любое';
    default:
      return String(key);
  }
}
