/**
 * Пост-обработка имён для стол-брифа: убрать «ломаную» локализацию, дубли, хвосты EN.
 */

/**
 * @param {string} raw
 * @returns {string}
 */
export function normalizeFantasyNameRu(raw) {
  let s = String(raw ?? '')
    .replace(/\*\*/g, '')
    .replace(/\s*\([^)]*[A-Za-z][^)]*\)/g, '')
    .trim();

  /** @type {Array<[RegExp, string]>} */
  const fixes = [
    [/сварм\s+кравлинг\s+клавс/gi, 'рой ползающих рук'],
    [/ворн\s+или\s+хелд/gi, 'ношения'],
    [/\bworn\s+or\s+held\b/gi, 'ношения'],
    [/\s+ентертаинерь?с\s+пакк/gi, ''],
    [/дипломать?с\s+пакк/gi, ''],
    [/\bportable\s+ram\b/gi, 'переносной таран'],
    [/\bmagnifying\s+glass\b/gi, 'лупа'],
    [/\bgloves\s+of\s+missile\s+snaring\b/gi, 'перчатки ловли снарядов'],
    [/\bring\s+of\s+jumping\b/gi, 'кольцо прыжка'],
    [/\breliquary\s+held\b/gi, 'реликварий'],
    [/\breliquary\b/gi, 'реликварий'],
    [/\bswarm\s+of\s+crawling\s+claws?\b/gi, 'рой ползающих рук'],
    [/\bswarm\b/gi, 'рой'],
    [/\bcrawling\s+claws?\b/gi, 'ползающих рук'],
    [/\s+/g, ' '],
  ];
  for (const [re, rep] of fixes) {
    s = s.replace(re, rep).trim();
  }

  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 4) {
    const half = Math.floor(parts.length / 2);
    const left = parts.slice(0, half).join(' ');
    const right = parts.slice(half).join(' ');
    if (left.toLowerCase() === right.toLowerCase()) {
      s = left;
    }
  }

  const w = s.split(/\s+/).filter(Boolean);
  const deduped = [];
  for (const x of w) {
    if (deduped.length && deduped[deduped.length - 1].toLowerCase() === x.toLowerCase()) continue;
    deduped.push(x);
  }
  s = deduped.join(' ');

  return s.replace(/\s+/g, ' ').replace(/^[\s,.:;]+|[\s,.:;]+$/g, '').trim();
}

/** Алиас для пост-обработки любых имён в выводе (существа, предметы). */
export function normalizeName(raw) {
  return normalizeFantasyNameRu(raw);
}
