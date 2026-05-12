/**
 * Словари и эвристики для перевода SRD-имён и описаний магических предметов без внешнего API.
 * Ключи имён — как в колонке `items.name` (точное совпадение для localization.item_name).
 */

import { MUNDANE_GEAR_NAME_RU } from './mundane-gear-names-ru.mjs';

/**
 * Единый вид тире для поиска в `MUNDANE_GEAR_NAME_RU` (SRD / импорт дают —, –, -).
 * @param {string} name
 */
export function normalizeGearNameKey(name) {
  return String(name ?? '')
    .trim()
    .replace(/[\u2013\u2014\u2212]/g, '—')
    .replace(/\s*-\s*(?=\d|Cantrip)/i, ' — ')
    .replace(/\s+/g, ' ');
}

/**
 * Полное русское имя из словаря снаряжения с учётом вариантов тире.
 * @param {string} name
 * @returns {string|null}
 */
export function resolveMundaneGearRuExact(name) {
  const n = String(name ?? '').trim();
  if (!n) return null;
  if (MUNDANE_GEAR_NAME_RU[n]) return MUNDANE_GEAR_NAME_RU[n];
  const norm = normalizeGearNameKey(n);
  if (MUNDANE_GEAR_NAME_RU[norm]) return MUNDANE_GEAR_NAME_RU[norm];
  return null;
}

