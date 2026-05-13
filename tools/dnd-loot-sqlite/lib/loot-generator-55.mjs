import { NON_COMMON_RARITY_SQL } from './lootMagicFilter.mjs';
import { dbgLootSql } from './lootSqlDebug.mjs';
import {
  itemLooksUrbanOrTechnical,
  itemLooksWritingSupplies,
  pickDungeonCorridorMundaneReplacement,
  pickNaturalTrophyOrGem,
  rosterTagsSuggestNoWritingDesk,
} from './lootNaturalContext.mjs';
import { SQL_ITEMS_LOCALIZED_FROM, SQL_ITEMS_LOCALIZED_SELECT } from './sql-items-localized.mjs';
import { formatLocalizedWithOriginalSuffix } from './db-localization.mjs';
import { effectiveItemPickWeight, pickRandomItemRowWeighted } from './loot-nexus-weights.mjs';
import { normalizeScoringContext } from './dm-scoring-contract.mjs';

/** @type {readonly string[]} */
const RARITY_ORDER = Object.freeze([
  'Common',
  'Uncommon',
  'Rare',
  'Very Rare',
  'Legendary',
]);

/**
 * @param {() => number} rng
 * @returns {number}
 */
function rollD100(rng) {
  return 1 + Math.floor(Math.max(0, Math.min(0.999999, rng())) * 100);
}

/** Рюкзаки и наборы «заменяют» магию в отчётах — исключаем из наград. */
export function isAdventuringPackExcluded(row) {
  const n = String(row.name ?? '').toLowerCase();
  if (!n) return false;
  if (n.includes('dungeoneer') && n.includes('pack')) return true;
  if (n.includes('explorer') && n.includes('pack')) return true;
  return false;
}

const SQL_EXCLUDE_ADVENTURING_PACKS = `AND NOT (lower(ifnull(i.name,'')) LIKE '%explorer%' AND lower(ifnull(i.name,'')) LIKE '%pack%')
    AND NOT (lower(ifnull(i.name,'')) LIKE '%dungeoneer%' AND lower(ifnull(i.name,'')) LIKE '%pack%')`;

const MUNDANE_JUNK_KEYWORDS = Object.freeze([
  'blanket',
  'cup',
  'mug',
  'plate',
  'spoon',
  'fork',
  'bowl',
  'bucket',
  'soap',
  'lamp oil',
  'candle',
  'chalk',
  'rope',
  'flask',
  'pitcher',
  'cloth',
  'common clothes',
  'traveler',
  'bedroll',
  'rations',
  'waterskin',
]);

/**
 * @param {Record<string, unknown>} row
 * @returns {boolean}
 */
function isLowValueMundaneJunk(row) {
  const name = String(row.name ?? '').toLowerCase();
  const cat = String(row.category ?? '').toLowerCase();
  const sub = String(row.subcategory ?? '').toLowerCase();
  const text = `${name} ${cat} ${sub}`;
  if (MUNDANE_JUNK_KEYWORDS.some((kw) => text.includes(kw))) {
    return true;
  }
  const cost = Number(row.cost_gp);
  return Number.isFinite(cost) && cost > 0 && cost <= 2 && !cat.includes('gem') && !cat.includes('jewel');
}

/**
 * Сундук (Treasure Hoard) в D&D 5.5 — без «хозтоваров»: только монеты, драгоценности, арт, магия.
 *
 * @param {Record<string, unknown>} row
 */
function isTreasureChestMundaneExcluded(row) {
  if (isLowValueMundaneJunk(row)) return true;
  const cat = String(row.category ?? '').toLowerCase();
  if (cat.includes('adventuring') || cat === 'adventuring gear') return true;
  if (cat.includes('food') || cat.includes('drink')) return true;
  return false;
}

/**
 * Мягкий потолок стоимости одной выдачи лута на группу (DMG 2024, ориентир богатства).
 *
 * @param {number} partyLevel
 * @param {number} playerCount
 */
export function partyTreasureSoftCapGp(partyLevel, playerCount) {
  const lv = Math.min(20, Math.max(1, Math.floor(Number(partyLevel) || 1)));
  const n = Math.min(12, Math.max(1, Math.floor(Number(playerCount) || 1)));
  const perChar = Math.round(80 + lv * 95 + lv * lv * 18);
  return Math.round(perChar * n * 0.45);
}

/**
 * Минимальное золото в сундуке (Treasure Hoard): не пустой лут.
 *
 * @param {number} partyLevel
 * @param {number} playerCount
 */
export function treasureHoardGoldFloorGp(partyLevel, playerCount) {
  const lv = Math.min(20, Math.max(1, Math.floor(Number(partyLevel) || 1)));
  const n = Math.min(12, Math.max(1, Math.floor(Number(playerCount) || 1)));
  return lv * 10 * n;
}

/**
 * @param {Array<Record<string, unknown>>} rows
 */
function sumItemsCostGp(rows) {
  let s = 0;
  for (const row of rows) {
    const g = Number(row.cost_gp);
    if (Number.isFinite(g) && g > 0) s += g;
  }
  return s;
}

/**
 * @param {Array<Record<string, unknown>>} magicItems
 * @param {Array<Record<string, unknown>>} mundaneItems
 * @param {number|null} coinsApproxGp
 * @param {number} capGp
 */
export function clipLootTotalsToWealthCap(magicItems, mundaneItems, coinsApproxGp, capGp) {
  const cap = Number(capGp);
  if (!Number.isFinite(cap) || cap <= 0) {
    return { magic: magicItems.slice(), mundane: mundaneItems.slice(), coins: coinsApproxGp };
  }
  const magic = magicItems.slice();
  const mundane = mundaneItems.slice();
  let coins = coinsApproxGp;
  const totalVal = () =>
    sumItemsCostGp(magic) + sumItemsCostGp(mundane) + (coins != null && Number.isFinite(coins) ? coins : 0);
  while (totalVal() > cap && magic.length > 0) {
    magic.pop();
  }
  while (totalVal() > cap && mundane.length > 0) {
    mundane.pop();
  }
  if (totalVal() > cap && coins != null && Number.isFinite(coins)) {
    const itemsOnly = sumItemsCostGp(magic) + sumItemsCostGp(mundane);
    coins = Math.max(0, Math.round(cap - itemsOnly));
  }
  return { magic, mundane, coins };
}

/**
 * D100: магия сокровищницы (скрытый бросок). 1–80 — только золото/драгоценности; 81–95 — одна вещь Common/Uncommon; 96–100 — Rare+.
 *
 * @param {() => number} rng
 * @returns {{ magicItemRolls: number, rarityBuckets: string[]|null }}
 */
export function rollTreasureHoardMagicPlanFromD100(rng) {
  const d = rollD100(rng);
  if (d <= 80) {
    return { magicItemRolls: 0, rarityBuckets: null };
  }
  if (d <= 95) {
    return { magicItemRolls: 1, rarityBuckets: ['Common', 'Uncommon'] };
  }
  return { magicItemRolls: 1, rarityBuckets: ['Rare', 'Very Rare', 'Legendary'] };
}

/**
 * @param {number} cr
 * @returns {number} tier 1–4
 */
export function tierFromCr(cr) {
  const n = Number(cr);
  if (!Number.isFinite(n)) {
    return 1;
  }
  if (n <= 4) {
    return 1;
  }
  if (n <= 10) {
    return 2;
  }
  if (n <= 16) {
    return 3;
  }
  return 4;
}

/**
 * Жёсткий потолок редкости по ЧИ:
 * CR 0–4: Common / Uncommon; 5–10: +Rare; 11+: Very Rare и Legendary.
 *
 * @param {number} crValue
 * @returns {number} индекс в RARITY_ORDER
 */
export function maxRarityIndexForCr(crValue) {
  const n = Number(crValue);
  if (!Number.isFinite(n)) {
    return 1;
  }
  if (n <= 4) {
    return 1;
  }
  if (n <= 10) {
    return 2;
  }
  return 4;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {number} cr
 * @returns {{ tier: number, weights: Record<string, number> }|null}
 */
/** Запасные веса, если в БД нет строки `encounters` (сборка без импорта и т.п.). */
const DEFAULT_ENCOUNTER_WEIGHTS_BY_TIER = Object.freeze({
  1: Object.freeze({ Common: 52, Uncommon: 32, Rare: 10, 'Very Rare': 4, Legendary: 2 }),
  2: Object.freeze({ Common: 35, Uncommon: 38, Rare: 16, 'Very Rare': 8, Legendary: 3 }),
  3: Object.freeze({ Common: 22, Uncommon: 28, Rare: 28, 'Very Rare': 16, Legendary: 6 }),
  4: Object.freeze({ Common: 12, Uncommon: 20, Rare: 28, 'Very Rare': 28, Legendary: 12 }),
});

export function encounterWeightsForCr(db, cr) {
  const t = tierFromCr(cr);
  const row = db
    .prepare(
      `SELECT tier, rarity_weights_json FROM encounters WHERE tier = ? LIMIT 1`,
    )
    .get(t);
  if (!row) {
    const fallback = DEFAULT_ENCOUNTER_WEIGHTS_BY_TIER[/** @type {1|2|3|4} */ (t)];
    if (fallback) {
      console.warn(
        `[loot] Нет строки encounters для tier=${t} — используются встроенные веса редкости.`,
      );
      return { tier: t, weights: { ...fallback } };
    }
    return null;
  }
  const weights = /** @type {Record<string, number>} */ (
    JSON.parse(/** @type {{ rarity_weights_json: string }} */ (row).rarity_weights_json)
  );
  return { tier: /** @type {{ tier: number }} */ (row).tier, weights };
}

/**
 * Суммарный CR для сокровищ: не ниже `partyLevel/4` и не ниже `cr_min` яруса из `encounters`,
 * чтобы группа 11+ уровня (Tier 3) не получала таблицы как у CR 0 при «лёгкой» встрече.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} partyLevel
 * @param {number} encounterTotalCr
 */
const TIER_CR_MIN_FALLBACK = Object.freeze([0.125, 5, 11, 17]);

export function resolveTreasureCrNumeric(db, partyLevel, encounterTotalCr) {
  const lv = Math.min(20, Math.max(1, Math.floor(Number(partyLevel) || 1)));
  const enc = Number(encounterTotalCr);
  const encOk = Number.isFinite(enc) && enc > 0 ? enc : 0;
  const tier = lv <= 4 ? 1 : lv <= 10 ? 2 : lv <= 16 ? 3 : 4;
  const row = db.prepare(`SELECT cr_min FROM encounters WHERE tier = ? LIMIT 1`).get(tier);
  const tierCrMin = Number(row?.cr_min);
  const dataFloor =
    Number.isFinite(tierCrMin) && tierCrMin > 0 ? tierCrMin : TIER_CR_MIN_FALLBACK[tier - 1] ?? lv / 4;
  const floor = Number.isFinite(dataFloor) && dataFloor > 0 ? dataFloor : lv / 4;
  const crCap = lv + 2;
  const merged = Math.max(0.125, Math.min(30, Math.max(encOk, lv / 4, floor)));
  return Math.min(crCap, merged);
}

/**
 * @param {Record<string, number>} weights
 * @param {() => number} rng [0,1)
 * @returns {string|null}
 */
export function pickRarityFromWeights(weights, rng) {
  const entries = Object.entries(weights).filter(([, v]) => v > 0);
  if (entries.length === 0) {
    return null;
  }
  const total = entries.reduce((a, [, w]) => a + w, 0);
  if (total <= 0) {
    return null;
  }
  let roll = rng() * total;
  for (const [k, w] of entries) {
    roll -= w;
    if (roll <= 0) {
      return k;
    }
  }
  return entries[entries.length - 1][0];
}

/**
 * @template T
 * @param {T[]} rows
 * @param {(row: T) => number} getWeight
 * @param {() => number} rng
 * @returns {number}
 */
function pickWeightedIndex(rows, getWeight, rng) {
  if (rows.length === 0) {
    return -1;
  }
  /** @type {number[]} */
  const w = [];
  let total = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const wi = Math.max(0, Number(getWeight(rows[i])) || 0);
    w.push(wi);
    total += wi;
  }
  if (total <= 0) {
    return -1;
  }
  let roll = rng() * total;
  for (let i = 0; i < rows.length; i += 1) {
    roll -= w[i];
    if (roll <= 0) {
      return i;
    }
  }
  return rows.length - 1;
}

/**
 * Map SRD item.rarity text to weight key (first matching tier name).
 *
 * @param {string|null|undefined} rarity
 * @returns {string|null}
 */
export function rarityBucket(rarity) {
  if (rarity == null || String(rarity).trim() === '') {
    return null;
  }
  const r = String(rarity).trim().toLowerCase();
  if (r.includes('very rare') || r.includes('very-rare')) {
    return 'Very Rare';
  }
  if (r.includes('legendary')) {
    return 'Legendary';
  }
  if (/artifact/.test(r)) {
    return 'Legendary';
  }
  if (r.includes('uncommon')) {
    return 'Uncommon';
  }
  if (r.includes('rare')) {
    return 'Rare';
  }
  if (r.includes('common')) {
    return 'Common';
  }
  return null;
}

/**
 * Число магических предметов в одной сокровищнице — строго 0–2 (кости), без «шторма» из 9+ позиций.
 *
 * @param {number} sumCrNumeric
 * @param {() => number} rng
 */
export function rollHoardMagicItemCount(sumCrNumeric, rng = Math.random) {
  void sumCrNumeric;
  return rollTreasureHoardMagicPlanFromD100(rng).magicItemRolls;
}

/**
 * План бросков «сокровищницы» по суммарному CR группы (Treasure Hoard).
 *
 * @param {number} sumCrNumeric
 * @param {() => number} [rng]
 * @returns {{
 *   magicItemRolls: number,
 *   magicRarityBuckets: string[]|null,
 *   mundanePicks: number,
 *   coinBundleRolls: number,
 *   effectiveCr: number,
 * }}
 */
export function treasureHoardRollPlanFromGroupCr(sumCrNumeric, rng = Math.random) {
  const raw = Number(sumCrNumeric);
  const s = Number.isFinite(raw) && raw > 0 ? raw : 0;
  const mp = rollTreasureHoardMagicPlanFromD100(rng);
  const magicItemRolls = mp.magicItemRolls;
  const magicRarityBuckets = mp.rarityBuckets;
  const mundanePicks = Math.min(6, Math.max(0, Math.floor(s / 6)));
  const coinBundleRolls = Math.min(6, Math.max(1, 1 + Math.floor(s / 5)));
  const effectiveCr = Math.min(30, Math.max(0.125, s || 0.125));
  return { magicItemRolls, magicRarityBuckets, mundanePicks, coinBundleRolls, effectiveCr };
}

/**
 * Оценка золота из строк категории `Currency` в `items` (если таких нет — null).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} sumCrNumeric
 * @param {() => number} rng
 * @returns {number|null}
 */
export function approximateHoardCoinsGp(db, sumCrNumeric, rng = Math.random) {
  const samples = /** @type {{ cost_gp: number }[]} */ (
    db
      .prepare(
        `SELECT cost_gp FROM items
       WHERE category = 'Currency' AND cost_gp IS NOT NULL AND cost_gp > 0`,
      )
      .all()
  );
  if (!samples.length) {
    return null;
  }
  const plan = treasureHoardRollPlanFromGroupCr(sumCrNumeric, rng);
  let total = 0;
  for (let i = 0; i < plan.coinBundleRolls; i += 1) {
    const row = samples[Math.floor(rng() * samples.length)];
    total += Number(row.cost_gp) * (0.4 + rng() * 1.2) * (0.6 + plan.effectiveCr / 25);
  }
  return Math.max(0, Math.round(total));
}

/**
 * Оценка «карманного» золота (Individual Treasure) — заметно скромнее полной сокровищницы.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} sumCrNumeric
 * @param {() => number} rng
 * @returns {number|null}
 */
export function approximateIndividualCoinsGp(db, sumCrNumeric, rng = Math.random) {
  const samples = /** @type {{ cost_gp: number }[]} */ (
    db
      .prepare(
        `SELECT cost_gp FROM items
       WHERE category = 'Currency' AND cost_gp IS NOT NULL AND cost_gp > 0`,
      )
      .all()
  );
  const s = Number(sumCrNumeric);
  const cr = Number.isFinite(s) && s > 0 ? s : 0.125;
  const pocket = 0.1 + rng() * 0.42;
  const crScale = 0.28 + Math.min(1.2, cr / 12) * 0.48;
  /** Не возвращаем 0/null: «карманный лут» в UI не должен быть пустой строкой из‑за округления. */
  if (!samples.length) {
    return Math.max(1, Math.round((4 + cr * 5) * (0.4 + rng() * 0.5)));
  }
  const row = samples[Math.floor(rng() * samples.length)];
  const gp = Number(row.cost_gp);
  const product = Number.isFinite(gp) && gp > 0 ? gp * pocket * crScale : 3 + cr * 2;
  return Math.max(1, Math.round(product));
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string[]} categories
 * @param {() => number} rng
 * @param {number} caveGemBias
 * @param {string|undefined} [contextTag] приоритет строкам `items.tags`
 * @param {string[]|undefined} [themeTags] тематические теги сцены
 * @returns {Record<string, unknown>|undefined}
 */
function pickCheapMundaneItem(db, categories, rng, caveGemBias = 0, contextTag, themeTags) {
  const baseExclusions = `ifnull(i.is_magic,0) = 0 AND i.category NOT IN ('Currency', 'Services')
    AND i.cost_gp IS NOT NULL AND i.cost_gp > 0 AND i.cost_gp <= 60 ${SQL_EXCLUDE_ADVENTURING_PACKS}`;
  /** @type {Record<string, unknown>|undefined} */
  let row;
  if (rng() < caveGemBias) {
    const sql = `SELECT ${SQL_ITEMS_LOCALIZED_SELECT} FROM ${SQL_ITEMS_LOCALIZED_FROM} WHERE ${baseExclusions} AND (
          lower(ifnull(i.category,'')) LIKE '%gem%' OR lower(ifnull(i.name,'')) LIKE '%ore%'
        )`;
    row = pickRandomItemRowWeighted(db, sql, [], contextTag, rng, 320, themeTags);
  }
  if (
    !row &&
    caveGemBias >= 0.5 &&
    rng() < Math.min(0.65, caveGemBias * 0.5)
  ) {
    const sql = `SELECT ${SQL_ITEMS_LOCALIZED_SELECT} FROM ${SQL_ITEMS_LOCALIZED_FROM} WHERE ${baseExclusions} AND (
          lower(ifnull(i.name,'')) LIKE '%hide%' OR lower(ifnull(i.name,'')) LIKE '%fur%'
          OR lower(ifnull(i.name,'')) LIKE '%leather%' OR lower(ifnull(i.name,'')) LIKE '%stone%'
          OR lower(ifnull(i.name,'')) LIKE '%claw%' OR lower(ifnull(i.name,'')) LIKE '%horn%'
        )`;
    row = pickRandomItemRowWeighted(db, sql, [], contextTag, rng, 320, themeTags);
  }
  if (
    !row &&
    categories &&
    categories.length > 0 &&
    rng() > 0.22
  ) {
    const cat = categories[Math.floor(rng() * categories.length)];
    const sql = `SELECT ${SQL_ITEMS_LOCALIZED_SELECT} FROM ${SQL_ITEMS_LOCALIZED_FROM} WHERE ${baseExclusions} AND (
          instr(lower(i.category), lower(?)) > 0 OR instr(lower(ifnull(i.subcategory,'')), lower(?)) > 0
        )`;
    row = pickRandomItemRowWeighted(db, sql, [cat, cat], contextTag, rng, 320, themeTags);
  }
  if (!row) {
    const sql = `SELECT ${SQL_ITEMS_LOCALIZED_SELECT} FROM ${SQL_ITEMS_LOCALIZED_FROM} WHERE ${baseExclusions}`;
    row = pickRandomItemRowWeighted(db, sql, [], contextTag, rng, 400, themeTags);
  }
  return row;
}

/**
 * Individual Treasure: монеты «в карманах» + шанс на 1 дешёвую вещь; магия — редкий бросок (макс. 1 за раз).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} opts
 * @param {number} opts.totalCr
 * @param {string[]} [opts.categories]
 * @param {boolean} [opts.excludeCommonMagic]
 * @param {number} [opts.caveGemBias]
 * @param {boolean} [opts.includeCoins]
 * @param {number} [opts.partyLevel]
 * @param {number} [opts.playerCount]
 * @param {() => number} [opts.rng]
 * @param {string} [opts.contextTag] контекстный тег (urban, dungeon, wilderness) — усиливает `items.tags`
 */
export function generateIndividualTreasureLoot(db, opts) {
  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
  const totalCr = Number(opts.totalCr);
  const sumCr = Number.isFinite(totalCr) && totalCr > 0 ? totalCr : 0.125;
  const categories = opts.categories ?? [];
  const excludeCommonMagic = Boolean(opts.excludeCommonMagic);
  const caveGemBias = typeof opts.caveGemBias === 'number' ? opts.caveGemBias : 0;
  const includeCoins = opts.includeCoins !== false;
  const partyLevel = opts.partyLevel != null ? Number(opts.partyLevel) : null;
  const playerCount = opts.playerCount != null ? Number(opts.playerCount) : null;
  const contextTag =
    opts.contextTag != null && String(opts.contextTag).trim()
      ? String(opts.contextTag).trim().toLowerCase()
      : undefined;

  let coinsApproxGp = null;
  if (includeCoins) {
    coinsApproxGp = approximateIndividualCoinsGp(db, sumCr, rng);
  }

  /** @type {Array<Record<string, unknown>>} */
  const mundaneItems = [];
  if (rollD100(rng) <= 50) {
    const row = pickCheapMundaneItem(db, categories, rng, caveGemBias, contextTag);
    const keepLowValueJunk = sumCr < 5;
    if (row && (keepLowValueJunk || !isLowValueMundaneJunk(row))) {
      mundaneItems.push(row);
    }
  }

  /** @type {Array<Record<string, unknown>>} */
  const magicItems = [];
  const mp = rollTreasureHoardMagicPlanFromD100(rng);
  if (mp.magicItemRolls > 0 && mp.rarityBuckets?.length) {
    let buckets = mp.rarityBuckets;
    if (excludeCommonMagic) {
      buckets = buckets.filter((b) => b !== 'Common');
    }
    if (buckets.length > 0) {
      const m = generateLootByCR(
        db,
        Math.min(30, sumCr),
        1,
        rng,
        excludeCommonMagic,
        buckets,
        contextTag,
        undefined,
      );
      if (m[0]) {
        magicItems.push(m[0]);
      }
    }
  }

  let magicOut = magicItems;
  let mundaneOut = mundaneItems;
  let coinsOut = coinsApproxGp;
  if (partyLevel != null && Number.isFinite(partyLevel) && playerCount != null && Number.isFinite(playerCount)) {
    const cap = partyTreasureSoftCapGp(partyLevel, playerCount);
    const clipped = clipLootTotalsToWealthCap(magicItems, mundaneItems, coinsApproxGp, cap);
    magicOut = clipped.magic;
    mundaneOut = clipped.mundane;
    coinsOut = clipped.coins;
  }

  return {
    rollPlan: { kind: 'individual' },
    magicItems: magicOut,
    mundaneItems: mundaneOut,
    coinsApproxGp: coinsOut,
  };
}

/**
 * @param {Record<string, unknown>} row
 * @param {string[]} categories
 * @returns {boolean}
 */
function itemMatchesCategories(row, categories) {
  if (!categories || categories.length === 0) {
    return true;
  }
  const cat = String(row.category ?? '').toLowerCase();
  const sub = String(row.subcategory ?? '').toLowerCase();
  return categories.some(
    (c) => cat.includes(String(c).toLowerCase()) || sub.includes(String(c).toLowerCase()),
  );
}

/**
 * @param {Record<string, unknown>} row
 * @param {number} goldLimitGp
 * @param {Record<string, number>} encounterWeights
 * @param {() => number} rng
 * @returns {number}
 */
