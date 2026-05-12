import { abilityModifierFromScore } from './abilities.mjs';
import {
  findBoldLine,
  normalizeAsciiMinus,
  slugify,
  uniqueSlug,
} from './text-utils.mjs';

/**
 * Detects a real stat block: narrative sections also use `content` arrays, but only
 * creatures repeat the **Armor Class** heading in the extracted JSON shape.
 *
 * @param {unknown} content
 * @returns {boolean}
 */
export function isMonsterStatBlockContent(content) {
  if (!Array.isArray(content)) {
    return false;
  }
  return content.some(
    (line) => typeof line === 'string' && line.includes('**Armor Class**'),
  );
}

/**
 * Recursively walks the `Monsters` subtree and yields every creature stat block.
 *
 * @param {Record<string, unknown>} node
 * @param {Array<{ name: string; content: Array<unknown> }>} out
 */
function walkMonstersTree(node, out) {
  if (!node || typeof node !== 'object') {
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }
    if ('content' in value) {
      const content = /** @type {{ content: unknown }} */ (value).content;
      if (isMonsterStatBlockContent(content)) {
        out.push({ name: key, content: /** @type {Array<unknown>} */ (content) });
        continue;
      }
    }
    walkMonstersTree(/** @type {Record<string, unknown>} */ (value), out);
  }
}

/**
 * @param {Array<unknown>} content
 * @returns {Record<string, { score: number|null; modFromBlock: number|null }>}
 */
export function parseAbilityTable(content) {
  const empty = {
    str: { score: null, modFromBlock: null },
    dex: { score: null, modFromBlock: null },
    con: { score: null, modFromBlock: null },
    int: { score: null, modFromBlock: null },
    wis: { score: null, modFromBlock: null },
    cha: { score: null, modFromBlock: null },
  };
  if (!Array.isArray(content)) {
    return empty;
  }
  const tableWrapper = content.find(
    (e) =>
      e &&
      typeof e === 'object' &&
      'table' in e &&
      /** @type {{ table: unknown }} */ (e).table &&
      typeof /** @type {{ table: unknown }} */ (e).table === 'object',
  );
  if (!tableWrapper) {
    return empty;
  }
  const table = /** @type {{ table: Record<string, string[]> }} */ (
    /** @type {{ table: unknown }} */ (tableWrapper).table
  );
  const readCell = (column) => {
    const cellArr = table[column];
    if (!cellArr || !cellArr[0]) {
      return { score: null, modFromBlock: null };
    }
    const raw = normalizeAsciiMinus(String(cellArr[0]));
    const paired = raw.match(/^(\d+)\s*\(([+-]?\d+)\)/);
    if (paired) {
      return {
        score: Number.parseInt(paired[1], 10),
        modFromBlock: Number.parseInt(paired[2], 10),
      };
    }
    const scoreOnly = raw.match(/^(\d+)\s*$/);
    if (scoreOnly) {
      return {
        score: Number.parseInt(scoreOnly[1], 10),
        modFromBlock: null,
      };
    }
    return { score: null, modFromBlock: null };
  };
  return {
    str: readCell('STR'),
    dex: readCell('DEX'),
    con: readCell('CON'),
    int: readCell('INT'),
    wis: readCell('WIS'),
    cha: readCell('CHA'),
  };
}

/**
 * @param {string|null|undefined} line Full line with **Challenge** or value only, e.g. `10 (5,900 XP)`.
 * @returns {{ cr: string|null; xp: number|null }}
 */
export function parseChallengeLine(line) {
  if (!line) {
    return { cr: null, xp: null };
  }
  let text = normalizeAsciiMinus(line.trim());
  let crMatch = text.match(/\*\*Challenge\*\*\s*([^\s(]+)\s*\(([^)]+)\)/);
  if (!crMatch) {
    crMatch = text.match(/^([^\s(]+)\s*\(([^)]+)\)\s*$/);
  }
  if (!crMatch) {
    return { cr: null, xp: null };
  }
  const cr = crMatch[1].trim();
  const xpPart = crMatch[2].replace(/,/g, '');
  const xpNumMatch = xpPart.match(/(\d+)/);
  const xp = xpNumMatch ? Number.parseInt(xpNumMatch[1], 10) : null;
  return { cr, xp };
}

/**
 * Parses the exported monsters JSON (`Monsters` root) into rows suitable for SQLite insertion.
 *
 * @param {Record<string, unknown>} monstersRoot
 * @returns {Array<Record<string, unknown>>}
 */
export function extractMonsterRows(monstersRoot) {
  const collected = [];
  walkMonstersTree(monstersRoot, collected);
  const usedSlugs = new Set();
  const rows = [];
  for (const { name, content } of collected) {
    const abilities = parseAbilityTable(content);
    const strScore = abilities.str.score;
    const dexScore = abilities.dex.score;
    const conScore = abilities.con.score;
    const intScore = abilities.int.score;
    const wisScore = abilities.wis.score;
    const chaScore = abilities.cha.score;
    const strMod = strScore != null ? abilityModifierFromScore(strScore) : null;
    const dexMod = dexScore != null ? abilityModifierFromScore(dexScore) : null;
    const conMod = conScore != null ? abilityModifierFromScore(conScore) : null;
    const intMod = intScore != null ? abilityModifierFromScore(intScore) : null;
    const wisMod = wisScore != null ? abilityModifierFromScore(wisScore) : null;
    const chaMod = chaScore != null ? abilityModifierFromScore(chaScore) : null;
    const challengeFromBold = findBoldLine(content, 'Challenge');
    const challengeFullLine =
      typeof challengeFromBold === 'string'
        ? challengeFromBold
        : content.find(
            (e) => typeof e === 'string' && e.includes('**Challenge**'),
          ) || null;
    const challengeParsed = parseChallengeLine(
      typeof challengeFullLine === 'string' ? challengeFullLine : null,
    );
    const typeLineEntry = content.find(
      (e) => typeof e === 'string' && e.startsWith('*') && e.includes(','),
    );
    rows.push({
      slug: uniqueSlug(slugify(name), usedSlugs),
      name,
      type_line: typeof typeLineEntry === 'string' ? typeLineEntry : null,
      armor_class: findBoldLine(content, 'Armor Class'),
      hit_points: findBoldLine(content, 'Hit Points'),
      speed: findBoldLine(content, 'Speed'),
      str_score: strScore,
      dex_score: dexScore,
      con_score: conScore,
      int_score: intScore,
      wis_score: wisScore,
      cha_score: chaScore,
      str_mod: strMod,
      dex_mod: dexMod,
      con_mod: conMod,
      int_mod: intMod,
      wis_mod: wisMod,
      cha_mod: chaMod,
      saving_throws: findBoldLine(content, 'Saving Throws'),
      skills: findBoldLine(content, 'Skills'),
      senses: findBoldLine(content, 'Senses'),
      languages: findBoldLine(content, 'Languages'),
      challenge_rating: challengeParsed.cr,
      xp: challengeParsed.xp,
      raw_content_json: JSON.stringify(content),
    });
  }
  return rows;
}
