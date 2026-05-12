/** @type {boolean} */
let lootSqlDebugEnabled = false;
/** @type {string[]} */
let lootSqlLines = [];

/**
 * Включает сбор строк лога SQL (и дублирует в stdout процесса Electron).
 */
export function beginLootSqlDebug() {
  lootSqlDebugEnabled = true;
  lootSqlLines = [];
}

/**
 * @returns {string[]} копия накопленных строк и сброс буфера
 */
export function endLootSqlDebug() {
  const out = lootSqlLines.slice();
  lootSqlDebugEnabled = false;
  lootSqlLines = [];
  return out;
}

/**
 * @param {string} label
 * @param {string} sql
 * @param {unknown} [params]
 */
export function dbgLootSql(label, sql, params) {
  if (!lootSqlDebugEnabled) return;
  const flat = sql.replace(/\s+/g, ' ').trim();
  const tail = params !== undefined ? ` | params: ${JSON.stringify(params)}` : '';
  const line = `${label}: ${flat}${tail}`;
  lootSqlLines.push(line);
  console.log(`[loot-sql] ${line}`);
}
