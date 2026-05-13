#!/usr/bin/env node
/**
 * Заполняет `monsters.tags` (CSV) эвристикой по type_line / name / statblock.
 * Та же база `dnd-loot.sqlite` — без новых файлов БД.
 *
 * Запуск: node seed-monster-tags.mjs
 * (из каталога tools/dnd-loot-sqlite)
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openLootDatabase } from './generate-loot.mjs';
import { ensureMonsterTagsColumn } from './lib/monster-tag-utils.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dir, 'dnd-loot.sqlite');

/**
 * @param {Record<string, unknown>} row
 * @returns {string}
 */
function inferMonsterTagsCsv(row) {
  /** @type {Set<string>} */
  const s = new Set();
  const tl = String(row.type_line ?? '').toLowerCase();
  const nm = String(row.name ?? '').toLowerCase();
  const md = String(row.raw_statblock_md ?? '')
    .slice(0, 6000)
    .toLowerCase();
  const blob = `${tl} ${nm} ${md}`;

  const types = [
    'aberration',
    'beast',
    'celestial',
    'construct',
    'dragon',
    'elemental',
    'fey',
    'fiend',
    'giant',
    'humanoid',
    'monstrosity',
    'ooze',
    'plant',
    'undead',
  ];
  for (const t of types) {
    if (tl.includes(t)) s.add(t);
  }

  if (tl.includes('undead') || /\b(zombie|skeleton|ghost|wraith|wight|ghoul|mummy|specter|vampire|lich)\b/.test(blob)) {
    s.add('undead');
    s.add('horror');
    s.add('crypt');
  }
  if (tl.includes('fiend') || /\b(devil|demon|imp|quasit|cult)\b/.test(blob)) {
    s.add('fiend');
    s.add('cult');
  }
  if (tl.includes('celestial')) s.add('celestial');
  if (tl.includes('elemental') || /\b(druid|sham|storm|lightning|thunder)\b/.test(blob)) {
    s.add('elemental');
    s.add('storm');
  }
  if (tl.includes('ooze') || /\b(plague|disease|rot|slime)\b/.test(blob)) {
    s.add('ooze');
    s.add('plague');
  }
  if (tl.includes('construct') || /\b(homunculus|golem|animated)\b/.test(blob)) {
    s.add('construct');
    s.add('laboratory');
  }
  if (tl.includes('aberration')) {
    s.add('aberration');
    s.add('horror');
    s.add('laboratory');
  }
  if (tl.includes('plant') || /\bfungus|myconid|shrieker\b/.test(blob)) {
    s.add('plant');
    s.add('crypt');
  }
  if (/\b(swarm|rats?|insect)\b/.test(blob)) {
    s.add('swarm');
    s.add('plague');
  }
  if (tl.includes('dragon') || tl.includes('draconic')) s.add('dragon');

  if (tl.includes('humanoid')) {
    s.add('humanoid');
    if (/\b(cultist|fanatic|acolyte|priest)\b/.test(blob)) s.add('cult');
    if (/\b(noble|knight|guard|spy|assassin|veteran|captain|lord|lady)\b/.test(blob)) {
      s.add('noble');
      s.add('conspiracy');
    }
    if (/\b(bandit|pirate|thug|rogue|smuggler|scout)\b/.test(blob)) {
      s.add('criminal');
      s.add('smuggling');
    }
    if (/\b(mage|wizard|archmage|warlock)\b/.test(blob)) {
      s.add('laboratory');
      s.add('storm');
    }
    if (/\b(druid)\b/.test(blob)) {
      s.add('druid');
      s.add('storm');
    }
  }

  if (/\b(crypt|tomb|grave|burial|necropolis|mausoleum)\b/.test(blob)) s.add('crypt');

  return [...s].sort().join(',');
}

function main() {
  const db = openLootDatabase(dbPath);
  try {
    ensureMonsterTagsColumn(db);
    const rows = /** @type {Array<Record<string, unknown>>} */ (
      db.prepare(`SELECT id, name, type_line, raw_statblock_md FROM monsters`).all()
    );
    const upd = db.prepare(`UPDATE monsters SET tags = ? WHERE id = ?`);
    let n = 0;
    for (const row of rows) {
      const tags = inferMonsterTagsCsv(row);
      if (tags) {
        upd.run(tags, row.id);
        n += 1;
      }
    }
    console.log(`[seed-monster-tags] updated ${n} / ${rows.length} monsters in ${dbPath}`);
  } finally {
    db.close();
  }
}

main();
