/**
 * ZERNIX Legacy Loot Ultra — расширенные трофеи, тайники, сокровищница, причуды магии.
 */

import { generatePocketLoot, formatLocalizedWithOriginalSuffix } from './loot-generator-55.mjs';

/** @typedef {'fire'|'acid'|'cold'|'lightning'|'necrotic'|'radiant'|'thunder'|'poison'|'none'|string} KillerElement */

const CONDITION_PRISTINE = Object.freeze({ ru: 'Идеальное состояние', en: 'Pristine condition' });
const CONDITION_BAD = Object.freeze([
  { ru: 'Обугленное', en: 'Charred' },
  { ru: 'Покрытое кровью', en: 'Blood-covered' },
  { ru: 'Треснувшее', en: 'Cracked' },
]);

const STORY_TRIGGERS = Object.freeze([
  {
    ru: 'Семейное фото в медной рамке — лица стёрты сажей.',
    en: 'A family portrait in a brass frame — faces smudged with soot.',
  },
  {
    ru: 'Приказ об аресте: на пергаменте **ваши** приметы (или очень похожие).',
    en: 'An arrest warrant — the description matches **your** party (or uncannily close).',
  },
  {
    ru: 'Кольцо с гербом города — внутри гравировка девиза, который узнают стражники.',
    en: 'A signet ring bearing the city coat of arms — motto inside that guards will recognize.',
  },
]);

const TACTICAL_CONSUMABLES = Object.freeze([
  {
    ru: 'Мешочек с сухим порохом (для шумной отвлекающей шашки или сигнала).',
    en: 'A pouch of dry powder (for a noisy flare or diversion charge).',
  },
  {
    ru: 'Бутыль с лёгким маслом — накрыть 5 фт скольжения или поджечь фитиль.',
    en: 'A flask of lamp oil — covers a 5 ft slick or feeds a fuse.',
  },
  {
    ru: 'Острые шипы из кости (1 использование) — уложить на 5 фт линии.',
    en: 'Sharp bone caltrops (one use) — scatter across a 5 ft line.',
  },
]);

const INFO_LOOT = Object.freeze([
  {
    ru: 'Карта соседней комнаты (набросок мелом): указан выход и «опасная ниша».',
    en: 'A chalk-sketch map of the next chamber — exit marked and a “danger niche” noted.',
  },
  {
    ru: 'Записка о слабости босса: **+2** к следующей проверке **Магии или Природы** (Знание о существе) против этой цели.',
    en: 'A scrap about the boss’s weak spot: **+2** to your next **Arcana or Nature** check (creature lore) vs that foe.',
  },
]);

const HISTORY_POOL = Object.freeze([
  { ru: 'Создан мастером-гномом, который ненавидел пауков.', en: 'Forged by a gnome smith who despised spiders.' },
  { ru: 'Выкован под двойной луной — кузнецы клянутся, что металл «помнит» прилив.', en: 'Hammered under a double moon — smiths swear the metal “remembers” the tide.' },
  { ru: 'Принадлежал павшему паладину; на рукояти осталась выцветшая клятва.', en: 'Once owned by a fallen paladin; a faded oath remains on the haft.' },
  { ru: 'Украден у драконьего культа до того, как ритуал завершился.', en: 'Stolen from a dragon cult before the rite could finish.' },
]);

const MINOR_POOL = Object.freeze([
  { ru: 'Светится тускло в присутствии орков.', en: 'Glows faintly near orcs.' },
  { ru: 'Никогда не ржавеет, даже в болотной парильне.', en: 'Never rusts, even in swamp mists.' },
  { ru: 'Слегка теплеет, когда рядом нежить.', en: 'Grows slightly warm near undead.' },
  { ru: 'Поёт едва слышную ноту, если рядом фея.', en: 'Hums a single faint note when fey are near.' },
]);

const QUIRK_POOL = Object.freeze([
  { ru: 'Владелец начинает видеть сны на языке Бездны.', en: 'The bearer dreams in Deep Speech.' },
  { ru: 'По ночам слышен шёпот счёта монет, которых нет.', en: 'At night you hear whispers counting coins that aren’t there.' },
  { ru: 'Иногда предмет кажется на унцию тяжелее.', en: 'Sometimes the item feels an ounce heavier for no reason.' },
  { ru: 'Капли воды на металле складываются в руну, которая тут же испаряется.', en: 'Water beads on the metal form a rune that vanishes in a breath.' },
]);

