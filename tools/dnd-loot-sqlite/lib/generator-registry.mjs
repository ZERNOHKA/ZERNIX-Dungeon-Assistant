/**
 * Декларативный реестр правил генерации (ZERNIX NEXUS).
 * Новая таблица (заклинания, фракции) → миграция + строка в `generator_rules`, без правок ядра.
 */

/**
 * @param {import('better-sqlite3').Database} db
 * @returns {Array<{ ruleKey: string, definition: Record<string, unknown>, version: number }>}
 */
export function loadGeneratorRuleRegistry(db) {
  try {
    const rows = /** @type {Array<{ rule_key: string, definition_json: string, version: number }>} */ (
      db.prepare(`SELECT rule_key, definition_json, version FROM generator_rules ORDER BY rule_key`).all()
    );
    return rows.map((r) => ({
      ruleKey: r.rule_key,
      definition: JSON.parse(r.definition_json || '{}'),
      version: r.version,
    }));
  } catch {
    return [];
  }
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} ruleKey
 * @returns {Record<string, unknown>|null}
 */
export function getGeneratorRule(db, ruleKey) {
  const row = /** @type {{ definition_json?: string }|undefined} */ (
    db.prepare(`SELECT definition_json FROM generator_rules WHERE rule_key = ?`).get(ruleKey)
  );
  if (!row?.definition_json) return null;
  try {
    return /** @type {Record<string, unknown>} */ (JSON.parse(String(row.definition_json)));
  } catch {
    return null;
  }
}
