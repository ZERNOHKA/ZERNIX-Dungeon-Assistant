#!/usr/bin/env node
/**
 * Пересоздаёт связи location_loot_map для схемы SRD 5.2 (entity_type: monster | item).
 *
 *   node seed-logic.mjs
 *   node seed-logic.mjs --db=C:\path\to\dnd-loot.sqlite
 */

import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveDatabasePath() {
  const fromArg = process.argv.find((a) => a.startsWith('--db='));
  if (fromArg) {
    return resolve(fromArg.slice(5));
  }
  if (process.env.DND_LOOT_DB && process.env.DND_LOOT_DB.length > 0) {
    return resolve(process.env.DND_LOOT_DB);
  }
  return resolve(join(__dirname, 'dnd-loot.sqlite'));
}

/**
 * @param {import('better-sqlite3').Database} db
 */
function upsertCoreLocations(db) {
  const stmt = db.prepare(`
    INSERT INTO locations (slug, name, display_name, description)
    VALUES (@slug, @name, @display_name, @description)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      display_name = excluded.display_name,
      description = excluded.description
  `);
  const rows = [
    {
      slug: 'forest',
      name: 'Forest',
      display_name: 'Лес',
      description:
        'Лесные тропы, звери, фэйри. Подходит для встреч с природными существами.',
    },
    {
      slug: 'dungeon',
      name: 'Dungeon',
      display_name: 'Подземелье',
      description:
        'Руины, склепы, логова. Гуманоиды, нежить, опасная добыча.',
    },
    {
      slug: 'city',
      name: 'City',
      display_name: 'Город',
      description:
        'Рынки, гильдии, социальные сцены. Снаряжение и городские истории.',
    },
  ];
  const runAll = db.transaction(() => {
    for (const row of rows) {
      stmt.run(row);
    }
  });
  runAll();
}

/**
 * @param {import('better-sqlite3').Database} db
 */
function clearLootMap(db) {
  db.exec(`DELETE FROM location_loot_map`);
}

/**
 * @param {import('better-sqlite3').Database} db
 */
function seedMonstersByCrBand(db) {
  db.prepare(
    `
    INSERT INTO location_loot_map (location_id, entity_type, entity_id, weight, tags_json, notes)
    SELECT lf.id, 'monster', m.id, 35,
           '["seed","forest","cr-low-mid"]',
           'Авто: CR <= 4'
    FROM monsters m
    JOIN locations lf ON lf.slug = 'forest'
    WHERE m.cr_numeric IS NOT NULL AND m.cr_numeric >= 0 AND m.cr_numeric <= 4
  `,
  ).run();

  db.prepare(
    `
    INSERT INTO location_loot_map (location_id, entity_type, entity_id, weight, tags_json, notes)
    SELECT ld.id, 'monster', m.id, 35,
           '["seed","dungeon","cr-mid"]',
           'Авто: CR 2–12'
    FROM monsters m
    JOIN locations ld ON ld.slug = 'dungeon'
    WHERE m.cr_numeric IS NOT NULL AND m.cr_numeric >= 2 AND m.cr_numeric <= 12
  `,
  ).run();
}

/**
 * @param {import('better-sqlite3').Database} db
 */
function seedItemsByCategory(db) {
  db.prepare(
    `
    INSERT INTO location_loot_map (location_id, entity_type, entity_id, weight, tags_json, notes)
    SELECT lc.id, 'item', i.id, 45,
           '["seed","city","gear"]',
           'Авто: снаряжение / амуниция в город'
    FROM items i
    JOIN locations lc ON lc.slug = 'city'
    WHERE i.is_magic = 0
      AND (
        instr(lower(ifnull(i.category, '')), 'adventuring') > 0
        OR instr(lower(ifnull(i.category, '')), 'weapon') > 0
        OR instr(lower(ifnull(i.category, '')), 'armor') > 0
        OR instr(lower(ifnull(i.category, '')), 'ammunition') > 0
      )
  `,
  ).run();

  db.prepare(
    `
    INSERT INTO location_loot_map (location_id, entity_type, entity_id, weight, tags_json, notes)
    SELECT ld.id, 'item', i.id, 30,
           '["seed","dungeon","magic"]',
           'Авто: магические предметы → подземелье'
    FROM items i
    JOIN locations ld ON ld.slug = 'dungeon'
    WHERE i.is_magic = 1
  `,
  ).run();

  db.prepare(
    `
    INSERT INTO location_loot_map (location_id, entity_type, entity_id, weight, tags_json, notes)
    SELECT lf.id, 'item', i.id, 25,
           '["seed","forest","mundane"]',
           'Авто: простое оружие и лёгкая броня в лес'
    FROM items i
    JOIN locations lf ON lf.slug = 'forest'
    WHERE i.is_magic = 0
      AND (
        (instr(lower(ifnull(i.category, '')), 'weapon') > 0
         AND instr(lower(ifnull(i.extra_json, '')), 'simple') > 0)
        OR instr(lower(ifnull(i.category, '')), 'armor') > 0
      )
  `,
  ).run();
}

function main() {
  const dbPath = resolveDatabasePath();
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  const runSeed = db.transaction(() => {
    upsertCoreLocations(db);
    clearLootMap(db);
    seedMonstersByCrBand(db);
    seedItemsByCategory(db);
  });

  runSeed();

  const counts = /** @type {{ c: number }} */ (
    db.prepare(`SELECT COUNT(*) AS c FROM location_loot_map`).get()
  );
  console.log(`[seed-logic] База: ${dbPath}`);
  console.log(`[seed-logic] Строк в location_loot_map: ${counts.c}`);

  db.close();
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exitCode = 1;
}
