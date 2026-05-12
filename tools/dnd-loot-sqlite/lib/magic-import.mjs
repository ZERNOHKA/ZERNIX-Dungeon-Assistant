import { parseCostToCp } from './pricing.mjs';
import { normalizeAsciiMinus, slugify, uniqueSlug } from './text-utils.mjs';

/**
 * Heuristic rarity labels that appear in SRD / DMG style magic item type lines.
 */
const RARITY_ORDER = [
  'artifact',
  'varies',
  'legendary',
  'very rare',
  'rare',
  'uncommon',
  'common',
];

/**
 * Pulls the first textual description line from heterogeneous `content` arrays.
 *
 * @param {unknown} content
 * @returns {string|null}
 */
function firstTypeLine(content) {
  if (!Array.isArray(content)) {
    return null;
  }
  for (const entry of content) {
    if (typeof entry === 'string' && entry.trim().startsWith('*')) {
      return entry.trim();
    }
  }
  return null;
}

/**
 * Attempts to find a coin price mentioned explicitly in description text (rare for SRD items).
 *
 * @param {Array<unknown>} content
 * @returns {number|null}
 */
function scanContentForPriceCp(content) {
  if (!Array.isArray(content)) {
    return null;
  }
  let best = null;
  const re = /\b([0-9,]+(?:\.[0-9]+)?)\s*(pp|gp|ep|sp|cp)\b/gi;
  for (const entry of content) {
    if (typeof entry !== 'string') {
      continue;
    }
    const matches = entry.matchAll(re);
    for (const match of matches) {
      const cp = parseCostToCp(`${match[1].replace(/,/g, '')} ${match[2].toLowerCase()}`);
      if (cp != null && cp > 0) {
        best = best == null ? cp : Math.max(best, cp);
      }
    }
  }
  return best;
}

/**
 * Extracts rarity token from a magic item italic header line.
 *
 * @param {string|null} typeLine
 * @returns {string|null}
 */
export function parseMagicRarity(typeLine) {
  if (!typeLine) {
    return null;
  }
  const line = normalizeAsciiMinus(typeLine).toLowerCase();
  for (const rarity of RARITY_ORDER) {
    if (line.includes(rarity)) {
      return rarity;
    }
  }
  return null;
}

/**
 * Detects attunement requirement.
 *
 * @param {string|null} typeLine
 * @returns {boolean}
 */
export function parseAttunement(typeLine) {
  if (!typeLine) {
    return false;
  }
  return /requires\s+attunement/i.test(typeLine);
}

/**
 * Flattens magic items from the root JSON object `Magic Items`.
 *
 * @param {Record<string, unknown>} magicRoot
 * @returns {Array<Record<string, unknown>>}
 */
export function extractMagicItemRows(magicRoot) {
  const usedSlugs = new Set();
  /** @type {Array<Record<string, unknown>>} */
  const rows = [];
  for (const [name, value] of Object.entries(magicRoot)) {
    if (name === 'content') {
      continue;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }
    if (!('content' in value)) {
      continue;
    }
    const content = /** @type {Array<unknown>} */ (
      /** @type {{ content: unknown }} */ (value).content
    );
    if (!Array.isArray(content)) {
      continue;
    }
    const typeLine = firstTypeLine(content);
    const rarity = parseMagicRarity(typeLine);
    const attunement = parseAttunement(typeLine) ? 1 : 0;
    const heuristicPrice = scanContentForPriceCp(content);
    rows.push({
      slug: uniqueSlug(slugify(name), usedSlugs),
      name,
      type_line: typeLine,
      rarity,
      attunement,
      price_cp: heuristicPrice,
      description_json: JSON.stringify(content),
    });
  }
  return rows;
}
