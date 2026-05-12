/**
 * Извлекает подстроки для фильтра monsters (name / type_line) из свободного текста (RU/EN).
 */

/** @param {string} text */
function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е');
}

/**
 * @param {string} description
 * @returns {{ fragments: string[], inferredEnv: string, tribal: 'orc'|'goblin'|null }}
 */
export function analyzeSessionPrepDescription(description) {
  const n = normalize(description);
  /** @type {Set<string>} */
  const frag = new Set();

  /** @type {Array<{ re: RegExp, bits: string[], env?: string, tribal?: 'orc'|'goblin' }>} */
  const rules = [
    { re: /лес|роща|глуш|чаш|дуб|forest|woods/i, bits: ['beast', 'fey', 'plant'], env: 'forest' },
    {
      re: /\bcrypt\b|склеп|catacomb|necropolis|mausoleum|ossuar|undercroft|гробниц|усыпальн/i,
      bits: ['undead', 'crypt', 'tomb', 'grave'],
      env: 'crypt',
    },
    { re: /пещер|подзем|канал|dungeon|cave/i, bits: ['ooze', 'monstrosity', 'humanoid'], env: 'cave' },
    { re: /болот|трясин|swamp|fen/i, bits: ['ooze', 'plant', 'monstrosity'], env: 'swamp' },
    { re: /побереж|берег|мор|coast|sea|beach/i, bits: ['beast', 'humanoid', 'dragon'], env: 'coastal' },
    { re: /снег|льд|тундр|аркт|arctic|ice/i, bits: ['beast', 'elemental', 'undead'], env: 'arctic' },
    { re: /город|улиц|рынк|urban|city|street/i, bits: ['humanoid', 'fiend'], env: 'urban' },
    { re: /гоблин|goblin/i, bits: ['goblin'], tribal: 'goblin' },
    { re: /орк|orc/i, bits: ['orc'], tribal: 'orc' },
    { re: /дракон|dragon|дрейк/i, bits: ['dragon'] },
    { re: /эльф|elf/i, bits: ['elf'] },
    { re: /лиса|волк|wolf|bear|медвед/i, bits: ['beast'] },
    { re: /нежит|undead|зомби|скелет|vampire/i, bits: ['undead'] },
  ];

  let inferredEnv = 'any';
  /** @type {'orc'|'goblin'|null} */
  let tribal = null;

  for (const r of rules) {
    if (r.re.test(n)) {
      for (const b of r.bits) frag.add(b);
      if (r.env) inferredEnv = r.env;
      if (r.tribal) tribal = r.tribal;
    }
  }

  const tokens = n.split(/[^a-zа-яё0-9]+/i).filter((w) => w.length >= 3);
  for (const t of tokens) {
    if (t.length <= 18) frag.add(t);
  }

  return {
    fragments: [...frag],
    inferredEnv,
    tribal,
  };
}