/**
 * @param {KillerElement|null|undefined} killerElement
 * @param {() => number} rng
 * @returns {{ ru: string, en: string, needsRepair: boolean }}
 */
function rollItemCondition(killerElement, rng) {
  const el = String(killerElement ?? 'none').toLowerCase();
  const fireAcid = /^(fire|acid|огонь|кислот|пламя|flame)$/i.test(el) || /огонь|кислот|fire|acid/i.test(el);
  const forceBad = fireAcid && rng() < 0.3;
  const softBad = !fireAcid && rng() < 0.06;
  if (forceBad || softBad) {
    const pick = CONDITION_BAD[Math.floor(rng() * CONDITION_BAD.length)];
    return { ...pick, needsRepair: true };
  }
  return { ...CONDITION_PRISTINE, needsRepair: false };
}

/**
 * Личный лут с тел (карманы + ZERNIX Ultra).
 * @param {string} npcType type_line или ярлык типа NPC
 * @param {number} cr
 * @param {KillerElement|null|undefined} killerElement огонь/кислота → 30% негативное состояние части находок
 * @param {() => number} [rng]
 */
export function generatePersonalLoot(npcType, cr, killerElement, rng = Math.random) {
  const base = generatePocketLoot(String(npcType), Number(cr), rng);
  const parts = base.label
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  /** @type {string[]} */
  const annotated = [];
  for (const p of parts) {
    const cond = rollItemCondition(killerElement, rng);
    const condLine = formatLocalizedWithOriginalSuffix(cond.ru, cond.en);
    const repairTag = cond.needsRepair ? ' 🛠 *[Нужен ремонт]*' : '';
    annotated.push(`${p} — _${condLine}_${repairTag}`);
  }

  let storyTrigger = null;
  if (rng() < 0.05) {
    const st = STORY_TRIGGERS[Math.floor(rng() * STORY_TRIGGERS.length)];
    storyTrigger = formatLocalizedWithOriginalSuffix(st.ru, st.en);
  }

  /** @type {string[]} */
  const markdownLines = ['**🎒 Трофеи с тел (Pocket loot)**', ''];
  markdownLines.push(`- ${annotated.join('\n- ')}`);
  if (base.coinLabel) {
    markdownLines.push(`- **Монеты:** ${base.coinLabel}`);
  }
  if (storyTrigger) {
    markdownLines.push(`- 📖 *[Сюжет]* ${storyTrigger}`);
  }

  const fullLabel = annotated.join('; ');
  return {
    label: fullLabel,
    coins: base.coins,
    coinLabel: base.coinLabel,
    storyTrigger,
    markdownLines,
  };
}

/**
 * Тайники и тактические находки по локации и глубине.
 * @param {string} location свободный текст / ключ биома
 * @param {number} floorDepth
 * @param {() => number} [rng]
 * @returns {{ markdownLines: string[] }}
 */
export function generateEnvironmentLoot(location, floorDepth, rng = Math.random) {
  void location;
  const d = Math.max(0, Math.floor(Number(floorDepth) || 0));
  const tactical = TACTICAL_CONSUMABLES[Math.floor(rng() * TACTICAL_CONSUMABLES.length)];
  const tactical2 =
    rng() < 0.45 ? TACTICAL_CONSUMABLES[Math.floor(rng() * TACTICAL_CONSUMABLES.length)] : null;
  const info = INFO_LOOT[Math.floor(rng() * INFO_LOOT.length)];

  /** @type {string[]} */
  const markdownLines = [
    '## 🏛 **Тайники и находки** (Environment loot)',
    '',
    `_Глубина подземелья (эхо): **${d}**._`,
    '',
    '**Тактические расходники:**',
    `- ${formatLocalizedWithOriginalSuffix(tactical.ru, tactical.en)}`,
  ];
  if (tactical2 && tactical2 !== tactical) {
    markdownLines.push(`- ${formatLocalizedWithOriginalSuffix(tactical2.ru, tactical2.en)}`);
  }
  markdownLines.push('', '**Информационный лут:**', `- ${formatLocalizedWithOriginalSuffix(info.ru, info.en)}`, '');

  return { markdownLines };
}

