#!/usr/bin/env node
/**
 * Scan SRD 5.2 markdown in /docs and build SQLite (items, spells, monsters, npc_core, encounters).
 *
 * Usage:
 *   node import-srd-docs.mjs
 *   node import-srd-docs.mjs --out=./dnd-loot.sqlite --docs=../../docs
 *   node import-srd-docs.mjs --no-demo-seed
 */

import { existsSync, readFileSync, unlinkSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import {
  parseEquipmentMarkdown,
  parseMagicItemsMarkdown,
  parseSpellsMarkdown,
  parseMonstersMarkdown,
  defaultEncounterTierRows,
  defaultNpcCoreRows,
} from './lib/srd52-import.mjs';
import { ensureLocalizationTable, seedLocalizationDefaults } from './lib/db-localization.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * @param {string[]} argv
 * @returns {Record<string, string|boolean>}
 */
function parseArgv(argv) {
  /** @type {Record<string, string|boolean>} */
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const eq = token.indexOf('=');
      if (eq === -1) {
        out[token.slice(2)] = true;
      } else {
        out[token.slice(2, eq)] = token.slice(eq + 1);
      }
    }
  }
  return out;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} schemaPath
 */
function applySchema(db, schemaPath) {
  db.exec(readFileSync(schemaPath, 'utf8'));
}

/**
 * @param {import('better-sqlite3').Database} db
 */
