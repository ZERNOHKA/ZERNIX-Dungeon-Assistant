import { normalizeWorldState, rollWorldState } from './loot-generator-55.mjs';

/**
 * @typedef {'day'|'night'|'storm'} WorldStateId
 */

/**
 * @typedef {{
 *   id: string,
 *   labelRu: string,
 *   fragments: string[],
 *   preferredWorld: WorldStateId | null,
 *   narrativeHintRu: string,
 *   locations: string[],
 *   atmosphere: Record<WorldStateId, string[]>,
 *   dangers: string[],
 *   hooks: string[],
 *   titleSeeds: string[],
 *   contentTags: string[],
 *   excludedTags?: string[],
 *   narrativeLootHints?: string[],
 * }} SceneTheme
 */

/** @type {SceneTheme[]} */
export const SCENE_THEMES = [
  {
    id: 'storm_magic',
    labelRu: 'Буря и дикая магия',
    fragments: ['elemental', 'druid', 'priest', 'mage', 'air', 'thunder'],
    preferredWorld: 'storm',
    narrativeHintRu: 'гроза, молнии, дикая магия стихии, запах озона',
    locations: [
      'Разрушенная часовня на холме',
      'Старый маяк на скалистом мысе',
      'Полуразрушенный мост через ущелье',
      'Заброшенный склад у причала',
    ],
    atmosphere: {
      day: [
        'Свирепый ветер, хлопают ставни, в воздухе металлический привкус',
        'Тяжёлые тучи, редкие вспышки на горизонте, сырая солома',
      ],
      night: [
        'Порывы ветра гасят факелы, далёкий раскат грома',
        'Мокрый камень блестит в редкой молнии, шорох по крышам',
      ],
      storm: [
        'Ливень, вспышки молний на каждом шагу, запах озона и мокрого камня',
        'Небо рвётся зигзагами, фонари гаснут и вновь загораются',
      ],
    },
    dangers: [
      'Резкий разряд — на миг слышны голоса там, где никого нет',
      'Металлические перила ведут ток; касание — онемение и промах',
      'Порыв срывает опору: доски уходят под ногами в пустоту',
    ],
    hooks: [
      'Кто-то пытался скрыть следы опасного эксперимента с молнией',
      'Местные шепчутся о «голосе в грозе», который зовёт по имени',
      'Старый ритуальный круг снова тлеет — будто его только что гасили',
    ],
    titleSeeds: ['Гроза над воротами', 'Молчание после удара', 'Озон у воды'],
    contentTags: ['elemental', 'storm', 'horror', 'laboratory', 'priest'],
    excludedTags: [],
    narrativeLootHints: [
      'обугленный жезл с выжженной руной',
      'дневник метеоролога — последняя запись обрывается на слове «слушай…»',
      'жетон гильдии стихийных жрецов, расплавившийся по краю',
    ],
  },
  {
    id: 'cult_ritual',
    labelRu: 'Культ и тайный ритуал',
    fragments: ['cultist', 'priest', 'fiend', 'humanoid', 'acolyte', 'fanatic'],
    preferredWorld: 'night',
    narrativeHintRu: 'тайный культ, ритуал, жертвенник, шёпот молитв',
    locations: [
      'Подвал гильдии под старым рынком',
      'Заброшенная часовня за чертой города',
      'Катакомбы под склепом знатного рода',
    ],
    atmosphere: {
      day: [
        'Слабый дневной свет в щелях, пахнет ладаном и пылью',
        'Тихие коридоры, на стенах свежие царапины когтем',
      ],
      night: [
        'Тонкие свечи, дрожащие тени, далёкий перезвон цепей',
        'Влажный холод и тишина, нарушаемая каплями воды',
      ],
      storm: [
        'Свечи трещат от порывов, с потолка течёт ржавая вода',
        'Гул бури над сводами смешивается с низким пением',
      ],
    },
    dangers: [
      'Свечной воск тает не туда — на полу символ, который «ползёт» к шагам',
      'Низкий гул из-под плиты; воздух густеет, как перед обмороком',
      'Тени свечей сходятся к одному силуэту — но его нет в комнате',
    ],
    hooks: [
      'Пропал ребёнок из нижнего квартала в ту же ночь, что и «благословение»',
      'Стража получила взятку — но кто-то всё равно оставил знак предупреждения',
      'На жертвеннике свежие следы — ритуал прервали всего час назад',
    ],
    titleSeeds: ['Тени у алтаря', 'Ночной обет', 'Красная свеча'],
    contentTags: ['cult', 'fiend', 'humanoid', 'horror', 'crypt'],
    excludedTags: [],
    narrativeLootHints: [
      'осколок алтарной плиты с ещё тёплой сажей',
      'лист с именами — одна строка стёрта до дыр',
      'перстень с резным демоном; пальцы чернеют от касания',
    ],
  },
  {
    id: 'plague_outbreak',
    labelRu: 'Чума и зараза',
    fragments: ['swarm', 'ooze', 'plant', 'undead', 'rat'],
    preferredWorld: null,
    narrativeHintRu: 'чума, гниль, зараза, изоляция, страх',
    locations: [
      'Запертый квартал у канализации',
      'Полевой лазарет у старых ворот',
      'Склад с контрабандой «лекарств»',
    ],
    atmosphere: {
      day: [
        'Белые маски, редкие прохожие, запах уксуса и гари',
        'Пустынные улицы и заколоченные окна',
      ],
      night: [
        'Тихий шорох по мостовой — кто-то тащит тело на носилках',
        'Тусклые фонари, в тени — движение без звука шагов',
      ],
      storm: [
        'Ливень смешивает грязь и зелья, стёкла лазарета запотели',
        'Гром заглушает кашель за стеной — кажется, город задыхается',
      ],
    },
    dangers: [
      'Пар над лужицей искажает контуры — союзник кажется чужим на мгновение',
      'Слышны шаги за стеной, которой нет на плане',
      'Запах лекарства слишком сладок; язык немеет, слова путаются',
    ],
    hooks: [
      'Кто-то продаёт «панацею» за золото — слишком дорого для простой лжи',
      'Печать на двери лазарета снята изнутри',
      'Странный груз увезли на рассвете — без каравана и без шума',
    ],
    titleSeeds: ['Зелёная метка', 'Запах лжи', 'Закрытый двор'],
    contentTags: ['plague', 'ooze', 'swarm', 'undead', 'horror'],
    excludedTags: ['celestial'],
    narrativeLootHints: [
      'пробирка с мутной сывороткой и печатью карантина',
      'санитарный журнал с вырванными страницами',
      'жетон скорой помощи — на обороте чужая клятва',
    ],
  },
  {
    id: 'undead_activity',
    labelRu: 'Нежить и склеп',
    fragments: ['undead', 'skeleton', 'zombie', 'ghost', 'wight', 'ghoul'],
    preferredWorld: 'night',
    narrativeHintRu: 'нежить, склеп, холод, шёпот костей',
    locations: [
      'Древний склеп под храмом',
      'Руины усыпальницы на окраине',
      'Затопленный зал с саркофагами',
    ],
    atmosphere: {
      day: [
        'Холодный воздух, пыль в лучах, тишина слишком плотная',
        'Слабый дневной свет не прогоняет мглу у пола',
      ],
      night: [
        'Факелы трещат, тени длиннее здравого смысла',
        'Слышен шорох там, где никого нет',
      ],
      storm: [
        'Вода течёт по ступеням вниз, кости стучат под ногами',
        'Молнии на миг выхватывают пустые глазницы статуй',
      ],
    },
    dangers: [
      'Холод настолько силён, что пальцы немеют — промах легче',
      'Тишина «давит» на уши; собственный пульс кажется чужим',
      'В зеркальной луже отражение оборачивается на долю секунды позже вас',
    ],
    hooks: [
      'Свежие цветы на могиле, которой сто лет',
      'Кто-то оставил цепь у входа — как будто ждал компанию',
      'Странный гул из глубины — не ветер и не вода',
    ],
    titleSeeds: ['Белый перстень', 'Холод у двери', 'След без сапога'],
    contentTags: ['undead', 'crypt', 'horror'],
    excludedTags: ['celestial'],
    narrativeLootHints: [
      'свежий перстень на кости в грязи',
      'костяной свисток — при дуновении тянет в грудь холодом',
      'записка: «не зажигай огонь у третьей ниши»',
    ],
  },
  {
    id: 'smuggling_operation',
    labelRu: 'Контрабанда и тайные сделки',
    fragments: ['bandit', 'pirate', 'spy', 'rogue', 'humanoid', 'thug'],
    preferredWorld: 'night',
    narrativeHintRu: 'контрабанда, тайник, сделка ночью, ложные документы',
    locations: [
      'Таверна «Три якоря» у причала',
      'Старый склад таможни',
      'Узкий переулок за рынком специй',
    ],
    atmosphere: {
      day: [
        'Шум docks, чайки, запах рыбы и смолы',
        'Торговцы кричат, но у задней двери слишком тихо',
      ],
      night: [
        'Тусклые фонари, брызги воды у свай, редкий стук бочек',
        'Запах табака и рома — и чужой шаг, слишком ровный',
      ],
      storm: [
        'Ливень скрывает грузовую баржу у пирса',
        'Мокрый камень, пустые улицы — идеальная ночь для переброски',
      ],
    },
    dangers: [
      'Туман от мокрой древесины — силуэты «догоняют» взгляд на шаг позже',
      'Скользкие мостки: под ногами чужой шаг, но вы идёте врозь',
      'Груз, закреплённый наспех — канат натянут на уровне глаз',
    ],
    hooks: [
      'Кто-то покинул лагерь всего пару минут назад',
      'Документы подделаны хорошо — но печать не та',
      'В ящике нашли карту с отметкой «без свидетелей»',
    ],
    titleSeeds: ['Соль и сталь', 'Чужой груз', 'Тихий причал'],
    contentTags: ['criminal', 'smuggling', 'humanoid', 'noble'],
    excludedTags: [],
    narrativeLootHints: [
      'ложные таможенные бланки в вощёной ткани',
      'ключ от люка без номера',
      'сургучная печать — оттиск не совпадает с гербом города',
    ],
  },
  {
    id: 'cursed_relics',
    labelRu: 'Проклятые реликвии',
    fragments: ['wraith', 'specter', 'ghost', 'mummy', 'cultist', 'priest'],
    preferredWorld: null,
    narrativeHintRu: 'проклятая реликвия, жадность, древняя клятва',
    locations: [
      'Зал реликвария под собором',
      'Дом коллекционера с запертым крылом',
      'Руины башни архимага',
    ],
    atmosphere: {
      day: [
        'Пыль в лучах, тяжёлый запах воска и старого дерева',
        'Тишина, в которой слышно собственное сердце',
      ],
      night: [
        'Свечи горят ровно слишком долго',
        'Металл на ощупь ледяной, хотя в комнате тепло',
      ],
      storm: [
        'Вспышки молний на миг выхватывают золото на полке — и кажется, оно дышит',
        'Дождь стучит в витражи, тени двигаются сами по себе',
      ],
    },
    dangers: [
      'Реликвия «тянет» руку — будто хочет остаться с вами',
      'Золото в луче света «дышит»; взгляд застревает, время течёт быстрее',
      'Древняя ловушка: нажатие плиты без щелчка — и тишина слишком ровная',
    ],
    hooks: [
      'Кто-то уже пытался уничтожить реликвию — следы обрываются на полуслове',
      'Ключ найден в кармане мёртвого — но дверь открыта',
      'Надпись на саркофаге свежая — хотя пыль столетий',
    ],
    titleSeeds: ['Проклятые реликвии', 'Золото, что помнит', 'Сухая клятва'],
    contentTags: ['undead', 'horror', 'cult', 'crypt', 'fiend'],
    excludedTags: [],
    narrativeLootHints: [
      'реликварий с пустой подушкой — след круглого предмета',
      'пергамент с клятвой, бумага всё ещё тёплая',
      'чёрная нить, обмотанная вокруг пальца статуи',
    ],
  },
  {
    id: 'noble_conspiracy',
    labelRu: 'Заговор знати',
    fragments: ['knight', 'guard', 'spy', 'assassin', 'humanoid', 'noble'],
    preferredWorld: 'day',
    narrativeHintRu: 'интриги двора, шантаж, фальшивые приказы',
    locations: [
      'Городской дворец — западное крыло',
      'Частный салон над банком',
      'Охотничий домик за городом',
    ],
    atmosphere: {
      day: [
        'Полированный паркет, запах чернил и духов',
        'Слуги расступаются — слишком быстро, слишком вежливо',
      ],
      night: [
        'Тихие ковры, приглушённые шаги, свет под дверью кабинета',
        'Карета без герба ждёт у бокового выхода',
      ],
      storm: [
        'Дождь барабанит по стёклам, внутри — разговоры шёпотом',
        'Мокрые плащи у входа, но один пустой вешак',
      ],
    },
    dangers: [
      'Ложное обвинение — стража придёт за минуту, если поднимете шум',
      'Дуэльная шпага на столе — слишком близко к пергаменту с печатью',
      'Яд в бокале: запах почти скрыт мёдом — и слишком «правильный» свет в зале',
    ],
    hooks: [
      'Перстень на столе совпадает с печатью на секретном письме',
      'Слуга исчез вместе с ключом от архива',
      'В гостевой книге чужая подпись — но почерк вашего покровителя',
    ],
    titleSeeds: ['Маскарад', 'Печать и кровь', 'Тихий указ'],
    contentTags: ['noble', 'conspiracy', 'humanoid', 'criminal'],
    excludedTags: ['ooze', 'plant', 'beast'],
    narrativeLootHints: [
      'перстень-печать с чужим гербом',
      'заклеенное письмо без адресата',
      'выцветший билет на маскарад — номер совпадает с датой смерти',
    ],
  },
  {
    id: 'abandoned_laboratory',
    labelRu: 'Заброшенная лаборатория',
    fragments: ['ooze', 'construct', 'homunculus', 'mage', 'elemental'],
    preferredWorld: null,
    narrativeHintRu: 'алхимия, реагенты, сломанные механизмы, эксперимент',
    locations: [
      'Подземная лаборатория алхимика',
      'Башня с оплавленными ступенями',
      'Старый университетский подвал',
    ],
    atmosphere: {
      day: [
        'Запах кислоты и озона, на полу разбитая колба',
        'Слабый свет из щелей, пыль парит в лучах',
      ],
      night: [
        'Тусклая лампа качается на цепи, тени аппаратов как звери',
        'Тиканье механизма без источника',
      ],
      storm: [
        'Молния бьёт в штырь на крыше — внизу вибрируют стеклянные колбы',
        'Дождь протекает сквозь крышу на рабочий стол',
      ],
    },
    dangers: [
      'Лёгкий пар от трещины в реторте — в поле зрения «двоятся» лица',
      'Разлитое масло отражает не ту комнату на долю секунды',
      'Незаземлённый шар: волосы дыбом, в ушах звон, как перед обмороком',
    ],
    hooks: [
      'Записи обрываются на фразе «не открывать после заката»',
      'Клетка пуста — а цепь лежит аккуратной кольцом',
      'Свежий след сапога в пыли, ведущий к запертой двери',
    ],
    titleSeeds: ['Зелёное стекло', 'Последняя запись', 'Сухой пар'],
    contentTags: ['laboratory', 'ooze', 'construct', 'aberration', 'elemental'],
    excludedTags: ['druid', 'fey'],
    narrativeLootHints: [
      'этикетка на флаконе: «не вдыхать после заката»',
      'рабочий стол: пепел в форме человеческой ладони',
      'демонстрационная проволока — вся в искрах',
    ],
  },
];