/** @type {Record<string, string>} */
export const MAGIC_ITEM_NAME_RU = {
  'Potion of Healing': 'Зелье лечения',
  'Potion of Greater Healing': 'Зелье великого лечения',
  'Potion of Superior Healing': 'Зелье превосходного лечения',
  'Potion of Supreme Healing': 'Зелье высшего лечения',
  'Potion of Climbing': 'Зелье лазания',
  'Potion of Water Breathing': 'Зелье подводного дыхания',
  'Potion of Invisibility': 'Зелье невидимости',
  'Potion of Growth': 'Зелье роста',
  'Potion of Diminution': 'Зелье уменьшения',
  'Potion of Gaseous Form': 'Зелье газообразной формы',
  'Potion of Resistance': 'Зелье сопротивления',
  'Potion of Speed': 'Зелье скорости',
  'Potion of Heroism': 'Зелье героизма',
  'Potion of Mind Reading': 'Зелье чтения мыслей',
  'Potion of Animal Friendship': 'Зелье дружбы с животными',
  'Potion of Poison': 'Зелье яда',
  'Potion of Fire Giant Strength': 'Зелье силы огненного великана',
  'Potion of Hill Giant Strength': 'Зелье силы холмового великана',
  'Potion of Frost Giant Strength': 'Зелье силы морозного великана',
  'Potion of Stone Giant Strength': 'Зелье силы каменного великана',
  'Potion of Cloud Giant Strength': 'Зелье силы облачного великана',
  'Potion of Storm Giant Strength': 'Зелье силы штормового великана',
  'Philter of Love': 'Фильтр любви',
  'Oil of Sharpness': 'Масло остроты',
  'Oil of Etherealness': 'Масло эфирности',
  'Oil of Slipperiness': 'Масло скольжения',
  'Elixir of Health': 'Эликсир здоровья',
  'Elixir of Life': 'Эликсир жизни',
  'Bag of Holding': 'Мешок хранения',
  'Bag of Devouring': 'Мешок пожирания',
  'Bag of Tricks': 'Мешок фокусов',
  'Portable Hole': 'Переносимая дыра',
  'Heward\'s Handy Haversack': 'Удобный ранец Хьюарда',
  'Alchemy Jug': 'Алхимический кувшин',
  'Amulet of Health': 'Амулет здоровья',
  'Amulet of Proof against Detection and Location': 'Амулет защиты от обнаружения и определения места',
  'Amulet of the Planes': 'Амулет планов',
  'Amulet of Mighty Fists': 'Амулет могучих кулаков',
  'Ring of Protection': 'Кольцо защиты',
  'Ring of Resistance': 'Кольцо сопротивления',
  'Ring of Spell Storing': 'Кольцо хранения заклинаний',
  'Ring of Mind Shielding': 'Кольцо защиты разума',
  'Ring of Invisibility': 'Кольцо невидимости',
  'Ring of Animal Influence': 'Кольцо влияния на животных',
  'Ring of Djinni Summoning': 'Кольцо призыва джинна',
  'Ring of Elemental Command': 'Кольцо повеления стихиями',
  'Ring of Evasion': 'Кольцо уклонения',
  'Ring of Feather Falling': 'Кольцо пера падающего',
  'Ring of Free Action': 'Кольцо свободы действий',
  'Ring of Regeneration': 'Кольцо регенерации',
  'Ring of Shooting Stars': 'Кольцо падающих звёзд',
  'Ring of Spell Turning': 'Кольцо обращения заклинаний',
  'Ring of Swimming': 'Кольцо плавания',
  'Ring of Telekinesis': 'Кольцо телекинеза',
  'Ring of Three Wishes': 'Кольцо трёх желаний',
  'Ring of Warmth': 'Кольцо тепла',
  'Ring of X-ray Vision': 'Кольцо рентгеновского зрения',
  'Ring of the Ram': 'Кольцо тарана',
  'Cloak of Protection': 'Плащ защиты',
  'Cloak of Invisibility': 'Плащ невидимости',
  'Cloak of Elvenkind': 'Плащ эльфийской натуры',
  'Cloak of the Bat': 'Плащ летучей мыши',
  'Cloak of the Manta Ray': 'Плащ морского дьявола',
  'Cloak of Arachnida': 'Плащ арахниды',
  'Boots of Elvenkind': 'Сапоги эльфийской натуры',
  'Boots of Levitation': 'Сапоги левитации',
  'Boots of Speed': 'Сапоги скорости',
  'Boots of Striding and Springing': 'Сапоги широкого шага и прыжка',
  'Boots of the Winterlands': 'Сапоги зимних земель',
  'Bracers of Archery': 'Наручи стрельбы из лука',
  'Bracers of Defense': 'Наручи защиты',
  'Gauntlets of Ogre Power': 'Рукавицы силы огра',
  'Gloves of Missile Snaring': 'Перчатки ловли снарядов',
  'Gloves of Swimming and Climbing': 'Перчатки плавания и лазания',
  'Gloves of Thievery': 'Перчатки воровства',
  'Belt of Giant Strength': 'Пояс силы великана',
  'Belt of Dwarvenkind': 'Пояс дуэргарской крови',
  'Belt of Hill Giant Strength': 'Пояс силы холмового великана',
  'Belt of Frost Giant Strength': 'Пояс силы морозного великана',
  'Belt of Stone Giant Strength': 'Пояс силы каменного великана',
  'Belt of Fire Giant Strength': 'Пояс силы огненного великана',
  'Belt of Cloud Giant Strength': 'Пояс силы облачного великана',
  'Belt of Storm Giant Strength': 'Пояс силы штормового великана',
  'Brooch of Shielding': 'Брошь защиты',
  'Broom of Flying': 'Метла полёта',
  'Carpet of Flying': 'Ковёр-самолёт',
  'Wings of Flying': 'Крылья полёта',
  'Immovable Rod': 'Неподвижный скипетр',
  'Rod of Absorption': 'Скипетр поглощения',
  'Rod of Alertness': 'Скипетр бдительности',
  'Rod of Lordly Might': 'Скипетр могущественной власти',
  'Rod of Resurrection': 'Скипетр воскрешения',
  'Rod of Rulership': 'Скипетр власти',
  'Rod of Security': 'Скипетр безопасности',
  'Staff of the Adder': 'Посох гадюки',
  'Staff of the Python': 'Посох питона',
  'Staff of Charming': 'Посох очарования',
  'Staff of Fire': 'Посох огня',
  'Staff of Frost': 'Посох мороза',
  'Staff of Healing': 'Посох лечения',
  'Staff of Power': 'Посох силы',
  'Staff of Striking': 'Посох ударов',
  'Staff of Swarming Insects': 'Посох роя насекомых',
  'Staff of Thunder and Lightning': 'Посох грома и молнии',
  'Staff of Withering': 'Посох увядания',
  'Staff of the Woodlands': 'Посох лесов',
  'Wand of Magic Detection': 'Жезл обнаружения магии',
  'Wand of Magic Missiles': 'Жезл магических снарядов',
  'Wand of Binding': 'Жезл связывания',
  'Wand of Enemy Detection': 'Жезл обнаружения врагов',
  'Wand of Fear': 'Жезл страха',
  'Wand of Fireballs': 'Жезл огненных шаров',
  'Wand of Lightning Bolts': 'Жезл молний',
  'Wand of Paralysis': 'Жезл паралича',
  'Wand of Polymorph': 'Жезл превращения',
  'Wand of Secrets': 'Жезл тайн',
  'Wand of Web': 'Жезл паутины',
  'Wand of Wonder': 'Жезл чудес',
  'Wand of the War Mage, +1': 'Жезл боевого мага +1',
  'Wand of the War Mage, +2': 'Жезл боевого мага +2',
  'Wand of the War Mage, +3': 'Жезл боевого мага +3',
  'Deck of Illusions': 'Колода иллюзий',
  'Deck of Many Things': 'Колода многих вещей',
  'Cube of Force': 'Куб силы',
  'Cubic Gate': 'Кубические врата',
  'Dimensional Shackles': 'Пространственные кандалы',
  'Efreeti Bottle': 'Бутыль ифрита',
  'Elemental Gem': 'Самоцвет стихии',
  'Eversmoking Bottle': 'Бутыль вечного дыма',
  'Figurine of Wondrous Power': 'Статуэтка чудесной силы',
  'Folding Boat': 'Складная лодка',
  'Horn of Valhalla': 'Рог Вальхаллы',
  'Horseshoes of Speed': 'Подковы скорости',
  'Horseshoes of a Zephyr': 'Подковы зефира',
  'Ioun Stone': 'Камень айон',
  'Iron Bands of Bilarro': 'Железные обручи Биларро',
  'Lantern of Revealing': 'Фонарь обнаружения',
  'Marvelous Pigments': 'Чудесные пигменты',
  'Medallion of Thoughts': 'Медальон мыслей',
  'Necklace of Adaptation': 'Ожерелье приспособления',
  'Necklace of Fireballs': 'Ожерелье огненных шаров',
  'Necklace of Prayer Beads': 'Ожерелье молитвенных чёток',
  'Orb of Dragonkind': 'Сфера драконьей природы',
  'Periapt of Health': 'Амулет здоровья (периапт)',
  'Periapt of Proof against Poison': 'Амулет защиты от яда',
  'Pipe of Haunting': 'Трубка преследования',
  'Pipe of Smoke Monsters': 'Трубка дымовых чудовищ',
  'Restorative Ointment': 'Восстанавливающая мазь',
  'Rope of Climbing': 'Верёвка лазания',
  'Rope of Entanglement': 'Верёвка опутывания',
  'Sending Stones': 'Камни послания',
  'Slippers of Spider Climbing': 'Тапочки паучьего лазания',
  'Sovereign Glue': 'Властный клей',
  'Sphere of Annihilation': 'Сфера уничтожения',
  'Talisman of Pure Good': 'Талисман абсолютного добра',
  'Talisman of Ultimate Evil': 'Талисман высшего зла',
  'Talisman of the Sphere': 'Талисман сферы',
  'Universal Solvent': 'Универсальный растворитель',
  'Well of Many Worlds': 'Колодец многих миров',
  'Wind Fan': 'Веер ветра',
  'Arrow of Slaying': 'Стрела убийства',
  'Gem of Brightness': 'Самоцвет сияния',
  'Gem of Seeing': 'Самоцвет зрения',
  'Bead of Force': 'Жемчужина силы',
  'Dust of Disappearance': 'Пыль исчезновения',
  'Dust of Dryness': 'Пыль сушки',
  'Dust of Sneezing and Choking': 'Пыль чихания и удушья',
  'Feather Token': 'Перо-жетон',
  'Quaal\'s Feather Token': 'Перо-жетон Каала',
  'Dagger of Venom': 'Кинжал яда',
  'Dancing Sword': 'Танцующий меч',
  'Defender': 'Защитник',
  'Dragon Slayer': 'Драконоборец',
  'Dwarven Thrower': 'Метатель дуэргаров',
  'Flame Tongue': 'Пылающий клинок',
  'Frost Brand': 'Морозная метка',
  'Giant Slayer': 'Убийца великанов',
  'Hammer of Thunderbolts': 'Молот молний',
  'Holy Avenger': 'Святой мститель',
  'Horn of Blasting': 'Рог разрушения',
  'Javelin of Lightning': 'Копьё молнии',
  'Luck Blade': 'Клинок удачи',
  'Mace of Disruption': 'Булава разрушения',
  'Mace of Smiting': 'Булава крушения',
  'Mace of Terror': 'Булава ужаса',
  'Nine Lives Stealer': 'Похититель девяти жизней',
  'Oathbow': 'Клятвенный лук',
  'Scimitar of Speed': 'Скимитар скорости',
  'Sun Blade': 'Солнечный клинок',
  'Sword of Life Stealing': 'Меч похищения жизни',
  'Sword of Sharpness': 'Меч остроты',
  'Sword of Wounding': 'Меч ранения',
  'Trident of Fish Command': 'Трезубец повеления рыбами',
  'Vicious Weapon': 'Злобное оружие',
  'Vorpal Sword': 'Ворпальный меч',
  'Animated Shield': 'Оживленный щит',
  'Arrow-catching Shield': 'Щит ловли стрел',
  'Spellguard Shield': 'Щит защиты от заклинаний',
  'Armor, +1': 'Доспех +1',
  'Armor, +2': 'Доспех +2',
  'Armor, +3': 'Доспех +3',
  'Armor of Invulnerability': 'Доспех неуязвимости',
  'Armor of Resistance': 'Доспех сопротивления',
  'Armor of Vulnerability': 'Доспех уязвимости',
  'Elven Chain': 'Эльфийская кольчуга',
  'Adamantine Armor': 'Адамантитовые доспехи',
  'Mithral Armor': 'Мифриловые доспехи',
  'Shield, +1': 'Щит +1',
  'Shield, +2': 'Щит +2',
  'Shield, +3': 'Щит +3',
  'Weapon, +1': 'Оружие +1',
  'Weapon, +2': 'Оружие +2',
  'Weapon, +3': 'Оружие +3',
  'Ammunition, +1': 'Боеприпасы +1',
  'Ammunition, +2': 'Боеприпасы +2',
  'Ammunition, +3': 'Боеприпасы +3',
  'Silvered Weapon': 'Серебряное оружие',
  'Apparatus of the Crab': 'Механизм краба',
  'Bowl of Commanding Water Elementals': 'Чаша повеления водными элементалями',
  'Brazier of Commanding Fire Elementals': 'Жаровня повеления огненными элементалями',
  'Censer of Controlling Air Elementals': 'Кадило управления воздушными элементалями',
  'Stone of Controlling Earth Elementals': 'Камень управления земными элементалями',
  'Crystal Ball': 'Хрустальный шар',
  'Driftglobe': 'Плывущий шар',
  'Dwarven Plate': 'Дуэргарские латы',
  'Eyes of Charming': 'Глаза очарования',
  'Eyes of Minute Seeing': 'Глаза мельчайшего зрения',
  'Eyes of the Eagle': 'Глаза орла',
  'Helm of Brilliance': 'Шлем сияния',
  'Helm of Comprehending Languages': 'Шлем понимания языков',
  'Helm of Telepathy': 'Шлем телепатии',
  'Helm of Teleportation': 'Шлем телепортации',
  'Instrument of the Bards': 'Инструмент бардов',
  'Ioun Stone of Absorption': 'Камень айон: поглощение',
  'Ioun Stone of Agility': 'Камень айон: ловкость',
  'Ioun Stone of Awareness': 'Камень айон: осведомлённость',
  'Ioun Stone of Fortitude': 'Камень айон: стойкость',
  'Ioun Stone of Greater Absorption': 'Камень айон: великое поглощение',
  'Ioun Stone of Insight': 'Камень айон: прозорливость',
  'Ioun Stone of Intellect': 'Камень айон: интеллект',
  'Ioun Stone of Leadership': 'Камень айон: лидерство',
  'Ioun Stone of Mastery': 'Камень айон: мастерство',
  'Ioun Stone of Protection': 'Камень айон: защита',
  'Ioun Stone of Regeneration': 'Камень айон: регенерация',
  'Ioun Stone of Reserve': 'Камень айон: резерв',
  'Ioun Stone of Strength': 'Камень айон: сила',
  'Ioun Stone of Sustenance': 'Камень айон: снабжение',
  'Manual of Bodily Health': 'Учебник телесного здоровья',
  'Manual of Gainful Exercise': 'Учебник полезных упражнений',
  'Manual of Golems': 'Учебник големов',
  'Manual of Quickness of Action': 'Учебник быстроты действия',
  'Tome of Clear Thought': 'Том ясной мысли',
  'Tome of Leadership and Influence': 'Том лидерства и влияния',
  'Tome of Understanding': 'Том понимания',
  'Tome of The Stilled Tongue': 'Том оцепеневшего языка',
  'Cape of the Mountebank': 'Плащ шарлатана',
  'Instrument of the Bards, Anstruth Harp': 'Инструмент бардов: арфа Анструта',
  'Instrument of the Bards, Canaith Mandolin': 'Инструмент бардов: мандолина Канаита',
  'Instrument of the Bards, Cli Lyre': 'Инструмент бардов: лира Кли',
  'Instrument of the Bards, Doss Lute': 'Инструмент бардов: лютня Досса',
  'Instrument of the Bards, Fochlucan Bandore': 'Инструмент бардов: бандора Фохлукана',
  'Instrument of the Bards, Mac-Fuirmidh Cittern': 'Инструмент бардов: циттер Мак-Фуирмида',
  'Instrument of the Bards, Ollamh Harp': 'Инструмент бардов: арфа Оллама',
  'Instrument of the Bards, Ruidluth Harp': 'Инструмент бардов: арфа Руидлута',
};

