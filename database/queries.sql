-- ZERNIX Dungeon Assistant — проверочные SQL-запросы (SQLite)
-- Перед выполнением: sqlite3 zernix.db < database/init_db.sql

PRAGMA foreign_keys = ON;

-- 1. SELECT с условием WHERE — предметы редкости rare/uncommon дороже 100 зм
SELECT
  id,
  name,
  type,
  rarity,
  market_value,
  description
FROM items
WHERE rarity IN ('rare', 'uncommon')
  AND market_value > 100
ORDER BY market_value DESC;

-- 2. INSERT — добавление нового монстра
INSERT INTO monsters (name, cr)
VALUES ('Тролль', 5.0);

-- 3. UPDATE — обновление рыночной цены предмета
UPDATE items
SET market_value = 75.0
WHERE id = 2
  AND name = 'Зелье лечения';

-- 4. DELETE — удаление сессии по id (связи в session_monsters удалятся каскадом)
DELETE FROM sessions
WHERE id = 4;

-- 5. SELECT с JOIN — суммарный CR монстров на каждую сессию
SELECT
  s.id AS session_id,
  s.title AS session_title,
  l.name AS location_name,
  SUM(m.cr * sm.quantity) AS total_cr
FROM sessions AS s
INNER JOIN locations AS l
  ON l.id = s.location_id
LEFT JOIN session_monsters AS sm
  ON sm.session_id = s.id
LEFT JOIN monsters AS m
  ON m.id = sm.monster_id
GROUP BY s.id, s.title, l.name
ORDER BY total_cr DESC;
