/**
 * Нарративный биом (логика сцены) — строже, чем только `environment` в SQLite.
 * @typedef {'cave'|'forest'|'city'|'dungeon'|'swamp'|'laboratory'|'coastal'|'mountain'|'arctic'|'crypt'|'generic'} NarrativeBiomeId
 */

/**
 * @param {string} environmentKey encounter-build environment
 * @param {string} themeId scene theme id
 * @returns {NarrativeBiomeId}
 */
export function inferNarrativeBiome(environmentKey, themeId) {
  const tid = String(themeId || '');
  if (tid === 'abandoned_laboratory') return 'laboratory';
  if (tid === 'noble_conspiracy') return 'city';
  const e = String(environmentKey || 'any').toLowerCase();
  if (e === 'urban') return 'city';
  if (e === 'coastal') return 'coastal';
  if (e === 'swamp') return 'swamp';
  if (e === 'forest') return 'forest';
  if (e === 'cave') return 'cave';
  if (e === 'crypt') return 'crypt';
  if (e === 'dungeon') return 'dungeon';
  if (e === 'mountain') return 'mountain';
  if (e === 'arctic') return 'arctic';
  return 'generic';
}

/** @type {Readonly<Record<NarrativeBiomeId, readonly string[]>>} */
const BIOME_PREFERRED_TAGS = Object.freeze({
  laboratory: Object.freeze([
    'laboratory',
    'construct',
    'ooze',
    'aberration',
    'elemental',
    'mage',
    'humanoid',
    'horror',
  ]),
  cave: Object.freeze(['ooze', 'undead', 'beast', 'monstrosity', 'humanoid', 'dragon', 'aberration']),
  forest: Object.freeze(['fey', 'beast', 'plant', 'humanoid', 'monstrosity', 'dragon']),
  city: Object.freeze(['noble', 'humanoid', 'criminal', 'cult', 'spy', 'fiend', 'conspiracy']),
  dungeon: Object.freeze(['undead', 'construct', 'aberration', 'humanoid', 'monstrosity', 'fiend']),
  swamp: Object.freeze(['ooze', 'plant', 'beast', 'monstrosity', 'humanoid', 'dragon']),
  coastal: Object.freeze(['elemental', 'monstrosity', 'humanoid', 'beast', 'criminal']),
  mountain: Object.freeze(['giant', 'dragon', 'monstrosity', 'beast', 'humanoid', 'elemental']),
  arctic: Object.freeze(['elemental', 'beast', 'monstrosity', 'humanoid', 'undead']),
  crypt: Object.freeze(['undead', 'crypt', 'horror', 'fiend', 'cult']),
  generic: Object.freeze([]),
});

/** @type {Readonly<Record<NarrativeBiomeId, readonly string[]>>} */
const BIOME_FORBIDDEN_TAGS = Object.freeze({
  laboratory: Object.freeze(['druid', 'fey']),
  cave: Object.freeze([]),
  city: Object.freeze([]),
  dungeon: Object.freeze([]),
  swamp: Object.freeze([]),
  coastal: Object.freeze([]),
  mountain: Object.freeze([]),
  arctic: Object.freeze([]),
  crypt: Object.freeze([]),
  generic: Object.freeze([]),
});

/** Имена/типы, несовместимые с закрытой лабораторией (без «sahuagin в реторте»). */
const LAB_FORBIDDEN_NAME_RE =
  /\b(sahuagin|merrow|locathah|merfolk|kraken|plesiosaur|plesiosaurus|octopus|shark|whale|dolphin|sea\s+hag|storm\s+giant)\b/i;

/**
 * @param {NarrativeBiomeId} biome
 * @param {Record<string, unknown>} row
 */
export function narrativeBiomeHardMismatch(biome, row) {
  const nm = String(row.name ?? '').toLowerCase();
  const tl = String(row.type_line ?? '').toLowerCase();
  const blob = `${nm} ${tl}`;
  if (biome === 'laboratory') {
    if (LAB_FORBIDDEN_NAME_RE.test(blob)) return true;
  }
  if (biome === 'city') {
    if (/\b(sahuagin|merrow|locathah|kraken)\b/i.test(blob)) return true;
  }
  if (biome === 'forest' || biome === 'mountain') {
    if (/\b(sahuagin|merrow|locathah)\b/i.test(blob)) return true;
  }
  return false;
}

/**
 * Копия тегов биома для скоринга / дефолтных thematicTags (без мутации констант).
 *
 * @param {NarrativeBiomeId} biome
 * @returns {string[]}
 */
export function listBiomePreferredTagsForScoring(biome) {
  const prefs = BIOME_PREFERRED_TAGS[biome] || BIOME_PREFERRED_TAGS.generic;
  return prefs.length ? [...prefs] : [];
}

/**
 * Число совпадений тегов монстра с «ожидаемыми» для биома (0…n).
 *
 * @param {Record<string, unknown>} row
 * @param {NarrativeBiomeId} biome
 */
