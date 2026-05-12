-- SRD 5.2 / D&D 2024 oriented schema for loot, spells, monsters, NPC seeds.
-- UTF-8. Run: node import-srd-docs.mjs

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS locations (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    slug          TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    display_name  TEXT,
    description   TEXT
);

-- Unified catalog: mundane gear + magic items (is_magic = 1).
CREATE TABLE IF NOT EXISTS items (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    slug                  TEXT NOT NULL UNIQUE,
    name                  TEXT NOT NULL,
    category              TEXT NOT NULL,
    subcategory           TEXT,
    source_section        TEXT,
    cost_raw              TEXT,
    cost_gp               REAL,
    cost_cp               INTEGER,
    weight_raw            TEXT,
    weight_lb             REAL,
    rarity                TEXT,
    is_magic              INTEGER NOT NULL DEFAULT 0 CHECK (is_magic IN (0, 1)),
    attunement            INTEGER NOT NULL DEFAULT 0 CHECK (attunement IN (0, 1)),
    mastery_property      TEXT,
    type_line             TEXT,
    consumable_use_action TEXT,
    description_md        TEXT,
    extra_json            TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_items_category ON items (category);
CREATE INDEX IF NOT EXISTS idx_items_magic ON items (is_magic);
CREATE INDEX IF NOT EXISTS idx_items_rarity ON items (rarity);
CREATE INDEX IF NOT EXISTS idx_items_cost ON items (cost_gp);

CREATE TABLE IF NOT EXISTS spells (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    slug            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    level_label     TEXT,
    level_num       INTEGER,
    summary_line    TEXT,
    casting_time    TEXT,
    range_text      TEXT,
    components      TEXT,
    duration        TEXT,
    description_md  TEXT NOT NULL,
    school          TEXT,
    classes_line    TEXT
);

CREATE INDEX IF NOT EXISTS idx_spells_level ON spells (level_num);
CREATE INDEX IF NOT EXISTS idx_spells_slug ON spells (slug);

CREATE TABLE IF NOT EXISTS monsters (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    slug              TEXT NOT NULL UNIQUE,
    name              TEXT NOT NULL,
    section_group     TEXT,
    type_line         TEXT,
    armor_class       TEXT,
    hit_points        TEXT,
    speed             TEXT,
    challenge_rating  TEXT,
    cr_numeric        REAL,
    xp                INTEGER,
    raw_statblock_md  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_monsters_cr ON monsters (cr_numeric);
CREATE INDEX IF NOT EXISTS idx_monsters_slug ON monsters (slug);

-- Seed rows for procedural NPC enrichment (visual_trait, mannerism, secret_goal).
CREATE TABLE IF NOT EXISTS npc_core (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    slug          TEXT NOT NULL UNIQUE,
    role_label    TEXT,
    visual_trait  TEXT NOT NULL,
    mannerism     TEXT NOT NULL,
    secret_goal   TEXT NOT NULL,
    notes         TEXT
);

-- Maps CR ranges to treasure tiers (magic item rarity distributions).
CREATE TABLE IF NOT EXISTS encounters (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    tier                INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 4),
    cr_min              REAL NOT NULL,
    cr_max              REAL NOT NULL,
    label               TEXT NOT NULL,
    rarity_weights_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_encounters_tier ON encounters (tier);

CREATE TABLE IF NOT EXISTS location_loot_map (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id    INTEGER NOT NULL,
    entity_type    TEXT NOT NULL CHECK (entity_type IN ('monster', 'item')),
    entity_id      INTEGER NOT NULL,
    weight         REAL NOT NULL DEFAULT 1 CHECK (weight > 0),
    tags_json      TEXT,
    notes          TEXT,
    UNIQUE (location_id, entity_type, entity_id),
    FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_location_loot_map_location ON location_loot_map (location_id);
CREATE INDEX IF NOT EXISTS idx_location_loot_map_entity ON location_loot_map (entity_type, entity_id);

-- UI / Markdown: английские ключи из SRD → русский вывод (SQL-фильтры не используют эту таблицу).
CREATE TABLE IF NOT EXISTS localization (
    category   TEXT NOT NULL,
    source_key TEXT NOT NULL,
    ru         TEXT NOT NULL,
    PRIMARY KEY (category, source_key)
);

CREATE INDEX IF NOT EXISTS idx_localization_category ON localization (category);