const THEME_BY_ID = new Map(SCENE_THEMES.map((t) => [t.id, t]));

/**
 * @param {string} text
 * @returns {string|null}
 */
export function inferSceneThemeIdFromText(text) {
  const n = String(text ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е');
  if (!n.trim()) return null;
  /** @type {Array<{ id: string, re: RegExp }>} */
  const rules = [
    { id: 'storm_magic', re: /шторм|гроз|молни|буря|ozone|storm|lightning|стихи[яи]/i },
    { id: 'cult_ritual', re: /культ|ритуал|жертвопринош|алтар|sect|cult/i },
    { id: 'plague_outbreak', re: /чум|эпидем|зараз|чума|plague|pestilence/i },
    { id: 'undead_activity', re: /нежит|склеп|зомби|скелет|привид|undead|necro|tomb/i },
    { id: 'smuggling_operation', re: /контрабанд|тайник|контрабанда|smuggl|dock|причал|бандит/i },
    { id: 'cursed_relics', re: /проклят|реликв|артефакт|curse|relic/i },
    { id: 'noble_conspiracy', re: /двор|знать|интриг|заговор|noble|court|шантаж/i },
    { id: 'abandoned_laboratory', re: /лаборатор|алхим|реторт|эксперимент|laboratory|alchemy|аркан|arcane/i },
  ];
  for (const { id, re } of rules) {
    if (re.test(n)) return id;
  }
  return null;
}

/**
 * @param {() => number} rng
 * @param {string} environmentText
 * @returns {SceneTheme}
 */
export function pickSceneTheme(rng, environmentText) {
  const inferred = inferSceneThemeIdFromText(environmentText);
  if (inferred && THEME_BY_ID.has(inferred)) {
    return /** @type {SceneTheme} */ (THEME_BY_ID.get(inferred));
  }
  return SCENE_THEMES[Math.floor(rng() * SCENE_THEMES.length)];
}

/**
 * @param {SceneTheme} theme
 * @param {string[]} userFragments
 * @param {number} [max]
 * @returns {string[]}
 */
export function mergeThemeKeywordFragments(theme, userFragments, max = 8) {
  const out = [];
  const seen = new Set();
  for (const f of [...theme.fragments, ...userFragments]) {
    const t = String(f).trim();
    const k = t.toLowerCase();
    if (k.length < 2) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * @param {SceneTheme} theme
 * @param {'day'|'night'|'storm'|null|undefined} explicitWorldState
 * @param {() => number} rng
 * @returns {'day'|'night'|'storm'}
 */
export function resolveThematicWorldState(theme, explicitWorldState, rng) {
  const norm = normalizeWorldState(explicitWorldState);
  if (norm) return norm;
  if (theme.preferredWorld && rng() < 0.68) return theme.preferredWorld;
  return rollWorldState(rng);
}

/**
 * @param {string[]} arr
 * @param {() => number} rng
 */
export function pickFrom(arr, rng) {
  const a = Array.isArray(arr) ? arr.filter((x) => String(x).trim().length > 0) : [];
  if (!a.length) return '';
  return a[Math.floor(rng() * a.length)];
}

/**
 * Детерминированный выбор варианта (без RNG) — разнообразие по seed сессии.
 *
 * @param {string[]} arr
 * @param {string} seed
 */
export function pickDeterministicFrom(arr, seed) {
  const a = Array.isArray(arr) ? arr.filter((x) => String(x).trim().length > 0) : [];
  if (!a.length) return '';
  let h = 2166136261;
  const s = String(seed || 'x');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return a[(h >>> 0) % a.length];
}

/**
 * @param {SceneTheme} theme
 * @param {'day'|'night'|'storm'} ws
 * @param {string} seed
 */
export function pickThematicAtmosphereDeterministic(theme, ws, seed) {
  const bucket = theme.atmosphere[ws] || theme.atmosphere.night || theme.atmosphere.day || [];
  const lines = bucket.filter((x) => String(x).trim().length > 0);
  if (!lines.length) return 'Плотная тишина и чужой след на пыли';
  return pickDeterministicFrom(lines, `${theme.id}|${ws}|${seed}`);
}

/**
 * @param {SceneTheme} theme
 * @param {'day'|'night'|'storm'} ws
 * @param {() => number} rng
 */
export function pickThematicAtmosphere(theme, ws, rng) {
  const bucket = theme.atmosphere[ws] || theme.atmosphere.night || theme.atmosphere.day || [];
  const line = pickFrom(bucket, rng);
  return line || 'Плотная тишина и чужой след на пыли';
}

/**
 * @param {SceneTheme} theme
 * @param {string} userText
 * @param {number} [maxLen]
 */
export function buildThematicEncounterExtraText(theme, userText, maxLen = 260) {
  const u = String(userText ?? '').trim();
  const hint = theme.narrativeHintRu.trim();
  const s = [u, hint].filter(Boolean).join(' · ').replace(/\s+/g, ' ').trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}
