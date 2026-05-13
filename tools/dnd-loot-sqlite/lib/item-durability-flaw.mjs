/**
 * Состояние предмета: с шансом добавляется префикс и корректируется ориентир цены (для отчёта ГМ).
 */

const PREFIXES = Object.freeze([
  { key: 'rusty', labelRu: 'Ржавый', gpMul: 0.65 },
  { key: 'worn', labelRu: 'Потёртый', gpMul: 0.78 },
  { key: 'crude', labelRu: 'Грубой работы', gpMul: 0.72 },
  { key: 'fine', labelRu: 'Мастерской работы', gpMul: 1.22 },
  { key: 'pristine', labelRu: 'Безупречный', gpMul: 1.15 },
]);

/**
 * @param {() => number} rng
 * @param {number} [chance] по умолчанию 15 %
 * @returns {{ prefixRu: string, gpMul: number, key: string }|null}
 */
export function rollItemDurabilityOrQualityPrefix(rng, chance = 0.15) {
  if (rng() >= chance) {
    return null;
  }
  const pick = PREFIXES[Math.floor(rng() * PREFIXES.length)];
  return { prefixRu: pick.labelRu, gpMul: pick.gpMul, key: pick.key };
}

/**
 * @param {number|null|undefined} costGp
 * @param {number} gpMul
 * @returns {string}
 */
export function formatAdjustedPriceNoteRu(costGp, gpMul) {
  const base = Number(costGp);
  if (!Number.isFinite(base) || base <= 0) {
    return `_Ориентир стоимости: множитель **×${gpMul.toFixed(2)}** к рыночной (решение Мастера)._`;
  }
  const adj = Math.max(0, Math.round(base * gpMul));
  return `_Ориентир стоимости: было **~${Math.round(base)} зм** → с учётом состояния **~${adj} зм**._`;
}
