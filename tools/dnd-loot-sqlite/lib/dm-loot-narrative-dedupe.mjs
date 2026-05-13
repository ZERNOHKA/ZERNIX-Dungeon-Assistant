/**
 * Дедуп строк сюжетного лута / наград по смысловому отпечатку (фракции, крючки, находки).
 */

/**
 * @param {string} line
 */
export function narrativeLootFingerprint(line) {
  const base = String(line)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!base) return '';
  const stripped = base.replace(
    /^(улика|сюжет|фракция|событие|накал|находка|ещё|зачепка|награда|монеты|~)\s*:\s*/i,
    '',
  );
  return stripped.slice(0, 80);
}

/**
 * @param {string[]} lines
 */
export function dedupeLinesByNarrativeFingerprint(lines) {
  const seen = new Set();
  /** @type {string[]} */
  const out = [];
  for (const ln of lines) {
    const fp = narrativeLootFingerprint(ln);
    if (!fp || seen.has(fp)) continue;
    seen.add(fp);
    out.push(ln);
  }
  return out;
}

/**
 * @param {string[]} base
 * @param {string[]} more
 * @param {number} [maxLen]
 */
export function mergeDedupedNarrativeLines(base, more, maxLen = 14) {
  return dedupeLinesByNarrativeFingerprint([...(base || []), ...(more || [])]).slice(0, maxLen);
}