/**
 * Мета сокровищницы: проклятие жадности + разнообразная валюта.
 * @param {string} hoardOrigin например `normal` | `desecrated` | `осквернено`
 * @param {number} cr эффективный CR кучи
 * @param {number} coinsGp оценка в зм после полов/капов
 * @param {() => number} [rng]
 */
export function generateHoard(hoardOrigin, cr, coinsGp, rng = Math.random) {
  void cr;
  const origin = String(hoardOrigin ?? 'normal').toLowerCase();
  const desecrated =
    origin === 'desecrated' ||
    origin === 'оскверн' ||
    origin.includes('оскверн') ||
    origin.includes('desecrat');

  let greedCurseLine = '';
  if (desecrated) {
    greedCurseLine = formatLocalizedWithOriginalSuffix(
      '⚠️ **Проклятие жадности:** сокровище **осквернено** — кто возьмёт монеты или ключевые предметы, до конца дня получает **помеху** на спасброски от **страха**.',
      '⚠️ **Curse of greed:** this hoard is **desecrated** — anyone who pockets the coins or key treasures has **disadvantage** on saves vs **fear** until the day ends.',
    );
  }

  const gp = Math.max(0, Math.floor(Number(coinsGp) || 0));
  let currencyFlavorLine = '';
  if (gp <= 0) {
    currencyFlavorLine = formatLocalizedWithOriginalSuffix(
      'Горсть медных и обломков нуммия — почти без ценности.',
      'A handful of copper bits and clipped nummi — almost worthless.',
    );
  } else {
    const ratio = 0.35 + rng() * 0.45;
    const a = Math.max(1, Math.floor(gp * ratio));
    const b = Math.max(0, gp - a);
    const c = rng() < 0.35 ? Math.max(1, Math.floor(gp * 0.08)) : 0;
    const rest = Math.max(0, gp - a - b - c);
    currencyFlavorLine = formatLocalizedWithOriginalSuffix(
      `≈**${a}** золотых монет Империи, ≈**${b}** массы в старинных серебряных слитках${c ? `, ≈**${c}** платиновых чеканок древнего чекана` : ''}${rest ? ` и ≈**${rest}** зм мелочью разных чеканов` : ''} _(оценка экв. **~${gp} зм**)._`,
      `≈**${a}** imperial gold coins, ≈**${b}** by weight in antique silver ingots${c ? `, ≈**${c}** platinum trade plaques` : ''}${rest ? ` plus ≈**${rest}** gp in mixed coin` : ''} _(equiv. **~${gp} gp**)._`,
    );
    if (desecrated && rng() < 0.5) {
      currencyFlavorLine += ` ${formatLocalizedWithOriginalSuffix(
        '⚠️ *[Опасно]* часть чеканки едкая на язык — не класть в рот.',
        '⚠️ *[Hazard]* some coins taste caustic — do not pocket with wet lips.',
      )}`;
    }
  }

  return { desecrated, greedCurseLine, currencyFlavorLine };
}

/**
 * Случайные причуды для магического предмета (DMG-style flavor).
 * @param {Record<string, unknown>} item piece из formatItemLoot или строка БД
 * @param {() => number} [rng]
 */
export function magicItemQuirk(item, rng = Math.random) {
  if (String(item?.kind ?? '') !== 'magic_item') {
    return { history: '', minorProperty: '', quirk: '', markdownBlock: '' };
  }

  const h = HISTORY_POOL[Math.floor(rng() * HISTORY_POOL.length)];
  const m = MINOR_POOL[Math.floor(rng() * MINOR_POOL.length)];
  const q = QUIRK_POOL[Math.floor(rng() * QUIRK_POOL.length)];

  const history = formatLocalizedWithOriginalSuffix(h.ru, h.en);
  const minorProperty = formatLocalizedWithOriginalSuffix(m.ru, m.en);
  const quirk = formatLocalizedWithOriginalSuffix(q.ru, q.en);

  const markdownBlock = [
    `- 📖 *[История]* ${history}`,
    `- _[Minor property]_ ${minorProperty}`,
    `- _[Quirk]_ ${quirk}`,
  ].join('\n');

  return { history, minorProperty, quirk, markdownBlock };
}
