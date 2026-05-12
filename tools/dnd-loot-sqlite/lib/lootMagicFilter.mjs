/**
 * Фрагмент SQL: только магические редкости выше Common (строго по значению rarity в SQLite).
 * Совпадение без учёта регистра и лишних пробелов.
 */
/** Для запросов с алиасом таблицы `items` как `i`. */
export const NON_COMMON_RARITY_SQL = `
(
  lower(trim(ifnull(i.rarity,''))) IN ('uncommon','rare','very rare','legendary','artifact')
)
`.trim();

