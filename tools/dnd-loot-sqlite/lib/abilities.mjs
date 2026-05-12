/**
 * D&D 5e ability modifier from a base score (Player's Handbook).
 *
 * @param {number} score
 * @returns {number}
 */
export function abilityModifierFromScore(score) {
  if (!Number.isFinite(score)) {
    return 0;
  }
  return Math.floor((score - 10) / 2);
}