/** Частые слова в названиях (оружие, материалы) */
/** @type {Record<string, string>} */
const NAME_TOKEN_RU = {
  longsword: 'длинный меч',
  shortsword: 'короткий меч',
  greatsword: 'двуручный меч',
  rapier: 'рапира',
  scimitar: 'скимитар',
  dagger: 'кинжал',
  battleaxe: 'боевой топор',
  handaxe: 'ручной топор',
  greataxe: 'двуручный топор',
  warhammer: 'боевой молот',
  maul: 'молот',
  mace: 'булава',
  morningstar: 'моргенштерн',
  spear: 'копьё',
  trident: 'трезубец',
  glaive: 'глефа',
  halberd: 'алебарда',
  pike: 'пика',
  javelin: 'дротик',
  quarterstaff: 'боевой посох',
  crossbow: 'арбалет',
  'light crossbow': 'лёгкий арбалет',
  'heavy crossbow': 'тяжёлый арбалет',
  longbow: 'длинный лук',
  shortbow: 'короткий лук',
  sling: 'праща',
  blowgun: 'духовая трубка',
  whip: 'кнут',
  flail: 'цеп',
  warpick: 'кирка',
  sickle: 'серп',
  dart: 'дротик',
  net: 'сеть',
  shield: 'щит',
  armor: 'доспехи',
  plate: 'латы',
  chain: 'кольчуга',
  'chain mail': 'кольчуга',
  'scale mail': 'чешуйчатый доспех',
  'splint armor': 'пластинчатый доспех',
  'half plate': 'полулаты',
  'breastplate': 'кираса',
  'leather armor': 'кожаные доспехи',
  'studded leather': 'клёпаный кожаный доспех',
  'hide armor': 'шкурный доспех',
  hide: 'шкура',
  ring: 'кольцо',
  rod: 'скипетр',
  staff: 'посох',
  wand: 'жезл',
  potion: 'зелье',
  scroll: 'свиток',
  spell: 'заклинание',
  boots: 'сапоги',
  cloak: 'плащ',
  gloves: 'перчатки',
  gauntlets: 'рукавицы',
  belt: 'пояс',
  helmet: 'шлем',
  helm: 'шлем',
  hat: 'шляпа',
  circlet: 'диадема',
  crown: 'корона',
  robe: 'роба',
  horn: 'рог',
  gem: 'самоцвет',
  stone: 'камень',
  dust: 'пыль',
  oil: 'масло',
  elixir: 'эликсир',
  bag: 'мешок',
  box: 'ящик',
  cube: 'куб',
  figurine: 'статуэтка',
  weapon: 'оружие',
  ammunition: 'боеприпасы',
  arrow: 'стрела',
  bolt: 'болт',
  bullet: 'пуля',
  needle: 'игла',
  sword: 'меч',
  axe: 'топор',
  hammer: 'молот',
  bow: 'лук',
  of: '',
  the: '',
  a: '',
  an: '',
  and: 'и',
  or: 'или',
};

