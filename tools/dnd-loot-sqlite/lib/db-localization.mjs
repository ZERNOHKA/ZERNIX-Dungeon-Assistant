/**
 * Слой локализации SRD-текстов для Markdown/UI. Ключи в БД — английские (как в данных);
 * SQL WHERE и логика подбора монстров остаются на английском.
 */

import {
  translateMagicItemName,
  translateItemDescriptionMd,
  fallbackTransliterateEnglishTitle,
} from './itemTranslationHeuristics.mjs';

/** @typedef {import('better-sqlite3').Database} BetterSqliteDatabase */

/**
 * Строки по умолчанию: INSERT OR IGNORE — не затирают пользовательские правки в той же таблице.
 * @type {ReadonlyArray<readonly [string, string, string]>}
 */
const DEFAULT_LOCALIZATION_ROWS = [
  ['ui', 'loot.gold', 'Золото'],
  ['ui', 'loot.items', 'Предметы'],
  ['ui', 'loot.magic', 'Магические вещи'],

  ['rarity', 'Common', 'Обычный'],
  ['rarity', 'Uncommon', 'Необычный'],
  ['rarity', 'Rare', 'Редкий'],
  ['rarity', 'Very Rare', 'Очень редкий'],
  ['rarity', 'Legendary', 'Легендарный'],
  ['rarity', 'Artifact', 'Артефакт'],
  ['rarity', 'None', 'Без редкости'],
  ['rarity', 'Varies', 'Различается'],

  ['encounter_tag', 'humanoid', 'гуманоид'],
  ['encounter_tag', 'undead', 'нежить'],
  ['encounter_tag', 'beast', 'зверь'],
  ['encounter_tag', 'dragon', 'дракон'],
  ['encounter_tag', 'elemental', 'элементаль'],
  ['encounter_tag', 'fey', 'фея'],
  ['encounter_tag', 'fiend', 'исчадие'],
  ['encounter_tag', 'celestial', 'небожитель'],
  ['encounter_tag', 'aberration', 'аберрация'],
  ['encounter_tag', 'construct', 'конструкт'],
  ['encounter_tag', 'giant', 'великан'],
  ['encounter_tag', 'monstrosity', 'чудовище'],
  ['encounter_tag', 'ooze', 'слизь'],
  ['encounter_tag', 'plant', 'растение'],

  ['type_token', 'Tiny', 'Крошечный'],
  ['type_token', 'Small', 'Маленький'],
  ['type_token', 'Medium', 'Средний'],
  ['type_token', 'Large', 'Большой'],
  ['type_token', 'Huge', 'Огромный'],
  ['type_token', 'Gargantuan', 'Исполинский'],
  ['type_token', 'humanoid', 'гуманоид'],
  ['type_token', 'undead', 'нежить'],
  ['type_token', 'beast', 'зверь'],
  ['type_token', 'dragon', 'дракон'],
  ['type_token', 'elemental', 'элементаль'],
  ['type_token', 'fey', 'фея'],
  ['type_token', 'fiend', 'исчадие'],
  ['type_token', 'celestial', 'небожитель'],
  ['type_token', 'aberration', 'аберрация'],
  ['type_token', 'construct', 'конструкт'],
  ['type_token', 'giant', 'великан'],
  ['type_token', 'monstrosity', 'чудовище'],
  ['type_token', 'ooze', 'слизь'],
  ['type_token', 'plant', 'растение'],
  ['type_token', 'swarm', 'рой'],

  ['type_phrase', 'Swarm of Tiny Undead', 'рой крошечной нежити'],

  ['type_phrase', 'any alignment', 'любое мировоззрение'],
  ['type_phrase', 'unaligned', 'без мировоззрения'],
  ['type_phrase', 'typically ', 'обычно '],
  ['type_phrase', 'often ', 'часто '],
  ['type_phrase', 'lawful good', 'законно-добрый'],
  ['type_phrase', 'neutral good', 'нейтрально-добрый'],
  ['type_phrase', 'chaotic good', 'хаотично-добрый'],
  ['type_phrase', 'lawful neutral', 'законно-нейтральный'],
  ['type_phrase', 'true neutral', 'истинно нейтральный'],
  ['type_phrase', 'chaotic neutral', 'хаотично-нейтральный'],
  ['type_phrase', 'lawful evil', 'законно-злой'],
  ['type_phrase', 'neutral evil', 'нейтрально-злой'],
  ['type_phrase', 'chaotic evil', 'хаотично-злой'],
  ['type_phrase', 'neutral', 'нейтральный'],
  ['type_phrase', 'Medium or Small', 'Средний или Маленький'],
  ['type_phrase', 'Large or Small', 'Большой или Маленький'],
  ['type_phrase', ' or ', ' или '],
  ['type_phrase', 'Dex modifier', 'модификатор Лов'],
  ['type_phrase', 'Stealth Disadvantage', 'помеха на Скрытность'],
  ['type_phrase', 'Disadvantage', 'помеха'],
  ['type_phrase', 'Advantage', 'преимущество'],
  ['type_phrase', 'Initiative', 'Инициатива'],
  ['type_phrase', 'AC ', 'КБ '],
  ['type_phrase', ' ft.', ' фт.'],
  ['type_phrase', 'ft.', 'фт.'],
  ['type_phrase', 'Don and', 'надеть и'],
  ['type_phrase', ' to Doff', ' снять'],
  ['type_phrase', ' to Don', ' надеть'],
  ['type_phrase', 'Minutes to Don', 'мин. надеть'],
  ['type_phrase', 'Minute to Doff', 'мин. снять'],

  ['ability_abbr', 'STR', 'СИЛ'],
  ['ability_abbr', 'DEX', 'ЛОВ'],
  ['ability_abbr', 'CON', 'ТЕЛ'],
  ['ability_abbr', 'INT', 'ИНТ'],
  ['ability_abbr', 'WIS', 'МДР'],
  ['ability_abbr', 'CHA', 'ХАР'],

  ['item_category', 'Weapon', 'Оружие'],
  ['item_category', 'Armor', 'Доспехи'],
  ['item_category', 'Ammunition', 'Боеприпасы'],
  ['item_category', 'Adventuring Gear', 'Снаряжение авантюриста'],
  ['item_category', 'Tools', 'Инструменты'],
  ['item_category', 'Currency', 'Монеты'],
  ['item_category', 'Potion', 'Зелье'],
  ['item_category', 'Scroll', 'Свиток'],
  ['item_category', 'Wondrous Item', 'Чудесный предмет'],
  ['item_category', 'Magic: Weapon', 'Магия: оружие'],
  ['item_category', 'Magic: Armor', 'Магия: доспехи'],
  ['item_category', 'Magic: Potion', 'Магия: зелье'],
  ['item_category', 'Magic: Scroll', 'Магия: свиток'],
  ['item_category', 'Magic: Wand', 'Магия: жезл'],
  ['item_category', 'Magic: Staff', 'Магия: посох'],
  ['item_category', 'Magic: Wondrous Item', 'Магия: чудесный предмет'],
  ['item_category', 'Magic: Ring', 'Магия: кольцо'],
  ['item_category', 'Magic: Rod', 'Магия: скипетр'],
  ['item_category', 'Crafting', 'Ремесло'],
  [
    'item_category',
    'Medium Armor (5 Minutes to Don and 1 Minute to Doff)',
    'Средние доспехи (5 мин. надеть, 1 мин. снять)',
  ],
];

