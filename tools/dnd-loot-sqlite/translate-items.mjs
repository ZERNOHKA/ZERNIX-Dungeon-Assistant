/**
 * Массовая запись переводов магических предметов в `localization`.
 * В `items` используются: name, description_md, type_line, rarity, category (колонок description/type нет).
 * Ключи: `item_name` → source_key = точное англ. имя; `item_desc` → source_key = **slug** предмета.
 * Составные имена монстров в отчётах — см. `COMPOUND_MONSTER_NAME_RU` в `lib/db-localization.mjs`.
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureLocalizationTable } from './lib/db-localization.mjs';
import {
  translateMagicItemName,
  translateItemDescriptionMd,
} from './lib/itemTranslationHeuristics.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dir = path.dirname(__filename);
const require = createRequire(import.meta.url);

function loadBetterSqlite3() {
  const rootCandidate = path.join(__dir, '..', '..', 'node_modules', 'better-sqlite3');
  try {
    return require(rootCandidate);
  } catch {
    return require('better-sqlite3');
  }
}

const Database = loadBetterSqlite3();

function loadOptionalNameOverrides() {
  const p = path.join(__dir, 'data', 'item-name-overrides.json');
  if (!fs.existsSync(p)) {
    return {};
  }
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return /** @type {Record<string, string>} */ (raw);
    }
  } catch (e) {
    console.warn('[translate-items] Не удалось прочитать item-name-overrides.json:', e);
  }
  return {};
}

const dbPath = path.join(__dir, 'dnd-loot.sqlite');
const overrides = loadOptionalNameOverrides();

const db = new Database(dbPath);
ensureLocalizationTable(db);

const ins = db.prepare(
  `INSERT OR IGNORE INTO localization (category, source_key, ru) VALUES (@category, @source_key, @ru)`,
);

/** @type {{ slug: string, name: string, description_md: string|null, type_line: string|null, rarity: string|null, is_magic: number }[]} */
const rows = db
  .prepare(
    `SELECT slug, name, description_md, type_line, rarity, is_magic
     FROM items
     WHERE ifnull(is_magic,0) = 1
     ORDER BY id`,
  )
  .all();

let insertedNames = 0;
let insertedDesc = 0;
let skippedEmptyDesc = 0;

function insertItemLocalizationRows(batchRows) {
  for (const row of batchRows) {
    const name = String(row.name ?? '').trim();
    const slug = String(row.slug ?? '').trim();
    if (!name || !slug) continue;

    const nameRu = translateMagicItemName(name, slug, overrides);
    const r1 = ins.run({ category: 'item_name', source_key: name, ru: nameRu });
    insertedNames += r1.changes;

    const md = row.description_md == null ? '' : String(row.description_md);
    if (md.trim().length === 0) {
      skippedEmptyDesc += 1;
      continue;
    }
    const descRu = translateItemDescriptionMd(md);
    const r2 = ins.run({ category: 'item_desc', source_key: slug, ru: descRu });
    insertedDesc += r2.changes;
  }
}

const txMagic = db.transaction(() => {
  insertItemLocalizationRows(rows);
});

txMagic();

/** Немагический снаряжение: те же эвристики имён + описание по slug (как у магии). */
/** @type {{ slug: string, name: string, description_md: string|null, type_line: string|null, rarity: string|null, is_magic: number }[]} */
const mundaneRows = db
  .prepare(
    `SELECT slug, name, description_md, type_line, rarity, is_magic
     FROM items
     WHERE ifnull(is_magic,0) = 0
     ORDER BY id`,
  )
  .all();

const txMundane = db.transaction(() => {
  insertItemLocalizationRows(mundaneRows);
});

txMundane();

const cName = /** @type {{ c: number }} */ (
  db.prepare(`SELECT COUNT(*) AS c FROM localization WHERE category = 'item_name'`).get()
).c;
const cDesc = /** @type {{ c: number }} */ (
  db.prepare(`SELECT COUNT(*) AS c FROM localization WHERE category = 'item_desc'`).get()
).c;

db.close();

console.log(`[translate-items] Магических строк в items: ${rows.length}`);
console.log(`[translate-items] Немагических строк в items: ${mundaneRows.length}`);
console.log(`[translate-items] Новых вставок item_name (changes): ${insertedNames}`);
console.log(`[translate-items] Новых вставок item_desc (changes): ${insertedDesc}`);
console.log(`[translate-items] Пропущено пустых описаний: ${skippedEmptyDesc}`);
console.log(`[translate-items] Всего в localization: item_name=${cName}, item_desc=${cDesc}`);