/**
 * @param {string} name
 * @param {string} slug
 * @param {Record<string, string>} [extraFromFile]
 */
export function translateMagicItemName(name, slug, extraFromFile = {}) {
  const n = String(name ?? '').trim();
  if (!n) return n;
  if (extraFromFile[n]) return extraFromFile[n];
  if (MAGIC_ITEM_NAME_RU[n]) return MAGIC_ITEM_NAME_RU[n];
  const mundaneRu = resolveMundaneGearRuExact(n);
  if (mundaneRu) return mundaneRu;

  /** «Scribe Spell Scroll — N»: не разбирать по токенам (иначе «Scroll» → свиток и ломается уровень). */
  const scribe = /^Scribe Spell Scroll — (Cantrip|\d+)$/i.exec(normalizeGearNameKey(n));
  if (scribe) {
    const lvl = scribe[1];
    const key =
      lvl.toLowerCase() === 'cantrip'
        ? 'Scribe Spell Scroll — Cantrip'
        : `Scribe Spell Scroll — ${lvl}`;
    const ru = resolveMundaneGearRuExact(key);
    if (ru) return ru;
  }

  const plus = n.match(/^(.*?)[,\s]+(\+[123])\s*$/);
  if (plus) {
    const base = plus[1].trim();
    const p = plus[2];
    const baseRu = MAGIC_ITEM_NAME_RU[base] ?? tokenTranslateTitle(base);
    return `${baseRu} ${p}`.trim();
  }

  const pot = /^Potion of (.+)$/i.exec(n);
  if (pot) {
    return `Зелье: ${tokenTranslateTitle(pot[1])}`;
  }
  const scr = /^Scroll of (.+)$/i.exec(n);
  if (scr) {
    return `Свиток: ${tokenTranslateTitle(scr[1])}`;
  }
  const wan = /^Wand of (.+)$/i.exec(n);
  if (wan) {
    return `Жезл: ${tokenTranslateTitle(wan[1])}`;
  }
  const stf = /^Staff of (.+)$/i.exec(n);
  if (stf) {
    return `Посох: ${tokenTranslateTitle(stf[1])}`;
  }
  const rng = /^Ring of (.+)$/i.exec(n);
  if (rng) {
    return `Кольцо: ${tokenTranslateTitle(rng[1])}`;
  }

  return tokenTranslateTitle(n);
}

