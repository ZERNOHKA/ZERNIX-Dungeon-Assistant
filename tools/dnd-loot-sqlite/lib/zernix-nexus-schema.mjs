/**
 * ZERNIX NEXUS: миграции SQLite (веса, теги, lore, профессии, реестр правил).
 * Вся схема в одной транзакции для атомарности.
 */

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} table
 * @param {string} column
 * @returns {boolean}
 */
function tableHasColumn(db, table, column) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  return rows.some((/** @type {{ name?: string }} */ r) => r.name === column);
}

/**
 * @param {import('better-sqlite3').Database} db
 */
function seedLoreFragmentsIfEmpty(db) {
  const n = /** @type {{ c: number }} */ (db.prepare(`SELECT COUNT(*) AS c FROM lore_fragments`).get()).c;
  if (n > 0) return;
  const stmt = db.prepare(
    `INSERT INTO lore_fragments (type, text, weight, tags) VALUES (@type, @text, @weight, @tags)`,
  );
  const rows = [
    { type: 'trait', text: 'Держится за привычный ритуал: трижды постукивает по столу, прежде чем решиться.', weight: 100, tags: 'urban' },
    { type: 'trait', text: 'Говорит шёпотом о деньгах и громко — о погоде.', weight: 90, tags: 'urban,dungeon' },
    { type: 'trait', text: 'Носит запах дёгтя и стали, даже вне кузницы.', weight: 110, tags: 'wilderness,urban' },
    { type: 'trait', text: 'Взгляд бегает к выходам — привычка того, кто ждал удара в переулке.', weight: 92, tags: 'criminal,urban' },
    { type: 'goal', text: 'Сейчас ищет человека, который расплатится старым долгом — без крови, если получится.', weight: 100, tags: 'urban' },
    { type: 'goal', text: 'Хочет вытащить из подземелья одну вещь — не золото, а «улику».', weight: 95, tags: 'dungeon' },
    { type: 'goal', text: 'Нужен проводник через дикие земли; платит информацией, не монетой.', weight: 85, tags: 'wilderness' },
    { type: 'goal', text: 'Хочет исчезнуть из поля зрения стражи хотя бы на две недели.', weight: 88, tags: 'criminal,debt' },
    { type: 'secret', text: 'Когда-то подписал бумагу, которую теперь ищет фракция.', weight: 80, tags: 'urban,dungeon' },
    { type: 'secret', text: 'В кармане — жетон чужой гильдии; сам не помнит, откуда.', weight: 75, tags: 'dungeon' },
  ];
  const tx = db.transaction((list) => {
    for (const r of list) stmt.run(r);
  });
  tx(rows);
}

/**
 * Доп. фрагменты для уже заполненных БД (идемпотентно по подстроке тега).
 *
 * @param {import('better-sqlite3').Database} db
 */
function seedLoreCriminalExtrasIfMissing(db) {
  const hit = /** @type {{ c: number }} */ (
    db.prepare(`SELECT COUNT(*) AS c FROM lore_fragments WHERE instr(tags,'criminal') > 0`).get()
  ).c;
  if (hit > 0) return;
  db.prepare(
    `INSERT INTO lore_fragments (type, text, weight, tags) VALUES ('trait', ?, 92, 'criminal,urban')`,
  ).run(
    'Взгляд бегает к выходам — привычка того, кто ждал удара в переулке.',
  );
  db.prepare(
    `INSERT INTO lore_fragments (type, text, weight, tags) VALUES ('goal', ?, 88, 'criminal,debt')`,
  ).run('Хочет исчезнуть из поля зрения стражи хотя бы на две недели.');
}

/**
 * @param {import('better-sqlite3').Database} db
 */
