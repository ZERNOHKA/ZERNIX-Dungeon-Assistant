/**
 * Массовая вставка переводов имён монстров в `localization`.
 * В проекте колонки: category, source_key (= en_text из задания), ru (= ru_text).
 * INSERT OR IGNORE по PRIMARY KEY (category, source_key).
 */

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureLocalizationTable } from './lib/db-localization.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {string} inner — тело кортежа без внешних скобок: 'a', 'b', 'c'
 * @returns {string[]}
 */
function splitSqlTuple(inner) {
  const out = [];
  let i = 0;
  const n = inner.length;
  while (i < n) {
    while (i < n && /\s/.test(inner[i])) i++;
    if (i >= n) break;
    if (inner[i] !== "'") {
      throw new Error(`Ожидалась строка в кавычках, позиция ${i}: ${inner.slice(i, i + 40)}`);
    }
    i++;
    let s = '';
    while (i < n) {
      const ch = inner[i];
      if (ch === "'") {
        if (inner[i + 1] === "'") {
          s += "'";
          i += 2;
          continue;
        }
        i++;
        break;
      }
      s += ch;
      i++;
    }
    out.push(s);
    while (i < n && /[\s,]/.test(inner[i])) i++;
  }
  return out;
}

/**
 * @param {string} sqlText
 * @returns {{ en_text: string, ru_text: string, category: string }[]}
 */
function parseBatchSqlFile(sqlText) {
  /** @type {{ en_text: string, ru_text: string, category: string }[]} */
  const rows = [];
  for (const rawLine of sqlText.split('\n')) {
    let line = rawLine.trim();
    if (!line || line.startsWith('--')) continue;
    line = line.replace(/,\s*$/, '').replace(/;\s*$/, '');
    if (!line.startsWith('(')) continue;
    if (!line.endsWith(')')) {
      throw new Error(`Некорректная строка (нет закрывающей скобки): ${line.slice(0, 80)}`);
    }
    const inner = line.slice(1, -1);
    const parts = splitSqlTuple(inner);
    if (parts.length !== 3) {
      throw new Error(`Ожидалось 3 поля, получено ${parts.length}: ${line.slice(0, 100)}`);
    }
    const [en_text, ru_text, category] = parts;
    if (category !== 'monster_name') {
      throw new Error(`Неожиданная category: ${category}`);
    }
    rows.push({ en_text, ru_text, category });
  }
  return rows;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @returns {string[]|null} имена колонок или null, если таблицы нет
 */
function getLocalizationColumnNames(db) {
  const exists = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'localization'`)
    .get();
  if (!exists) return null;
  return db.prepare('PRAGMA table_info(localization)').all().map((/** @type {{ name: string }} */ c) => c.name);
}

const dbPath = path.join(__dirname, 'dnd-loot.sqlite');
const dataPath = path.join(__dirname, 'data', 'batch-monster-names.sql');

const sqlText = fs.readFileSync(dataPath, 'utf8');
const batch = parseBatchSqlFile(sqlText);

const db = new Database(dbPath);

try {
  const colNames = getLocalizationColumnNames(db);

  if (colNames == null) {
    console.log('[seed] Таблицы `localization` не было — создаём (category, source_key, ru).');
    ensureLocalizationTable(db);
  } else {
    const hasAppShape =
      colNames.includes('category') && colNames.includes('source_key') && colNames.includes('ru');
    if (!hasAppShape) {
      throw new Error(
        `Таблица localization уже есть с неожиданными колонками: ${colNames.join(', ')}. ` +
          'Ожидаются category, source_key, ru (см. lib/db-localization.mjs).',
      );
    }
    ensureLocalizationTable(db);
  }

  const ins = db.prepare(
    `INSERT OR IGNORE INTO localization (category, source_key, ru) VALUES (@category, @source_key, @ru)`,
  );

  let inserted = 0;
  const tx = db.transaction(() => {
    for (const { en_text, ru_text, category } of batch) {
      const info = ins.run({
        category,
        source_key: en_text,
        ru: ru_text,
      });
      inserted += info.changes;
    }
  });
  tx();

  const total = /** @type {{ c: number }} */ (db.prepare(`SELECT COUNT(*) AS c FROM localization`).get()).c;
  const monsterRows = /** @type {{ c: number }} */ (
    db.prepare(`SELECT COUNT(*) AS c FROM localization WHERE category = 'monster_name'`).get()
  ).c;

  console.log(`[seed] Распарсено строк из файла: ${batch.length}`);
  console.log(`[seed] Вставлено новых строк (changes суммарно): ${inserted}`);
  console.log(`[seed] Всего записей в localization: ${total}`);
  console.log(`[seed] Записей category=monster_name: ${monsterRows}`);
} finally {
  db.close();
}
