-- ZERNIX Dungeon Assistant — учебная БД (SQLite)
-- Инициализация схемы и тестовых данных

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Схема
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS locations (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT    NOT NULL,
  tags TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  type         TEXT    NOT NULL,
  rarity       TEXT    NOT NULL,
  market_value REAL    NOT NULL CHECK (market_value >= 0),
  description  TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS monsters (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  cr   REAL NOT NULL CHECK (cr >= 0)
);

CREATE TABLE IF NOT EXISTS sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  location_id INTEGER NOT NULL,
  FOREIGN KEY (location_id) REFERENCES locations (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS session_monsters (
  session_id INTEGER NOT NULL,
  monster_id INTEGER NOT NULL,
  quantity   INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  PRIMARY KEY (session_id, monster_id),
  FOREIGN KEY (session_id) REFERENCES sessions (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  FOREIGN KEY (monster_id) REFERENCES monsters (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_sessions_location_id ON sessions (location_id);
CREATE INDEX IF NOT EXISTS idx_session_monsters_monster_id ON session_monsters (monster_id);
CREATE INDEX IF NOT EXISTS idx_items_rarity ON items (rarity);

-- ---------------------------------------------------------------------------
-- Тестовое заполнение (seed)
-- ---------------------------------------------------------------------------

INSERT INTO locations (name, tags) VALUES
  ('Подземелье Забытого Короля', 'dungeon,underground,ruins'),
  ('Лесная опушка у реки', 'forest,outdoor,river'),
  ('Рыночная площадь города', 'urban,market,city'),
  ('Заброшенная башня мага', 'tower,magic,ruins');

INSERT INTO items (name, type, rarity, market_value, description) VALUES
  ('Меч длинный', 'weapon', 'common', 15.0, 'Стандартное стальное оружие для опытного бойца.'),
  ('Зелье лечения', 'consumable', 'common', 50.0, 'Восстанавливает 2d4+2 хита при употреблении.'),
  ('Кольцо защиты', 'ring', 'rare', 3500.0, 'Даёт бонус +1 к КД и спасброскам.'),
  ('Свиток огненного шара', 'scroll', 'uncommon', 200.0, 'Одноразовое заклинание 3 уровня.');

INSERT INTO monsters (name, cr) VALUES
  ('Гоблин', 0.25),
  ('Орк', 0.5),
  ('Огр', 2.0),
  ('Молодой красный дракон', 10.0);

INSERT INTO sessions (title, created_at, location_id) VALUES
  ('Разведка подземелья', '2026-05-10 18:30:00', 1),
  ('Засада на торговом тракте', '2026-05-12 14:00:00', 2),
  ('Осада башни', '2026-05-15 20:45:00', 4),
  ('Патруль у городских ворот', '2026-05-18 09:15:00', 3);

INSERT INTO session_monsters (session_id, monster_id, quantity) VALUES
  (1, 1, 6),
  (1, 2, 2),
  (2, 1, 4),
  (2, 3, 1),
  (3, 3, 2),
  (3, 4, 1),
  (4, 2, 3);
