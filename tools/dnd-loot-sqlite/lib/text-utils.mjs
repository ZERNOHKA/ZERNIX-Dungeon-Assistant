/**
 * Normalizes typographic minus (U+2212) and similar dash characters to ASCII hyphen-minus
 * so numeric parsing matches D&D stat blocks copied from PDFs or reference sites.
 *
 * @param {string} input
 * @returns {string}
 */
export function normalizeAsciiMinus(input) {
  if (typeof input !== 'string') {
    return '';
  }
  return input
    .replace(/\u2212/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '-');
}

/**
 * Produces a URL-safe, stable English slug for cross-referencing third-party localized data.
 *
 * @param {string} name
 * @returns {string}
 */
export function slugify(name) {
  if (name == null || name === '') {
    return 'unknown';
  }
  const base = String(name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['''´`]/g, '')
    .replace(/&amp;/g, 'and')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.length > 0 ? base : 'unknown';
}

/**
 * Ensures every slug within a set is unique by appending numeric suffixes when collisions occur.
 *
 * @param {string} baseSlug
 * @param {Set<string>} usedSlugs
 * @returns {string}
 */
export function uniqueSlug(baseSlug, usedSlugs) {
  let candidate = baseSlug;
  let n = 2;
  while (usedSlugs.has(candidate)) {
    candidate = `${baseSlug}-${n}`;
    n += 1;
  }
  usedSlugs.add(candidate);
  return candidate;
}

/**
 * Extracts the first line matching a **Label** prefix inside monster content blocks.
 *
 * @param {Array} content
 * @param {string} labelWithoutStars e.g. "Armor Class"
 * @returns {string|null}
 */
export function findBoldLine(content, labelWithoutStars) {
  if (!Array.isArray(content)) {
    return null;
  }
  const prefix = `**${labelWithoutStars}**`;
  for (const entry of content) {
    if (typeof entry === 'string' && entry.startsWith(prefix)) {
      return entry.slice(prefix.length).trim();
    }
  }
  return null;
}