export function monsterBiomePreferredTagHits(row, biome) {
  const prefs = BIOME_PREFERRED_TAGS[biome] || BIOME_PREFERRED_TAGS.generic;
  if (!prefs.length) return 0;
  const raw = row.tags != null ? String(row.tags) : '';
  const rowTags = new Set(
    raw
      .split(/[,;|\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  let n = 0;
  for (const t of prefs) {
    if (rowTags.has(String(t).toLowerCase())) n += 1;
  }
  return Math.min(4, n);
}

/**
 * @param {Record<string, unknown>} row
 * @param {NarrativeBiomeId} biome
 */
export function monsterHasForbiddenBiomeTag(row, biome) {
  const forb = BIOME_FORBIDDEN_TAGS[biome] || [];
  if (!forb.length) return false;
  const raw = row.tags != null ? String(row.tags) : '';
  const rowTags = new Set(
    raw
      .split(/[,;|\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  for (const t of forb) {
    if (rowTags.has(String(t).toLowerCase())) return true;
  }
  return false;
}

/**
 * Кинематографичные опасности окружения (игровой смысл + образ).
 * Индекс выбирается детерминированно по `seed` — без доп. random().
 *
 * @param {NarrativeBiomeId} biome
 * @param {number} floorDepth
 * @param {string} seed
 * @param {string} [themeId]
 * @returns {{ label: string, dc: number, saveRu: string, saveEn: string }}
 */
export function pickCinematicHazardForBiome(biome, floorDepth, seed, themeId) {
  const d = Math.max(0, Math.floor(Number(floorDepth) || 0));
  const dc = Math.min(22, 10 + d);
  const con = Math.max(10, dc - 2);
  const wis = Math.max(10, dc - 1);
  /** @type {Array<{ ru: string, en: string, saveRu: string, saveEn: string }>} */
  const rows = [];

  const push = (ru, en, saveRu, saveEn) => rows.push({ ru, en, saveRu, saveEn });

  push(
    `Галлюциногенный пар у трещин — на миг слышатся шёпоты и чужие шаги (DC ${con} Телосложение, иначе помеха на следующий ход).`,
    `Hallucinogenic fumes at cracks — whispers and phantom footsteps for a moment (DC ${con} Constitution or disadvantage next turn).`,
    'Телосложение',
    'Constitution',
  );
  push(
    `Статическое поле: вспышка срывает короткую память — имена союзников «плывут» на 1 раунд (DC ${wis} Мудрость).`,
    `A static field flicker disrupts short-term memory — allies' names blur for 1 round (DC ${wis} Wisdom).`,
    'Мудрость',
    'Wisdom',
  );
  push(
    `Споры дают ложные зрительные эхо — дубликаты силуэтов в периферии (DC ${wis} Мудрость, иначе помеха на проверки восприятия до конца хода).`,
    `Spores create false visual echoes — duplicate silhouettes at the edge of vision (DC ${wis} Wisdom or perception checks at disadvantage until end of turn).`,
    'Мудрость',
    'Wisdom',
  );
  push(
    `Нестабильный потолок — громкие заклинания могут вызвать обвал (DC ${dc} Ловкость, половина урона).`,
    `Unstable ceiling — loud spells risk collapse (DC ${dc} Dexterity, half damage).`,
    'Ловкость',
    'Dexterity',
  );

  if (biome === 'laboratory' || biome === 'dungeon') {
    push(
      `Ионизированный туман вокруг аппарата — металл «поёт», концентрация срывается без DC ${con} Телосложения при чтении заклинания.`,
      `Ionized mist around apparatus — metal sings; concentration breaks without DC ${con} Constitution when casting.`,
      'Телосложение',
      'Constitution',
    );
  }
  if (biome === 'coastal' || biome === 'swamp') {
    push(
      `Солёная пелена и жгучий туман — кожа онемевает, руки дрожат (DC ${con} Телосложение, иначе −2 к атакам дальнего боя до конца сцены).`,
      `Salt haze and biting fog — numb hands (DC ${con} Constitution or −2 ranged attacks until scene end).`,
      'Телосложение',
      'Constitution',
    );
  }

  const tid = String(themeId || '').toLowerCase();
  if (tid === 'plague_outbreak') {
    push(
      `Болезнетворная пыльца в луче фонаря — при вдохе DC ${wis} Мудрость или до конца хода союзники кажутся «мертвыми» (без урона, только образ).`,
      `Pathogenic glitter in lamplight — DC ${wis} Wisdom or allies look 'dead' until end of turn (illusion-like).`,
      'Мудрость',
      'Wisdom',
    );
  }
  if (tid === 'storm_magic') {
    push(
      `Заряженный воздух: металлические предметы искрят — при касании DC ${con} Телосложение или помеха на следующий бросок атаки.`,
      `Ionized air: metal sparks on touch — DC ${con} Constitution or disadvantage on next attack roll.`,
      'Телосложение',
      'Constitution',
    );
  }
  if (tid === 'cult_ritual') {
    push(
      `Круг из соли истёрт — внутри круга шёпоты на неизвестном языке; DC ${wis} Мудрость или помеха на проверки Проницательности 1 раунд.`,
      `A salt circle is worn — whispers inside; DC ${wis} Wisdom or Insight checks at disadvantage for 1 round.`,
      'Мудрость',
      'Wisdom',
    );
  }
  if (tid === 'cursed_relics') {
    push(
      `Проклятая зона: золото на секунду «дышит» — DC ${wis} Мудрость или преимущество врагу на один бросок против вас до конца хода.`,
      `Cursed ground: gold seems to breathe — DC ${wis} Wisdom or enemies gain advantage on one roll vs you until end of turn.`,
      'Мудрость',
      'Wisdom',
    );
  }
  if (tid === 'noble_conspiracy') {
    push(
      `Слишком ровный свет в зале — тени «режут» силуэты; DC ${wis} Мудрость или нельзя использовать помощь союзника до конца хода.`,
      `Over-even light cuts silhouettes oddly — DC ${wis} Wisdom or no Help ally bonus until end of turn.`,
      'Мудрость',
      'Wisdom',
    );
  }

  let h = 2166136261;
  const s = String(seed || 'zernix');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h = (h >>> 0) % rows.length;
  const pick = rows[h];
  return {
    label: pick.ru,
    dc,
    saveRu: pick.saveRu,
    saveEn: pick.saveEn,
  };
}