/**
 * @param {BetterSqliteDatabase} database
 */
export function ensureLocalizationTable(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS localization (
      category TEXT NOT NULL,
      source_key TEXT NOT NULL,
      ru TEXT NOT NULL,
      PRIMARY KEY (category, source_key)
    );
    CREATE INDEX IF NOT EXISTS idx_localization_category ON localization (category);
  `);
}

/**
 * Добавляет недостающие строки из пресета (INSERT OR IGNORE).
 *
 * @param {BetterSqliteDatabase} database
 */
export function seedLocalizationDefaults(database) {
  ensureLocalizationTable(database);
  const ins = database.prepare(
    `INSERT OR IGNORE INTO localization (category, source_key, ru) VALUES (@category, @source_key, @ru)`,
  );
  const tx = database.transaction(() => {
    for (const [category, source_key, ru] of DEFAULT_LOCALIZATION_ROWS) {
      ins.run({ category, source_key, ru });
    }
  });
  tx();
}

/**
 * Ищет перевод в `localization`. При отсутствии — исходная строка.
 *
 * @param {BetterSqliteDatabase|null|undefined} database
 * @param {string|null|undefined} text
 * @param {string} [category]
 * @returns {string}
 */
export function translate(database, text, category = 'misc') {
  if (database == null) {
    return text == null ? '' : String(text);
  }
  if (text == null) {
    return '';
  }
  const s = String(text);
  if (s.length === 0) {
    return s;
  }
  ensureLocalizationTable(database);
  const exact = database
    .prepare(`SELECT ru FROM localization WHERE category = ? AND source_key = ? LIMIT 1`)
    .get(category, s);
  if (exact && typeof /** @type {{ ru?: unknown }} */ (exact).ru === 'string') {
    return /** @type {{ ru: string }} */ (exact).ru;
  }
  const ci = database
    .prepare(
      `SELECT ru FROM localization WHERE category = ? AND lower(source_key) = lower(?) LIMIT 1`,
    )
    .get(category, s);
  if (ci && typeof /** @type {{ ru?: unknown }} */ (ci).ru === 'string') {
    return /** @type {{ ru: string }} */ (ci).ru;
  }
  return s;
}

/**
 * Перевод названия монстра для отчёта: `localization` → встроенные составные имена →
 * `MONSTER_NAME_EXTRA_RU` → транслитерация по токенам (если БД открыта).
 *
 * BATCH_MONSTER_NAMES: позже массово заполнить таблицу, например скриптом:
 *   INSERT OR IGNORE INTO localization (category, source_key, ru)
 *   SELECT 'monster_name', m.name, m.name FROM monsters m
 *   LEFT JOIN localization l ON l.category='monster_name' AND l.source_key=m.name
 *   WHERE l.source_key IS NULL;
 * затем заменить `ru` на переводы (или подставить из внешнего CSV).
 *
 * @param {BetterSqliteDatabase|null|undefined} database
 * @param {string|null|undefined} enName
 * @returns {string}
 */
/** Составные имена SRD до записей в `localization` (точное совпадение в БД имеет приоритет). */
const COMPOUND_MONSTER_NAME_RU = Object.freeze({
  'Priest Acolyte': 'Аколит-жрец',
  'Bandit Captain': 'Капитан бандитов',
  'Guard Captain': 'Капитан стражи',
});

/** Имена без отдельной строки в `localization` (импорт не обновлял БД). */
const MONSTER_NAME_EXTRA_RU = Object.freeze({
  Pirate: 'Пират',
  'Vampire Familiar': 'Фамильяр вампира',
  'Warrior Infantry': 'Пехотный воин',
  'Warrior Cavalry': 'Кавалерист-воин',
  'Warrior Artillery': 'Артиллерист-воин',
  'Warrior Commander': 'Командир воинов',
  'Warrior Champion': 'Воин-защитник',
  'Mage Apprentice': 'Ученик мага',
  'Mage Destroyer': 'Маг-разрушитель',
  'Mage Hand': 'Рука мага',
});

export function translateMonsterNameForReport(database, enName) {
  const raw = enName == null ? '' : String(enName).trim();
  if (!raw) {
    return '';
  }
  if (COMPOUND_MONSTER_NAME_RU[raw]) {
    return /** @type {string} */ (COMPOUND_MONSTER_NAME_RU[raw]);
  }
  if (MONSTER_NAME_EXTRA_RU[raw]) {
    return /** @type {string} */ (MONSTER_NAME_EXTRA_RU[raw]);
  }
  const fromDb = translate(database, enName, 'monster_name');
  if (fromDb !== raw) {
    return fromDb;
  }
  if (database == null) {
    return raw;
  }
  return fallbackTransliterateEnglishTitle(raw);
}

/**
 * Одинаковые подписи (без дубля «Имя (Имя)»): точное совпадение или без учёта регистра латиницы.
 *
 * @param {string|null|undefined} ru
 * @param {string|null|undefined} en
 */
export function displayNamesAreSameForOriginalSuffix(ru, en) {
  const a = String(ru ?? '').trim();
  const b = String(en ?? '').trim();
  if (!a || !b) {
    return true;
  }
  if (a === b) {
    return true;
  }
  if (a.toLowerCase() === b.toLowerCase()) {
    return true;
  }
  return false;
}

/**
 * Русская подпись + оригинал SRD в скобках для отчётов.
 *
 * @param {string|null|undefined} ru
 * @param {string|null|undefined} en
 */
export function formatLocalizedWithOriginalSuffix(ru, en) {
  const r = String(ru ?? '').trim();
  const e = String(en ?? '').trim();
  if (!e) {
    return r || '';
  }
  if (!r || displayNamesAreSameForOriginalSuffix(r, e)) {
    return r || e;
  }
  return `${r} (${e})`;
}

/**
 * Имя монстра для statblock: `Ru (En)` или только `En`, если перевода нет / совпадает.
 *
 * @param {BetterSqliteDatabase|null|undefined} database
 * @param {string|null|undefined} englishName
 */
export function formatMonsterDisplayNameRuEn(database, englishName) {
  const en = String(englishName ?? '').trim();
  if (!en) {
    return 'Существо';
  }
  const ru = translateMonsterNameForReport(database, en);
  return formatLocalizedWithOriginalSuffix(ru, en);
}

/**
 * Заголовок монстра в Markdown: `Ru (En) [CR x]` или `En [CR x]` без скобок при отсутствии перевода.
 *
 * @param {BetterSqliteDatabase|null|undefined} database
 * @param {string|null|undefined} englishName
 * @param {string|null|undefined} crDisplay
 */
export function formatMonsterHeadingRuEnCr(database, englishName, crDisplay) {
  const en = String(englishName ?? '').trim();
  const cr = String(crDisplay ?? '').trim();
  const crPart = cr.length > 0 ? ` [CR ${cr}]` : '';
  if (!en) {
    return `Существо${crPart}`;
  }
  const ru = translateMonsterNameForReport(database, en);
  if (!ru || displayNamesAreSameForOriginalSuffix(ru, en)) {
    return `${en}${crPart}`;
  }
  return `${ru} (${en})${crPart}`;
}

/**
 * Название предмета для отчёта / UI (category `item_name` в `localization`).
 * Если в БД нет строки (или ключ = текст), подставляются эвристики / словарь снаряжения и транслитерация.
 *
 * @param {BetterSqliteDatabase|null|undefined} database
 * @param {string|null|undefined} enName
 * @returns {string}
 */
export function translateItemNameForReport(database, enName) {
  const s = enName == null ? '' : String(enName).trim();
  if (!s) return '';
  /** Словарь «Scribe…» ломается при частичном `item_name` в SQLite — сначала полный шаблон. */
  if (/^Scribe\s+Spell\s+Scroll\b/i.test(s)) {
    const fromHeur = translateMagicItemName(s, '', {});
    if (fromHeur !== s) {
      return fromHeur;
    }
  }
  const fromDb = translate(database, s, 'item_name');
  if (fromDb !== s) return fromDb;
  return translateMagicItemName(s, '', {});
}

/**
 * Частично переведённый `item_desc` из БД (латиница + кириллица в одной фразе).
 *
 * @param {string} ru
 */
function itemDescTranslationLikelyCorrupt(ru) {
  const s = String(ru);
  if (/This\s+[а-яё]/i.test(s)) return true;
  if (/The\s+[а-яё]/i.test(s)) return true;
  if (/[а-яё]{2,}.*\b(and|while|from|charges?|daily)\b/i.test(s) && /\b(and|while|from)\b/i.test(s)) {
    return true;
  }
  return false;
}

/**
 * Описание предмета (markdown), category `item_desc`.
 * В БД ключ — **`slug`** предмета; при необходимости пробуем и полный `description_md` (старые сиды).
 *
 * @param {BetterSqliteDatabase|null|undefined} database
 * @param {string|null|undefined} enMd
 * @param {string|null|undefined} [itemSlug]
 * @returns {string}
 */
export function translateItemDescriptionForReport(database, enMd, itemSlug = null) {
  if (database == null) {
    return enMd == null ? '' : String(enMd);
  }
  const md = enMd == null ? '' : String(enMd);
  const slug = itemSlug == null ? '' : String(itemSlug).trim();
  if (slug.length > 0) {
    const bySlug = translate(database, slug, 'item_desc');
    if (bySlug !== slug && !itemDescTranslationLikelyCorrupt(bySlug)) {
      return bySlug;
    }
  }
  if (md.length > 0) {
    const byMd = translate(database, md, 'item_desc');
    if (byMd !== md && !itemDescTranslationLikelyCorrupt(byMd)) {
      return byMd;
    }
  }
  return translateItemDescriptionMd(md);
}

/**
 * Подстановка фраз и токенов в строке типа SRD (`type_line`).
 *
 * @param {BetterSqliteDatabase|null|undefined} database
 * @param {string|null|undefined} typeLine
 * @returns {string|null|undefined}
 */
export function translateMonsterTypeLine(database, typeLine) {
  if (typeLine == null || String(typeLine).trim() === '') {
    return typeLine;
  }
  if (database == null) {
    return typeLine;
  }
  ensureLocalizationTable(database);
  /** @type {{ source_key: string, ru: string }[]} */
  const phrases = database
    .prepare(
      `SELECT source_key, ru FROM localization WHERE category = 'type_phrase' ORDER BY length(source_key) DESC`,
    )
    .all();
  /** @type {{ source_key: string, ru: string }[]} */
  const tokens = database
    .prepare(
      `SELECT source_key, ru FROM localization WHERE category = 'type_token' ORDER BY length(source_key) DESC`,
    )
    .all();
  let out = String(typeLine);
  const applyRows = (rows) => {
    for (const { source_key, ru } of rows) {
      const esc = source_key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(esc, 'gi');
      out = out.replace(re, ru);
    }
  };
  applyRows(phrases);
  applyRows(tokens);
  /* Старые БД / частичные замены: «рой of» или «рой из Крошечный нежить». */
  out = out.replace(/\bрой\s+of\b/gi, 'рой из');
  out = out.replace(/рой из Крошечный нежить/gi, 'рой крошечной нежити');
  out = out.replace(/\s+\bor\b\s+/gi, ' или ');
  out = out.replace(/\bClimb\b/gi, 'лазание');
  return out;
}

/**
 * Краткие обозначения характеристик в сводке (STR и т.д.).
 *
 * @param {BetterSqliteDatabase|null|undefined} database
 * @param {string|null|undefined} summary
 * @returns {string}
 */
export function translateAbilitySummary(database, summary) {
  if (summary == null || String(summary).trim() === '') {
    return summary == null ? '' : String(summary);
  }
  if (database == null) {
    return String(summary);
  }
  let s = String(summary);
  for (const ab of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']) {
    const ru = translate(database, ab, 'ability_abbr');
    if (ru !== ab) {
      s = s.replace(new RegExp(`\\b${ab}\\b`, 'g'), ru);
    }
  }
  return s;
}

/**
 * @param {BetterSqliteDatabase|null|undefined} database
 * @param {string|null|undefined} rarity
 * @returns {string}
 */
export function translateItemRarityForReport(database, rarity) {
  return translate(database, rarity, 'rarity');
}

/**
 * @param {BetterSqliteDatabase|null|undefined} database
 * @param {string|null|undefined} category
 * @returns {string}
 */
export function translateItemCategoryForReport(database, category) {
  const c = category == null ? '' : String(category);
  if (!c) {
    return c;
  }
  const t = translate(database, c, 'item_category');
  if (t !== c) {
    return t;
  }
  if (c.includes(':')) {
    const prefix = c.split(':')[0]?.trim() ?? '';
    const suffix = c.slice(c.indexOf(':') + 1).trim();
    const pRu = translate(database, prefix, 'item_category');
    const sRu = translate(database, suffix, 'item_category');
    if (pRu !== prefix || sRu !== suffix) {
      return `${pRu}: ${sRu}`;
    }
  }
  return c;
}

/**
 * @param {BetterSqliteDatabase|null|undefined} database
 * @param {Set<string>|string[]} tags
 * @returns {string}
 */
export function formatCreatureTagsLocalized(database, tags) {
  const arr = tags instanceof Set ? [...tags] : [...tags];
  if (arr.length === 0) {
    return 'смешанные / не определены';
  }
  const parts = arr.map((t) => translate(database, t, 'encounter_tag'));
  return parts.join(', ');
}