function seedLocations(db) {
  const stmt = db.prepare(`
    INSERT INTO locations (slug, name, display_name, description)
    VALUES (@slug, @name, @display_name, @description)
  `);
  const rows = [
    {
      slug: 'forest',
      name: 'Forest',
      display_name: 'Лес',
      description: 'Wilderness encounters and fey-touched sites.',
    },
    {
      slug: 'dungeon',
      name: 'Dungeon',
      display_name: 'Подземелье',
      description: 'Ruins, vaults, monster lairs.',
    },
    {
      slug: 'city',
      name: 'City',
      display_name: 'Город',
      description: 'Markets, guildhalls, social scenes.',
    },
  ];
  const tx = db.transaction((list) => {
    for (const r of list) {
      stmt.run(r);
    }
  });
  tx(rows);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {Array<Record<string, unknown>>} rows
 */
function bulkItems(db, rows) {
  const stmt = db.prepare(`
    INSERT INTO items (
      slug, name, category, subcategory, source_section,
      cost_raw, cost_gp, cost_cp, weight_raw, weight_lb,
      rarity, is_magic, attunement, mastery_property, type_line,
      consumable_use_action, description_md, extra_json,
      loot_weight, tags
    ) VALUES (
      @slug, @name, @category, @subcategory, @source_section,
      @cost_raw, @cost_gp, @cost_cp, @weight_raw, @weight_lb,
      @rarity, @is_magic, @attunement, @mastery_property, @type_line,
      @consumable_use_action, @description_md, @extra_json,
      COALESCE(@loot_weight, 100), COALESCE(@tags, '')
    )
  `);
  const tx = db.transaction((list) => {
    for (const r of list) {
      stmt.run(r);
    }
  });
  tx(rows);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {Array<Record<string, unknown>>} rows
 */
function bulkSpells(db, rows) {
  const stmt = db.prepare(`
    INSERT INTO spells (
      slug, name, level_label, level_num, summary_line,
      casting_time, range_text, components, duration, description_md,
      school, classes_line
    ) VALUES (
      @slug, @name, @level_label, @level_num, @summary_line,
      @casting_time, @range_text, @components, @duration, @description_md,
      @school, @classes_line
    )
  `);
  const tx = db.transaction((list) => {
    for (const r of list) {
      stmt.run(r);
    }
  });
  tx(rows);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {Array<Record<string, unknown>>} rows
 */
function bulkMonsters(db, rows) {
  const stmt = db.prepare(`
    INSERT INTO monsters (
      slug, name, section_group, type_line, armor_class, hit_points, speed,
      challenge_rating, cr_numeric, xp, raw_statblock_md
    ) VALUES (
      @slug, @name, @section_group, @type_line, @armor_class, @hit_points, @speed,
      @challenge_rating, @cr_numeric, @xp, @raw_statblock_md
    )
  `);
  const tx = db.transaction((list) => {
    for (const r of list) {
      stmt.run(r);
    }
  });
  tx(rows);
}

/**
 * @param {import('better-sqlite3').Database} db
 */
function seedEncounters(db) {
  const stmt = db.prepare(`
    INSERT INTO encounters (tier, cr_min, cr_max, label, rarity_weights_json)
    VALUES (@tier, @cr_min, @cr_max, @label, @rarity_weights_json)
  `);
  defaultEncounterTierRows().forEach((r) => stmt.run(r));
}

/**
 * @param {import('better-sqlite3').Database} db
 */
function seedNpcCore(db) {
  const stmt = db.prepare(`
    INSERT INTO npc_core (slug, role_label, visual_trait, mannerism, secret_goal)
    VALUES (@slug, @role_label, @visual_trait, @mannerism, @secret_goal)
  `);
  defaultNpcCoreRows().forEach((r) => stmt.run(r));
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} monsterSlug
 * @returns {number|null}
 */
function monsterIdBySlug(db, monsterSlug) {
  const row = db.prepare(`SELECT id FROM monsters WHERE slug = ?`).get(monsterSlug);
  return row ? /** @type {{ id: number }} */ (row).id : null;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} itemSlug
 * @returns {number|null}
 */
function itemIdBySlug(db, itemSlug) {
  const row = db.prepare(`SELECT id FROM items WHERE slug = ?`).get(itemSlug);
  return row ? /** @type {{ id: number }} */ (row).id : null;
}

/**
 * @param {import('better-sqlite3').Database} db
 */
function seedDemoLoot(db) {
  const links = [
    ['dungeon', 'monster', 'aboleth', 8],
    ['dungeon', 'monster', 'goblin-warrior', 14],
    ['dungeon', 'item', 'torch', 12],
    ['dungeon', 'item', 'bag-of-holding', 2],
    ['forest', 'monster', 'owlbear', 9],
    ['forest', 'item', 'longbow', 5],
    ['city', 'item', 'potion-of-healing', 10],
  ];
  for (const [locSlug, entType, slug, w] of links) {
    const loc = db.prepare(`SELECT id FROM locations WHERE slug = ?`).get(locSlug);
    if (!loc) {
      continue;
    }
    const lid = /** @type {{ id: number }} */ (loc).id;
    const eid =
      entType === 'monster' ? monsterIdBySlug(db, slug) : itemIdBySlug(db, slug);
    if (eid == null) {
      continue;
    }
    db.prepare(
      `
      INSERT OR IGNORE INTO location_loot_map (location_id, entity_type, entity_id, weight, tags_json)
      VALUES (?, ?, ?, ?, ?)
    `,
    ).run(lid, entType, eid, w, '["demo-seed"]');
  }
}

function main() {
  const args = parseArgv(process.argv);
  const docsDir = resolve(
    typeof args.docs === 'string' ? args.docs : join(__dirname, '..', '..', 'docs'),
  );
  const outPath = resolve(
    typeof args.out === 'string' ? args.out : join(__dirname, 'dnd-loot.sqlite'),
  );
  const equipPath = join(docsDir, 'equipment.md');
  const magicPath = join(docsDir, 'magic-items.md');
  const spellsPath = join(docsDir, 'spells.md');
  const monstersPath = join(docsDir, 'monsters-A-Z.md');

  for (const p of [equipPath, magicPath, spellsPath, monstersPath]) {
    if (!existsSync(p)) {
      throw new Error(`Missing required doc: ${p}`);
    }
  }

  const equipmentMd = readFileSync(equipPath, 'utf8');
  const magicMd = readFileSync(magicPath, 'utf8');
  const spellsMd = readFileSync(spellsPath, 'utf8');
  const monstersMd = readFileSync(monstersPath, 'utf8');

  console.log('Parsing markdown…');
  const mundane = parseEquipmentMarkdown(equipmentMd);
  const magic = parseMagicItemsMarkdown(magicMd);
  const spells = parseSpellsMarkdown(spellsMd);
  const monsters = parseMonstersMarkdown(monstersMd);

  const allItems = [...mundane, ...magic];
  console.log(
    `Rows: items ${mundane.length} mundane + ${magic.length} magic = ${allItems.length}; spells ${spells.length}; monsters ${monsters.length}`,
  );

  if (existsSync(outPath)) {
    unlinkSync(outPath);
  }
  const db = new Database(outPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  applySchema(db, join(__dirname, 'schema.sql'));

  bulkItems(db, allItems);
  bulkSpells(db, spells);
  bulkMonsters(db, monsters);
  seedEncounters(db);
  seedNpcCore(db);
  seedLocations(db);

  if (args['no-demo-seed'] !== true) {
    seedDemoLoot(db);
  }

  ensureLocalizationTable(db);
  seedLocalizationDefaults(db);

  const counts = {
    items: /** @type {{n:number}} */ (db.prepare(`SELECT COUNT(*) AS n FROM items`).get()).n,
    spells: /** @type {{n:number}} */ (db.prepare(`SELECT COUNT(*) AS n FROM spells`).get()).n,
    monsters: /** @type {{n:number}} */ (db.prepare(`SELECT COUNT(*) AS n FROM monsters`).get()).n,
  };
  console.log(`SQLite ready: ${outPath}`);
  console.log(`  items=${counts.items} spells=${counts.spells} monsters=${counts.monsters}`);

  db.close();
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exitCode = 1;
}