function plausibilityScoreForBudgetItem(row, goldLimitGp, encounterWeights, rng) {
  const cap = Number(goldLimitGp);
  const bucket = rarityBucket(/** @type {string|null} */ (row.rarity));
  const rarityWeight =
    bucket != null && encounterWeights[bucket] != null ? Number(encounterWeights[bucket]) : 0;
  const cost = Number(row.cost_gp);
  if (!Number.isFinite(cost) || cost <= 0 || !Number.isFinite(cap) || cost > cap) {
    return -1e9;
  }
  const ratio = cost / cap;
  const ideal = 0.28;
  const distance = Math.abs(ratio - ideal);
  const costFit = 1 / (1 + distance * 4);
  const jitter = (rng() - 0.5) * 0.02;
  return rarityWeight * costFit * (1 + Math.log1p(cost) * 0.003) + jitter;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {number} goldLimitGp
 * @param {string[]} [categories]
 * @param {string[]|null} [allowedRarityBuckets]
 * @param {() => number} [rng]
 * @param {number|null} [crHint]
 * @param {boolean} [excludeCommonMagic]
 * @param {string|undefined} [contextTag]
 * @returns {Array<Record<string, unknown>>}
 */
export function generateLootByBudget(
  db,
  goldLimitGp,
  categories = [],
  allowedRarityBuckets = null,
  rng = Math.random,
  crHint = null,
  excludeCommonMagic = false,
  contextTag,
) {
  const cap = Number(goldLimitGp);
  if (!Number.isFinite(cap) || cap <= 0) {
    return [];
  }
  const crForWeights =
    crHint != null && Number.isFinite(Number(crHint)) ? Number(crHint) : 1;
  const cfg = encounterWeightsForCr(db, crForWeights);
  if (!cfg?.weights || Object.keys(cfg.weights).length === 0) {
    return [];
  }
  const weights = cfg.weights;

  let sql = `
    SELECT ${SQL_ITEMS_LOCALIZED_SELECT} FROM ${SQL_ITEMS_LOCALIZED_FROM}
    WHERE ifnull(i.is_magic,0) = 1 AND i.cost_gp IS NOT NULL AND i.cost_gp > 0 AND i.cost_gp <= ?
  `;
  if (excludeCommonMagic) {
    sql += ` AND (${NON_COMMON_RARITY_SQL}) `;
  }
  dbgLootSql('generateLootByBudget', sql.trim(), [cap]);
  let pool = /** @type {Array<Record<string, unknown>>} */ (db.prepare(sql.trim()).all(cap));
  pool = pool.filter((row) => itemMatchesCategories(row, categories));
  if (allowedRarityBuckets !== null) {
    if (allowedRarityBuckets.length === 0) {
      return [];
    }
    const allow = new Set(allowedRarityBuckets);
    pool = pool.filter((row) => {
      const b = rarityBucket(/** @type {string|null} */ (row.rarity));
      return Boolean(b && allow.has(b));
    });
  }
  const maxRIdx =
    crHint != null && Number.isFinite(Number(crHint))
      ? maxRarityIndexForCr(Number(crHint))
      : null;
  if (maxRIdx != null) {
    pool = pool.filter((row) => {
      const b = rarityBucket(/** @type {string|null} */ (row.rarity));
      if (!b) {
        return false;
      }
      const idx = RARITY_ORDER.indexOf(b);
      return idx >= 0 && idx <= maxRIdx;
    });
  }
  const sorted = [...pool].sort(
    (a, b) =>
      plausibilityScoreForBudgetItem(b, cap, weights, rng) * (effectiveItemPickWeight(b, contextTag) / 100) -
      plausibilityScoreForBudgetItem(a, cap, weights, rng) * (effectiveItemPickWeight(a, contextTag) / 100),
  );
  /** @type {Array<Record<string, unknown>>} */
  const out = [];
  let spent = 0;
  for (const row of sorted) {
    const g = Number(row.cost_gp);
    if (spent + g <= cap) {
      out.push(row);
      spent += g;
    }
  }
  return out;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {number} goldLimitGp
 * @param {number} crValue
 * @param {string[]} [categories]
 * @param {() => number} [rng]
 * @param {boolean} [excludeCommonMagic]
 * @param {string[]|null} [allowedRarityBuckets]
 * @param {string|undefined} [contextTag]
 * @param {string[]|undefined} [themeTags]
 * @returns {Record<string, unknown>|undefined}
 */
export function pickOneMagicItemForBudgetAndCr(
  db,
  goldLimitGp,
  crValue,
  categories = [],
  rng = Math.random,
  excludeCommonMagic = false,
  allowedRarityBuckets = null,
  contextTag,
  themeTags,
) {
  const cap = Number(goldLimitGp);
  if (!Number.isFinite(cap) || cap <= 0) {
    return undefined;
  }
  const cfg = encounterWeightsForCr(db, crValue);
  if (!cfg?.weights) {
    return undefined;
  }
  const weights = cfg.weights;
  const maxRIdx = maxRarityIndexForCr(crValue);

  let sql = `
      SELECT ${SQL_ITEMS_LOCALIZED_SELECT} FROM ${SQL_ITEMS_LOCALIZED_FROM}
      WHERE ifnull(i.is_magic,0) = 1 AND i.cost_gp IS NOT NULL AND i.cost_gp > 0 AND i.cost_gp <= ?
    `;
  if (excludeCommonMagic) {
    sql += ` AND (${NON_COMMON_RARITY_SQL}) `;
  }

  dbgLootSql('pickOneMagicItemForBudgetAndCr', sql.trim(), [cap]);
  let pool = /** @type {Array<Record<string, unknown>>} */ (db.prepare(sql.trim()).all(cap));
  pool = pool.filter((row) => itemMatchesCategories(row, categories));
  pool = pool.filter((row) => {
    const b = rarityBucket(/** @type {string|null} */ (row.rarity));
    if (!b) {
      return false;
    }
    const idx = RARITY_ORDER.indexOf(b);
    return idx >= 0 && idx <= maxRIdx;
  });
  if (allowedRarityBuckets != null && allowedRarityBuckets.length > 0) {
    let allow = new Set(allowedRarityBuckets);
    if (excludeCommonMagic) {
      allow = new Set([...allow].filter((x) => x !== 'Common'));
    }
    pool = pool.filter((row) => {
      const b = rarityBucket(/** @type {string|null} */ (row.rarity));
      return Boolean(b && allow.has(b));
    });
  }
  if (pool.length === 0) {
    return undefined;
  }
  const idx = pickWeightedIndex(
    pool,
    (row) => {
      const b = rarityBucket(/** @type {string|null} */ (row.rarity));
      const rw = b != null && weights[b] != null ? Number(weights[b]) : 0;
      return rw * (effectiveItemPickWeight(row, contextTag, 2.4, themeTags) / 100);
    },
    rng,
  );
  return idx >= 0 ? pool[idx] : undefined;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {number} totalBudgetGp
 * @param {number} rollCount
 * @param {number} effectiveCr
 * @param {string[]} [categories]
 * @param {boolean} [excludeCommonMagic]
 * @param {string[]|null} [allowedRarityBuckets]
 * @param {string|undefined} [contextTag]
 * @param {string[]|undefined} [themeTags]
 * @returns {Array<Record<string, unknown>>}
 */
export function fillMagicItemsTreasureHoard(
  db,
  totalBudgetGp,
  rollCount,
  effectiveCr,
  categories = [],
  rng = Math.random,
  excludeCommonMagic = false,
  allowedRarityBuckets = null,
  contextTag,
  themeTags,
) {
  const budget = Number(totalBudgetGp);
  const rolls = Math.min(2, Math.max(0, Math.floor(Number(rollCount))));
  if (rolls === 0) {
    return [];
  }
  if (!Number.isFinite(budget) || budget <= 0) {
    return generateLootByCR(db, effectiveCr, rolls, rng, excludeCommonMagic, allowedRarityBuckets, contextTag, themeTags);
  }
  /** @type {Array<Record<string, unknown>>} */
  const items = [];
  let remaining = budget;
  for (let i = 0; i < rolls; i += 1) {
    const rollsLeft = rolls - i;
    const slot = Math.max(25, Math.floor(remaining / rollsLeft));
    const pick = pickOneMagicItemForBudgetAndCr(
      db,
      slot,
      effectiveCr,
      categories,
      rng,
      excludeCommonMagic,
      allowedRarityBuckets,
      contextTag,
      themeTags,
    );
    if (pick) {
      items.push(pick);
      remaining -= Number(pick.cost_gp) || 0;
    } else {
      const fb = generateLootByCR(db, effectiveCr, 1, rng, excludeCommonMagic, allowedRarityBuckets, contextTag, themeTags);
      if (fb[0]) {
        items.push(fb[0]);
      }
    }
    if (remaining < 25) {
      break;
    }
  }
  return items;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {object} opts
 * @param {number} opts.totalCr
 * @param {number|null|undefined} [opts.goldLimitGp]
 * @param {string[]} [opts.categories]
 * @param {boolean} [opts.includeCoins]
 * @param {boolean} [opts.includeMundane]
 * @param {boolean} [opts.excludeCommonMagic]
 * @param {number} [opts.caveGemBias] 0–1 — чаще камни/руда в обычном луте сундука
 * @param {boolean} [opts.treasureChest] сундук: без бытового немагического лута
 * @param {number} [opts.partyLevel] для мягкого капа богатства группы (DMG 2024)
 * @param {number} [opts.playerCount]
 * @param {() => number} [opts.rng]
 * @param {string} [opts.contextTag] — приоритет `items.tags` при выборе
 * @returns {{
 *   rollPlan: ReturnType<typeof treasureHoardRollPlanFromGroupCr>,
 *   magicItems: Array<Record<string, unknown>>,
 *   mundaneItems: Array<Record<string, unknown>>,
 *   coinsApproxGp: number|null,
 * }}
 */
export function generateTreasureHoardLoot(db, opts) {
  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
  const totalCr = Number(opts.totalCr);
  const sumCr = Number.isFinite(totalCr) && totalCr > 0 ? totalCr : 0;
  const plan = treasureHoardRollPlanFromGroupCr(sumCr, rng);
  const goldLimitGp = opts.goldLimitGp != null ? Number(opts.goldLimitGp) : null;
  const categories = opts.categories ?? [];
  const includeCoins = opts.includeCoins !== false;
  const treasureChest = Boolean(opts.treasureChest);
  const includeMundane = opts.includeMundane !== false && !treasureChest;
  const excludeCommonMagic = Boolean(opts.excludeCommonMagic);
  const caveGemBias = typeof opts.caveGemBias === 'number' ? opts.caveGemBias : 0;
  const partyLevel = opts.partyLevel != null ? Number(opts.partyLevel) : null;
  const playerCount = opts.playerCount != null ? Number(opts.playerCount) : null;
  const contextTag =
    opts.contextTag != null && String(opts.contextTag).trim()
      ? String(opts.contextTag).trim().toLowerCase()
      : undefined;
  const themeTags =
    Array.isArray(opts.themeTags) && opts.themeTags.length
      ? opts.themeTags.map((x) => String(x).trim().toLowerCase()).filter(Boolean)
      : undefined;
  let magicRarityBuckets = plan.magicRarityBuckets;
  if (excludeCommonMagic && magicRarityBuckets != null && magicRarityBuckets.length > 0) {
    magicRarityBuckets = magicRarityBuckets.filter((b) => b !== 'Common');
    if (magicRarityBuckets.length === 0) {
      magicRarityBuckets = ['Uncommon'];
    }
  }

  /** @type {Array<Record<string, unknown>>} */
  let magicItems;
  if (goldLimitGp != null && Number.isFinite(goldLimitGp) && goldLimitGp > 0) {
    magicItems = fillMagicItemsTreasureHoard(
      db,
      goldLimitGp,
      plan.magicItemRolls,
      plan.effectiveCr,
      categories,
      rng,
      excludeCommonMagic,
      magicRarityBuckets,
      contextTag,
      themeTags,
    );
  } else {
    magicItems = generateLootByCR(
      db,
      plan.effectiveCr,
      plan.magicItemRolls,
      rng,
      excludeCommonMagic,
      magicRarityBuckets,
      contextTag,
      themeTags,
    );
  }

  /** @type {Array<Record<string, unknown>>} */
  let mundaneItems = [];
  if (includeMundane && plan.mundanePicks > 0) {
    mundaneItems = pickMundaneHoardItems(db, plan.mundanePicks, categories, rng, {
      caveGemBias,
      qualityTargetCr: sumCr,
      treasureChestMode: treasureChest,
      contextTag,
      themeTags,
    });
  }

  let coinsApproxGp = null;
  if (includeCoins) {
    coinsApproxGp = approximateHoardCoinsGp(db, sumCr > 0 ? sumCr : 0.125, rng);
  }

  if (
    partyLevel != null &&
    Number.isFinite(partyLevel) &&
    playerCount != null &&
    Number.isFinite(playerCount)
  ) {
    const cap = partyTreasureSoftCapGp(partyLevel, playerCount);
    const clipped = clipLootTotalsToWealthCap(magicItems, mundaneItems, coinsApproxGp, cap);
    magicItems = clipped.magic;
    mundaneItems = clipped.mundane;
    coinsApproxGp = clipped.coins;
  }

  if (treasureChest) {
    const pl =
      partyLevel != null && Number.isFinite(partyLevel) && partyLevel > 0
        ? Math.floor(partyLevel)
        : Math.min(20, Math.max(1, Math.round(plan.effectiveCr * 2)));
    const pc =
      playerCount != null && Number.isFinite(playerCount) && playerCount > 0
        ? Math.floor(playerCount)
        : 4;
    const floorGp = treasureHoardGoldFloorGp(pl, pc);
    const cur = coinsApproxGp != null && Number.isFinite(coinsApproxGp) ? coinsApproxGp : 0;
    coinsApproxGp = Math.max(floorGp, cur);
  }

  return {
    rollPlan: plan,
    magicItems,
    mundaneItems,
    coinsApproxGp,
  };
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {number} count
 * @param {string[]} categories
 * @param {() => number} rng
 * @returns {Array<Record<string, unknown>>}
 */
export function pickMundaneHoardItems(db, count, categories, rng, hoardOpts = {}) {
  const n = Math.max(0, Math.floor(Number(count)));
  const caveGemBias =
    hoardOpts &&
    typeof /** @type {{ caveGemBias?: number }} */ (hoardOpts).caveGemBias === 'number'
      ? Math.min(1, Math.max(0, /** @type {{ caveGemBias: number }} */ (hoardOpts).caveGemBias))
      : 0;
  const qualityTargetCr =
    hoardOpts &&
    typeof /** @type {{ qualityTargetCr?: number }} */ (hoardOpts).qualityTargetCr === 'number'
      ? Number(/** @type {{ qualityTargetCr: number }} */ (hoardOpts).qualityTargetCr)
      : 0;
  const treasureChestMode =
    hoardOpts &&
    Boolean(/** @type {{ treasureChestMode?: boolean }} */ (hoardOpts).treasureChestMode);
  const contextTag =
    hoardOpts &&
    /** @type {{ contextTag?: string }} */ (hoardOpts).contextTag != null &&
    String(/** @type {{ contextTag?: string }} */ (hoardOpts).contextTag).trim()
      ? String(/** @type {{ contextTag: string }} */ (hoardOpts).contextTag).trim().toLowerCase()
      : undefined;
  const themeTags =
    hoardOpts &&
    Array.isArray(/** @type {{ themeTags?: string[] }} */ (hoardOpts).themeTags)
      ? /** @type {{ themeTags: string[] }} */ (hoardOpts).themeTags
          .map((x) => String(x).trim().toLowerCase())
          .filter(Boolean)
      : undefined;

  if (n === 0) {
    return [];
  }
  const baseExclusions = `ifnull(i.is_magic,0) = 0 AND i.category NOT IN ('Currency', 'Services') ${SQL_EXCLUDE_ADVENTURING_PACKS}`;
  /** @type {Array<Record<string, unknown>>} */
  const out = [];
  for (let i = 0; i < n; i += 1) {
    let row;

    if (rng() < caveGemBias) {
      const sql = `SELECT ${SQL_ITEMS_LOCALIZED_SELECT} FROM ${SQL_ITEMS_LOCALIZED_FROM} WHERE ${baseExclusions} AND (
            lower(ifnull(i.category,'')) LIKE '%gem%' OR lower(ifnull(i.name,'')) LIKE '%ore%'
            OR lower(ifnull(i.name,'')) LIKE '%ruby%' OR lower(ifnull(i.name,'')) LIKE '%quartz%'
          )`;
      row = pickRandomItemRowWeighted(db, sql, [], contextTag, rng, 380, themeTags);
    }

    if (
      !row &&
      caveGemBias >= 0.42 &&
      rng() < Math.min(0.72, caveGemBias * 0.65)
    ) {
      const sql = `SELECT ${SQL_ITEMS_LOCALIZED_SELECT} FROM ${SQL_ITEMS_LOCALIZED_FROM} WHERE ${baseExclusions} AND (
            lower(ifnull(i.name,'')) LIKE '%hide%' OR lower(ifnull(i.name,'')) LIKE '%fur%'
            OR lower(ifnull(i.name,'')) LIKE '%leather%' OR lower(ifnull(i.name,'')) LIKE '%stone%'
            OR lower(ifnull(i.name,'')) LIKE '%claw%' OR lower(ifnull(i.name,'')) LIKE '%horn%'
            OR lower(ifnull(i.name,'')) LIKE '%ivory%' OR lower(ifnull(i.name,'')) LIKE '%scale%'
            OR lower(ifnull(i.name,'')) LIKE '%bone%' OR lower(ifnull(i.name,'')) LIKE '%boulder%'
          )`;
      row = pickRandomItemRowWeighted(db, sql, [], contextTag, rng, 380, themeTags);
    }

    if (
      !row &&
      categories &&
      categories.length > 0 &&
      rng() > caveGemBias * 0.35
    ) {
      const cat = categories[Math.floor(rng() * categories.length)];
      const sql = `SELECT ${SQL_ITEMS_LOCALIZED_SELECT} FROM ${SQL_ITEMS_LOCALIZED_FROM} WHERE ${baseExclusions} AND (
          instr(lower(i.category), lower(?)) > 0 OR instr(lower(ifnull(i.subcategory,'')), lower(?)) > 0
        )`;
      row = pickRandomItemRowWeighted(db, sql, [cat, cat], contextTag, rng, 380, themeTags);
    }
    if (!row && treasureChestMode) {
      const sql = `SELECT ${SQL_ITEMS_LOCALIZED_SELECT} FROM ${SQL_ITEMS_LOCALIZED_FROM} WHERE ${baseExclusions}
           AND (lower(ifnull(i.category,'')) LIKE '%gem%'
             OR lower(ifnull(i.name,'')) LIKE '%jewel%'
             OR lower(ifnull(i.name,'')) LIKE '%ruby%'
             OR lower(ifnull(i.name,'')) LIKE '%pearl%'
             OR lower(ifnull(i.name,'')) LIKE '%gold%')`;
      row = pickRandomItemRowWeighted(db, sql, [], contextTag, rng, 360, themeTags);
    }
    if (!row) {
      const sql = `SELECT ${SQL_ITEMS_LOCALIZED_SELECT} FROM ${SQL_ITEMS_LOCALIZED_FROM} WHERE ${baseExclusions}
         AND i.category NOT IN ('Vehicle', 'Mount')`;
      row = pickRandomItemRowWeighted(db, sql, [], contextTag, rng, 450, themeTags);
    }
    if (row) {
      const typed = /** @type {Record<string, unknown>} */ (row);
      if (treasureChestMode && isTreasureChestMundaneExcluded(typed)) {
        continue;
      }
      if (qualityTargetCr >= 5 && isLowValueMundaneJunk(typed)) {
        continue;
      }
      if (isAdventuringPackExcluded(typed)) {
        continue;
      }
      out.push(typed);
    }
  }
  return out;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {number} crValue
 * @param {number} [count]
 * @param {() => number} [rng]
 * @param {boolean} [excludeCommonMagic]
 * @param {string[]|null} [allowedRarityBuckets]
 * @param {string|undefined} [contextTag]
 * @param {string[]|undefined} [themeTags]
 * @returns {Array<Record<string, unknown>>}
 */
export function generateLootByCR(
  db,
  crValue,
  count = 1,
  rng = Math.random,
  excludeCommonMagic = false,
  allowedRarityBuckets = null,
  contextTag,
  themeTags,
) {
  const cfg = encounterWeightsForCr(db, crValue);
  if (!cfg?.weights) {
    return [];
  }
  const weights = cfg.weights;
  const maxRIdx = maxRarityIndexForCr(crValue);

  let sql = `SELECT ${SQL_ITEMS_LOCALIZED_SELECT} FROM ${SQL_ITEMS_LOCALIZED_FROM} WHERE ifnull(i.is_magic,0) = 1 AND i.rarity IS NOT NULL`;
  if (excludeCommonMagic) {
    sql += ` AND (${NON_COMMON_RARITY_SQL})`;
  }

  dbgLootSql('generateLootByCR', sql, {
    note: 'только магия (is_magic=1); обычные предметы лута этим SELECT не выбираются',
    crValue,
    count,
    excludeCommonMagic,
    rarityBuckets: allowedRarityBuckets,
  });
  const allMagic = /** @type {Array<Record<string, unknown>>} */ (db.prepare(sql).all());
  let candidates = allMagic.filter((row) => {
    const b = rarityBucket(/** @type {string|null} */ (row.rarity));
    if (!b) {
      return false;
    }
    const idx = RARITY_ORDER.indexOf(b);
    return idx >= 0 && idx <= maxRIdx;
  });
  if (allowedRarityBuckets != null && allowedRarityBuckets.length > 0) {
    let allow = new Set(allowedRarityBuckets);
    if (excludeCommonMagic) {
      allow = new Set([...allow].filter((x) => x !== 'Common'));
    }
    candidates = candidates.filter((row) => {
      const b = rarityBucket(/** @type {string|null} */ (row.rarity));
      return Boolean(b && allow.has(b));
    });
  }
  if (candidates.length === 0 && allowedRarityBuckets != null && allowedRarityBuckets.length > 0) {
    dbgLootSql('generateLootByCR(fallback)', 'retry without rarity bucket filter', {
      crValue,
      buckets: allowedRarityBuckets,
    });
    return generateLootByCR(db, crValue, count, rng, excludeCommonMagic, null, contextTag, themeTags);
  }
  if (candidates.length === 0) {
    dbgLootSql('generateLootByCR(empty)', 'no candidates after rarity/CR filters', {
      crValue,
      maxRIdx,
      excludeCommonMagic,
      buckets: allowedRarityBuckets,
      allMagicCount: allMagic.length,
    });
    return [];
  }

  /** @type {Array<Record<string, unknown>>} */
  const out = [];
  const n = Math.max(0, Math.floor(Number(count)));
  for (let i = 0; i < n; i += 1) {
    const idx = pickWeightedIndex(
      candidates,
      (row) => {
        const b = rarityBucket(/** @type {string|null} */ (row.rarity));
        const rw = b != null && weights[b] != null ? Number(weights[b]) : 0;
        return rw * (effectiveItemPickWeight(row, contextTag, 2.4, themeTags) / 100);
      },
      rng,
    );
    if (idx < 0) {
      break;
    }
    out.push(candidates[idx]);
  }
  return out;
}

/**
 * При зверях/растениях городской «технический» предмет в гибриде заменяется трофеем из тех же строк БД.
 * При нежити/слизи без гуманоидов чернила и пергамент заменяются на типичный «коридорный» мусор подземелья.
 */
export function applyNatureContextToHybridPicks(db, picks, creatureTags, rng = Math.random) {
  const tags = creatureTags instanceof Set ? creatureTags : new Set(creatureTags ?? []);
  const swapWriting = rosterTagsSuggestNoWritingDesk(tags);
  const hasNature = tags.has('beast') || tags.has('plant');

  if (!swapWriting && !hasNature) {
    return picks.slice();
  }

  return picks.map((row) => {
    if (swapWriting && itemLooksWritingSupplies(row)) {
      const gp = Number(row.cost_gp);
      const cap = Number.isFinite(gp) ? Math.max(8, gp * 1.5) : 25;
      const rep =
        pickDungeonCorridorMundaneReplacement(db, cap, rng) ??
        pickNaturalTrophyOrGem(db, Number.isFinite(gp) ? Math.max(10, gp * 1.15) : 40, rng);
      return rep ?? row;
    }
    if (!hasNature) {
      return row;
    }
    if (!itemLooksUrbanOrTechnical(row)) {
      return row;
    }
    const gp = Number(row.cost_gp);
    const rep = pickNaturalTrophyOrGem(
      db,
      Number.isFinite(gp) ? Math.max(10, gp * 1.15) : 75,
      rng,
    );
    return rep ?? row;
  });
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {number} goldLimitGp
 * @param {number} crValue
 * @param {string[]} [categories]
 * @param {() => number} [rng]
 * @param {boolean} [excludeCommonMagic]
 * @returns {{ picks: Array<Record<string, unknown>>, tier: number, bias_rarities: string[] }}
 */
export function generateLootHybrid(
  db,
  goldLimitGp,
  crValue,
  categories = [],
  rng = Math.random,
  excludeCommonMagic = false,
  contextTag,
) {
  const cfg = encounterWeightsForCr(db, crValue);
  const tier = cfg?.tier ?? tierFromCr(crValue);
  if (!cfg?.weights) {
    return { picks: [], tier, bias_rarities: [] };
  }
  const baseWeights = cfg.weights;
  /** @type {string[]} */
  const bias = [];
  for (let k = 0; k < 3; k += 1) {
    const r = pickRarityFromWeights(baseWeights, rng);
    if (r) {
      bias.push(r);
    }
  }
  let allow = [...new Set(bias)];
  if (excludeCommonMagic) {
    allow = allow.filter((r) => r !== 'Common');
    if (allow.length === 0) {
      allow = Object.keys(baseWeights).filter((k) => k !== 'Common' && baseWeights[k] > 0);
    }
  }
  if (allow.length === 0) {
    return { picks: [], tier, bias_rarities: [] };
  }
  const picks = generateLootByBudget(
    db,
    goldLimitGp,
    categories,
    allow,
    rng,
    crValue,
    excludeCommonMagic,
    contextTag,
  );
  return { picks, tier, bias_rarities: allow };
}

/**
 * Токены из continuity для пересечения с `items.tags` (тот же механизм веса, что у themeTags).
 *
 * @param {string} text
 */
function continuityTokensForItemWeight(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-zа-яё0-9]+/i)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4 && s.length <= 24)
    .slice(0, 10);
}

/**
 * Единый набор тегов для взвешивания предметов в hybrid-dice (тема + фракция + continuity), через scoring contract.
 *
 * @param {string[]|undefined|null} themeTags
 * @param {string[]|undefined|null} factionTags
 * @param {string|undefined|null} continuityText
 * @param {import('./location-context.mjs').NarrativeBiomeId|string} narrativeBiome
 */
export function buildHybridDiceLootWeightTags(themeTags, factionTags, continuityText, narrativeBiome) {
  const ctx = normalizeScoringContext({
    biome: narrativeBiome,
    themeTags: Array.isArray(themeTags) ? themeTags : [],
    factionTags,
    continuityText,
    continuityFallback: continuityText ? '' : 'hybrid-dice',
    themeId: '',
  });
  const extra = continuityTokensForItemWeight(ctx.continuityText);
  return [...new Set([...ctx.themeTags, ...ctx.factionTags, ...extra])].slice(0, 28);
}

/**
 * Дополнительные находки без «добора» до лимита gp: только случайные броски (как кости на столе).
 * Теги темы/фракции/continuity — тот же контракт, что у encounter scoring (через `normalizeScoringContext`).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} crValue
 * @param {string[]} [categories]
 * @param {() => number} [rng]
 * @param {boolean} [excludeCommonMagic]
 * @param {number} [caveGemBias]
 * @param {boolean} [skipMundane]
 * @param {string|undefined} [contextTag]
 * @param {string[]|undefined|null} [themeTags]
 * @param {string[]|undefined|null} [factionTags]
 * @param {string|undefined|null} [continuityText]
 * @param {import('./location-context.mjs').NarrativeBiomeId|string} [narrativeBiome]
 * @returns {{ magicItems: Array<Record<string, unknown>>, mundaneItems: Array<Record<string, unknown>> }}
 */
export function generateLootHybridDiceOnly(
  db,
  crValue,
  categories = [],
  rng = Math.random,
  excludeCommonMagic = false,
  caveGemBias = 0,
  skipMundane = false,
  contextTag,
  themeTags,
  factionTags,
  continuityText,
  narrativeBiome,
) {
  const weightTags = buildHybridDiceLootWeightTags(themeTags, factionTags, continuityText, narrativeBiome);

  /** @type {Array<Record<string, unknown>>} */
  const magicItems = [];
  /** @type {Array<Record<string, unknown>>} */
  const mundaneItems = [];

  const attempts = rollD100(rng) <= 52 ? 1 : 2;
  for (let i = 0; i < attempts && magicItems.length < 2; i += 1) {
    const mp = rollTreasureHoardMagicPlanFromD100(rng);
    if (mp.magicItemRolls > 0 && mp.rarityBuckets?.length) {
      let buckets = mp.rarityBuckets;
      if (excludeCommonMagic) {
        buckets = buckets.filter((b) => b !== 'Common');
      }
      if (buckets.length > 0) {
        const batch = generateLootByCR(db, crValue, 1, rng, excludeCommonMagic, buckets, contextTag, weightTags);
        if (batch[0]) {
          magicItems.push(batch[0]);
        }
      }
    }
  }

  if (!skipMundane) {
    const mundRoll = rollD100(rng);
    /** Было ≤38 → слишком часто «ничего» при 0 сундуков; чуть чаще хотя бы одна вещь. */
    const nMund = mundRoll <= 28 ? 0 : mundRoll <= 72 ? 1 : 2;
    if (nMund > 0) {
      mundaneItems.push(
        ...pickMundaneHoardItems(db, nMund, categories, rng, {
          caveGemBias,
          qualityTargetCr: crValue,
          contextTag,
          themeTags: weightTags,
        }),
      );
    }
  }

  return { magicItems, mundaneItems };
}

/**
 * @param {Record<string, unknown>} monsterRow
 * @returns {boolean}
 */
export function isHumanoidMonster(monsterRow) {
  const t = String(monsterRow.type_line ?? '').toLowerCase();
  return t.includes('humanoid');
}

/**
 * @param {Record<string, unknown>} monsterRow
 * @returns {string|null}
 */
export function inferNpcEquipmentRole(monsterRow) {
  if (!isHumanoidMonster(monsterRow)) {
    return null;
  }
  const name = String(monsterRow.name ?? '').toLowerCase();
  if (/guard captain/.test(name)) {
    return 'guard';
  }
  if (/bandit captain/.test(name)) {
    return 'rogue';
  }
  if (/alchemist|apothecary|poisoner/.test(name)) {
    return 'alchemist';
  }
  if (/archmage|mage|wizard|sorcerer|warlock|enchanter/.test(name)) {
    return 'arcanist';
  }
  if (/druid|shaman/.test(name)) {
    return 'druid';
  }
  if (/priest|acolyte|cleric|cultist/.test(name)) {
    return 'divine';
  }
  if (/assassin|spy|thief|bandit|rogue|scout/.test(name)) {
    return 'rogue';
  }
  if (/guard|soldier|veteran|captain/.test(name)) {
    return 'guard';
  }
  if (/knight|gladiator|berserker|warrior|champion/.test(name)) {
    return 'warrior';
  }
  if (/noble|commoner|merchant|minstrel|bartender|servant/.test(name)) {
    return 'civilian';
  }
  return 'civilian';
}

/**
 * @param {string} role
 * @returns {{
 *   mundanePickSpecs: Array<{ category: string }>,
 *   magicCategories: string[],
 *   magicChance: number,
 * }}
 */
function npcRoleToLoadoutSpec(role) {
  switch (role) {
    case 'guard':
      return {
        mundanePickSpecs: [
          { category: 'Armor' },
          { category: 'Weapon' },
          { category: 'Adventuring Gear' },
        ],
        magicCategories: ['Magic: Armor', 'Magic: Weapon', 'Magic: Potion'],
        magicChance: 0.06,
      };
    case 'warrior':
      return {
        mundanePickSpecs: [
          { category: 'Armor' },
          { category: 'Weapon' },
          { category: 'Weapon' },
        ],
        magicCategories: ['Magic: Weapon', 'Magic: Armor'],
        magicChance: 0.1,
      };
    case 'arcanist':
      return {
        mundanePickSpecs: [
          { category: 'Adventuring Gear' },
          { category: 'Tool' },
        ],
        magicCategories: ['Magic: Scroll', 'Magic: Wand', 'Magic: Staff'],
        magicChance: 0.35,
      };
    case 'druid':
      return {
        mundanePickSpecs: [
          { category: 'Tool' },
          { category: 'Adventuring Gear' },
        ],
        magicCategories: ['Magic: Potion', 'Magic: Staff'],
        magicChance: 0.2,
      };
    case 'divine':
      return {
        mundanePickSpecs: [
          { category: 'Adventuring Gear' },
          { category: 'Adventuring Gear' },
        ],
        magicCategories: ['Magic: Scroll', 'Magic: Potion', 'Magic: Wondrous Item'],
        magicChance: 0.22,
      };
    case 'alchemist':
      return {
        mundanePickSpecs: [
          { category: 'Adventuring Gear' },
          { category: 'Tool' },
          { category: 'Crafting' },
        ],
        magicCategories: ['Magic: Potion'],
        magicChance: 0.45,
      };
    case 'rogue':
      return {
        mundanePickSpecs: [
          { category: 'Weapon' },
          { category: 'Adventuring Gear' },
          { category: 'Tool' },
        ],
        magicCategories: ['Magic: Wondrous Item', 'Magic: Weapon', 'Magic: Potion'],
        magicChance: 0.12,
      };
    default:
      return {
        mundanePickSpecs: [
          { category: 'Adventuring Gear' },
          { category: 'Adventuring Gear' },
        ],
        magicCategories: ['Magic: Potion', 'Magic: Wondrous Item'],
        magicChance: 0.04,
      };
  }
}

/**
 * Пулы черт внешности (проза для мастера). Одежда дополнительно задаётся по роли.
 */
const appearanceTraits = Object.freeze({
  clothingStyles: Object.freeze([
    'выцветшая мантия',
    'походный доспех со следами копоти',
    'богатый камзол с вышивкой по вороту',
    'простая шерстяная туника и тяжёлый плащ',
    'кожаный жилет поверх льняной рубахи',
  ]),
  clothingStylesByRole: Object.freeze({
    arcanist: Object.freeze([
      'длинная мантия с кольцами для свитков на поясе',
      'тёмный балахон с потёртыми рунами по краю',
      'накидка из тонкой ткани с карманами под свитки',
      'роба учёного с ожогами от кислоты по рукавам',
    ]),
    divine: Object.freeze([
      'белая сутана с простым символом на груди',
      'тёмное облачение с вышитой окантовкой',
      'пыльная ряса и шнурок молитвенных бус',
    ]),
    druid: Object.freeze([
      'мотки травы и кожаные нашивки на плечах',
      'плащ из нестриженого меха и пояс из коры',
      'пропитанный смолой плащ и сандалии из сыромята',
    ]),
    alchemist: Object.freeze([
      'фартук с пятнами реактивов и резиновые нарукавники',
      'кожаный халат с подвесками-колбами',
      'простой сюртук с въевшимся запахом трав',
    ]),
    guard: Object.freeze([
      'однотонный гамбизон с гербом города',
      'жёсткая кожа и латный нагрудник без украшений',
      'аккуратная форма стражи с отполированной бляхой',
    ]),
    warrior: Object.freeze([
      'полный комплект прокаченного доспеха с царапинами',
      'кольчужная рубаха и шлем на поясном ремне',
      'латные наплечники поверх потёртого гамбизона',
    ]),
    rogue: Object.freeze([
      'тёмный капюшон и несколько потайных карманов',
      'облегчённая кожа без блеска металла',
      'поношенный плащ и туфли без скрипа подошв',
    ]),
    civilian: Object.freeze([
      'аккуратный камзол торговца',
      'праздничный жилет и сапоги на низком каблуке',
      'скромная рабочая одежда без украшений',
    ]),
  }),
  physicalDetails: Object.freeze([
    'шрам на подбородке',
    'татуировка гильдии на предплечье',
    'золотой зуб при улыбке',
    'воронёный ноготь на указательном пальце',
    'цепочка с жетоном, которую теребит раз за разом',
    'сломленный хрящ носа',
    'редкая бледность и «хрустальные» глаза',
  ]),
  mannerisms: Object.freeze([
    'постоянно проверяет кошелёк',
    'подмигивает перед каждым важным словом',
    'говорит очень быстро, будто боится перебить',
    'кашляет в кулак, когда лжёт',
    'не садится спиной к двери',
    'считает монеты взглядом, не доставая их',
    'при каждой паузе выправляет воротник',
  ]),
});

/**
 * @param {string} role
 * @param {() => number} rng
 * @returns {string}
 */
function pickClothingStyleForRole(role, rng) {
  const byRole = /** @type {Record<string, readonly string[]> | undefined} */ (
    appearanceTraits.clothingStylesByRole[
      /** @type {keyof typeof appearanceTraits.clothingStylesByRole} */ (role)
    ]
  );
  const preferRole = byRole && byRole.length > 0 && rng() < 0.72;
  const pool = preferRole ? byRole : appearanceTraits.clothingStyles;
  return pool[Math.floor(rng() * pool.length)];
}

/**
 * @param {() => number} rng
 * @param {readonly string[]} pool
 * @returns {string}
 */
function pickTrait(rng, pool) {
  if (!pool.length) {
    return '';
  }
  return pool[Math.floor(rng() * pool.length)];
}

/**
 * Образ NPC из строк `npc_core` (случайная строка при отсутствии совпадения по роли).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string|null} roleKey
 * @param {() => number} rng
 * @returns {{
 *   clothes_color: string,
 *   physical_detail: string,
 *   behavioral_quirk: string,
 * }}
 */
function fetchNpcAppearanceFromDb(db, roleKey, rng) {
  void rng;
  /** @type {Record<string, unknown>|undefined} */
  let row;
  if (roleKey && String(roleKey).length > 0) {
    row = db
      .prepare(
        `SELECT visual_trait, mannerism, notes FROM npc_core
       WHERE role_label IS NOT NULL AND (
         instr(lower(role_label), lower(?)) > 0
         OR instr(lower(?), lower(role_label)) > 0
       )
       ORDER BY RANDOM() LIMIT 1`,
      )
      .get(roleKey, roleKey);
  }
  if (!row) {
    row = db
      .prepare(
        `SELECT visual_trait, mannerism, notes FROM npc_core ORDER BY RANDOM() LIMIT 1`,
      )
      .get();
  }
  if (!row) {
    return {
      clothes_color: '',
      physical_detail: '',
      behavioral_quirk: '',
    };
  }

  const visual = String(row.visual_trait ?? '').trim();
  const manner = String(row.mannerism ?? '').trim();
  const notes = String(row.notes ?? '').trim();

  const semi = visual.indexOf(';');
  let clothes_color;
  let physical_detail;
  if (semi >= 0) {
    clothes_color = visual.slice(0, semi).trim();
    physical_detail = visual.slice(semi + 1).trim() || visual;
  } else {
    physical_detail = visual;
    clothes_color =
      notes.length > 0 ? notes : visual.split(/[.!?]/)[0]?.trim() ?? visual;
  }

  return {
    clothes_color,
    physical_detail,
    behavioral_quirk: manner,
  };
}

/**
 * Собирает поля `description` / `feature` / `quirk` и сохраняет прежние ключи для совместимости.
 *
 * @param {string} role
 * @param {{
 *   clothes_color: string,
 *   physical_detail: string,
 *   behavioral_quirk: string,
 * }} fromDb
 * @param {() => number} rng
 */
function buildAppearanceProfile(role, fromDb, rng) {
  const clothing = pickClothingStyleForRole(role, rng);
  const procFeature = pickTrait(rng, appearanceTraits.physicalDetails);
  const procQuirk = pickTrait(rng, appearanceTraits.mannerisms);

  const feature =
    fromDb.physical_detail.length > 0 && rng() < 0.55
      ? fromDb.physical_detail
      : procFeature || fromDb.physical_detail;
  const quirk =
    fromDb.behavioral_quirk.length > 0 && rng() < 0.55
      ? fromDb.behavioral_quirk
      : procQuirk || fromDb.behavioral_quirk;

  const clothesLine =
    fromDb.clothes_color.length > 0 && rng() < 0.4
      ? `${fromDb.clothes_color}; к этому подходит ${clothing}`
      : clothing;

  const description = [
    `Одежда и силуэт: ${clothesLine}.`,
    `Бросается в глаза: ${feature}.`,
    `Манеры и речь: ${quirk}.`,
  ].join(' ');

  return {
    clothes_color: clothesLine,
    physical_detail: feature,
    behavioral_quirk: quirk,
    description: description.trim(),
    feature,
    quirk,
  };
}

/**
 * Снаряжение гуманоида из `items` + визуальный профиль из `npc_core`.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {Record<string, unknown>} monsterRow
 * @param {() => number} [rng]
 * @param {{ contextTag?: string }} [options]
 * @returns {{
 *   gear: Array<Record<string, unknown>>,
 *   appearance: {
 *     clothes_color: string,
 *     physical_detail: string,
 *     behavioral_quirk: string,
 *     description: string,
 *     feature: string,
 *     quirk: string,
 *   }|null,
 * }}
 */
export function generateHumanoidNpcLoot(db, monsterRow, rng = Math.random, options = {}) {
  const role = inferNpcEquipmentRole(monsterRow);
  if (role == null) {
    return { gear: [], appearance: null };
  }
  const contextTag =
    options.contextTag != null && String(options.contextTag).trim()
      ? String(options.contextTag).trim().toLowerCase()
      : undefined;
  const cr = Number(monsterRow.cr_numeric);
  const crVal = Number.isFinite(cr) ? cr : 0;
  const spec = npcRoleToLoadoutSpec(role);
  const maxMagicGp =
    crVal <= 1 ? 400 : crVal <= 4 ? 900 : crVal <= 10 ? 4500 : crVal <= 16 ? 25000 : 120000;

  /** @type {Array<Record<string, unknown>>} */
  const out = [];
  for (const specItem of spec.mundanePickSpecs) {
    const sql = `SELECT ${SQL_ITEMS_LOCALIZED_SELECT} FROM ${SQL_ITEMS_LOCALIZED_FROM} WHERE i.is_magic = 0 AND i.category = ?`;
    const row = pickRandomItemRowWeighted(db, sql, [specItem.category], contextTag, rng, 320);
    if (row) {
      out.push(/** @type {Record<string, unknown>} */ (row));
    }
  }

  const roll = rng();
  if (spec.magicCategories.length > 0 && roll < spec.magicChance * (1 + Math.min(1.5, crVal / 12))) {
    const cat = spec.magicCategories[Math.floor(rng() * spec.magicCategories.length)];
    const sql = `SELECT ${SQL_ITEMS_LOCALIZED_SELECT} FROM ${SQL_ITEMS_LOCALIZED_FROM}
         WHERE i.is_magic = 1 AND i.category = ?
           AND (i.cost_gp IS NULL OR i.cost_gp <= ?)`;
    const magicRow = pickRandomItemRowWeighted(db, sql, [cat, maxMagicGp], contextTag, rng, 280);
    if (magicRow) {
      out.push(/** @type {Record<string, unknown>} */ (magicRow));
    }
  }

  const fromDb = fetchNpcAppearanceFromDb(db, role, rng);
  const appearance = buildAppearanceProfile(role, fromDb, rng);
  const hasAnyAppearance =
    appearance.description.length > 0 ||
    appearance.feature.length > 0 ||
    appearance.quirk.length > 0;

  return {
    gear: out,
    appearance: hasAnyAppearance ? appearance : null,
  };
}

// --- Encounter Scenario Engine (архетипы, нарратив, аудит) ---

/** @typedef {'nest'|'patrol'|'symbiosis'|'boss_minions'|'horde'} EncounterArchetypeId */

/** Веса броска архетипа (сумма = 100). */
export const ENCOUNTER_ARCHETYPE_WEIGHTS = Object.freeze([
  ['nest', 20],
  ['patrol', 24],
  ['symbiosis', 20],
  ['boss_minions', 21],
  ['horde', 15],
]);

/** @type {Readonly<Record<EncounterArchetypeId, { nameRu: string, nameEn: string }>>} */
export const ENCOUNTER_ARCHETYPE_LABELS = Object.freeze({
  nest: { nameRu: 'Гнездо / логово', nameEn: 'Nest / Lair' },
  patrol: { nameRu: 'Патруль', nameEn: 'Patrol' },
  symbiosis: { nameRu: 'Симбиоз', nameEn: 'Symbiosis' },
  boss_minions: { nameRu: 'Босс и миньоны', nameEn: 'Boss & Minions' },
  horde: { nameRu: 'Орда', nameEn: 'Horde' },
});

/**
 * @param {() => number} rng
 * @returns {EncounterArchetypeId}
 */
export function rollEncounterArchetype(rng) {
  const roll = Math.floor(rng() * 100);
  let acc = 0;
  for (const [id, w] of ENCOUNTER_ARCHETYPE_WEIGHTS) {
    acc += w;
    if (roll < acc) return /** @type {EncounterArchetypeId} */ (id);
  }
  return 'patrol';
}

/**
 * @param {EncounterArchetypeId} id
 * @returns {string}
 */
export function formatArchetypeLabelRuEn(id) {
  const m = ENCOUNTER_ARCHETYPE_LABELS[/** @type {EncounterArchetypeId} */ (id)];
  if (!m) return String(id);
  return formatLocalizedWithOriginalSuffix(m.nameRu, m.nameEn);
}

/** @typedef {'day'|'night'|'storm'} WorldStateId */

/** Состояние мира — влияет на тактику, окружение и отчёт мастера. */
export const WORLD_STATES = Object.freeze({
  day: { nameRu: 'День', nameEn: 'Day' },
  night: { nameRu: 'Ночь', nameEn: 'Night' },
  storm: { nameRu: 'Буря', nameEn: 'Storm' },
});

/**
 * @param {unknown} v
 * @returns {WorldStateId|null}
 */
export function normalizeWorldState(v) {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  if (s === 'day' || s === 'night' || s === 'storm') return /** @type {WorldStateId} */ (s);
  return null;
}

/**
 * @param {() => number} rng
 * @returns {WorldStateId}
 */
export function rollWorldState(rng) {
  const r = rng();
  if (r < 1 / 3) return 'day';
  if (r < 2 / 3) return 'night';
  return 'storm';
}

/**
 * @param {WorldStateId} id
 * @returns {string}
 */
export function formatWorldStateLabelRuEn(id) {
  const m = WORLD_STATES[/** @type {keyof typeof WORLD_STATES} */ (id)];
  if (!m) return String(id);
  return formatLocalizedWithOriginalSuffix(m.nameRu, m.nameEn);
}

/** @type {Readonly<Record<string, readonly string[]>>} */
const BIOME_CONTRADICTION_NEEDLES = Object.freeze({
  arctic: Object.freeze(['desert', 'sand', 'camel', 'cactus', 'oasis', 'jungle', 'tropical', 'savanna', 'пустын']),
  swamp: Object.freeze(['arctic', 'tundra', 'iceberg', 'blizzard', 'полярн']),
  coastal: Object.freeze(['mountain peak', 'alpine', 'tundra', 'высокогорн']),
});

/**
 * @param {string} envKey
 * @param {Record<string, unknown>} row
 * @returns {boolean} true если строка противоречит биому
 */
export function rowContradictsBiome(envKey, row) {
  const needles = BIOME_CONTRADICTION_NEEDLES[String(envKey).toLowerCase()];
  if (!needles?.length) return false;
  const blob = `${String(row.name ?? '')} ${String(row.type_line ?? '')} ${String(row.raw_statblock_md ?? '').slice(0, 4000)}`.toLowerCase();
  return needles.some((n) => blob.includes(String(n).toLowerCase()));
}

/**
 * @param {Record<string, unknown>} row
 * @returns {{ str: number|null, dex: number|null, con: number|null, int: number|null, wis: number|null, cha: number|null }}
 */
export function parseAbilityScoresFromMonsterMd(row) {
  const md = String(row.raw_statblock_md ?? '');
  const out = { str: null, dex: null, con: null, int: null, wis: null, cha: null };
  for (const ab of /** @type {const} */ (['str', 'dex', 'con', 'int', 'wis', 'cha'])) {
    const re = new RegExp(`\\*\\*${ab.toUpperCase()}\\*\\*\\s*(\\d+)`, 'i');
    const m = md.match(re);
    if (m) out[ab] = Number(m[1]);
  }
  if (out.str == null) {
    const pipe = md.match(/\|\s*STR\s*\|\s*DEX\s*\|\s*CON[\s\S]*?\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)/i);
    if (pipe) {
      out.str = Number(pipe[1]);
      out.dex = Number(pipe[2]);
      out.con = Number(pipe[3]);
    }
  }
  return out;
}

/**
 * Первое число КБ из statblock (для экологии «Стража»).
 * @param {Record<string, unknown>} row
 * @returns {number|null}
 */
export function parseArmorClassFromMonsterMd(row) {
  const md = String(row.raw_statblock_md ?? '');
  const m1 = md.match(/\*\*Armor Class\*\*\s*(\d+)/i) || md.match(/\bAC\b\s*[:\s]*(\d+)/i);
  if (m1) {
    const n = Number(m1[1]);
    return Number.isFinite(n) ? n : null;
  }
  const m2 = md.match(/\*\*Класс брони\*\*\s*(\d+)/i);
  if (m2) {
    const n = Number(m2[1]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * @typedef {'scout'|'guard'|'worker'|'boss'} EncounterEcologyRoleId
 */

/**
 * Скрытая роль отряда (экология встречи) — влияет на тактику и эффекты (разведка → тревога).
 * @param {Array<{ row: Record<string, unknown>, count: number }>} roster
 * @param {number} partyLevel
 * @param {() => number} [rng]
 * @returns {EncounterEcologyRoleId}
 */
export function inferEncounterEcologyRole(roster, partyLevel, rng = Math.random) {
  void rng;
  const pl = Math.min(20, Math.max(1, Math.floor(Number(partyLevel) || 1)));
  if (!roster?.length) return 'worker';

  const crs = roster.map((e) => {
    const n = Number(e.row.cr_numeric);
    return Number.isFinite(n) ? n : 0;
  });
  const maxCr = Math.max(...crs);
  const sorted = [...crs].sort((a, b) => b - a);
  const second = sorted.length > 1 ? sorted[1] : 0;
  const totalCount = roster.reduce((s, e) => s + Math.max(0, Math.floor(Number(e.count) || 0)), 0);

  const allBeast = roster.every((e) => String(e.row.type_line ?? '').toLowerCase().includes('beast'));
  const allVeryLow = roster.every((e) => (Number(e.row.cr_numeric) || 0) <= 0.5);
  if ((allBeast && maxCr <= 2) || (allVeryLow && totalCount >= 2)) {
    return 'worker';
  }

  const bossThreshold = Math.max(1, pl * 0.38);
  if (maxCr >= bossThreshold || (totalCount === 1 && maxCr >= 1) || (totalCount >= 2 && maxCr >= second + 1.5 && maxCr >= 2)) {
    return 'boss';
  }

  let scoutWeight = 0;
  let guardWeight = 0;
  for (const { row, count } of roster) {
    const c = Math.max(0, Math.floor(Number(count) || 0));
    if (c <= 0) continue;
    if (monsterStatblockSuggestsStealth(row)) scoutWeight += c;
    const abs = parseAbilityScoresFromMonsterMd(row);
    if (abs.dex != null && abs.dex >= 16) scoutWeight += c;
    const ac = parseArmorClassFromMonsterMd(row);
    const md = String(row.raw_statblock_md ?? '').toLowerCase();
    if (ac != null && ac >= 17) guardWeight += c;
    if (/\bshield\b|щит|tower shield|buckler/i.test(md)) guardWeight += c;
  }

  if (scoutWeight >= Math.max(2, Math.ceil(totalCount * 0.35))) {
    return 'scout';
  }
  if (guardWeight >= Math.max(2, Math.ceil(totalCount * 0.3))) {
    return 'guard';
  }
  if (maxCr >= pl * 0.22) {
    return 'boss';
  }
  return 'guard';
}

/**
 * @param {EncounterEcologyRoleId} role
 * @returns {string}
 */
export function formatEncounterEcologyRoleLabelRu(role) {
  switch (role) {
    case 'scout':
      return 'Разведка (Scout)';
    case 'guard':
      return 'Стража (Guard)';
    case 'worker':
      return 'Добытчики / зверье (Worker)';
    case 'boss':
      return 'Главарь / элита (Boss)';
    default:
      return String(role);
  }
}

/**
 * Тактика экологии (дополнение к общему тексту встречи).
 * @param {EncounterEcologyRoleId} role
 * @returns {string}
 */
export function formatEncounterEcologyTacticsLocalized(role) {
  switch (role) {
    case 'scout':
      return formatLocalizedWithOriginalSuffix(
        'Разведка: избегают прямого боя; один срывается вглубь, поднимая тревогу (следующая комната суровее).',
        'Scouting posture: avoid a fair fight; one runner breaks deeper, raising the alarm (next room is harsher).',
      );
    case 'guard':
      return formatLocalizedWithOriginalSuffix(
        'Стража: держат «бутылочное горлышко», прикрывают кастеров, стоят до последнего хита.',
        'Guard posture: hold the chokepoint, screen spellcasters, fight to the last hit.',
      );
    case 'worker':
      return formatLocalizedWithOriginalSuffix(
        'Добытчики: яростно охраняют добычу; при потере ~50% численности разбегаются к логову.',
        'Harvester posture: fiercely guard spoils; at ~50% losses they scatter toward a lair.',
      );
    case 'boss':
      return formatLocalizedWithOriginalSuffix(
        'Главарь: легендарные действия на контроль толпы, пафосные выкрики, приоритет на опасных героев.',
        'Boss posture: legendary actions to control the crowd, dramatic battle cries, priority on dangerous heroes.',
      );
    default:
      return '';
  }
}

/**
 * @typedef {'flat'|'multi'|'pit'} BattlefieldHeightId
 */

/**
 * Вертикаль комнаты + краткие правила для ДМ.
 * @param {() => number} rng
 * @returns {{ heightLevel: BattlefieldHeightId, summary: string }}
 */
export function rollBattlefieldHeightProfile(rng) {
  const r = rng();
  const heightLevel = r < 0.55 ? 'flat' : r < 0.8 ? 'multi' : 'pit';
  if (heightLevel === 'flat') {
    return {
      heightLevel,
      summary: formatLocalizedWithOriginalSuffix(
        'Полигон: ровный зал без выгодной высоты.',
        'Battlefield: flat hall — no high-ground advantage.',
      ),
    };
  }
  if (heightLevel === 'multi') {
    return {
      heightLevel,
      summary: formatLocalizedWithOriginalSuffix(
        'Полигон: ярусы / балконы / мосты — **+2 к дальнобойным атакам** с занятой высоты (по усмотрению ДМ).',
        'Battlefield: balconies/bridges — **+2 to ranged attack rolls** from held high ground (DM adjudication).',
      ),
    };
  }
  return {
    heightLevel,
    summary: formatLocalizedWithOriginalSuffix(
      'Полигон: ямы и обрывы — риск падения; проверки **Атлетики** при толчках и сбивании с ног.',
      'Battlefield: pits and drops — fall risk; **Athletics** checks when shoved or knocked prone near edges.',
    ),
  };
}

/**
 * @param {number} floorDepth
 * @param {() => number} rng
 * @returns {{ label: string, dc: number, saveRu: string, saveEn: string }}
 */
export function rollEnvironmentalHazard(floorDepth, rng) {
  const d = Math.max(0, Math.floor(Number(floorDepth) || 0));
  const dc = Math.min(22, 10 + d);
  const rows = [
    {
      ru: `Неустойчивый потолок — громкие заклинания/взрывы могут вызвать обвал (DC ${dc} Ловкость, половина урона).`,
      en: `Unstable ceiling — loud spells/explosions risk a collapse (DC ${dc} Dexterity, half damage).`,
      saveRu: 'Ловкость',
      saveEn: 'Dexterity',
    },
    {
      ru: `Скользкий мох на настиле (DC ${Math.max(11, dc - 1)} Ловкость — падение ничком).`,
      en: `Slick moss on planks (DC ${Math.max(11, dc - 1)} Dexterity — fall prone).`,
      saveRu: 'Ловкость',
      saveEn: 'Dexterity',
    },
    {
      ru: `Алхимические испарения у трещин (DC ${Math.max(10, dc - 2)} Телосложение — отравлён до конца хода).`,
      en: `Alchemical fumes near cracks (DC ${Math.max(10, dc - 2)} Constitution — poisoned until end of turn).`,
      saveRu: 'Телосложение',
      saveEn: 'Constitution',
    },
    {
      ru: `Древний шипастый механизм у стены (КБ ${Math.min(18, 12 + Math.floor(d / 2))} / DC ${dc} Ловкость, чтобы обезвредить).`,
      en: `Ancient spiked wall device (AC ${Math.min(18, 12 + Math.floor(d / 2))} / DC ${dc} Dexterity to disable).`,
      saveRu: 'Ловкость',
      saveEn: 'Dexterity',
    },
  ];
  const pick = rows[Math.floor(rng() * rows.length)];
  return {
    label: formatLocalizedWithOriginalSuffix(pick.ru, pick.en),
    dc,
    saveRu: pick.saveRu,
    saveEn: pick.saveEn,
  };
}

/**
 * @param {Record<string, unknown>} row
 * @returns {boolean}
 */
export function monsterStatblockSuggestsStealth(row) {
  const md = String(row.raw_statblock_md ?? '').toLowerCase();
  return /\bstealth\b/.test(md) && (/\+[2-9]\d*\b/.test(md) || /expertise|advantage.*stealth/i.test(md));
}

/**
 * @param {Record<string, unknown>} row
 * @returns {boolean}
 */
export function isMindlessBeastRow(row) {
  const tl = String(row.type_line ?? '').toLowerCase();
  if (!tl.includes('beast')) return false;
  if (tl.includes('humanoid')) return false;
  return /\bunaligned\b|typically\s+unaligned|often\s+unaligned/i.test(tl);
}

/**
 * @param {Record<string, unknown>} row
 * @returns {number|null} индекс лидера (макс. CR) в развёрнутом списке или 0
 */
export function pickLeaderIndexInRoster(roster) {
  let bestI = 0;
  let bestCr = -1;
  let i = 0;
  for (const { row, count } of roster) {
    const cr = Number(row.cr_numeric);
    const c = Math.max(0, Math.floor(Number(count) || 0));
    if (c <= 0) continue;
    const ok = Number.isFinite(cr) ? cr : 0;
    if (ok > bestCr) {
      bestCr = ok;
      bestI = i;
    }
    i += 1;
  }
  return bestI;
}

const LEADER_VISUAL_TRAITS_RU = Object.freeze([
  'глубокий шрам через бровь',
  'потёртый плащ с вышитым гербом чужой гильдии',
  'необычное кривое копьё с насечками побед',
  'трофейный череп на поясе',
  'перстень с треснувшим камнем',
  'левый глаз закрыт кожаной повязкой',
  'руки в старых кровавых пятнах, будто не отмывал',
  'массивные браслеты из чёрного железа',
  'голубая татуировка змеи на шее',
  'седой пробор в чёрных волосах',
  'ржавая цепь на запястье вместо браслета',
  'пустой ножны за спиной и второй клинок в руке',
  'пояс усыпан мелкими костяными амулетами',
  'капюшон с пришитыми серебряными монетами',
  'одноглазый — второй глаз заменён стеклянным шаром',
]);

const LEADER_VISUAL_TRAITS_EN = Object.freeze([
  'a deep scar through the brow',
  'a worn cloak embroidered with a foreign guild crest',
  'an unusual crooked spear notched with kill-marks',
  'a trophy skull on the belt',
  'a cracked-gem signet ring',
  'the left eye covered by a leather patch',
  'hands stained as if never washed',
  'heavy black-iron bracers',
  'a blue serpent tattoo on the neck',
  'a silver streak in black hair',
  'a rusted chain bracelet',
  'an empty scabbard on the back and a second blade in hand',
  'a belt hung with tiny bone fetishes',
  'a hood sewn with silver coins',
  'one-eyed — the other socket holds a glass orb',
]);

const NPC_HAND_PROPS_RU = Object.freeze([
  'у одного в руках надкусанное яблоко',
  'у старшего — свиток с каракулями, сжатый мокрой ладонью',
  'у пары бойцов — факелы, едва дымятся',
  'у лучника — полусорванная перчатка и стрела за ухом',
  'у одного — пустая фляга, которую он поглаживает нервно',
  'у капитана — сломанная монета, которую он крутит между пальцами',
  'у часового — кусок сырого мяса, от которого тянет собак',
  'у бандита — верёвка с петлёй, намотанная на кисть',
  'у солдата — окровавленный бинт вместо рукояти',
  'у разведчика — трубка, из которой идёт дымок',
  'у одного — ключ на большом кольце, звенит при каждом шаге',
  'у головореза — кожаный мешочек с чем-то тяжёлым',
]);

const NPC_HAND_PROPS_EN = Object.freeze([
  'one holds a half-eaten apple',
  'the elder clutches a ink-smudged scroll in a damp palm',
  'two carry smoking torches',
  'the archer wears a torn glove and keeps an arrow behind the ear',
  'one keeps stroking an empty waterskin nervously',
  'the captain spins a bent coin between his fingers',
  'the sentry holds raw meat that draws flies',
  'a bandit coils a noose-rope around the fist',
  'a soldier wraps a bloodstained rag around a haft',
  'the scout puffs a pipe with a thin trail of smoke',
  'one jingles a heavy ring of keys with every step',
  'the thug hefts a small heavy leather pouch',
]);

/**
 * @param {() => number} rng
 * @returns {string}
 */
export function pickLeaderUniqueTraitLocalized(rng) {
  const i = Math.floor(rng() * LEADER_VISUAL_TRAITS_RU.length);
  return formatLocalizedWithOriginalSuffix(LEADER_VISUAL_TRAITS_RU[i], LEADER_VISUAL_TRAITS_EN[i]);
}

/**
 * @param {() => number} rng
 * @returns {string}
 */
export function pickHumanoidHandPropLocalized(rng) {
  const i = Math.floor(rng() * NPC_HAND_PROPS_RU.length);
  return formatLocalizedWithOriginalSuffix(NPC_HAND_PROPS_RU[i], NPC_HAND_PROPS_EN[i]);
}

/** @type {readonly { ru: string, en: string }[]} */
const BATTLE_CRIES_ORCS = Object.freeze([
  { ru: 'За Груумшога! Кровь и железо!', en: 'For Gruumsh! Blood and iron!' },
  { ru: '{leader} ведёт нас — давите их!', en: '{leader} leads — crush them!' },
  { ru: 'Никакой пощады слабакам!', en: 'No mercy for the weak!' },
  { ru: 'Рубите щиты, ломайте кости!', en: 'Splinter shields, break bones!' },
  { ru: 'Эта земля наша — уходите или умрите!', en: 'This land is ours — leave or die!' },
  { ru: 'Орки не отступают!', en: 'Orcs do not retreat!' },
  { ru: 'За племя {clan}!', en: 'For the {clan} tribe!' },
  { ru: 'Пусть небо услышит наш боевой клич!', en: 'Let the sky hear our war-cry!' },
  { ru: 'Слабые сердца — на ужин волкам!', en: 'Weak hearts — wolf-meat tonight!' },
  { ru: 'Сталь поёт — пойте с ней!', en: 'Steel sings — sing with it!' },
  { ru: 'Мы вырвем победу из ваших рук!', en: 'We will tear victory from your hands!' },
  { ru: 'Гром и копья!', en: 'Thunder and spears!' },
  { ru: 'Топот копыт — ваш конец!', en: 'Hoofbeats — your ending!' },
  { ru: 'Пепел ваших костров станет нашим знаменем!', en: 'Your campfire ash becomes our banner!' },
  { ru: 'Не щадите колдунов!', en: 'Spare no wizards!' },
  { ru: 'Солнце встало — время резни!', en: 'Sun is up — time to slaughter!' },
  { ru: 'Мы помним старые обиды!', en: 'We remember old grudges!' },
  { ru: 'Зубы и когти!', en: 'Teeth and claws!' },
  { ru: 'Держите строй — и вперёд!', en: 'Hold the line — advance!' },
  { ru: 'Пусть реки текут вашей кровью!', en: 'Let rivers run with your blood!' },
  { ru: 'Слава оркам, смерть врагам!', en: 'Glory to orcs, death to foes!' },
  { ru: 'Мы не просим — мы берём!', en: 'We do not ask — we take!' },
  { ru: 'Клинок знает дорогу!', en: 'The blade knows the way!' },
  { ru: 'Слышите ли вы наш топор?', en: 'Do you hear our axe?' },
]);

/** @type {readonly { ru: string, en: string }[]} */
const BATTLE_CRIES_UNDEAD = Object.freeze([
  { ru: 'Тишина… и холод…', en: 'Silence… and cold…' },
  { ru: 'Вернитесь в землю…', en: 'Return to the earth…' },
  { ru: 'Мы не чувствуем боли…', en: 'We feel no pain…' },
  { ru: 'Смерть служит нам…', en: 'Death serves us…' },
  { ru: 'Кости стучат в такт…', en: 'Bones rattle in time…' },
  { ru: 'Память плоти — ложь…', en: 'Memory of flesh is a lie…' },
  { ru: 'Вечный покой — не для вас…', en: 'Eternal rest — not for you…' },
  { ru: 'Следуйте за нами во тьму…', en: 'Follow us into the dark…' },
  { ru: 'Сердца бьются в последний раз…', en: 'Hearts beat one last time…' },
  { ru: 'Мы — эхо клятвы…', en: 'We are the echo of an oath…' },
  { ru: 'Прах зовёт прах…', en: 'Dust calls to dust…' },
  { ru: 'Нет страха. Нет милосердия.', en: 'No fear. No mercy.' },
  { ru: 'Ваш свет погаснет…', en: 'Your light will gutter…' },
  { ru: 'Мы уже умерли — ваша очередь…', en: 'We died already — your turn…' },
  { ru: 'Шёпот могил…', en: 'Whisper of graves…' },
  { ru: 'Служим некромантии…', en: 'We serve necromancy…' },
  { ru: 'Кости помнят…', en: 'Bones remember…' },
  { ru: 'Холодные пальцы…', en: 'Cold fingers…' },
  { ru: 'Прах к праху…', en: 'Ashes to ashes…' },
  { ru: 'Вы — гости на вечеринке смерти…', en: 'You are guests at death’s feast…' },
  { ru: 'Мы — пустота в доспехах…', en: 'We are emptiness in armor…' },
  { ru: 'Слышите скрежет зубов?', en: 'Hear the teeth grind?' },
  { ru: 'Могилы открываются…', en: 'Graves open…' },
  { ru: 'Нет покоя…', en: 'No rest…' },
]);

/** @type {readonly { ru: string, en: string }[]} */
const BATTLE_CRIES_CULTISTS = Object.freeze([
  { ru: 'Звёзды правы — вы ошибаетесь!', en: 'The stars are right — you are wrong!' },
  { ru: 'Кровь — ключ!', en: 'Blood is the key!' },
  { ru: 'Великий — пробудится!', en: 'The Great One stirs!' },
  { ru: 'Мы принесём дар… огня!', en: 'We bring the gift… of fire!' },
  { ru: 'Их воля — наш клинок!', en: 'Their will — our blade!' },
  { ru: 'Пепел истины оседает на язык!', en: 'Ash of truth settles on the tongue!' },
  { ru: 'Руны горят на коже!', en: 'Runes burn on the skin!' },
  { ru: 'Вы — топливо ритуала!', en: 'You are ritual fuel!' },
  { ru: 'Сломайте их кости — пусть песнь зазвучит!', en: 'Break their bones — let the hymn rise!' },
  { ru: 'Мы не боимся смерти — мы её женихи!', en: 'We do not fear death — we court it!' },
  { ru: 'Тьма — мать, мы — дети!', en: 'Darkness is mother — we are children!' },
  { ru: 'Пламя очищает!', en: 'Flame purifies!' },
  { ru: 'Слышите шёпот безымянного?', en: 'Hear the Nameless whisper?' },
  { ru: 'Мы вырежем путь к рассвету тьмы!', en: 'We carve a path to dawn of night!' },
  { ru: 'Клятва на языке пепла!', en: 'Oath on a tongue of ash!' },
  { ru: 'Врата открыты!', en: 'The gates are open!' },
  { ru: 'Их глаз смотрит сквозь нас!', en: 'Its eye sees through us!' },
  { ru: 'Мы принесём конец мира… начало!', en: 'We bring world’s end… and beginning!' },
  { ru: 'Кровь по камню — карта судьбы!', en: 'Blood on stone — a map of fate!' },
  { ru: 'Вы — последнее препятствие!', en: 'You are the last obstacle!' },
  { ru: 'Служим тому, кто не спит!', en: 'We serve the Sleepless!' },
  { ru: 'Пепел и кости — наша монета!', en: 'Ash and bone — our coin!' },
  { ru: 'Мы — зубы культа!', en: 'We are the cult’s teeth!' },
  { ru: 'Пусть небо треснет!', en: 'Let the sky crack!' },
]);

/** @type {readonly { ru: string, en: string }[]} */
const BATTLE_CRIES_GUARDS = Object.freeze([
  { ru: 'Стой! Имя и цель!', en: 'Halt! Name and business!' },
  { ru: 'Оружие вниз — немедленно!', en: 'Weapons down — now!' },
  { ru: 'За закон и город!', en: 'For law and city!' },
  { ru: 'Стража! Ко мне!', en: 'Watch! To me!' },
  { ru: 'Вы арестованы!', en: 'You are under arrest!' },
  { ru: 'Держите строй!', en: 'Hold ranks!' },
  { ru: 'Никто не пройдёт без дозволения!', en: 'None pass without leave!' },
  { ru: 'Поднимите щиты!', en: 'Raise shields!' },
  { ru: 'Мы защищаем этот мост!', en: 'We defend this bridge!' },
  { ru: 'Отбойный сигнал — живым не уйти!', en: 'Alarm — no one leaves alive!' },
  { ru: 'Приказ — задержать!', en: 'Orders — detain!' },
  { ru: 'Сдаться — и живы будете!', en: 'Surrender — and you live!' },
  { ru: 'Сталь закона холоднее вашей!', en: 'Law’s steel is colder than yours!' },
  { ru: 'Король смотрит!', en: 'The king is watching!' },
  { ru: 'Не шагу дальше!', en: 'Not one step further!' },
  { ru: 'Вы нарушили указ!', en: 'You broke the edict!' },
  { ru: 'Стража не дрогнет!', en: 'The watch does not waver!' },
  { ru: 'К оружию!', en: 'To arms!' },
  { ru: 'За стены!', en: 'For the walls!' },
  { ru: 'Докажите мирные намерения!', en: 'Prove peaceful intent!' },
  { ru: 'Мы помним долг перед народом!', en: 'We remember duty to the people!' },
  { ru: 'Сдавайтесь — суд будет справедлив!', en: 'Yield — justice will be fair!' },
  { ru: 'Тревога! Нарушители!', en: 'Alarm! Intruders!' },
  { ru: 'Строй клина!', en: 'Wedge formation!' },
]);

/** @type {readonly { ru: string, en: string }[]} */
/** @type {readonly { ru: string, en: string }[]} */
const BATTLE_CRIES_KNIGHTS = Object.freeze([
  { ru: 'За честь и закон!', en: 'For honour and the law!' },
  { ru: 'Клянусь мечом и щитом — вы не пройдёте!', en: 'By sword and shield — you shall not pass!' },
  { ru: 'Во имя короны — стой!', en: "In the crown's name — halt!" },
  { ru: 'Честь обязывает. Вперёд!', en: 'Noblesse oblige. Advance!' },
  { ru: 'Сталь верна тем, кто верен клятве!', en: 'Steel is true to the oath-sworn!' },
  { ru: 'Порядок держится мечом!', en: 'Order is kept by the blade!' },
  { ru: 'Трусость — бесчестье; вперёд, гвардия!', en: 'Cowardice is dishonor; forward, guard!' },
  { ru: 'Стены стоят, пока живы защитники!', en: 'Walls stand while defenders breathe!' },
  { ru: 'Лорд смотрит — держите строй!', en: 'The lord watches — hold the line!' },
  { ru: 'Рубите изменников без пощады!', en: 'Cut down traitors without mercy!' },
  { ru: 'Знамя не падёт, пока я стою!', en: 'The banner will not fall while I stand!' },
  { ru: 'За дом, за род, за клятву!', en: 'For home, for kin, for oath!' },
  { ru: 'Скрестите копья — не дайте им пройти!', en: 'Cross lances — let none through!' },
  { ru: 'Сегодня мы пишем хроники!', en: 'Today we write the chronicles!' },
  { ru: 'Доблесть рождается в бою — докажите её!', en: 'Valor is born in battle — prove yours!' },
  { ru: 'Ни шагу назад от воли господина!', en: "Not one step from the lord's will!" },
  { ru: 'Благородная кровь не течёт в трусах!', en: 'Noble blood does not flow in cowards!' },
  { ru: 'Стражи — вперёд! Именем закона!', en: 'Guards — forward! By the law!' },
  { ru: 'Сдавайтесь — и суд решит; сражайтесь — и меч решит!', en: 'Yield and be judged; fight and be cut!' },
  { ru: 'Честь дороже жизни!', en: 'Honour above life!' },
  { ru: 'Наш герб — не просто рисунок!', en: 'Our coat of arms is no mere picture!' },
  { ru: 'Держите фланг, пока лорд командует!', en: 'Hold the flank until the lord commands!' },
  { ru: 'Клятва дана — смерть не отменит её!', en: 'Oath sworn — death cannot undo it!' },
  { ru: 'Гвардия не ломается!', en: 'The guard does not break!' },
]);

const BATTLE_CRIES_BEASTS = Object.freeze([
  { ru: '*рычащий рев, перекрывающий речь*', en: '*a snarling roar that drowns speech*' },
  { ru: '*треск клыков и удар копыт*', en: '*clack of fangs and hooves*' },
  { ru: '*визг хищника на высокой ноте*', en: '*shrill predator shriek*' },
  { ru: '*низкое урчание из груди*', en: '*low chest-rumble*' },
  { ru: '*хруст костей в пасти*', en: '*bone-crunch in the maw*' },
  { ru: '*рывок и треск кустов*', en: '*lunge and brush-crash*' },
  { ru: '*вой по луне — короткий и злой*', en: '*short vicious moon-howl*' },
  { ru: '*шипение змеи*', en: '*serpent hiss*' },
  { ru: '*удар лап по камню*', en: '*paw-slap on stone*' },
  { ru: '*глоток воздуха перед прыжком*', en: '*air-gulp before the leap*' },
  { ru: '*топот — как барабан*', en: '*gallop like a drum*' },
  { ru: '*скрежет когтей по металлу*', en: '*claws skree on metal*' },
  { ru: '*всплеск слюны*', en: '*spray of spit*' },
  { ru: '*двойной удар хвоста*', en: '*double tail-thwack*' },
  { ru: '*хриплое «ку-ва-а»*', en: '*rasping caw*' },
  { ru: '*треск перьев в вихре*', en: '*feather-rush in a whirl*' },
  { ru: '*глухой удар брюха о землю*', en: '*belly-thud on earth*' },
  { ru: '*сверчок тишины — затем рык*', en: '*silence — then roar*' },
  { ru: '*скрип сухожилий*', en: '*sinew creak*' },
  { ru: '*вдох — и резкий выпад*', en: '*inhale — sharp lunge*' },
  { ru: '*хруст панциря*', en: '*shell-click*' },
  { ru: '*булькающий рык амфибии*', en: '*gurgling amphibian roar*' },
  { ru: '*топот стаи*', en: '*pack-patter*' },
  { ru: '*визг крысы-гиганта*', en: '*giant rat squeal*' },
]);

/** @type {readonly { ru: string, en: string }[]} */
const MORALE_RULES_SNIPPETS = Object.freeze([
  { ru: 'Звери при 30% HP стремятся отступить к логову.', en: 'Beasts at 30% HP try to flee toward a lair.' },
  { ru: 'Солдаты сдаются, если падает командир.', en: 'Soldiers surrender if the commander falls.' },
  { ru: 'Орки держатся, пока видят знамя вождя.', en: 'Orcs hold while the warlord’s banner stands.' },
  { ru: 'Нежить не отступает.', en: 'Undead do not retreat.' },
  { ru: 'Культисты впадают в безумие, если ритуал сорван.', en: 'Cultists frenzy if the ritual is broken.' },
  { ru: 'Наёмники отступают при потере половины отряда.', en: 'Mercenaries pull back after half losses.' },
  { ru: 'Разумные гуманоиды просят пощады при окружении.', en: 'Smart humanoids beg mercy if surrounded.' },
  { ru: 'Слуги бегут при первом тяжёлом ранении лидера.', en: 'Minions bolt on the leader’s first heavy wound.' },
  { ru: 'Орда ломается, если гаснет «носильщик» знамени.', en: 'A horde breaks if the banner-bearer dies.' },
  { ru: 'Дикие звери бросают бой без добычи.', en: 'Wild beasts quit if they cannot drag prey.' },
  { ru: 'Стража отступает к укреплению при трети потерь.', en: 'Guards fall back to a redoubt at one-third losses.' },
  { ru: 'Бандиты рассыпаются, если падает самый громкий.', en: 'Bandits scatter if the loudest leader drops.' },
  { ru: 'Конструкты не знают страха.', en: 'Constructs know no fear.' },
  { ru: 'Элементали рассеиваются при разрушении якоря.', en: 'Elementals disperse if their anchor is ruined.' },
  { ru: 'Феи исчезают в тумане при половине HP.', en: 'Fey vanish in mist at half HP.' },
  { ru: 'Драконьи прислужники бегут без хозяина.', en: 'Dragon cultists flee without the master.' },
  { ru: 'Пиратская сабля — дисциплина до первой крови.', en: 'Pirate discipline lasts until first blood.' },
  { ru: 'Гоблины прячутся, если «босс» падает.', en: 'Goblins hide if the “boss” falls.' },
  { ru: 'Слизи не отступают — только делятся.', en: 'Oozes do not retreat — only split.' },
  { ru: 'Великаны презирают бегство, но уходят при оскорблении чести.', en: 'Giants scorn flight but leave if honor is insulted.' },
  { ru: 'Исполинские волки держатся стаей до конца.', en: 'Dire wolves fight to the last as a pack.' },
  { ru: 'Культ предпочитает смерть плену.', en: 'The cult prefers death to capture.' },
  { ru: 'Гарнизон держит мораль, пока звонит колокол.', en: 'The garrison holds while the bell rings.' },
  { ru: 'Разбойники торгуются за жизнь при ноже у горла.', en: 'Brigands bargain when a blade kisses the throat.' },
]);

/**
 * Теги тактики — фильтрация по ростеру (requires) и «только при нескольких существах» (multiOnly).
 * @typedef {{ id: string, ru: string, en: string, tags?: readonly string[], requires?: readonly string[], multiOnly?: boolean }} FirstMoveTacticRow
 */

/** Ночь как состояние мира — отдельная установка (см. WORLD_STATES). */
const WORLD_STATE_NIGHT_TACTIC = Object.freeze({
  id: 'world_night_darkness',
  ru: 'Использование темноты: гасят свет, атакуют из теней (тёмное зрение).',
  en: 'Exploit darkness: snuff lights, strike from shadows (darkvision).',
  tags: Object.freeze(['night', 'environment']),
});

/** Соло / одиночка: выживание, легендарные действия, без «волн орды». */
const SOLO_TACTICS_TAGGED = Object.freeze(
  /** @type {readonly FirstMoveTacticRow[]} */ ([
    {
      id: 'solo_legendary_budget',
      ru: 'Одиночка: экономит легендарные действия на побег, сбивание концентрации или второй ход.',
      en: 'Solo: hoard legendary actions for escape, concentration breaks, or a second tempo.',
      tags: Object.freeze(['solo', 'legendary']),
      requires: Object.freeze(['solo']),
    },
    {
      id: 'solo_turtle',
      ru: 'Одиночка: уходит в защиту, держит дистанцию, заставляет тратить ресурсы впустую.',
      en: 'Solo: turtles up, keeps range, forces you to burn resources for nothing.',
      tags: Object.freeze(['solo', 'defense']),
      requires: Object.freeze(['solo']),
    },
    {
      id: 'solo_terrain_dance',
      ru: 'Одиночка: круговое движение по сложному рельефу, не даёт окружить.',
      en: 'Solo: wheels through rough terrain; denies surround.',
      tags: Object.freeze(['solo', 'skirmish']),
      requires: Object.freeze(['solo']),
    },
    {
      id: 'solo_burst_focus',
      ru: 'Одиночка: один взрывной раунд по самому уязвимому герою, затем отход.',
      en: 'Solo: one burst round on the softest hero, then disengage.',
      tags: Object.freeze(['solo', 'alpha_strike']),
      requires: Object.freeze(['solo']),
    },
    {
      id: 'solo_concentration_war',
      ru: 'Одиночка: приоритет — сбить ключевые концентрации заклинаний.',
      en: 'Solo: priority is breaking key spell concentrations.',
      tags: Object.freeze(['solo', 'caster_prey']),
      requires: Object.freeze(['solo']),
    },
  ]),
);

/** @type {readonly FirstMoveTacticRow[]} */
const FIRST_MOVE_TACTICS_TAGGED = Object.freeze([
  { id: 'dex_ambush', ru: 'Высокая Лов: засада, половина стартов с укрытия, готовность защищаться.', en: 'High Dex: ambush; half start hidden; ready dodge.', tags: Object.freeze(['dex', 'skirmish']) },
  { id: 'int_flank', ru: 'Высокий Инт: фланг через сложный рельеф, один носитель факела гасит свет.', en: 'High Int: flank via terrain; one snuffs light.', tags: Object.freeze(['int', 'skirmish']) },
  { id: 'wis_patterns', ru: 'Высокая Мдр: читают ваши паттерны, держат дистанцию до ошибки.', en: 'High Wis: read patterns; hold range until you slip.', tags: Object.freeze(['wis']) },
  { id: 'cha_taunt', ru: 'Высокая Хар: провокации, выманивание заклинаний, ложный отступ.', en: 'High Cha: taunts to bait spells; feigned retreat.', tags: Object.freeze(['cha']) },
  { id: 'heavy_bottleneck', ru: 'Тяжёлая броня: узкий коридор, «бутылочное горлышко».', en: 'Heavy armor: bottleneck fighting.', tags: Object.freeze(['armor']) },
  { id: 'ranged_spread', ru: 'Дальний бой: рассеивание и прикрытие стрелой лидера.', en: 'Ranged: spread and cover the leader with arrows.', tags: Object.freeze(['ranged']), multiOnly: true },
  { id: 'undead_grind', ru: 'Нежить: методичное давление, не ждут исцеления.', en: 'Undead: grind you down; no healing race.', tags: Object.freeze(['undead']), requires: Object.freeze(['undead']) },
  { id: 'beast_soft', ru: 'Звери: цель — самый слабый на вид.', en: 'Beasts: target whoever looks softest.', tags: Object.freeze(['beast']), requires: Object.freeze(['beast']) },
  { id: 'casters_cantrips', ru: 'Маги в отряде: контроль зоны кантрипами до больших слотов.', en: 'Arcane support: zone control with cantrips first.', tags: Object.freeze(['caster']), requires: Object.freeze(['caster']) },
  { id: 'berserk_backline', ru: 'Берсерки: прорыв к задней линии, игнор мелких ран.', en: 'Berserkers: dive the back line; ignore light hits.', tags: Object.freeze(['brute']) },
  { id: 'shield_wall', ru: 'Щиты вперёд — стена, второй ряд — копья.', en: 'Shield wall front; spears second rank.', tags: Object.freeze(['formation', 'command']), multiOnly: true },
  { id: 'night_torches', ru: 'Ночной бой: гасят факелы, держат ночное зрение.', en: 'Night fight: kill torches; exploit darkvision.', tags: Object.freeze(['night', 'dark']) },
  { id: 'height_fly_team', ru: 'Высота: один отряд сверху с дальним, второй снизу режет отход.', en: 'Height: ranged up top; cutters below block retreat.', tags: Object.freeze(['fly', 'height']), requires: Object.freeze(['fly']), multiOnly: true },
  { id: 'water_shore', ru: 'Вода: держат берег, бьют по всплывающим.', en: 'Water: hold shore; strike surfacers.', tags: Object.freeze(['water']) },
  { id: 'fire_smoke', ru: 'Огонь: поджигают укрытия, давят дымом.', en: 'Fire: ignite cover; choke with smoke.', tags: Object.freeze(['fire']) },
  { id: 'dark_lunges', ru: 'Тьма: тишина + короткие выпады.', en: 'Dark: silence and short lunges.', tags: Object.freeze(['dark']) },
  { id: 'traps_pair', ru: 'Ловушки: один выманивает, второй рубит по ногам.', en: 'Traps: one baits, second chops low.', tags: Object.freeze(['traps']), multiOnly: true },
  { id: 'mounts_indoor', ru: 'Конница в зале: круги и удары по флангу.', en: 'Mounts indoors: wheel and flank-strike.', tags: Object.freeze(['mount', 'flank']) },
  { id: 'symbiosis_flank', ru: 'Симбиоз: один тип держит внимание, второй бьёт в спину.', en: 'Symbiosis: one type pins attention; other flanks.', tags: Object.freeze(['symbiosis', 'flank']), requires: Object.freeze(['symbiosis']), multiOnly: true },
  { id: 'horde_waves', ru: 'Орда: волнами по двое, не дают передохнуть.', en: 'Horde: pairs in waves; deny breathers.', tags: Object.freeze(['horde']), requires: Object.freeze(['horde_archetype', 'min3']) },
  { id: 'boss_minions_react', ru: 'Босс: ждёт пока миньоны сожрут реакции.', en: 'Boss: waits until minions eat reactions.', tags: Object.freeze(['boss']), multiOnly: true },
  { id: 'patrol_whistle', ru: 'Патруль: свист — сигнал окружить через 1 раунд.', en: 'Patrol: whistle — surround next round.', tags: Object.freeze(['patrol', 'command']) },
  { id: 'nest_cell', ru: 'Гнездо: защищают «гнездовую» клетку любой ценой.', en: 'Nest: defend the nest cell at any cost.', tags: Object.freeze(['nest']), requires: Object.freeze(['nest_archetype']) },
  { id: 'arcane_shield_minions', ru: 'Лидер с магией: щит на миньонов, удар по концентрации.', en: 'Arcane leader: shield minions; break concentration.', tags: Object.freeze(['caster', 'support']), requires: Object.freeze(['caster', 'min2']), multiOnly: true },
  { id: 'skirmish_reposition', ru: 'Дальники: меняют позиции после каждого залпа.', en: 'Skirmishers: reposition after each volley.', tags: Object.freeze(['skirmish']) },
  { id: 'brute_prone', ru: 'Тяжёлые: сбивание с ног и добивание.', en: 'Brutes: shove prone then finish.', tags: Object.freeze(['brute']) },
  { id: 'flyer_dive', ru: 'Летающие: дайв-бомбы по задней линии.', en: 'Flyers: dive the back line.', tags: Object.freeze(['fly']), requires: Object.freeze(['fly']) },
  { id: 'swarm_split', ru: 'Рой: разделяют партий на две зоны.', en: 'Swarm: split the party across two zones.', tags: Object.freeze(['swarm']), requires: Object.freeze(['swarm', 'min2']), multiOnly: true },
  { id: 'cult_ritual', ru: 'Культ: жертвует слабым ради ритуального хода.', en: 'Cult: spends weaklings for a ritual tempo play.', tags: Object.freeze(['cult']), requires: Object.freeze(['cult']), multiOnly: true },
]);

/** Лунные / ночные интерактивы (доп. к биому при состоянии «Ночь»). */
const NIGHT_ENVIRONMENT_INTERACTABLES = Object.freeze([
  { ru: 'Странные тени — кажутся живыми при лунном свете', en: 'Strange shadows — seem alive in moonlight' },
  { ru: 'Лунные блики на воде сбивают ориентир', en: 'Moon-glint on water spoils bearings' },
  { ru: 'Тихий шёпот без источника — помеха на Внимательность', en: 'Sourceless whispers — Wisdom (Perception) strain' },
  { ru: 'Серебристый туман — слабый свет режет дальность видимости', en: 'Silver fog — dim light cuts sight range' },
  { ru: 'Следы, которые видны только ночью', en: 'Tracks visible only at night' },
  { ru: 'Одинокий светлячок ведёт к опасности', en: 'A lone firefly lures toward danger' },
]);

/** @type {Readonly<Record<string, readonly { ru: string, en: string }[]>>} */
const ENVIRONMENT_INTERACTABLES = Object.freeze({
  forest: Object.freeze([
    { ru: 'Подпиленное дерево над тропой', en: 'A sawn tree poised over the trail' },
    { ru: 'Яма-ловушка под листвой', en: 'A leaf-hidden pit' },
    { ru: 'Скользкие корни над обрывом', en: 'Slick roots above a drop' },
    { ru: 'Сухой хворост — огонь расползётся за раунд', en: 'Dry brush — fire spreads each round' },
    { ru: 'Пчелиное гнездо на ветке', en: 'A bee-nest on a branch' },
    { ru: 'Камень-охотник за жертвой', en: 'A hunter’s stone blind' },
    { ru: 'Лишайники — скользко как лёд', en: 'Lichen — slick as ice' },
    { ru: 'Ручей мутит следы', en: 'A brook muddles tracks' },
    { ru: 'Пень с грибом-паразитом', en: 'A stump with parasitic fungus' },
    { ru: 'Заросли колючки — сложный рельеф', en: 'Bramble thickets — rough terrain' },
    { ru: 'Старая верёвка на дубе', en: 'Old rope on an oak' },
    { ru: 'Склон — сползание при толчке', en: 'A slope that slides if shoved' },
    { ru: 'Падаль — привлекает хищников', en: 'Carrion — draws predators' },
    { ru: 'Туманная низина', en: 'Foggy hollow' },
    { ru: 'Улей диких ос на уступе', en: 'Wild wasps on a ledge' },
    { ru: 'Сломанная телега — укрытие', en: 'Broken cart as cover' },
    { ru: 'Костёр незнакомцев — дымная завеса', en: 'Strangers’ campfire — smoke veil' },
    { ru: 'Камень с рунами предупреждения', en: 'Warning-rune stone' },
    { ru: 'Заросший колодец', en: 'Overgrown well' },
    { ru: 'Пень с топором', en: 'Axe stuck in a stump' },
    { ru: 'Следы крупного зверя к обрыву', en: 'Big beast tracks to a cliff' },
    { ru: 'Скрипучая ветка — помеха на скрытность', en: 'A squeaky branch — stealth penalty' },
    { ru: 'Ягодный куст — укрытие до пояса', en: 'Berry bush — waist-high cover' },
    { ru: 'Мох — тихий, но скользкий', en: 'Moss — quiet but slick' },
  ]),
  cave: Object.freeze([
    { ru: 'Обвалённый проход (1 действие расчистить)', en: 'Collapsed tunnel (1 action to clear)' },
    { ru: 'Сталактит на трещине', en: 'A cracked stalactite' },
    { ru: 'Кислотная лужа', en: 'An acid puddle' },
    { ru: 'Зазубренный камень — режущая местность', en: 'Jagged stone — cutting terrain' },
    { ru: 'Старая бочка с порохом (опасно)', en: 'Old powder-keg (volatile)' },
    { ru: 'Верёвка на уступе', en: 'Rope on a ledge' },
    { ru: 'Тёмная ниша — укрытие', en: 'Dark niche — cover' },
    { ru: 'Скользкая слизь на полу', en: 'Floor slime — slick' },
    { ru: 'Подземный ручей', en: 'Underground stream' },
    { ru: 'Кристаллы — отражают свет', en: 'Crystals — reflect light' },
    { ru: 'Гнездо летучих', en: 'Bat roost' },
    { ru: 'Ржавая решётка', en: 'Rusty grate' },
    { ru: 'Колонна с трещиной', en: 'Cracked pillar' },
    { ru: 'Костяная куча — низкое укрытие', en: 'Bone pile — low cover' },
    { ru: 'Факелные скобы', en: 'Torch brackets' },
    { ru: 'Вентиляционная щель — узкий проход', en: 'Vent slot — tight crawl' },
    { ru: 'Грибы-светлячки', en: 'Glow-shrooms' },
    { ru: 'Старый рудный вагонет', en: 'Old mine cart' },
    { ru: 'Цепь с крюком', en: 'Chain and hook' },
    { ru: 'Залив воды при ливне (лор)', en: 'Flood risk in rain (lore)' },
    { ru: 'Капающая вода — маскирует шаги', en: 'Dripping water masks steps' },
    { ru: 'Узкий мостик над пропастью', en: 'Narrow bridge over a drop' },
    { ru: 'Следы слизи к гнезду', en: 'Ooze trail to a lair' },
    { ru: 'Камень W — балансировка', en: 'Wobble-stone' },
  ]),
  dungeon: Object.freeze([
    { ru: 'Люстра на цепи — можно сбить', en: 'Chandelier on a chain — can drop' },
    { ru: 'Завал из мебели', en: 'Barricade of furniture' },
    { ru: 'Рычаг за портретом', en: 'Lever behind a portrait' },
    { ru: 'Решётка с замком', en: 'Locked grate' },
    { ru: 'Костёр в жаровне', en: 'Brazier fire' },
    { ru: 'Витраж — слабое место', en: 'Stained glass — weak point' },
    { ru: 'Колонна с цепью', en: 'Pillar with chain' },
    { ru: 'Яма с крышкой', en: 'Pit with lid' },
    { ru: 'Скользкий пол — воск', en: 'Waxed slick floor' },
    { ru: 'Алхимические полки', en: 'Alchemy shelves' },
    { ru: 'Статуя — можно опрокинуть', en: 'Topple-able statue' },
    { ru: 'Книжные стеллажи', en: 'Bookshelves' },
    { ru: 'Арбалетные бойницы', en: 'Murder holes' },
    { ru: 'Тяжёлая дверь с засовом', en: 'Heavy barred door' },
    { ru: 'Цепной мост', en: 'Chain bridge' },
    { ru: 'Кандалы у стены', en: 'Wall shackles' },
    { ru: 'Кровавые следы к алтарю', en: 'Blood trail to altar' },
    { ru: 'Сломанная решётка — острые края', en: 'Broken grate — sharp edges' },
    { ru: 'Колодец в зале', en: 'Hall well' },
    { ru: 'Рычаг решётки', en: 'Portcullis lever' },
    { ru: 'Пыль — следы видны', en: 'Dust — tracks show' },
    { ru: 'Скрытая дверь за ковром', en: 'Hidden door behind tapestry' },
    { ru: 'Костяной трон', en: 'Bone throne' },
    { ru: 'Свечи — зажечь/снести', en: 'Candles — ignite or snuff' },
  ]),
  urban: Object.freeze([
    { ru: 'Перевёрнутая телега — укрытие', en: 'Overturned cart — cover' },
    { ru: 'Рынок — толпа как сложная местность', en: 'Market crowd — difficult terrain' },
    { ru: 'Водосточная труба — лаз', en: 'Drainpipe climb' },
    { ru: 'Крыша с черепицей — шумно', en: 'Tile roof — noisy' },
    { ru: 'Уличный фонарь', en: 'Street lantern' },
    { ru: 'Колодец во дворе', en: 'Courtyard well' },
    { ru: 'Верёвка прачек', en: 'Clotheslines' },
    { ru: 'Бочки пива', en: 'Beer barrels' },
    { ru: 'Конюшня — копыта и пыль', en: 'Stable — hooves and dust' },
    { ru: 'Кузница — жар и искры', en: 'Forge — heat and sparks' },
    { ru: 'Канализационная решётка', en: 'Sewer grate' },
    { ru: 'Лестница пожарная', en: 'Fire escape' },
    { ru: 'Закрытый переулок', en: 'Dead-end alley' },
    { ru: 'Вывеска на цепях', en: 'Swinging sign' },
    { ru: 'Каменные ступени — скользко от дождя', en: 'Stone steps slick in rain' },
    { ru: 'Телега с сеном', en: 'Hay wagon' },
    { ru: 'Колодец с ведром', en: 'Well with bucket' },
    { ru: 'Деревянный мост через канал', en: 'Wooden canal bridge' },
    { ru: 'Стойло с ножом мясника', en: 'Butcher block with cleaver' },
    { ru: 'Клетка с курами — хаос', en: 'Chicken coop chaos' },
    { ru: 'Камень мостовой — неровный', en: 'Cobblestones — uneven' },
    { ru: 'Балкон второго этажа', en: 'Second-floor balcony' },
    { ru: 'Дверь с запором', en: 'Barred door' },
    { ru: 'Уличный котёл супа', en: 'Street soup cauldron' },
  ]),
  coastal: Object.freeze([
    { ru: 'Причальные сваи — скользко', en: 'Dock pilings — slick' },
    { ru: 'Сети — схватить ногу', en: 'Nets — snag legs' },
    { ru: 'Шлюпка на волнах', en: 'Rowboat in surf' },
    { ru: 'Устричная куча — острые раковины', en: 'Oyster bed — sharp shells' },
    { ru: 'Высокая волна каждые 3 раунда', en: 'High wave every 3 rounds' },
    { ru: 'Якорь на цепи', en: 'Anchor on chain' },
    { ru: 'Трос — можно перерезать', en: 'Hawser — can sever' },
    { ru: 'Скалы — укрытие', en: 'Sea rocks — cover' },
    { ru: 'Песок — слепит при ударе', en: 'Sand — blinds on shove' },
    { ru: 'Тайник в бочке', en: 'Hidden cache in barrel' },
    { ru: 'Чайки — отвлекают', en: 'Gulls — distraction' },
    { ru: 'Приливная лужа', en: 'Tidal pool' },
    { ru: 'Рыбацкая лодка', en: 'Fishing skiff' },
    { ru: 'Верёвка к снастям', en: 'Rigging ropes' },
    { ru: 'Солёный ветер — помеха на дальний огонь', en: 'Salt spray — ranged penalty' },
    { ru: 'Пирс с щелями', en: 'Rickety pier' },
    { ru: 'Бочка смолы', en: 'Tar barrel' },
    { ru: 'Штормовой прибой', en: 'Storm surge' },
    { ru: 'Камень маяка', en: 'Lighthouse stone' },
    { ru: 'Крабьи норы', en: 'Crab burrows' },
    { ru: 'Водоросли — скользко', en: 'Kelp — slick' },
    { ru: 'Брошенный якорь', en: 'Discarded anchor' },
    { ru: 'Шкура на сушилке', en: 'Hide drying rack' },
    { ru: 'Крюк для рыбы', en: 'Gaff hook on post' },
  ]),
  arctic: Object.freeze([
    { ru: 'Наст — вся местность сложная', en: 'Ice crust — difficult terrain' },
    { ru: 'Снежная насыпь — можно сбросить', en: 'Snow cornice — can avalanche' },
    { ru: 'Лёд на озере — трещит', en: 'Lake ice — cracks' },
    { ru: 'Метель каждые несколько раундов', en: 'Blizzard gusts' },
    { ru: 'Сосулька на карнизе', en: 'Icicle on ledge' },
    { ru: 'Укрытие из сугроба', en: 'Snowdrift cover' },
    { ru: 'Костёр тает снег — яма', en: 'Fire melts snow into pit' },
    { ru: 'Волчья стая следов', en: 'Wolf-pack tracks' },
    { ru: 'Замёрзшая река', en: 'Frozen river' },
    { ru: 'Скользкий склон', en: 'Icy slope' },
    { ru: 'Палатка — укрытие', en: 'Tent cover' },
    { ru: 'Камень выступает из снега', en: 'Stone juts from snow' },
    { ru: 'Ветер срывает мелкий огонь', en: 'Wind snuffs small flames' },
    { ru: 'Ледяная игла с потолка пещеры', en: 'Ice stalactite' },
    { ru: 'Туша мамонта — укрытие', en: 'Mammoth carcass cover' },
    { ru: 'Ловушка под снегом', en: 'Snow-hidden pit' },
    { ru: 'Снежный шар на уступе', en: 'Balanced snow boulder' },
    { ru: 'Лыжня — направление', en: 'Ski tracks — direction clue' },
    { ru: 'Костяные колья', en: 'Bone stakes' },
    { ru: 'Морозная дымка', en: 'Freezing fog' },
    { ru: 'Лёд на ступенях руин', en: 'Icy ruin steps' },
    { ru: 'Снежная слепота при порыве', en: 'Snow-blind gusts' },
    { ru: 'Замёрзшая верёвка — ломается', en: 'Frozen rope — snaps' },
    { ru: 'Укрытие за ледяной глыбой', en: 'Cover behind ice boulder' },
  ]),
  swamp: Object.freeze([
    { ru: 'Тина — удерживает ногу', en: 'Mud — grabs feet' },
    { ru: 'Корни мангров', en: 'Mangrove roots' },
    { ru: 'Гнилое бревно — нестабильно', en: 'Rot log — unstable' },
    { ru: 'Газовые пузыри', en: 'Gas bubbles' },
    { ru: 'Комары — помеха на концентрацию', en: 'Midges — concentration nuisance' },
    { ru: 'Скрипучий мост', en: 'Creaking bridge' },
    { ru: 'Кочки — прыжки', en: 'Hummocks — hop terrain' },
    { ru: 'Плавающий торф', en: 'Floating peat' },
    { ru: 'Змеиное гнездо', en: 'Snake nest' },
    { ru: 'Туман над водой', en: 'Fog over water' },
    { ru: 'Крокодилья тропа', en: 'Croc slide-path' },
    { ru: 'Грибы-споры', en: 'Spore mushrooms' },
    { ru: 'Старая лодка', en: 'Rotting skiff' },
    { ru: 'Верёвка к сухому пятну', en: 'Rope to dry hummock' },
    { ru: 'Пни с мхом', en: 'Mossy stumps' },
    { ru: 'Светлячки', en: 'Fireflies' },
    { ru: 'Тина на доспехах', en: 'Mud on armor' },
    { ru: 'Запах гнили — помеха Восприятию', en: 'Stench — perception hindrance' },
    { ru: 'Пиявки в воде', en: 'Leeches in water' },
    { ru: 'Сломанная клетка', en: 'Broken cage' },
    { ru: 'Камыш — укрытие', en: 'Reeds — cover' },
    { ru: 'Болотный газ', en: 'Marsh gas' },
    { ru: 'Коряга — препятствие', en: 'Snag hazard' },
    { ru: 'Следы копыт к трясине', en: 'Hoof tracks to quicksand' },
  ]),
  mountain: Object.freeze([
    { ru: 'Сыпучий склон', en: 'Scree slope' },
    { ru: 'Узкая тропа над пропастью', en: 'Narrow cliff path' },
    { ru: 'Обвал', en: 'Rockfall trap' },
    { ru: 'Верёвка на уступе', en: 'Cliff rope' },
    { ru: 'Орлиное гнездо', en: 'Aerie overhead' },
    { ru: 'Ветер срывает мелкие предметы', en: 'Wind steals small gear' },
    { ru: 'Козьи тропы', en: 'Goat paths' },
    { ru: 'Снежная полка', en: 'Snow ledge' },
    { ru: 'Водопад — шум маскирует', en: 'Waterfall noise masks sound' },
    { ru: 'Камнепад', en: 'Rockslide' },
    { ru: 'Высота — дальний бой с преимуществом', en: 'Height — ranged advantage' },
    { ru: 'Укрытие за валуном', en: 'Boulder cover' },
    { ru: 'Мост из досок', en: 'Plank bridge' },
    { ru: 'Железная цепь у скалы', en: 'Iron chain on cliff' },
    { ru: 'След козла', en: 'Ibex trail' },
    { ru: 'Гнездо воронов', en: 'Rook nest' },
    { ru: 'Старая шахта', en: 'Old mine mouth' },
    { ru: 'Кристаллы в расщелине', en: 'Crystals in a cleft' },
    { ru: 'Ледник', en: 'Ice tongue' },
    { ru: 'Туман в ущелье', en: 'Gorge fog' },
    { ru: 'Костёр на перевале', en: 'Pass campfire' },
    { ru: 'Каменная стела', en: 'Menhir' },
    { ru: 'Овраг', en: 'Gully' },
    { ru: 'Ветер в узком проходе', en: 'Wind-tunnel pass' },
  ]),
  crypt: Object.freeze([
    { ru: 'Саркофаг с щелью', en: 'Sarcophagus seam' },
    { ru: 'Кости под ногами — шум', en: 'Bone floor — noise' },
    { ru: 'Плита с рычагом', en: 'Slab lever' },
    { ru: 'Факелы гаснут сами', en: 'Self-snuffing torches' },
    { ru: 'Холодный туман', en: 'Cold mist' },
    { ru: 'Надпись-предупреждение', en: 'Warning inscription' },
    { ru: 'Цепи с кандалами', en: 'Shackles on chains' },
    { ru: 'Алтарь с желобом для крови', en: 'Altar with blood groove' },
    { ru: 'Разбитые гробы', en: 'Smashed coffins' },
    { ru: 'Тусклый свет свечей', en: 'Dim candlelight' },
    { ru: 'Скользкий мрамор', en: 'Slick marble' },
    { ru: 'Ниша с урной', en: 'Urn niche' },
    { ru: 'Статуя без лица', en: 'Faceless statue' },
    { ru: 'Трещина в полу', en: 'Floor crack' },
    { ru: 'Следы когтей', en: 'Claw marks' },
    { ru: 'Паутина в углу', en: 'Corner cobwebs' },
    { ru: 'Железная решётка', en: 'Iron grate' },
    { ru: 'Каменные ступени вниз', en: 'Steps down' },
    { ru: 'Запах тлена', en: 'Rot smell' },
    { ru: 'Сломанный символ божества', en: 'Broken holy symbol' },
    { ru: 'Книга молитв — пыль', en: 'Prayer-book dust' },
    { ru: 'След крови к стене', en: 'Blood smear to wall' },
    { ru: 'Скрытая ниша за гробом', en: 'Hidden niche behind bier' },
    { ru: 'Костяной светильник', en: 'Bone sconce' },
  ]),
  any: Object.freeze([
    { ru: 'Случайный мусор как импровизированное оружие', en: 'Random junk as improvised weapons' },
    { ru: 'Слабая балка под потолком', en: 'Weak ceiling beam' },
    { ru: 'Верёвка через зал', en: 'Rope span across room' },
    { ru: 'Камень под ногой — можно пнуть', en: 'Kickable loose stone' },
    { ru: 'Тёмный угол', en: 'Dark corner' },
    { ru: 'Скользкий пол', en: 'Slick floor' },
    { ru: 'Высокий ящик — укрытие', en: 'Tall crate cover' },
    { ru: 'Цепь от потолка', en: 'Hanging chain' },
    { ru: 'Бочка воды', en: 'Water barrel' },
    { ru: 'Костёр', en: 'Campfire' },
    { ru: 'Сломанная мебель', en: 'Broken furniture' },
    { ru: 'Пыльная паутина', en: 'Dusty web' },
    { ru: 'Каменный выступ', en: 'Stone ledge' },
    { ru: 'Узкий проход', en: 'Tight chokepoint' },
    { ru: 'Старый ковёр — может загореться', en: 'Old rug — flammable' },
    { ru: 'Ржавый гвоздь', en: 'Rusty spike' },
    { ru: 'Верёвка на крюке', en: 'Hook and rope' },
    { ru: 'Следы грязи', en: 'Muddy tracks' },
    { ru: 'Сломанная дверь', en: 'Broken door' },
    { ru: 'Камень на краю обрыва', en: 'Cliff-edge stone' },
    { ru: 'Туман', en: 'Fog' },
    { ru: 'Сильный ветер', en: 'Strong wind' },
    { ru: 'Лужа', en: 'Puddle' },
    { ru: 'Куча щебня', en: 'Rubble pile' },
  ]),
});

/**
 * @param {string} envKey
 * @param {() => number} rng
 * @returns {string}
 */
/**
 * @param {string} envKey
 * @param {() => number} rng
 * @param {WorldStateId} [worldState] при `night` — шанс лунных/теневых интерактивов
 * @returns {string}
 */
export function pickEnvironmentInteractableLocalized(envKey, rng, worldState = 'day') {
  const ws = normalizeWorldState(worldState) ?? 'day';
  const k = String(envKey || 'any').toLowerCase();
  const pool = ENVIRONMENT_INTERACTABLES[k] ?? ENVIRONMENT_INTERACTABLES.any;
  if (ws === 'night' && rng() < 0.35) {
    const np = NIGHT_ENVIRONMENT_INTERACTABLES[Math.floor(rng() * NIGHT_ENVIRONMENT_INTERACTABLES.length)];
    return formatLocalizedWithOriginalSuffix(np.ru, np.en);
  }
  const pick = pool[Math.floor(rng() * pool.length)];
  return formatLocalizedWithOriginalSuffix(pick.ru, pick.en);
}

/**
 * @param {string} environmentExtraText
 * @param {string} baseFlavourRu
 * @param {string} baseFlavourEn
 * @returns {{ ru: string, en: string }}
 */
export function mergeEnvironmentIntoTactics(environmentExtraText, baseFlavourRu, baseFlavourEn) {
  const t = String(environmentExtraText ?? '').toLowerCase();
  /** @type {{ keys: RegExp, ru: string, en: string }[]} */
  const mods = [
    { keys: /вода|water|водопад|река|lake|river|прилив|tide/i, ru: 'Используют глубину воды и брызги, чтобы скрыть подход.', en: 'They use depth and spray to hide the approach.' },
    { keys: /огонь|fire|пламя|жар|lava|лава/i, ru: 'Используют жар, дым и пепел, чтобы сбить прицел и видимость.', en: 'They use heat, smoke, and ash to spoil aim and sight.' },
    { keys: /высота|height|обрыв|cliff|скал|вершин|precipice/i, ru: 'Используют перепад высот и обвалы, чтобы давить сверху.', en: 'They use height and rockfalls to pressure from above.' },
    { keys: /тьма|dark|ночь|night|тень|shadow/i, ru: 'Используют тьму как союзника — короткие выпады из чёрного.', en: 'They treat darkness as an ally — stabs from blackness.' },
  ];
  for (const m of mods) {
    if (m.keys.test(t)) {
      return { ru: `${baseFlavourRu} ${m.ru}`, en: `${baseFlavourEn} ${m.en}` };
    }
  }
  return { ru: baseFlavourRu, en: baseFlavourEn };
}

/**
 * @param {Array<{ row: Record<string, unknown>, count: number }>} roster
 * @param {number} leaderIdx
 * @param {string} environmentExtraText
 * @returns {{ ru: string, en: string }}
 */
export function buildEncounterFlavourTextPair(roster, leaderIdx, environmentExtraText) {
  const leader = roster[leaderIdx]?.row;
  if (!leader) {
    return { ru: 'Тактика зависит от численности и местности.', en: 'Tactics depend on numbers and terrain.' };
  }
  const abs = parseAbilityScoresFromMonsterMd(leader);
  const dexHigh = abs.dex != null && abs.dex >= 16;
  const intHigh = abs.int != null && abs.int >= 14;
  const anyStealth = roster.some(({ row }) => monsterStatblockSuggestsStealth(row));
  const beastsHungry = roster.every(({ row }) => isMindlessBeastRow(row) || String(row.type_line ?? '').toLowerCase().includes('beast'));

  let ru = 'Держат строй и используют численность.';
  let en = 'They hold formation and leverage numbers.';
  if (dexHigh && anyStealth) {
    ru = 'Они устроили засаду.';
    en = 'They have set an ambush.';
  } else if (intHigh) {
    ru = 'Они используют тактику и окружение.';
    en = 'They use tactics and terrain.';
  } else if (beastsHungry && roster.length) {
    ru = 'Они голодны и ведут себя агрессивно.';
    en = 'They are hungry and behave aggressively.';
  }
  return mergeEnvironmentIntoTactics(environmentExtraText, ru, en);
}

/**
 * @param {Record<string, unknown>} row
 * @returns {'orcs'|'undead'|'cultists'|'guards'|'beasts'}
 */
export function detectBattleCryTheme(row) {
  const blob = `${String(row.name ?? '')} ${String(row.type_line ?? '')} ${String(row.raw_statblock_md ?? '').slice(0, 800)}`.toLowerCase();
  if (/\borc\b|half[- ]?orc|gruumsh/i.test(blob)) return 'orcs';
  if (/\bundead\b|zombie|skeleton|ghoul|wight|wraith|vampire|lich|specter|ghost\b/i.test(blob)) return 'undead';
  if (/\bcultist\b|acolyte|warlock|fanatic|priest\b.*evil|demon|devil|fiend/i.test(blob)) return 'cultists';
  // Noble/Knight → честь и закон (проверяем до общих «guard»)
  if (/\bnoble\b|\bknight\b|\bpaladin\b|\bchampion\b|\blord\b|\blieutenant\b/i.test(blob)) return 'knights';
  if (/\bguard\b|\bsoldier\b|captain\b|veteran|city watch|sworn/i.test(blob)) return 'guards';
  if (/\bbeast\b|animal|wolf|bear|spider|eagle|serpent/i.test(blob)) return 'beasts';
  return 'guards';
}

/**
 * @param {Array<{ row: Record<string, unknown>, count: number }>} roster
 * @param {() => number} rng
 * @returns {string}
 */
export function pickBattleCryLocalized(roster, rng) {
  const lead = roster[pickLeaderIndexInRoster(roster)]?.row ?? roster[0]?.row;
  if (!lead) {
    return formatLocalizedWithOriginalSuffix('Вперёд!', 'Forward!');
  }
  // Tag-matching: проверяем весь ростер на наличие культистов, фей, благородных
  const allBlobs = roster.map(
    ({ row }) =>
      `${String(row.name ?? '')} ${String(row.type_line ?? '')}`.toLowerCase(),
  );
  const rosterHasCultistOrFiend = allBlobs.some((b) =>
    /\bcultist\b|\bfiend\b|\bdevil\b|\bdemon\b|\bfanatic\b/.test(b),
  );
  const rosterHasNobleOrKnight = allBlobs.some((b) =>
    /\bnoble\b|\bknight\b|\bpaladin\b|\bchampion\b|\blord\b/.test(b),
  );

  let theme = detectBattleCryTheme(lead);

  // Если культовые фразы выбраны, но в отряде нет культистов/fiend — переключаем
  if (theme === 'cultists' && !rosterHasCultistOrFiend) {
    theme = 'guards';
  }
  // Приоритет «честь и закон» если есть Noble/Knight
  if (rosterHasNobleOrKnight) {
    theme = 'knights';
  }

  const pool =
    theme === 'orcs'
      ? BATTLE_CRIES_ORCS
      : theme === 'undead'
        ? BATTLE_CRIES_UNDEAD
        : theme === 'cultists'
          ? BATTLE_CRIES_CULTISTS
          : theme === 'knights'
            ? BATTLE_CRIES_KNIGHTS
            : theme === 'beasts'
              ? BATTLE_CRIES_BEASTS
              : BATTLE_CRIES_GUARDS;
  const raw = pool[Math.floor(rng() * pool.length)];
  const leader = String(lead.name ?? 'Captain');
  const sub = (s) => s.replace(/\{leader\}/gi, leader).replace(/\{clan\}/gi, 'Ironfang');
  return formatLocalizedWithOriginalSuffix(sub(raw.ru), sub(raw.en));
}

/**
 * @param {EncounterArchetypeId} archetype
 * @param {() => number} rng
 * @returns {string}
 */
export function pickMoraleRuleLocalized(archetype, rng) {
  void archetype;
  const raw = MORALE_RULES_SNIPPETS[Math.floor(rng() * MORALE_RULES_SNIPPETS.length)];
  return formatLocalizedWithOriginalSuffix(raw.ru, raw.en);
}

/**
 * @param {string} md
 * @returns {number}
 */
function maxFlySpeedFromStatblock(md) {
  const s = String(md ?? '');
  let best = 0;
  const re = /\bfly(?:ing)?\s+(\d+)\s*ft/gi;
  let m;
  while ((m = re.exec(s)) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > best) best = n;
  }
  return best;
}

/**
 * @param {string} md
 * @returns {boolean}
 */
function statblockHasSpellcasting(md) {
  return /Spellcasting|Innate Spellcasting/i.test(String(md ?? ''));
}

/**
 * Возможности ростера для фильтрации тактик.
 * @param {Array<{ row: Record<string, unknown>, count: number }>} roster
 */
export function scanRosterCapabilities(roster) {
  let totalCreatures = 0;
  let hasUndead = false;
  let hasBeast = false;
  let hasFly = false;
  let hasCaster = false;
  let hasSwarm = false;
  let hasCult = false;
  let hasDragon = false;
  let hasMonstrosity = false;
  let hasHumanoid = false;
  let hasFiend = false;

  for (const { row, count } of roster) {
    const c = Math.max(0, Math.floor(Number(count) || 0));
    totalCreatures += c;
    const tl = String(row.type_line ?? '').toLowerCase();
    const nm = String(row.name ?? '').toLowerCase();
    const md = String(row.raw_statblock_md ?? '');
    if (tl.includes('undead')) hasUndead = true;
    if (tl.includes('beast')) hasBeast = true;
    if (tl.includes('dragon')) hasDragon = true;
    if (tl.includes('monstrosity')) hasMonstrosity = true;
    if (tl.includes('humanoid')) hasHumanoid = true;
    if (tl.includes('fiend')) hasFiend = true;
    if (/\bswarm\b/i.test(tl) || /\bswarm\b/i.test(nm)) hasSwarm = true;
    if (/\bcultist\b|\bfanatic\b|\bcult\b/i.test(tl)) hasCult = true;
    if (statblockHasSpellcasting(md)) hasCaster = true;
    if (maxFlySpeedFromStatblock(md) > 0) hasFly = true;
  }

  const isSolo = totalCreatures === 1;
  return {
    totalCreatures,
    isSolo,
    min2: totalCreatures >= 2,
    min3: totalCreatures >= 3,
    hasUndead,
    hasBeast,
    hasFly,
    hasCaster,
    hasSwarm,
    hasCult,
    hasDragon,
    hasMonstrosity,
    hasHumanoid,
    hasFiend,
  };
}

/**
 * @param {FirstMoveTacticRow} entry
 * @param {ReturnType<typeof scanRosterCapabilities>} cap
 * @param {EncounterArchetypeId} archetype
 * @param {WorldStateId} worldState
 * @returns {boolean}
 */
function tacticAllowedForRoster(entry, cap, archetype, worldState) {
  if (entry.multiOnly && cap.isSolo) return false;
  if (worldState === 'night' && entry.id === 'night_torches') return false;
  for (const req of entry.requires ?? []) {
    if (req === 'undead' && !cap.hasUndead) return false;
    if (req === 'beast' && !cap.hasBeast) return false;
    if (req === 'caster' && !cap.hasCaster) return false;
    if (req === 'fly' && !cap.hasFly) return false;
    if (req === 'swarm' && !cap.hasSwarm) return false;
    if (req === 'cult' && !cap.hasCult) return false;
    if (req === 'min2' && !cap.min2) return false;
    if (req === 'min3' && !cap.min3) return false;
    if (req === 'solo' && !cap.isSolo) return false;
    if (req === 'horde_archetype' && archetype !== 'horde') return false;
    if (req === 'nest_archetype' && archetype !== 'nest') return false;
    if (req === 'symbiosis' && (archetype !== 'symbiosis' || !cap.min2)) return false;
  }
  return true;
}

/**
 * @param {FirstMoveTacticRow} row
 * @returns {string}
 */
function formatTacticRowLocalized(row) {
  return formatLocalizedWithOriginalSuffix(row.ru, row.en);
}

/**
 * @param {FirstMoveTacticRow[]} arr
 * @param {() => number} rng
 */
function shuffleTacticArrayInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Первый ход: фильтрация по тегам ростера, состоянию мира, лимит 2–3 строки.
 * @param {Array<{ row: Record<string, unknown>, count: number }>} roster
 * @param {EncounterArchetypeId} archetype
 * @param {() => number} rng
 * @param {WorldStateId} [worldState]
 * @param {boolean} [isLegendarySolo]
 * @returns {string[]}
 */
export function pickFirstMoveTacticsLocalizedList(roster, archetype, rng, worldState = 'day', isLegendarySolo = false) {
  const ws = normalizeWorldState(worldState) ?? 'day';
  const cap = scanRosterCapabilities(roster);
  const leader = roster[pickLeaderIndexInRoster(roster)]?.row;
  const abs = leader ? parseAbilityScoresFromMonsterMd(leader) : { str: null, dex: null, con: null, int: null, wis: null, cha: null };

  const maxLines = 3;
  /** @type {string[]} */
  const out = [];
  /** @type {Set<string>} */
  const seen = new Set();
  const push = (line) => {
    if (!line || out.length >= maxLines || seen.has(line)) return;
    seen.add(line);
    out.push(line);
  };

  if (ws === 'night') {
    push(formatTacticRowLocalized(WORLD_STATE_NIGHT_TACTIC));
  }

  const allBlobs = roster.map(
    ({ row }) => `${String(row.name ?? '')} ${String(row.type_line ?? '')}`.toLowerCase(),
  );
  const hasNobleOrKnight = allBlobs.some((b) =>
    /\bnoble\b|\bknight\b|\bpaladin\b|\bchampion\b/.test(b),
  );
  if (hasNobleOrKnight) {
    const patrol = FIRST_MOVE_TACTICS_TAGGED.find((t) => t.id === 'patrol_whistle');
    if (patrol && tacticAllowedForRoster(patrol, cap, archetype, ws)) push(formatTacticRowLocalized(patrol));
    if (cap.min2) {
      const wall = FIRST_MOVE_TACTICS_TAGGED.find((t) => t.id === 'shield_wall');
      if (wall && tacticAllowedForRoster(wall, cap, archetype, ws)) push(formatTacticRowLocalized(wall));
    }
  }

  if (isLegendarySolo && cap.isSolo) {
    const leg = SOLO_TACTICS_TAGGED.find((t) => t.id === 'solo_legendary_budget');
    if (leg && tacticAllowedForRoster(leg, cap, archetype, ws)) push(formatTacticRowLocalized(leg));
  }

  if (abs.dex != null && abs.dex >= 16) {
    const t = FIRST_MOVE_TACTICS_TAGGED.find((e) => e.id === 'dex_ambush');
    if (t && tacticAllowedForRoster(t, cap, archetype, ws)) push(formatTacticRowLocalized(t));
  }
  if (abs.int != null && abs.int >= 14) {
    const t = FIRST_MOVE_TACTICS_TAGGED.find((e) => e.id === 'int_flank');
    if (t && tacticAllowedForRoster(t, cap, archetype, ws)) push(formatTacticRowLocalized(t));
  }

  /** @type {FirstMoveTacticRow[]} */
  const candidates = [];
  for (const row of FIRST_MOVE_TACTICS_TAGGED) {
    if (tacticAllowedForRoster(row, cap, archetype, ws)) candidates.push(row);
  }
  if (cap.isSolo) {
    for (const row of SOLO_TACTICS_TAGGED) {
      if (tacticAllowedForRoster(row, cap, archetype, ws)) candidates.push(row);
    }
  }

  shuffleTacticArrayInPlace(candidates, rng);
  for (const row of candidates) {
    push(formatTacticRowLocalized(row));
    if (out.length >= maxLines) break;
  }

  return out;
}

/**
 * Алиас: тактический первый ход с учётом состояния мира (день / ночь / буря).
 * @param {Array<{ row: Record<string, unknown>, count: number }>} roster
 * @param {EncounterArchetypeId} archetype
 * @param {() => number} rng
 * @param {WorldStateId} [worldState]
 * @param {boolean} [isLegendarySolo]
 * @returns {string[]}
 */
export function pickFirstMoveTactics(roster, archetype, rng, worldState = 'day', isLegendarySolo = false) {
  return pickFirstMoveTacticsLocalizedList(roster, archetype, rng, worldState, isLegendarySolo);
}

/**
 * @param {number} playerCount
 * @param {EncounterArchetypeId} archetype
 * @returns {number}
 */
export function maxCreaturesForArchetype(playerCount, archetype) {
  void playerCount;
  if (archetype === 'horde') return 10;
  if (archetype === 'boss_minions') return 8;
  return 5;
}

/**
 * @param {Array<{ row: Record<string, unknown>, count: number }>} roster
 * @param {number} totalCrCap
 * @param {number} partyLevel
 * @returns {{ ok: boolean, reasons: string[] }}
 */
export function auditEncounterRoster(roster, totalCrCap, partyLevel) {
  const reasons = [];
  let sumCr = 0;
  let hasCelestial = false;
  let hasFiend = false;
  let hasUndead = false;
  for (const { row, count } of roster) {
    const c = Math.max(0, Math.floor(Number(count) || 0));
    const cr = Number(row.cr_numeric);
    sumCr += (Number.isFinite(cr) ? cr : 0) * c;
    const tl = String(row.type_line ?? '').toLowerCase();
    if (tl.includes('celestial')) hasCelestial = true;
    if (tl.includes('fiend')) hasFiend = true;
    if (tl.includes('undead')) hasUndead = true;
  }
  if (sumCr > totalCrCap + 0.75) reasons.push('cr_over_cap');
  if (hasCelestial && hasFiend && !(hasUndead && partyLevel >= 12)) {
    reasons.push('celestial_fiend_without_context');
  }
  if (hasCelestial && hasUndead && partyLevel < 8) {
    reasons.push('celestial_undead_odd_low_tier');
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * @param {() => number} rng
 * @param {Array<{ row: Record<string, unknown>, count: number, injured?: boolean }>} roster
 */
export function applyInjuryVarianceToRoster(roster, rng) {
  if (roster.length === 0) return;
  if (rng() > 0.15) return;
  const idx = Math.floor(rng() * roster.length);
  roster[idx].injured = true;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {Record<string, unknown>} leaderRow
 * @param {number} maxCr
 * @param {number} [limit]
 * @returns {Array<Record<string, unknown>>}
 */
export function fetchMonstersMentioningLeaderKeywords(db, leaderRow, maxCr, limit = 40) {
  const name = String(leaderRow.name ?? '');
  const parts = name
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length >= 4 && !/^(young|adult|ancient|swarm|large|small|medium|tiny|huge|gargantuan)$/.test(w));
  const keywords = [...new Set(parts)].slice(0, 4);
  if (keywords.length === 0) return [];
  const likeVals = keywords.map((k) => `%${k}%`);
  const kwSql = keywords.map(() => 'instr(lower(ifnull(raw_statblock_md,\'\')), ?) > 0').join(' OR ');
  const sql = `
    SELECT * FROM monsters
    WHERE xp IS NOT NULL AND cast(xp as real) > 0
      AND cr_numeric IS NOT NULL AND cast(cr_numeric as real) >= 0
      AND cast(cr_numeric as real) <= ?
      AND (${kwSql})
      AND lower(ifnull(name,'')) != lower(?)
    ORDER BY RANDOM()
    LIMIT ?
  `;
  const fullParams = [...likeVals, maxCr, name, limit];
  return /** @type {Array<Record<string, unknown>>} */ (db.prepare(sql).all(...fullParams));
}

/**
 * Извлекает семантические теги из текста «следа» (RU/EN) для цепочки встреч.
 * @param {string|null|undefined} traceText
 * @returns {string[]}
 */
export function extractTagsFromTrace(traceText) {
  const t = String(traceText ?? '').toLowerCase();
  /** @type {Set<string>} */
  const tags = new Set();
  if (/гнилостн|разложен|труп|decay|putref|rotting|corpse|shamble|necrot/i.test(t)) {
    tags.add('undead');
  }
  if (/оккультн|ритуал|кров|blood symbol|occult|sigil|pentagram|cult|жертв|blood smear/i.test(t)) {
    tags.add('cultist');
    tags.add('fiend');
  }
  if (/чешуя|коготь|дракон|dragon|scale|claw furrow|reptilian|wyrm/i.test(t)) {
    tags.add('dragon');
    tags.add('monstrosity');
  }
  if (/золото|монет|бандит|gold coin|purse|brigand|thug|orders addressed|разбой/i.test(t)) {
    tags.add('humanoid');
    tags.add('bandit');
  }
  if (/механическ|скрежет|gears|clockwork|construct|automaton|golem/i.test(t)) {
    tags.add('construct');
  }
  return [...tags];
}

/**
 * Превращает семантические теги в подстроки для SQL LIKE (name / type_line / statblock).
 * @param {string[]} tags
 * @returns {string[]}
 */
export function dungeonTagsToSqlFragments(tags) {
  /** @type {Set<string>} */
  const s = new Set();
  for (const raw of tags) {
    const t = String(raw ?? '')
      .trim()
      .toLowerCase();
    if (!t) continue;
    switch (t) {
      case 'undead':
        s.add('undead');
        break;
      case 'cultist':
        s.add('cultist');
        s.add('fanatic');
        s.add('acolyte');
        break;
      case 'fiend':
        s.add('fiend');
        s.add('demon');
        s.add('devil');
        break;
      case 'dragon':
        s.add('dragon');
        break;
      case 'monstrosity':
        s.add('monstrosity');
        break;
      case 'humanoid':
        s.add('humanoid');
        break;
      case 'bandit':
        s.add('bandit');
        s.add('brigand');
        s.add('thug');
        break;
      case 'construct':
        s.add('construct');
        break;
      default:
        if (t.length >= 3) s.add(t);
    }
  }
  return [...s];
}

/** Примечание к окружению при буре (дальний бой / Внимательность). */
const STORM_ENVIRONMENT_NOTE = Object.freeze({
  ru: 'Сильный ветер: помеха на дальние атаки и проверки восприятия.',
  en: 'Strong wind: disadvantage on ranged attacks and Perception checks.',
});

const TRACE_HUMANOID_NAMES_RU = Object.freeze([
  'Торин', 'Марета', 'Касвелл', 'Иветта', 'Дорн', 'Серафина', 'Гримм', 'Альва', 'Рюрик', 'Элина',
  'Борис', 'Лиора', 'Феникс', 'Освальд', 'Мира', 'Калеб', 'Найра', 'Виктор', 'Сильва', 'Ян',
]);

const TRACE_HUMANOID_NAMES_EN = Object.freeze([
  'Torrin', 'Mareta', 'Caswell', 'Yvette', 'Dorn', 'Seraphina', 'Grimm', 'Alva', 'Rurik', 'Elina',
  'Boris', 'Liora', 'Phoenix', 'Oswald', 'Mira', 'Caleb', 'Nyra', 'Victor', 'Silva', 'Jan',
]);

/**
 * @typedef {'visual'|'auditory'|'olfactory'|'resource'} EncounterTraceClueType
 */

/**
 * След 2.0: тип улики + нарратив + механика для следующей сцены.
 * @param {Array<{ row: Record<string, unknown>, count: number }>} roster
 * @param {string} [nextEncounterHint]
 * @param {() => number} [rng]
 * @returns {{
 *   clueType: EncounterTraceClueType,
 *   displayLine: string,
 *   mechanicsLine: string,
 *   chainTagLine: string,
 * }}
 */
export function generateEncounterTrace2(roster, nextEncounterHint = '', rng = Math.random) {
  const cap = scanRosterCapabilities(roster);
  const r = rng();
  /** @type {EncounterTraceClueType} */
  let clueType = 'visual';
  if (r < 0.32) clueType = 'visual';
  else if (r < 0.57) clueType = 'auditory';
  else if (r < 0.78) clueType = 'olfactory';
  else clueType = 'resource';

  if (clueType === 'resource' && cap.hasUndead) {
    clueType = rng() < 0.5 ? 'visual' : 'olfactory';
  }

  let ru = '';
  let en = '';
  let mechRu = '';
  let mechEn = '';

  if (clueType === 'visual') {
    if (cap.hasUndead) {
      ru = 'Зрительная улика: гнилостные потёки и чёрная кровь на пороге ведут вглубь…';
      en = 'Visual clue: foul smears and black blood on the threshold lead deeper…';
    } else if (cap.hasDragon || cap.hasMonstrosity) {
      ru = 'Зрительная улика: обломок чешуи и глубокие борозды когтей на камне…';
      en = 'Visual clue: a shed scale and deep claw furrows scored into stone…';
    } else if (cap.hasHumanoid) {
      ru = 'Зрительная улика: брызги крови и рваный лоскут плаща на кольях…';
      en = 'Visual clue: blood spatter and a torn cloak scrap caught on spikes…';
    } else {
      ru = 'Зрительная улика: свежие царапины и придавленная грязь — кто-то тащил тяжесть прочь…';
      en = 'Visual clue: fresh gouges and pressed mud — something heavy was dragged away…';
    }
    mechRu = 'Эффект: **+2** к следующей проверке **Инициативы** у группы (вы готовы к засаде).';
    mechEn = 'Effect: **+2** to the party’s next **Initiative** check (you’re braced for ambush).';
  } else if (clueType === 'auditory') {
    ru = 'Слуховая улика: из темноты доносятся лязг цепей и чужой напев…';
    en = 'Auditory clue: from the dark — chain-rattle and a stranger’s humming…';
    mechRu = 'Эффект: **преимущество** на **первый** спасбросок от **страха** или **очарования** в следующем бою.';
    mechEn = 'Effect: **advantage** on the **first** save vs **fear** or **charm** in the next combat.';
  } else if (clueType === 'olfactory') {
    const ozone = rng() < 0.5;
    if (ozone) {
      ru = 'Обонятельная улика: резкий запах озона — будто здесь били молнией…';
      en = 'Olfactory clue: sharp ozone — as if lightning kissed the stone…';
      mechRu =
        'Эффект: **Сопротивление (Resistance)** к **электричеству** к **одному** попаданию в следующем бою.';
      mechEn = 'Effect: **Resistance** to **lightning** against **one** hit in the next combat.';
    } else {
      ru = 'Обонятельная улика: тошнотворная сера и кислотный дым из щели…';
      en = 'Olfactory clue: sickening brimstone and acidic vapour from a crack…';
      mechRu = 'Эффект: **Сопротивление (Resistance)** к **кислоте** к **одному** попаданию в следующем бою.';
      mechEn = 'Effect: **Resistance** to **acid** against **one** hit in the next combat.';
    }
  } else {
    ru = 'Находка: брошенный лагерь — зола тёплая, котелок опрокинут…';
    en = 'Find: an abandoned camp — warm ashes, kettle overturned…';
    mechRu = 'Эффект: группа может совершить **короткий отдых** без броска на случайную встречу (по усмотрению ДМ).';
    mechEn = 'Effect: the party may take a **short rest** with no random encounter roll (DM discretion).';
  }

  const hint = String(nextEncounterHint ?? '').trim();
  if (hint) {
    ru = `${ru} _(подсказка: ${hint})_`;
    en = `${en} _(hint: ${hint})_`;
  }

  const displayLine = formatLocalizedWithOriginalSuffix(ru, en);
  const mechanicsLine = formatLocalizedWithOriginalSuffix(mechRu, mechEn);
  const chainTagLine = formatLocalizedWithOriginalSuffix(ru, en);
  return { clueType, displayLine, mechanicsLine, chainTagLine };
}

/**
 * «След» после боя — строка для совместимости (нарратив + механика в одном блоке).
 * @param {Array<{ row: Record<string, unknown>, count: number }>} roster
 * @param {string} [nextEncounterHint]
 * @param {() => number} [rng]
 * @returns {string}
 */
export function generateEncounterTrace(roster, nextEncounterHint = '', rng = Math.random) {
  const t = generateEncounterTrace2(roster, nextEncounterHint, rng);
  return `${t.displayLine} ${t.mechanicsLine}`.trim();
}

/** @type {readonly { ru: string, en: string }[]} */
const DEATH_RATTLE_LAWFUL = Object.freeze([
  { ru: 'За короля…', en: 'For the king…' },
  { ru: 'Мой орден… не забудет…', en: 'My order… will not forget…' },
  { ru: 'Честь… важнее…', en: 'Honour… above…' },
  { ru: 'Стой… стража… держите… строй…', en: 'Hold… guards… the… line…' },
  { ru: 'Клятва… была… священна…', en: 'The oath… was… sacred…' },
]);

/** @type {readonly { ru: string, en: string }[]} */
const DEATH_RATTLE_CHAOTIC = Object.freeze([
  { ru: 'Проклятье… всё золото… вам не достанется…', en: 'Damn it… all the gold… you’ll never… get it…' },
  { ru: 'Горит… в аду… вместе со мной…', en: 'Burn… in hell… with me…' },
  { ru: 'Я… ещё… вернусь…', en: 'I’ll… be back…' },
  { ru: 'Никому… не скажу… где… тайник…', en: 'Won’t tell… where… the stash…' },
  { ru: 'Вы… такие же… воры…', en: 'You’re… thieves… too…' },
]);

/** @type {readonly { ru: string, en: string }[]} */
const DEATH_RATTLE_ABERRATION = Object.freeze([
  { ru: '(В голове всплывает образ бесконечной пустоты и голода…)', en: '(Your mind flashes with endless void and hunger…)' },
  { ru: '(Шёпот на языке, которого не существует…)', en: '(A whisper in a tongue that should not exist…)' },
  { ru: '(Зубы в темноте смыкаются — звук остаётся после смерти…)', en: '(Teeth click in darkness — the sound outlasts death…)' },
]);

/** @type {readonly { ru: string, en: string }[]} */
const DEATH_RATTLE_BEAST = Object.freeze([
  { ru: '(Жалобный визг и последний оскал…)', en: '(A plaintive whine and a final snarl…)' },
  { ru: '(Хриплое дыхание — и тишина…)', en: '(A rasping breath — then silence…)' },
  { ru: '(Дёргается лапа — как прощание…)', en: '(A twitching paw — a farewell…)' },
]);

/** @type {readonly { ru: string, en: string }[]} */
const DEATH_RATTLE_UNDEAD = Object.freeze([
  { ru: 'Тишина… без… слов…', en: 'Silence… without… words…' },
  { ru: 'Прах… зовёт… прах…', en: 'Dust… calls… dust…' },
  { ru: 'Свет… гаснет…', en: 'The light… gutters…' },
]);

/** @type {readonly { ru: string, en: string }[]} */
const DEATH_RATTLE_DEFAULT = Object.freeze([
  { ru: 'Это… ещё не конец…', en: 'This… isn’t the end…' },
  { ru: 'Запомни… моё имя…', en: 'Remember… my name…' },
  { ru: 'Я… видел… хуже…', en: 'I’ve… seen… worse…' },
]);

/**
 * @param {Record<string, unknown>} row
 * @returns {'evil'|'good'|'neutral'|'beast'}
 */
export function inferAlignmentBandFromMonster(row) {
  const tl = String(row.type_line ?? '').toLowerCase();
  const nm = String(row.name ?? '').toLowerCase();
  const md = String(row.raw_statblock_md ?? '').slice(0, 2000).toLowerCase();
  const blob = `${tl} ${nm} ${md}`;
  if (tl.includes('beast') && !tl.includes('humanoid')) return 'beast';
  if (/\bunaligned\b|typically\s+unaligned|often\s+unaligned/i.test(tl) && tl.includes('beast')) return 'beast';
  if (tl.includes('celestial') || /\bgood\b|\blawful\s+good\b|\bneutral\s+good\b/i.test(blob)) return 'good';
  if (
    tl.includes('fiend') ||
    tl.includes('undead') ||
    /\bevil\b|\bchaotic\s+evil\b|\blawful\s+evil\b|\bneutral\s+evil\b|\bvillain\b|\bassassin\b/i.test(blob)
  ) {
    return 'evil';
  }
  return 'neutral';
}

/**
 * Предсмертная фраза 2.0 — зависит от мировоззрения / типа; возвращает механический хвост для ДМ.
 * @param {Record<string, unknown>} row строка monsters
 * @param {() => number} [rng]
 * @param {EncounterEcologyRoleId|null} [encounterRole]
 * @returns {{ display: string, mechanical: string }}
 */
export function generateDeathRattle(row, rng = Math.random, encounterRole = null) {
  const tl = String(row.type_line ?? '').toLowerCase();
  const nm = String(row.name ?? '').toLowerCase();
  const md = String(row.raw_statblock_md ?? '').slice(0, 1500).toLowerCase();
  const band = inferAlignmentBandFromMonster(row);

  /** @type {readonly { ru: string, en: string }[]} */
  let pool = DEATH_RATTLE_DEFAULT;
  if (tl.includes('aberration') || /mind flayer|illithid|beholder|aboleth/i.test(nm + md)) {
    pool = DEATH_RATTLE_ABERRATION;
  } else if (tl.includes('undead')) {
    pool = DEATH_RATTLE_UNDEAD;
  } else if (tl.includes('beast')) {
    pool = DEATH_RATTLE_BEAST;
  } else if (/\bknight\b|\bpaladin\b|\bguard\b|\bcaptain\b|\blawful\b/i.test(tl + md)) {
    pool = DEATH_RATTLE_LAWFUL;
  } else if (/\bbandit\b|\bbrigand\b|\boutlaw\b|\bthief\b|\bchaotic\b|\braider\b/i.test(tl + nm + md)) {
    pool = DEATH_RATTLE_CHAOTIC;
  }

  let pick = pool[Math.floor(rng() * pool.length)];
  let mechRu = '';
  let mechEn = '';

  if (band === 'evil' || tl.includes('fiend')) {
    pick = { ru: 'Мой господин… вырвет вам сердца…', en: 'My master… will tear out… your hearts…' };
    mechRu = 'Механика: на всех героях **Bane** (проклятие) **1 раунд** (спасбросок Харизмы СЛ 10 — по усмотрению ДМ).';
    mechEn = 'Mechanics: **Bane** on all heroes for **1 round** (Charisma save DC 10 — DM adjudication).';
  } else if (band === 'good') {
    const hints = [
      { ru: 'Берегитесь… впереди… пламя…', en: 'Beware… ahead… flame…', dmg: 'огонь / fire' },
      { ru: 'Лёд… в жилах… трона…', en: 'Ice… in the… throne…', dmg: 'холод / cold' },
      { ru: 'Яд… капает… с балкона…', en: 'Poison… drips… from the gallery…', dmg: 'яд / poison' },
    ];
    const h = hints[Math.floor(rng() * hints.length)];
    pick = { ru: h.ru, en: h.en };
    mechRu = `Подсказка следующего угрозы: основной урон — **${h.dmg}**.`;
    mechEn = `Foreshadowing: the next big threat favors **${h.dmg}** damage.`;
  } else if (band === 'beast') {
    pick = { ru: '(Скулёж, зовущий стаю…)', en: '(A howl that calls the pack…)' };
    mechRu =
      'Механика: **50%** шанс, что в **начале второго раунда** появится **1 миньон** того же семейства (CR ≤ 1/4).';
    mechEn =
      'Mechanics: **50%** chance **1 minion** of the same family (CR ≤ 1/4) arrives at **round 2 start**.';
  } else if (band === 'neutral' && !/aberration|construct|ooze|elemental/i.test(tl)) {
    const h = [
      { ru: 'Берегитесь… впереди… пламя…', en: 'Beware… ahead… flame…', dmg: 'огонь / fire' },
      { ru: 'Свет… гаснет… в зале…', en: 'The light… dies… in the hall…', dmg: 'некротик / necrotic' },
    ][Math.floor(rng() * 2)];
    pick = { ru: h.ru, en: h.en };
    mechRu = `Подсказка: следующий «босс» может бить **${h.dmg}**.`;
    mechEn = `Hint: the next “boss” may deal **${h.dmg}**.`;
  }

  if (encounterRole === 'boss') {
    mechRu = `${mechRu ? `${mechRu} ` : ''}(Главарь) последний выдох усиливает угрозу — враги получают **вдохновение** на одну реплику союзника.`.trim();
    mechEn = `${mechEn ? `${mechEn} ` : ''}(Boss) final breath empowers allies — one ally gains **inspiration** on a taunt line.`.trim();
  }

  return {
    display: formatLocalizedWithOriginalSuffix(pick.ru, pick.en),
    mechanical: mechRu && mechEn ? formatLocalizedWithOriginalSuffix(mechRu, mechEn) : '',
  };
}

/**
 * Сводный нарратив для JSON/Markdown.
 *
 * @param {import('better-sqlite3').Database|null} db
 * @param {{
 *   archetype: EncounterArchetypeId,
 *   roster: Array<{ row: Record<string, unknown>, count: number, injured?: boolean }>,
 *   environmentKey: string,
 *   environmentExtraText: string,
 *   isLegendarySolo: boolean,
 *   rng: () => number,
 *   worldState?: WorldStateId,
 *   nextEncounterHint?: string,
 *   encounterRole?: EncounterEcologyRoleId,
 *   ecologyTactics?: string,
 *   battlefieldHeightSummary?: string,
 *   environmentalHazardLine?: string,
 * }} pack
 * @returns {{
 *   archetype: string,
 *   archetypeLabel: string,
 *   tactics: string,
 *   battleCry: string,
 *   morale: string,
 *   interactable: string,
 *   firstMoves: string[],
 *   legendarySolo: boolean,
 *   worldState: WorldStateId,
 *   worldStateLabel: string,
 *   stormEnvironmentNote: string,
 *   encounterTrace: string,
 *   encounterTraceMechanics: string,
 *   encounterTraceClueType: EncounterTraceClueType,
 *   encounterEcologyTactics: string,
 *   encounterRole: EncounterEcologyRoleId,
 *   encounterRoleLabelRu: string,
 *   battlefieldHeightSummary: string,
 *   environmentalHazardLine: string,
 *   darknessCombatNote: string,
 * }}
 */
export function buildScenarioNarrativeBundle(db, pack) {
  const rng = pack.rng;
  const ws = normalizeWorldState(pack.worldState) ?? 'day';
  const leaderIdx = pickLeaderIndexInRoster(pack.roster);
  const pair = buildEncounterFlavourTextPair(pack.roster, leaderIdx, pack.environmentExtraText);
  const tactics = formatLocalizedWithOriginalSuffix(pair.ru, pair.en);
  const battleCry = pickBattleCryLocalized(pack.roster, rng);
  const morale = pickMoraleRuleLocalized(pack.archetype, rng);
  const interactable = pickEnvironmentInteractableLocalized(pack.environmentKey, rng, ws);
  const firstMoves = pickFirstMoveTacticsLocalizedList(
    pack.roster,
    pack.archetype,
    rng,
    ws,
    Boolean(pack.isLegendarySolo),
  );
  const stormEnvironmentNote =
    ws === 'storm' ? formatLocalizedWithOriginalSuffix(STORM_ENVIRONMENT_NOTE.ru, STORM_ENVIRONMENT_NOTE.en) : '';
  const trace2 = generateEncounterTrace2(pack.roster, String(pack.nextEncounterHint ?? ''), rng);
  const encounterTrace = `${trace2.displayLine} ${trace2.mechanicsLine}`.trim();
  const darknessCombatNote =
    ws === 'night'
      ? formatLocalizedWithOriginalSuffix(
          'Тьма: враги используют слух — атака по источнику звука, **Скрытность** в тенях.',
          'Darkness: foes rely on hearing — attacks target sound sources, **Stealth** in shadow.',
        )
      : '';
  const encounterRole = /** @type {EncounterEcologyRoleId} */ (pack.encounterRole ?? 'guard');
  const encounterEcologyTactics =
    typeof pack.ecologyTactics === 'string' && pack.ecologyTactics.length > 0
      ? pack.ecologyTactics
      : formatEncounterEcologyTacticsLocalized(encounterRole);
  const battlefieldHeightSummary =
    typeof pack.battlefieldHeightSummary === 'string' ? pack.battlefieldHeightSummary : '';
  const environmentalHazardLine =
    typeof pack.environmentalHazardLine === 'string' ? pack.environmentalHazardLine : '';
  let npcInventoryNote = '';
  if (pack.roster.some(({ row }) => isHumanoidMonster(row))) {
    npcInventoryNote = pickHumanoidHandPropLocalized(rng);
  }
  void db;
  return {
    archetype: pack.archetype,
    archetypeLabel: formatArchetypeLabelRuEn(pack.archetype),
    tactics,
    battleCry,
    morale,
    interactable,
    firstMoves,
    npcInventoryNote,
    legendarySolo: Boolean(pack.isLegendarySolo),
    worldState: ws,
    worldStateLabel: formatWorldStateLabelRuEn(ws),
    stormEnvironmentNote,
    encounterTrace,
    encounterTraceMechanics: trace2.mechanicsLine,
    encounterTraceClueType: trace2.clueType,
    encounterEcologyTactics,
    encounterRole,
    encounterRoleLabelRu: formatEncounterEcologyRoleLabelRu(encounterRole),
    battlefieldHeightSummary,
    environmentalHazardLine,
    darknessCombatNote,
  };
}

// ─── Pocket Loot Engine ───────────────────────────────────────────────────────

/** @type {readonly { ru: string, en: string }[]} */
const POCKET_HUMANOID = Object.freeze([
  { ru: 'трубка с остатком табака', en: 'pipe with tobacco dregs' },
  { ru: 'игральные кости из кости', en: 'bone dice' },
  { ru: 'смятое письмо (нечитаемо)', en: 'crumpled letter (illegible)' },
  { ru: 'тяжёлый железный ключ', en: 'heavy iron key' },
  { ru: 'кремень и огниво', en: 'flint and steel' },
  { ru: 'кусок засохшего сыра', en: 'hard dried cheese' },
  { ru: 'обгрызенный карандаш', en: 'chewed stub of a pencil' },
  { ru: 'дешёвый деревянный амулет', en: 'cheap wooden amulet' },
  { ru: 'полоска вяленого мяса', en: 'strip of jerky' },
  { ru: 'флакон с дешёвым вином', en: 'flask of cheap wine' },
  { ru: 'лоскут с гербом неизвестной гильдии', en: 'rag with unknown guild sigil' },
  { ru: 'набор игл и ниток', en: 'needle and thread' },
  { ru: 'потрёпанная колода карт', en: 'worn deck of cards' },
  { ru: 'наручные счёты (абак)', en: 'small abacus' },
  { ru: 'огрызок свечи', en: 'stub candle' },
  { ru: 'маленькое зеркальце', en: 'small mirror' },
  { ru: 'кольцо с дешёвым стеклом вместо камня', en: 'ring with glass instead of a gem' },
  { ru: 'засушенный цветок', en: 'dried flower' },
  { ru: 'пара медных монет с просверленными дырками', en: 'two copper coins with drilled holes' },
  { ru: 'шнурок с узелками — счёт долгов', en: 'knotted cord — debt tally' },
  { ru: 'охотничий свисток', en: 'hunting whistle' },
  { ru: 'пузырёк с едкой жидкостью (уксус?)', en: 'vial of pungent liquid (vinegar?)' },
  { ru: 'маленькая куколка из соломы', en: 'small straw doll' },
  { ru: 'сломанный гребень', en: 'broken comb' },
  { ru: 'кусочек мела', en: 'piece of chalk' },
  { ru: 'грязный платок', en: 'dirty handkerchief' },
  { ru: 'листок с кривыми числами (расчёты)', en: 'paper with crooked numbers (accounts)' },
  { ru: 'зубочистка из кости', en: 'bone toothpick' },
  { ru: 'сыромятный ремешок', en: 'rawhide cord' },
  { ru: 'маленькая стеклянная бусина', en: 'small glass bead' },
]);

/** @type {readonly { ru: string, en: string }[]} */
const POCKET_UNDEAD = Object.freeze([
  { ru: 'костяной амулет в форме черепа', en: 'skull-shaped bone amulet' },
  { ru: 'щепотка серого праха в мешочке', en: 'pinch of grey ash in a pouch' },
  { ru: 'старая монета с неизвестным профилем', en: 'old coin with unknown profile' },
  { ru: 'заржавевший гвоздь', en: 'rusted nail' },
  { ru: 'сухая рука — не понять чья', en: 'dried hand — origin unknown' },
  { ru: 'клок свалявшихся тёмных волос', en: 'matted lock of dark hair' },
  { ru: 'кольцо из потемневшего серебра', en: 'ring of tarnished silver' },
  { ru: 'осколок надгробного камня с буквой', en: 'gravestone shard with a letter' },
  { ru: 'оберег из кладбищенской земли (зашит)', en: 'charm sewn with graveyard earth' },
  { ru: 'маленький флакон с чёрной жидкостью', en: 'small vial of black liquid' },
  { ru: 'ленточка траурного крепа', en: 'strip of mourning crape' },
  { ru: 'кость пальца на шнурке', en: 'finger bone on a cord' },
  { ru: 'монета с пробитым глазом (проклятая?)', en: 'coin with pierced eye (cursed?)' },
  { ru: 'хрупкий бумажный свиток — стёртые руны', en: 'brittle paper scroll — erased runes' },
  { ru: 'стеклянный глаз', en: 'glass eye' },
  { ru: 'сгнивший кошелёк без монет', en: 'rotted pouch (empty)' },
  { ru: 'высушенный цветок чёрного паслёна', en: 'dried black nightshade flower' },
  { ru: 'щепотка кладбищенской соли', en: 'pinch of graveyard salt' },
  { ru: 'миниатюрный гроб из дерева', en: 'miniature wooden coffin' },
  { ru: 'засохшая восковая печать — герб склепа', en: 'dried wax seal — crypt heraldry' },
  { ru: 'цепь с жетоном без надписи', en: 'chain with blank token' },
  { ru: 'клочок савана', en: 'scrap of burial shroud' },
  { ru: 'чёрные чётки из обсидиана', en: 'black obsidian prayer beads' },
  { ru: 'засушенное насекомое в янтаре', en: 'dried insect in amber resin' },
  { ru: 'обломок деревянного колышка', en: 'snapped wooden stake fragment' },
  { ru: 'старая записка: "не открывай"', en: 'old note: "do not open"' },
  { ru: 'пепел от письма', en: 'ash from a burned letter' },
  { ru: 'булавка из железа с кровавым пятном', en: 'iron pin with a bloodstain' },
  { ru: 'монетка из незнакомого металла', en: 'coin of unfamiliar metal' },
  { ru: 'ноготь (нечеловечески длинный)', en: 'fingernail (unnaturally long)' },
]);

/** @type {readonly { ru: string, en: string }[]} */
const POCKET_BEAST = Object.freeze([
  { ru: 'необычное радужное перо', en: 'iridescent unusual feather' },
  { ru: 'сломанный клык', en: 'broken fang' },
  { ru: 'блестящий камушек из желудка', en: 'shiny stone from the stomach' },
  { ru: 'маленькая ракушка', en: 'small shell' },
  { ru: 'клочок яркой шерсти', en: 'tuft of bright fur' },
  { ru: 'небольшая чешуя', en: 'small scale' },
  { ru: 'сухое насекомое — жук-рогач', en: 'dried stag beetle' },
  { ru: 'обглоданная кость', en: 'gnawed bone' },
  { ru: 'кусочек янтаря с мухой', en: 'amber chip with fly inside' },
  { ru: 'коготь (необычно острый)', en: 'claw (unusually sharp)' },
  { ru: 'пучок жёстких щетинок', en: 'bundle of stiff bristles' },
  { ru: 'несколько крупных зубов', en: 'several large teeth' },
  { ru: 'сухой кусочек кожи (рептилия)', en: 'dried skin patch (reptile)' },
  { ru: 'маленькое яйцо (пустое)', en: 'small egg (empty)' },
  { ru: 'кусочек пчелиных сот', en: 'piece of honeycomb' },
  { ru: 'шарик слизи в листе лопуха', en: 'ball of slime in a burdock leaf' },
  { ru: 'засохший след крови — карта охоты?', en: 'dried blood smear — hunt map?' },
  { ru: 'обрывок паутины с добычей', en: 'web scrap with caught prey' },
  { ru: 'мелкие косточки (мышь)', en: 'tiny bones (mouse)' },
  { ru: 'пара когтей на нитке', en: 'two claws on a string' },
  { ru: 'беззвучный свисток (ультразвук)', en: 'silent whistle (ultrasonic)' },
  { ru: 'маленький рог (обломок)', en: 'small horn (fragment)' },
  { ru: 'клубок паучьего шёлка', en: 'spool of spider silk' },
  { ru: 'странный камень — почти правильной формы', en: 'oddly regular-shaped stone' },
  { ru: 'высушенный грибок', en: 'dried fungus cap' },
  { ru: 'маленький сухой стручок семян', en: 'small dried seed pod' },
  { ru: 'перо совы — абсолютно бесшумное', en: 'owl feather — completely silent' },
  { ru: 'кусочек воска от дикого улья', en: 'beeswax from a wild hive' },
  { ru: 'осколок панциря краба', en: 'crab shell shard' },
  { ru: 'высушенный жук-скарабей', en: 'dried scarab beetle' },
]);

/** @type {readonly { ru: string, en: string }[]} */
const POCKET_CULTIST = Object.freeze([
  { ru: 'рунический медальон', en: 'runic medallion' },
  { ru: 'флакон с тёмной маслянистой жидкостью', en: 'vial of dark oily liquid' },
  { ru: 'обрывок манифеста с проповедью', en: 'torn manifesto excerpt' },
  { ru: 'восковая фигурка с иглами', en: 'wax doll with needles' },
  { ru: 'мешочек с зубами и прахом', en: 'small pouch of teeth and ash' },
  { ru: 'чёрная свеча (наполовину сожжена)', en: 'black candle (half burned)' },
  { ru: 'печать из неизвестного металла', en: 'seal of unknown metal' },
  { ru: 'зашифрованная записка', en: 'encoded note' },
  { ru: 'кольцо с символом ока', en: 'ring with eye symbol' },
  { ru: 'нечитаемая татуировочная игла', en: 'tattooing needle with strange ink' },
  { ru: 'фрагмент чёрного зеркала', en: 'fragment of black mirror' },
  { ru: 'засушенное сердце мелкого животного', en: 'dried heart of small animal' },
  { ru: 'флакон «благовоний» — резкий запах', en: 'vial of "incense" — pungent odor' },
  { ru: 'осколок алтарного камня', en: 'altar stone shard' },
  { ru: 'маленькая чёрная ложечка', en: 'small black spoon' },
  { ru: 'список имён жертв (зачёркнутых)', en: 'list of names (crossed out)' },
  { ru: 'пепел от книги', en: 'ash from a burned book' },
  { ru: 'сырой кусок тёмного мыла', en: 'raw chunk of dark soap' },
  { ru: 'кусочек ткани с символами крови', en: 'cloth scrap with blood symbols' },
  { ru: 'старый зуб в платочке', en: 'old tooth in a cloth wrap' },
  { ru: 'тёмный кристалл', en: 'dark crystal' },
  { ru: 'игла из кости', en: 'bone needle' },
  { ru: 'запечатанный конверт: «Не вскрывать»', en: 'sealed envelope: "Do not open"' },
  { ru: 'кожаный шнурок с узорами', en: 'patterned leather cord' },
  { ru: 'обуглённый пергамент с символом', en: 'charred parchment with a sigil' },
  { ru: 'пыль из чёрной смоляной труборки', en: 'dust from a black resin pipe' },
  { ru: 'монета с изображением взора', en: 'coin bearing a watching eye' },
  { ru: 'маленькая бутылка с кровью', en: 'small bottle with blood' },
  { ru: 'нитка со стеклянными шариками', en: 'thread with glass beads' },
  { ru: 'потрёпанная книжечка молитв тьме', en: 'tattered book of dark prayers' },
]);

/** @type {readonly { ru: string, en: string }[]} */
const POCKET_FEY = Object.freeze([
  { ru: 'мешочек с серебристой пыльцой', en: 'pouch of silver-dust pollen' },
  { ru: 'резная дудочка из ивы', en: 'carved willow flute' },
  { ru: 'серебряное колечко с гравировкой листьев', en: 'silver ring engraved with leaves' },
  { ru: 'связка сушёных ягод бузины', en: 'string of dried elderberries' },
  { ru: 'крошечный фонарик из мха и светлячков', en: 'tiny lantern of moss and fireflies' },
  { ru: 'ожерелье из желудей и зёрен', en: 'acorn-and-seed necklace' },
  { ru: 'пузырёк с росой из волшебного источника', en: 'vial of fey-spring dew' },
  { ru: 'перо феникса (поддельное, но красивое)', en: 'phoenix feather (fake but gorgeous)' },
  { ru: 'ленточка из паутины, не рвётся', en: 'silk-like unbreakable web ribbon' },
  { ru: 'маленький хрустальный шар — горит в полнолуние', en: 'crystal orb that glows at full moon' },
  { ru: 'высушенное крыло бабочки-великана', en: 'dried giant butterfly wing' },
  { ru: 'монетка с изображением луны (не чеканилась у людей)', en: 'moon-face coin (no known mint)' },
  { ru: 'клубок нити, конец которой уходит «в никуда»', en: 'thread ball whose end goes "nowhere"' },
  { ru: 'миниатюрная арфа из кости птицы', en: 'miniature harp of bird bone' },
  { ru: 'мешочек с семенами неизвестного растения', en: 'pouch of seeds from an unknown plant' },
  { ru: 'сушёный цветок, пахнущий сном', en: 'dried flower that smells of sleep' },
  { ru: 'веточка омелы, перевязанная красной нитью', en: 'mistletoe branch tied with red thread' },
  { ru: 'флакончик со слезой наяды', en: 'tiny vial of naiad tear' },
  { ru: 'зубок с гравировкой звезды', en: 'carved tooth with a star glyph' },
  { ru: 'лепестки волшебной розы (светятся слабо)', en: 'petals of a fey rose (faint glow)' },
  { ru: 'кольцо из переплетённых корней', en: 'ring of woven roots' },
  { ru: 'маленький рог из кости — зовёт лесных зверей', en: 'small bone horn — calls woodland creatures' },
  { ru: 'горсть серебристых монет-листьев', en: 'handful of silver leaf-coins' },
  { ru: 'записка с фейскими письменами (незнакомый язык)', en: 'note in fey script (unknown tongue)' },
  { ru: 'куколка из веток и ягод', en: 'doll of twigs and berries' },
  { ru: 'нить из лунного света (вроде бы)', en: 'thread of moonlight (seemingly)' },
  { ru: 'маленькое яйцо колибри в мохнатом гнезде', en: 'hummingbird egg in a fuzzy nest' },
  { ru: 'крошечный сундучок — внутри пусто, но пахнет малиной', en: 'tiny chest — empty but smells of raspberries' },
  { ru: 'высушенный гриб-светляк', en: 'dried bioluminescent mushroom' },
  { ru: 'заколка с янтарём и пойманным светлячком', en: 'amber pin with a trapped firefly' },
]);

/** @type {readonly { ru: string, en: string }[]} */
const POCKET_SOLDIER = Object.freeze([
  { ru: 'полевая фляга (полупустая)', en: 'field canteen (half-empty)' },
  { ru: 'точильный камень', en: 'whetstone' },
  { ru: 'сухой паёк в тряпице', en: 'dry ration in cloth' },
  { ru: 'отличительный жетон солдата', en: 'soldier identification tag' },
  { ru: 'обрывок карты с маршрутом', en: 'map fragment with route' },
  { ru: 'набор для чистки оружия', en: 'weapon cleaning kit' },
  { ru: 'кубики для игры', en: 'dice set' },
  { ru: 'письмо домой (незаконченное)', en: 'letter home (unfinished)' },
  { ru: 'монетка на удачу', en: 'lucky coin' },
  { ru: 'маленькая икона или образок', en: 'small icon or holy token' },
  { ru: 'льняной бинт', en: 'linen bandage' },
  { ru: 'масло для смазки', en: 'lubricating oil' },
  { ru: 'армейские краги', en: 'army gauntlet lining' },
  { ru: 'кусок мела — пометки позиций', en: 'chalk — position markers' },
  { ru: 'гвозди и верёвка', en: 'nails and rope piece' },
  { ru: 'свиток с уставом', en: 'scroll of orders' },
  { ru: 'сухое яблоко', en: 'dried apple' },
  { ru: 'кисет с табаком', en: 'tobacco pouch' },
  { ru: 'медная застёжка плаща', en: 'brass cloak pin' },
  { ru: 'горсть гороха (сухой)', en: 'handful of dried peas' },
  { ru: 'нашивка звания (оторвана)', en: 'rank patch (torn off)' },
  { ru: 'маленький молоток и пара клиньев', en: 'small hammer and wedges' },
  { ru: 'мазь от мозолей', en: 'blister salve' },
  { ru: 'деревянная ложка', en: 'wooden spoon' },
  { ru: 'запасная тетива', en: 'spare bowstring' },
  { ru: 'компас (сломан)', en: 'compass (broken)' },
  { ru: 'список имён отряда', en: 'squad name list' },
  { ru: 'огарок свечи и коробочка', en: 'candle stub and box' },
  { ru: 'небольшой кинжал для еды', en: 'small eating dagger' },
  { ru: 'горсть сухарей', en: 'hardtack crumbles' },
]);

/**
 * @param {string} typeLine
 * @param {number} cr
 * @param {() => number} rng
 * @returns {{ label: string, coins: number, coinLabel: string }}
 */
export function generatePocketLoot(typeLine, cr, rng = Math.random) {
  const tl = String(typeLine ?? '').toLowerCase();
  const crN = Math.max(0.125, Number.isFinite(Number(cr)) ? Number(cr) : 0.125);

  /** @type {readonly { ru: string, en: string }[]} */
  let pool;
  if (/\bundead\b/.test(tl)) {
    pool = POCKET_UNDEAD;
  } else if (/\bcultist\b|\bfiend\b|\bcult/.test(tl)) {
    pool = POCKET_CULTIST;
  } else if (/\bbeast\b|\bmonstrosity\b|\bplant\b/.test(tl)) {
    pool = POCKET_BEAST;
  } else if (/\bfey\b|\bdryad\b|\bsprite\b|\bpixie\b|\bnymph\b|\bsatyr\b|\beladrin\b/.test(tl)) {
    pool = POCKET_FEY;
  } else if (/\bguard\b|\bsoldier\b|\bveteran\b|\bknight\b|\bwarrior\b/.test(tl)) {
    pool = POCKET_SOLDIER;
  } else {
    pool = POCKET_HUMANOID;
  }

  const count = crN >= 5 ? 3 : crN >= 2 ? 2 : 1;
  /** @type {Set<number>} */
  const seen = new Set();
  /** @type {string[]} */
  const items = [];
  while (items.length < count && items.length < pool.length) {
    const i = Math.floor(rng() * pool.length);
    if (seen.has(i)) continue;
    seen.add(i);
    const e = pool[i];
    items.push(formatLocalizedWithOriginalSuffix(e.ru, e.en));
  }
  const label = items.join('; ');

  let coins = 0;
  let coinLabel = '';
  if (/\bundead\b|\bbeast\b|\bplant\b|\bfey\b|\bdryad\b|\bsprite\b|\bpixie\b|\bnymph\b/.test(tl)) {
    coinLabel = '';
  } else if (crN < 1) {
    coins = Math.max(1, Math.floor(rng() * 6 + 1));
    coinLabel = `${coins} мм (${coins} cp)`;
  } else if (crN < 3) {
    coins = Math.max(1, Math.floor(rng() * 10 + 1));
    coinLabel = `${coins} см (${coins} sp)`;
  } else {
    coins = Math.max(1, Math.floor((rng() * 10 + 1) * crN));
    coinLabel = `${coins} зм (${coins} gp)`;
  }

  return { label, coins, coinLabel };
}

// ─── Spell Quick-Ref ──────────────────────────────────────────────────────────

/**
 * Краткие подсказки по заклинаниям для мастера — RU (EN).
 * @type {Readonly<Record<string, string>>}
 */
export const SPELL_QUICK_REF_RU = Object.freeze({
  // Контроль
  'Hold Person': 'Парализует 1 гуманоида (спасбросок МДР)',
  'Hold Monster': 'Парализует 1 существо (спасбросок МДР)',
  'Web': 'Зона 20 фт — сложная местность, пойманные существа Обездвижены (Ловк.)',
  'Entangle': 'Зона растений 20 фт — Обездвижены существа без спасброска Силы',
  'Hypnotic Pattern': 'Заворожённые существа в зоне 30 фт (МДР, реакция — прервёт)',
  'Slow': 'До 6 целей: −2 КБ, бросок атаки, скорость/2, одно действие или бонусное',
  'Fear': 'Конус 30 фт — Испуганные, бросают бежать (МДР)',
  'Confusion': 'Сфера 10 фт — случайные действия (МДР)',
  'Dominate Person': 'Полный контроль над гуманоидом (МДР, концентрация)',
  'Dominate Monster': 'Полный контроль над любым существом (МДР, концентрация)',
  'Dominate Beast': 'Контроль над зверем (МДР, концентрация)',
  'Polymorph': 'Превращает цель в зверя (МДР, концентрация)',
  'Banishment': 'Отправляет на другой план (ХАР, концентрация)',
  'Forcecage': 'Ловушка из силового поля без спасброска',
  'Maze': 'Лабиринт — цель пропадает и не может действовать',
  'Irresistible Dance': 'Цель обязана танцевать (МДР, без конц.)',
  // Урон
  'Fireball': 'Шар огня 20 фт — 8d6 огонь (Ловк.)',
  'Lightning Bolt': 'Молния 100 фт — 8d6 электричество (Ловк.)',
  'Ice Storm': 'Цилиндр 20/40 фт — 2d8+4d6, сложная местность',
  'Cone of Cold': 'Конус 60 фт — 8d8 холод (Телос.)',
  'Cloudkill': 'Облако 20 фт — 5d8 яд/ход, двигается (Телос.)',
  'Disintegrate': '10d6+40 урона (Ловк.); при 0 HP — уничтожен',
  'Power Word Kill': 'Убивает цель с HP ≤ 100 без броска',
  'Power Word Stun': 'Оглушает цель с HP ≤ 150 (Телос. — конец)',
  'Finger of Death': '7d8+30 некр. урона; убитый гуманоид — зомби',
  'Chain Lightning': '10d8 основной + 5d8 на 3 вторичные цели',
  'Meteor Swarm': '4 кометы, 40d6 дробящий/огонь, радиус 40 фт',
  'Fire Storm': '7d10 огонь в 10 кубах 10 фт (Ловк.)',
  'Sunbeam': 'Луч слепит + 6d8 сияние (Телос.)',
  'Sunburst': 'Сфера 60 фт — 12d6 сияние, слепит (Телос.)',
  'Witchbolt': 'Постоянный урон 1d12/ход (Ловк., конц.)',
  'Call Lightning': '3d10 молния 60 фт, каждый ход (Ловк.)',
  'Earthquake': 'Зона 100 фт — сложная местность, трещины, концентрация',
  'Blight': '8d8 некр. одной цели (Телос.)',
  'Inflict Wounds': 'Касание — до 5d10 некр. урона',
  'Guiding Bolt': 'Дальнобойная атака 4d6 сияние + следующий по цели с преимуществом',
  'Spiritual Weapon': 'Оружие-призрак бонусным действием, 1d8+мод',
  'Spirit Guardians': 'Дух-хранитель 15 фт — 3d8 сияние/некр/ход (МДР)',
  'Sacred Flame': 'Кантрип 1d8 сияние (Ловк.)',
  // Защита
  'Shield': '+5 КБ до начала след. хода, реакция',
  'Counterspell': 'Отмена заклинания ≤3 ур. (реакция, иначе — провер.)',
  'Dispel Magic': 'Снимает заклинание/эффект 3 ур.',
  'Globe of Invulnerability': 'Пузырь: заклинания ≤5 ур. не проникают',
  'Wall of Force': 'Стена непробиваемой силы, концентрация',
  'Prismatic Wall': 'Стена с 7 слоями — каждый другой эффект',
  'Mirror Image': '3 иллюзорные копии — дают промахи',
  'Blur': 'Атаки против тебя с помехой (концентрация)',
  'Stoneskin': 'Устойчивость к дробящему/коля./режущему (концентрация)',
  'Death Ward': 'При 0 HP остаёшься с 1 HP, 1 раз',
  // Мобильность
  'Misty Step': 'Телепорт 30 фт бонусным действием',
  'Blink': 'Шанс 50% каждый ход — Эфирный план',
  'Fly': 'Полёт 60 фт (концентрация)',
  'Dimension Door': 'Телепорт 500 фт',
  'Teleport': 'Мгновенное перемещение на любое расстояние',
  'Thunder Step': 'Телепорт 90 фт + 3d10 грома вокруг',
  'Wind Walk': 'Газообразное существо, скорость 300 фт',
  // Утилита
  'Darkness': 'Непроглядная тьма 15 фт (концентрация)',
  'Silence': 'Зона тишины 20 фт (концентрация) — нет вербальных заклинаний',
  'Invisibility': 'Невидимость (концентрация, действие прервёт)',
  'Greater Invisibility': 'Невидимость без прерывания атакой (концентрация)',
  'True Seeing': 'Видит невидимое, иллюзии, истинный облик',
  'Scrying': 'Наблюдает за целью на другом плане (МДР)',
  'Plane Shift': 'Перемещает до 8 существ на другой план (ХАР)',
  'Gate': 'Открывает портал на другой план',
  'Time Stop': '1d4+1 дополнительных ходов подряд',
  'Wish': 'Всё что угодно (с последствиями)',
  'Animate Dead': 'Поднимает до 3 нежити под контроль',
  'Create Undead': 'Поднимает гула, мертвяка или тени',
  'Feeblemind': '4d6 пси-урон, ИНТ и ХАР → 1 (ИНТ)',
  'Power Word Blind': 'Ослепляет цель с HP ≤ 50',
  'Power Word Pain': 'Боль при любом действии (Телос.)',
  'Eyebite': 'Одно из трёх: Спит/Паника/Тошнота (МДР, конц.)',
  // Призыв
  'Summon Greater Demon': 'Призывает демона — без гарантий подчинения',
  'Summon Undead': 'Призывает нежить соответствующего типа',
  'Conjure Animals': 'Призывает зверей (уровень→число)',
  'Conjure Elemental': 'Призывает элементаля до CR 5',
  'Conjure Fey': 'Призывает существо Феи до CR 6',
});

/**
 * @param {string} md raw_statblock_md монстра
 * @returns {string[]} список EN-имён заклинаний
 */
export function extractSpellNamesFromStatblock(md) {
  if (!md) return [];
  const raw = String(md);
  const section = raw.match(/Spellcasting([\s\S]{0,2000}?)(?:\n##|\n---|\nActions|\nReactions|$)/i);
  if (!section) return [];
  const block = section[1];
  /** Match patterns like: "- _cantrips (at will):_ **Fire Bolt**, **Prestidigitation**" */
  const found = new Set();
  const boldRe = /\*\*([A-Z][A-Za-z\s'/-]{3,40})\*\*/g;
  let m;
  while ((m = boldRe.exec(block)) !== null) {
    const name = m[1].trim();
    if (SPELL_QUICK_REF_RU[name]) found.add(name);
  }
  /** fallback: italics */
  const italRe = /_([A-Z][A-Za-z\s'/-]{3,40})_/g;
  while ((m = italRe.exec(block)) !== null) {
    const name = m[1].trim();
    if (SPELL_QUICK_REF_RU[name]) found.add(name);
  }
  /** plain names (list items) */
  const listRe = /^\s*[-–]\s*([A-Z][a-z][A-Za-z\s'/-]{2,35})\b/gm;
  while ((m = listRe.exec(block)) !== null) {
    const name = m[1].trim();
    if (SPELL_QUICK_REF_RU[name]) found.add(name);
  }
  return [...found].slice(0, 8);
}

/**
 * Возвращает массив строк «Заклинание (Spell) — подсказка» для 3-4 самых важных заклинаний.
 * @param {string[]} spellNames
 * @returns {string[]}
 */
export function buildSpellQuickRefLines(spellNames) {
  const PRIORITY = [
    'Power Word Kill', 'Power Word Stun', 'Forcecage', 'Banishment', 'Maze',
    'Disintegrate', 'Finger of Death', 'Dominate Monster', 'Dominate Person',
    'Hold Monster', 'Hold Person', 'Fear', 'Hypnotic Pattern', 'Slow', 'Confusion',
    'Meteor Swarm', 'Fireball', 'Cone of Cold', 'Cloudkill', 'Fire Storm',
    'Ice Storm', 'Chain Lightning', 'Globe of Invulnerability', 'Counterspell',
    'Misty Step', 'Blink', 'Shield', 'Greater Invisibility', 'Time Stop',
  ];
  const sorted = [
    ...PRIORITY.filter((s) => spellNames.includes(s)),
    ...spellNames.filter((s) => !PRIORITY.includes(s)),
  ].slice(0, 4);

  return sorted.map((en) => {
    const ru = SPELL_QUICK_REF_RU[en] ?? '';
    return `${formatLocalizedWithOriginalSuffix(ru, en)}`;
  });
}

// ─── Combat Essentials ────────────────────────────────────────────────────────

/**
 * @type {Readonly<Record<string, string>>}
 * EN-название свойства → краткий RU-текст для мастера
 */
const COMBAT_TRAIT_QUICK_RU = Object.freeze({
  'Multiattack': 'Мультиатака',
  'Pack Tactics': 'Стайная тактика — преимущество если союзник рядом',
  'Pounce': 'Прыжок — при попадании цель должна спасаться или упасть',
  'Charge': 'Разгон — бонусный урон после рывка',
  'Reckless': 'Безрассудная атака — преимущество атаки, но и по нему тоже',
  'Magic Resistance': 'Устойчивость к магии — преимущество на спасброски от заклинаний',
  'Magic Weapons': 'Атаки оружием считаются магическими',
  'Legendary Resistance': 'Легендарная устойчивость — замена провала спасброска',
  'Regeneration': 'Регенерация — восстанавливает HP каждый ход (тип урона прерывает)',
  'Undead Fortitude': 'Стойкость нежити — при 0 HP делает спасбросок на выживание',
  'Sunlight Sensitivity': 'Уязвимость к солнечному свету — помеха на атаки и Восприятие',
  'Sunlight Hypersensitivity': 'Гиперчувствительность к солнцу — 20 сияния/ход на солнце',
  'Spider Climb': 'Паучье лазание — движение по вертикали и потолку',
  'Amorphous': 'Аморфность — проходит сквозь щели 1 дюйм',
  'False Appearance': 'Ложная внешность — маскировка под неживой объект',
  'Mimicry': 'Мимикрия — имитирует звуки и голоса',
  'Spellcasting': 'Заклинательство',
  'Innate Spellcasting': 'Врождённое заклинательство',
  'Aura of Fear': 'Аура страха — существа вокруг испытывают Испуг',
  'Aura of Hate': 'Аура ненависти — бонус к урону для союзников',
  'Aura of Murder': 'Аура убийства',
  'Death Burst': 'Взрыв смерти — урон в радиусе при гибели',
  'Ethereal Sight': 'Эфирное зрение — видит на Эфирном плане',
  'Incorporeal Movement': 'Бесплотное движение — сквозь существ и объекты',
  'Shadow Stealth': 'Теневая скрытность — бонусное действие скрыться в тусклом свете',
  'Shadow Step': 'Теневой шаг — телепортация от тени к тени',
  'Frightful Presence': 'Пугающее присутствие — существа в 120 фт делают спасбросок МДР',
  'Legendary Actions': 'Легендарные действия — дополнительные действия после хода других',
  'Lair Actions': 'Действия логова — инициатива 20, особые эффекты',
  'Parry': 'Парирование — реакция +CR к КБ против одной атаки',
  'Brute': 'Брутальность — двойная кость на рукопашный урон раз за ход',
  'Aggressive': 'Агрессивность — бонусное действие движения к врагу',
  'Rampage': 'Буйство — откусывает бонусным действием после убийства',
  'Blood Frenzy': 'Кровная ярость — преимущество на атаки против поврежд. существ',
  'Keen Smell': 'Острое чутьё — преимущество на Восприятие (запах)',
  'Keen Sight': 'Острое зрение — преимущество на Восприятие (зрение)',
  'Keen Hearing': 'Острый слух — преимущество на Восприятие (слух)',
  'Darkvision': 'Тёмное зрение',
  'Blindsight': 'Слепое чутьё',
  'Tremorsense': 'Сейсмочутьё',
  'Truesight': 'Истинное зрение',
  'Swarm': 'Рой — занимает гекс существа, делится уроном',
  'Siege Monster': 'Осадный монстр — двойной урон по объектам/строениям',
  'Flyby': 'Пролёт — не вызывает провокационных атак при полёте',
  'Evasion': 'Уклонение — при успехе Ловк. урон = 0, при неудаче = ½',
  'Brave': 'Храбрость — преимущество на спасброски от Испуга',
  'Undead Nature': 'Природа нежити — не нуждается в дыхании, еде, воде, сне',
  'Construct Nature': 'Природа конструкта — не нуждается в еде, воде, воздухе, сне',
});

/**
 * Извлекает до 4 ключевых черт и действий монстра из raw_statblock_md.
 * @param {string} md
 * @returns {string[]}
 */
export function extractCombatEssentials(md) {
  if (!md) return [];
  const raw = String(md);

  /** @type {string[]} */
  const found = [];

  // Multiattack — SRD 5.2 format: **_Multiattack._** or **Multiattack.**
  const hasMulti = /\*\*_?Multiattack\.?_?\*\*|#{2,4}\s+Multiattack\b/i.test(raw);
  if (hasMulti) {
    const numM = raw.match(/Multiattack[^.]{0,200}?(\d)\s*(?:times|\s*attacks?)/i);
    const num = numM ? numM[1] : '2';
    found.push(formatLocalizedWithOriginalSuffix(`Мультиатака: ~${num} атаки за ход`, `Multiattack: ~${num} attacks/turn`));
  }

  // Остальные приоритетные черты
  const PRIORITY_TRAITS = [
    'Magic Resistance', 'Legendary Resistance', 'Frightful Presence', 'Regeneration',
    'Undead Fortitude', 'Pack Tactics', 'Pounce', 'Charge', 'Reckless',
    'Spider Climb', 'Incorporeal Movement', 'Shadow Stealth', 'Death Burst',
    'Spellcasting', 'Innate Spellcasting', 'Flyby', 'Evasion', 'Blood Frenzy',
    'Aggressive', 'Brute', 'Siege Monster', 'Aura of Fear', 'Aura of Hate',
  ];

  for (const trait of PRIORITY_TRAITS) {
    if (found.length >= 4) break;
    const esc = trait.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Matches: **_Trait._**, **_Trait (X/Day)._**, **Trait**, ### Trait
    if (new RegExp(`(?:\\*\\*_?${esc}[^*]{0,40}_?\\.?\\*\\*|#{2,4}\\s+${esc}\\b)`, 'i').test(raw)) {
      const ru = COMBAT_TRAIT_QUICK_RU[trait] ?? trait;
      found.push(formatLocalizedWithOriginalSuffix(ru, trait));
    }
  }

  return found.slice(0, 4);
}

// ─── Hoard Loot Floor ─────────────────────────────────────────────────────────

/**
 * Жёсткий пол монет для Treasure Hoard Tier 2 (уровни 5–10).
 * @param {number|null} coinsGp текущая оценка
 * @param {number} partyLevel
 * @param {() => number} rng
 * @returns {number}
 */
/**
 * Применяет минимальный порог золота для сундука.
 * Tier 1 (1–4 ур): (party_level × 10) + 2d20 зм.
 * Tier 2+ (5+ ур): (party_level × 50) + 1d100 × 5 зм.
 * Заменяет значения ≤0 текстовой меткой «Горсть медных монет».
 *
 * @param {number|null|undefined} coinsGp
 * @param {number} partyLevel
 * @param {() => number} rng
 * @returns {{ gp: number, label: string }}
 */
export function applyHoardGoldFloor(coinsGp, partyLevel, rng = Math.random) {
  const lv = Math.min(20, Math.max(1, Math.floor(Number(partyLevel) || 1)));
  const cur = coinsGp != null && Number.isFinite(Number(coinsGp)) && Number(coinsGp) > 0
    ? Number(coinsGp)
    : 0;

  let floor;
  if (lv <= 4) {
    // Tier 1: (lv * 10) + 2d20
    floor = lv * 10 + Math.floor(rng() * 20 + 1) + Math.floor(rng() * 20 + 1);
  } else {
    // Tier 2+: (lv * 50) + 1d100 * 5
    floor = lv * 50 + Math.floor(rng() * 100 + 1) * 5;
  }

  const gp = Math.max(cur, floor);

  let label;
  if (gp <= 0) {
    label = 'Горсть медных монет (a handful of copper coins)';
  } else if (gp < 5) {
    label = `Мешочек с серебром (~${gp} зм / ~${gp} gp)`;
  } else {
    label = `~${gp} зм (~${gp} gp)`;
  }

  return { gp, label };
}

/**
 * Гарантированный минимум лута для Hoard при CR 5+ и 0 магических предметов.
 * Возвращает массив строк (уже локализованных RU/EN) для вывода в отчёт.
 * @param {number} cr
 * @param {() => number} rng
 * @returns {string[]}
 */
export function guaranteeHoardFallbackItems(cr, rng = Math.random) {
  if (cr < 5) return [];

  /** @type {{ ru: string, en: string }[]} */
  const POTIONS = [
    { ru: 'Зелье лечения', en: 'Potion of Healing' },
    { ru: 'Зелье повышенного лечения', en: 'Potion of Greater Healing' },
    { ru: 'Зелье устойчивости (Сопротивление)', en: 'Potion of Resistance' },
    { ru: 'Зелье скорости', en: 'Potion of Speed' },
    { ru: 'Зелье силы великана (Огр)', en: 'Potion of Giant Strength (Hill)' },
    { ru: 'Зелье невидимости', en: 'Potion of Invisibility' },
    { ru: 'Зелье огненного дыхания', en: 'Potion of Fire Breath' },
    { ru: 'Зелье водного дыхания', en: 'Potion of Water Breathing' },
    { ru: 'Зелье чтения мыслей', en: 'Potion of Mind Reading' },
    { ru: 'Зелье удачи', en: 'Potion of Luck' },
  ];

  /** @type {{ ru: string, en: string }[]} */
  const SCROLLS = [
    { ru: 'Свиток заклинания «Щит»', en: 'Spell Scroll: Shield' },
    { ru: 'Свиток заклинания «Огненный шар»', en: 'Spell Scroll: Fireball' },
    { ru: 'Свиток заклинания «Невидимость»', en: 'Spell Scroll: Invisibility' },
    { ru: 'Свиток заклинания «Полёт»', en: 'Spell Scroll: Fly' },
    { ru: 'Свиток заклинания «Телепортация»', en: 'Spell Scroll: Misty Step' },
    { ru: 'Свиток заклинания «Массовое лечение ран»', en: 'Spell Scroll: Mass Cure Wounds' },
    { ru: 'Свиток заклинания «Рассеивание магии»', en: 'Spell Scroll: Dispel Magic' },
    { ru: 'Свиток заклинания «Молния»', en: 'Spell Scroll: Lightning Bolt' },
    { ru: 'Свиток заклинания «Стена льда»', en: 'Spell Scroll: Wall of Ice' },
    { ru: 'Свиток заклинания «Истинное воскрешение»', en: 'Spell Scroll: True Resurrection' },
  ];

  /** @type {{ ru: string, en: string }[]} */
  const MUNDANE_USEFUL = [
    { ru: 'Набор альпиниста (крюк, верёвка 50 фт, шипы)', en: "Climber's Kit (hook, 50 ft rope, pitons)" },
    { ru: 'Масляный фонарь с запасным флаконом масла', en: 'Hooded lantern + oil flask' },
    { ru: 'Набор лекаря (5 использований)', en: "Healer's Kit (5 uses)" },
    { ru: 'Дымовая шашка (гранатообразная)', en: 'Smoke bomb' },
    { ru: 'Маг. чернила и пустой свиток (10 страниц)', en: 'Arcane ink + blank scroll (10 pages)' },
    { ru: 'Инструменты вора (воровские отмычки)', en: "Thieves' Tools" },
    { ru: 'Зеркало стали (ручное)', en: 'Steel hand mirror' },
    { ru: 'Антитоксин (1 доза)', en: 'Antitoxin (1 dose)' },
    { ru: 'Набор для снятия мерок (компас, нить)', en: "Surveyor's compass and thread" },
    { ru: 'Портативный таран', en: 'Portable battering ram' },
  ];

  const items = [];

  // 1 зелье
  const pi = Math.floor(rng() * POTIONS.length);
  items.push(`🧪 **[Гарантия]** ${formatLocalizedWithOriginalSuffix(POTIONS[pi].ru, POTIONS[pi].en)}`);

  // 1 свиток
  const si = Math.floor(rng() * SCROLLS.length);
  items.push(`📜 **[Гарантия]** ${formatLocalizedWithOriginalSuffix(SCROLLS[si].ru, SCROLLS[si].en)}`);

  // 2 утилиты
  /** @type {Set<number>} */
  const seen = new Set();
  while (seen.size < 2) {
    seen.add(Math.floor(rng() * MUNDANE_USEFUL.length));
  }
  for (const mi of seen) {
    items.push(`🔧 **[Гарантия]** ${formatLocalizedWithOriginalSuffix(MUNDANE_USEFUL[mi].ru, MUNDANE_USEFUL[mi].en)}`);
  }

  return items;
}

/** Локализация отчётов: редкости, имена монстров; предметы — JOIN + `translateItemNameForReport` в generate-loot. */
export {
  translate,
  translateMonsterNameForReport,
  translateItemRarityForReport,
  translateItemNameForReport,
  translateItemDescriptionForReport,
  displayNamesAreSameForOriginalSuffix,
  formatMonsterDisplayNameRuEn,
  formatMonsterHeadingRuEnCr,
} from './db-localization.mjs';

export { formatLocalizedWithOriginalSuffix } from './db-localization.mjs';