/**
 * Если в `localization` нет строки — кириллическая подпись по токенам/транслитерации (имена монстров и т.п.).
 * @param {string} englishPhrase
 */
export function fallbackTransliterateEnglishTitle(englishPhrase) {
  return tokenTranslateTitle(String(englishPhrase ?? '').trim());
}

/**
 * Оставшийся латинский токен (имена вроде Hobgoblin) — в кириллицу по буквам для единообразия в отчётах.
 * @param {string} word
 */
function transliterateLatinToken(word) {
  const letters = word.replace(/[^a-zA-Z']/g, '');
  if (!letters || !/^[a-zA-Z']+$/.test(letters)) {
    return word;
  }
  /** @type {Record<string, string>} */
  const m = {
    a: 'а',
    b: 'б',
    c: 'к',
    d: 'д',
    e: 'е',
    f: 'ф',
    g: 'г',
    h: 'х',
    i: 'и',
    j: 'дж',
    k: 'к',
    l: 'л',
    m: 'м',
    n: 'н',
    o: 'о',
    p: 'п',
    q: 'к',
    r: 'р',
    s: 'с',
    t: 'т',
    u: 'у',
    v: 'в',
    w: 'в',
    x: 'кс',
    y: 'и',
    z: 'з',
  };
  const lower = letters.toLowerCase();
  let out = '';
  for (let i = 0; i < lower.length; i += 1) {
    const ch = lower[i];
    if (ch === "'") {
      out += 'ь';
      continue;
    }
    out += m[ch] ?? ch;
  }
  const cap = /^[A-Z]/.test(word);
  const t = cap ? out.charAt(0).toUpperCase() + out.slice(1) : out;
  return t;
}

/**
 * @param {string} phrase
 */
function tokenTranslateTitle(phrase) {
  const parts = phrase
    .replace(/['']/g, "'")
    .split(/[\s/]+/)
    .filter(Boolean);
  const out = [];
  for (const w of parts) {
    const key = w.replace(/[^a-zA-Z']/g, '').toLowerCase();
    if (key in NAME_TOKEN_RU) {
      const ru = NAME_TOKEN_RU[key];
      if (ru) out.push(ru);
    } else if (w.match(/^\d+$/) || w === '+' || w.startsWith('+')) {
      out.push(w);
    } else {
      out.push(transliterateLatinToken(w));
    }
  }
  const s = out.join(' ').replace(/\s+/g, ' ').trim();
  if (!s) return phrase;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Грубый перевод markdown-описания: фразы SRD + типичные заголовки.
 * @param {string} md
 */
export function translateItemDescriptionMd(md) {
  let s = String(md ?? '');
  if (!s.trim()) return s;

  /** @type {Array<[RegExp, string]>} */
  const pairs = [
    [/This magic weapon has/gi, 'Это магическое оружие имеет'],
    [/This magic weapon can/gi, 'Это магическое оружие может'],
    [/This магическое оружие/gi, 'Это магическое оружие'],
    [/Это магическое оружие has/gi, 'Это магическое оружие имеет'],
    [/Это магическое оружие can/gi, 'Это магическое оружие может'],
    [/and it regains/gi, 'оно восстанавливает'],
    [/expended charges? daily at dawn/gi, 'потраченные заряды ежедневно на рассвете'],
    [/expended заряд daily at рассвет/gi, 'потраченные заряды ежедневно на рассвете'],
    [/While you carry it/gi, 'Пока вы несёте его'],
    [/you can expend 1 charge to cast/gi, 'вы можете потратить 1 заряд, чтобы наложить'],
    [/you can expend 1 заряд to cast/gi, 'вы можете потратить 1 заряд, чтобы наложить'],
    [/you can expend 1 заряд/gi, 'вы можете потратить 1 заряд'],
    [/\*\*Attunement\*\*/gi, '**Настройка**'],
    [/\*\*Attunement Required\*\*/gi, '**Требуется настройка**'],
    [/\*\*Curse\*\*/gi, '**Проклятие**'],
    [/\*\*Properties\*\*/gi, '**Свойства**'],
    [/\*\*Description\*\*/gi, '**Описание**'],
    [/While (?:you are )?attuned to this/gi, 'Пока вы настроены на этот предмет'],
    [/While attuned to it/gi, 'Пока вы настроены на него'],
    [/While wearing this/gi, 'Пока вы носите этот предмет'],
    [/While holding this/gi, 'Пока вы держите этот предмет'],
    [/While carried on your person/gi, 'Пока предмет находится при вас'],
    [/You can use an action/gi, 'Вы можете действием'],
    [/You can use a bonus action/gi, 'Вы можете бонусным действием'],
    [/As an action/gi, 'Действием'],
    [/You gain a \+(\d) bonus/gi, 'Вы получаете бонус +$1'],
    [/You gain a bonus/gi, 'Вы получаете бонус'],
    [/You have advantage/gi, 'У вас есть преимущество'],
    [/You have resistance/gi, 'У вас есть сопротивление'],
    [/You have immunity/gi, 'У вас есть иммунитет'],
    [/You can speak/gi, 'Вы можете говорить'],
    [/You can breathe/gi, 'Вы можете дышать'],
    [/You can cast/gi, 'Вы можете накладывать'],
    [/You know the/gi, 'Вы знаете'],
    [/This (?:item|weapon|armor|shield|ring|wand|staff|rod|potion|scroll) has/gi, 'Этот предмет имеет'],
    [/This (?:item|weapon|armor|shield|ring|wand|staff|rod|potion|scroll) can/gi, 'Этот предмет может'],
    [/The (?:item|weapon|armor|shield|ring|wand|staff|rod|potion|scroll) has/gi, 'Предмет имеет'],
    [/The (?:item|weapon|armor|shield|ring|wand|staff|rod|potion|scroll) can/gi, 'Предмет может'],
    [/If you remove/gi, 'Если вы снимаете'],
    [/If you die/gi, 'Если вы умираете'],
    [/If you are/gi, 'Если вы'],
    [/Once per/gi, 'Один раз за'],
    [/At will/gi, 'По желанию'],
    [/Charges?\b/gi, 'заряд'],
    [/Expend (?:one |1 )?charge/gi, 'Потратьте 1 заряд'],
    [/Regains (?:\d+|1d\d\+\d+) charges?/gi, 'Восстанавливает заряды'],
    [/Requires attunement/gi, 'Требует настройки'],
    [/by a spellcaster/gi, 'заклинателем'],
    [/by a creature/gi, 'существом'],
    [/Hit points?/gi, 'хиты'],
    [/Armor Class/gi, 'Класс доспеха'],
    [/Saving throw/gi, 'спасбросок'],
    [/Dexterity saving throw/gi, 'спасбросок Ловкости'],
    [/Constitution saving throw/gi, 'спасбросок Телосложения'],
    [/Wisdom saving throw/gi, 'спасбросок Мудрости'],
    [/Strength saving throw/gi, 'спасбросок Силы'],
    [/Charisma saving throw/gi, 'спасбросок Харизмы'],
    [/Intelligence saving throw/gi, 'спасбросок Интеллекта'],
    [/Creature/gi, 'существо'],
    [/creatures?/gi, 'существа'],
    [/Undead/gi, 'Нежить'],
    [/Humanoid/gi, 'Гуманоид'],
    [/Fiend/gi, 'Исчадие'],
    [/Celestial/gi, 'Небожитель'],
    [/Elemental/gi, 'Элементаль'],
    [/Fey/gi, 'Фея'],
    [/Aberration/gi, 'Аберрация'],
    [/Construct/gi, 'Конструкт'],
    [/Dragon/gi, 'Дракон'],
    [/Giant/gi, 'Великан'],
    [/Monstrosity/gi, 'Чудовище'],
    [/Ooze/gi, 'Слизь'],
    [/Plant/gi, 'Растение'],
    [/Beast/gi, 'Зверь'],
    [/Within \d+ feet/gi, 'В пределах указанного расстояния'],
    [/within \d+ feet/gi, 'в пределах указанного расстояния'],
    [/feet/gi, 'фт'],
    [/foot radius/gi, 'фт радиуса'],
    [/long rest/gi, 'долгий отдых'],
    [/short rest/gi, 'короткий отдых'],
    [/Dawn/gi, 'рассвет'],
    [/Dusk/gi, 'закат'],
    [/Magic weapon/gi, 'магическое оружие'],
    [/Magic ammunition/gi, 'магические боеприпасы'],
    [/Uncommon/gi, 'Необычный'],
    [/Rare/gi, 'Редкий'],
    [/Very rare/gi, 'Очень редкий'],
    [/Legendary/gi, 'Легендарный'],
    [/Artifact/gi, 'Артефакт'],
    [/Common/gi, 'Обычный'],
    [/Bonus action/gi, 'бонусное действие'],
    [/Reaction/gi, 'реакция'],
    [/reaction/gi, 'реакция'],
    [/Concentration/gi, 'концентрация'],
    [/Duration:/gi, 'Длительность:'],
    [/Range:/gi, 'Дистанция:'],
    [/Weight:/gi, 'Вес:'],
  ];

  for (const [re, repl] of pairs) {
    s = s.replace(re, repl);
  }

  return s;
}
