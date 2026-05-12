/**
 * Фрагменты SQL: `items` + `localization` для имён и описаний предметов.
 * Схема: `localization(category, source_key, ru)` — ключи `item_name` / `item_desc`,
 * `item_name.source_key` = `items.name`; `item_desc.source_key` = **`items.slug`** (как пишет translate-items.mjs).
 * Массовые ключи и эвристики для сидов — см. `itemTranslationHeuristics.mjs`.
 */

/** SELECT: все колонки items + опциональные переводы. */
export const SQL_ITEMS_LOCALIZED_SELECT = `i.*, loc_item_name.ru AS name_ru, loc_item_desc.ru AS desc_ru`;

/** FROM … JOIN: алиас строки предмета — всегда `i`. */
export const SQL_ITEMS_LOCALIZED_FROM = `items i
LEFT JOIN localization loc_item_name ON loc_item_name.category = 'item_name' AND loc_item_name.source_key = i.name
LEFT JOIN localization loc_item_desc ON loc_item_desc.category = 'item_desc' AND loc_item_desc.source_key = i.slug`;