function seedNpcProfessionsIfEmpty(db) {
  const n = /** @type {{ c: number }} */ (db.prepare(`SELECT COUNT(*) AS c FROM npc_professions`).get()).c;
  if (n > 0) return;
  const stmt = db.prepare(
    `INSERT INTO npc_professions (profession_id, name_ru, category, weight, tags) VALUES (@profession_id, @name_ru, @category, @weight, @tags)`,
  );
  const rows = [
    { profession_id: 'merchant', name_ru: 'Торговец', category: 'trade', weight: 120, tags: 'urban' },
    { profession_id: 'blacksmith', name_ru: 'Кузнец', category: 'craft', weight: 100, tags: 'urban,tool,heavy' },
    { profession_id: 'innkeeper', name_ru: 'Трактирщик', category: 'service', weight: 110, tags: 'urban' },
    { profession_id: 'sage', name_ru: 'Мудрец', category: 'lore', weight: 70, tags: 'urban,dungeon' },
    { profession_id: 'alchemist', name_ru: 'Алхимик', category: 'craft', weight: 90, tags: 'urban,tool' },
    { profession_id: 'guide', name_ru: 'Проводник', category: 'wilderness', weight: 85, tags: 'wilderness,dungeon' },
    { profession_id: 'mercenary', name_ru: 'Наёмник', category: 'combat', weight: 95, tags: 'dungeon,wilderness' },
    { profession_id: 'locksmith', name_ru: 'Замочник', category: 'craft', weight: 75, tags: 'urban,tool' },
  ];
  const tx = db.transaction((list) => {
    for (const r of list) stmt.run(r);
  });
  tx(rows);
}

/**
 * @param {import('better-sqlite3').Database} db
 */
function seedGeneratorRulesIfEmpty(db) {
  const n = /** @type {{ c: number }} */ (db.prepare(`SELECT COUNT(*) AS c FROM generator_rules`).get()).c;
  if (n > 0) return;
  const stmt = db.prepare(
    `INSERT INTO generator_rules (rule_key, definition_json, version) VALUES (@rule_key, @definition_json, @version)`,
  );
  stmt.run({
    rule_key: 'items_weighted_pick',
    definition_json: JSON.stringify({
      engine: 'pickRandomItemRowWeighted',
      sampleCap: 420,
      stratifiedContextTag: true,
      tagPoolFraction: 0.35,
    }),
    version: 1,
  });
  stmt.run({
    rule_key: 'npc_lore_motivation',
    definition_json: JSON.stringify({
      engine: 'buildInstantMotivationBio',
      usesSecondaryTagsFromSecret: true,
      tables: ['lore_fragments'],
    }),
    version: 1,
  });
}

function runMigrationsBody(db) {
  if (!tableHasColumn(db, 'items', 'loot_weight')) {
    db.exec(`ALTER TABLE items ADD COLUMN loot_weight INTEGER NOT NULL DEFAULT 100`);
  }
  if (!tableHasColumn(db, 'items', 'tags')) {
    db.exec(`ALTER TABLE items ADD COLUMN tags TEXT NOT NULL DEFAULT ''`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS lore_fragments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('trait', 'secret', 'goal')),
      text TEXT NOT NULL,
      weight INTEGER NOT NULL DEFAULT 100,
      tags TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_lore_fragments_type ON lore_fragments (type);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS npc_professions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profession_id TEXT NOT NULL UNIQUE,
      name_ru TEXT NOT NULL,
      category TEXT,
      weight INTEGER NOT NULL DEFAULT 100,
      tags TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_npc_professions_weight ON npc_professions (weight);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS generator_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_key TEXT NOT NULL UNIQUE,
      definition_json TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_generator_rules_key ON generator_rules (rule_key);
  `);

  seedLoreFragmentsIfEmpty(db);
  seedLoreCriminalExtrasIfMissing(db);
  seedNpcProfessionsIfEmpty(db);
  seedGeneratorRulesIfEmpty(db);

  db.exec(`UPDATE items SET loot_weight = 100 WHERE loot_weight IS NULL OR loot_weight <= 0`);
  db.exec(`UPDATE items SET tags = '' WHERE tags IS NULL`);
}

/**
 * Применить миграции NEXUS (идемпотентно, в одной транзакции).
 *
 * @param {import('better-sqlite3').Database} db
 */
export function applyZernixNexusMigrations(db) {
  db.transaction(() => {
    runMigrationsBody(db);
  })();
}

/**
 * Асинхронная обёртка для моста/сервера (better-sqlite3 остаётся синхронным внутри).
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {Promise<void>}
 */
export async function applyZernixNexusMigrationsAsync(db) {
  applyZernixNexusMigrations(db);
  return Promise.resolve();
}
