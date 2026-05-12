/**
 * Converts a coin expression from the SRD tables into copper pieces (cp).
 * Standard SRD rates: 1 pp = 10 gp = 100 sp = 1,000 cp; 1 ep = 5 sp = 50 cp.
 *
 * @param {string|null|undefined} raw
 * @returns {number|null} Integer cp, or null if unparseable / not a fixed price
 */
export function parseCostToCp(raw) {
  if (raw == null) {
    return null;
  }
  let s = String(raw).trim();
  if (s === '' || s === '—' || s === '-' || s === '*') {
    return null;
  }
  if (/^×/u.test(s)) {
    return null;
  }
  s = s.replace(/,/g, '').toLowerCase();
  const match = s.match(/^([0-9]+(?:\.[0-9]+)?)\s*(cp|sp|ep|gp|pp)\s*$/u);
  if (!match) {
    return null;
  }
  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount)) {
    return null;
  }
  const unit = match[2];
  const factor =
    unit === 'cp' ? 1 : unit === 'sp' ? 10 : unit === 'ep' ? 50 : unit === 'gp' ? 100 : 1000;
  return Math.round(amount * factor);
}

/**
 * SRD 5.2 Magic Item Rarities and Values (GP), before modifiers for bundled gear.
 *
 * @see docs/magic-items.md “Magic Item Rarities and Values”
 */
export const SRD52_RARITY_GP = Object.freeze({
  Common: 100,
  Uncommon: 400,
  Rare: 4000,
  'Very Rare': 40000,
  Legendary: 200000,
});

/**
 * @param {number|null|undefined} cp
 * @returns {number|null}
 */
export function cpToGp(cp) {
  if (cp == null || !Number.isFinite(Number(cp))) {
    return null;
  }
  return Number(cp) / 100;
}

/**
 * @param {string|null|undefined} rarity
 * @param {{ consumable?: boolean, spellScroll?: boolean }} [opts]
 * @returns {number|null}
 */
export function suggestedCostGpFromRarity(rarity, opts = {}) {
  if (rarity == null || String(rarity).trim() === '') {
    return null;
  }
  const raw = String(rarity);
  if (/artifact/i.test(raw)) {
    return null;
  }
  /** @type {string|null} */
  let matchedKey = null;
  if (raw.includes('Very Rare')) {
    matchedKey = 'Very Rare';
  } else {
    for (const key of Object.keys(SRD52_RARITY_GP)) {
      if (key !== 'Very Rare' && raw.includes(key)) {
        matchedKey = key;
        break;
      }
    }
  }
  if (!matchedKey) {
    return null;
  }
  let base = SRD52_RARITY_GP[matchedKey];
  if (opts.spellScroll) {
    return base * 2;
  }
  if (opts.consumable) {
    return base / 2;
  }
  return base;
}
