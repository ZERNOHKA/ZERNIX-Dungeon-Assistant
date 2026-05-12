import type { AppContentJson, NpcPortrait } from "../types/content";

/** Сводка цен из npc-engine (сумма явных зм/см в строках услуг). */
export interface NpcPricingRollup {
  totalZm: number;
  totalSm: number;
  totalCostZm?: number;
}

export interface ResolvedNpcCard {
  /** Имя (личное) */
  name: string;
  /** Прозвище: прилагательное + существительное */
  epithet: string;
  raceRu: string;
  genderRu: string;
  /** Подпись роли из UI (например «Наставник») */
  roleLabelRu: string;
  occupationRu: string;
  /** Родовая подпись профессии из движка (например «кузнец» / «кузнеца» контекстно). */
  professionLabelRu?: string;
  /** Категория: Ремесло / Интеллект / Услуги / Криминал */
  professionCategoryLabelRu?: string;
  /** Строка специализации («Кузнец: заточка клинков»). */
  specializationLine?: string;
  appearance: string;
  manner: string;
  motivation: string;
  secret: string;
  /** Вступительная реплика по мотивации */
  catchphrase: string;
  inventory: string;
  portrait: string;
  /** Полный Markdown из npc-engine (Electron). */
  markdownFull?: string;
  pricingRollup?: NpcPricingRollup;
  /** Отношение к партии (из движка). */
  dispositionLabelRu?: string;
  /** Социальная роль к героям — пояснение. */
  socialStakeLine?: string;
  /** Хобби, контрастирующее с профессией */
  hobbyEclectic?: string;
  /** Короткая строка «где найти сейчас» */
  whereToFindNow?: string;
  /** Крючок про ремесло / руки / отношение к сломанным вещам */
  craftsmanshipNarrativeHook?: string;
  /** Ориентир ремонта (оружие), из calculateServicePrice */
  repairWeaponSummaryRu?: string;
  /** Ориентир ремонта (магический предмет) */
  repairMagicItemSummaryRu?: string;
}

export interface NpcSummonForm {
  race: string;
  occupationValue: string;
  role: string;
  genderId: string;
}

/** Подписи карточки NPC (UI и шаринг). */
export const NPC_CARD_LABEL_RU = {
  name: "Имя",
  race: "Раса",
  role: "Роль",
  occupation: "Занятие",
  appearance: "Облик",
  manner: "Манера",
  quote: "Цитата",
  motivation: "Мотивация",
  secret: "Тайна",
  inventory: "Имущество",
} as const;

const RACE_VALUE_FALLBACK_RU: Record<string, string> = {
  human: "Человек",
  elf: "Эльф",
  dwarf: "Дварф",
  halfling: "Полурослик",
  dragonborn: "Драконорождённый",
  tiefling: "Тифлинг",
  gnome: "Гном",
  orc: "Орк",
  goliath: "Голиаф",
  aasimar: "Аасимар",
};

const ROLE_VALUE_FALLBACK_RU: Record<string, string> = {
  ally: "Союзник",
  rival: "Соперник",
  mentor: "Наставник",
  villain: "Злодей",
};

const OCCUPATION_VALUE_FALLBACK_RU: Record<string, string> = {
  merchant: "Торговец",
  scholar: "Учёный",
  craftsman: "Ремесленник",
  guard: "Страж",
  rogue: "Авантюрист",
};

/** Значение занятия из UI → id профессии в npc-engine.mjs */
const OCCUPATION_TO_ENGINE_PROFESSION_ID: Record<string, string> = {
  merchant: "merchant",
  scholar: "sage",
  craftsman: "blacksmith",
  guard: "mercenary",
  rogue: "fence",
};

type StyleBucket = "intellectual" | "working" | "general";
type NpcTraitGroup = "social" | "combat" | "science" | "shadow";

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)] ?? arr[0];
}

function resolveStyleBucket(occupationValue: string, roleValue: string): StyleBucket {
  if (roleValue === "mentor" || occupationValue === "scholar") return "intellectual";
  if (occupationValue === "craftsman") return "working";
  return "general";
}

function resolveTraitFocus(occupationValue: string, roleValue: string): NpcTraitGroup[] {
  const role = String(roleValue || "").toLowerCase();
  const occupation = String(occupationValue || "").toLowerCase();
  if (occupation === "merchant" || role.includes("merchant") || role.includes("trader")) {
    return ["social", "shadow", "science", "combat"];
  }
  if (
    occupation === "scholar" ||
    role === "mentor" ||
    role.includes("scholar") ||
    role.includes("sage") ||
    role.includes("scient")
  ) {
    return ["science", "social", "shadow", "combat"];
  }
  if (occupation === "guard" || role.includes("guard") || role.includes("warrior")) {
    return ["combat", "social", "shadow", "science"];
  }
  if (occupation === "rogue" || role.includes("spy") || role.includes("thief")) {
    return ["shadow", "social", "combat", "science"];
  }
  return ["social", "combat", "science", "shadow"];
}

/** Грубые / цеховые манеры, неуместные для «учёного» образа без тега грубости. */
const ROUGH_MANNER_RE =
  /плюёт|плев|сплевы|жу[её]т\s+(зубочист|гвозд)|матом|ругается\s+грязн|блю[её]т|харк/i;

function personaAllowsRoughManner(roleValue: string, occupationValue: string): boolean {
  const r = String(roleValue || "").toLowerCase();
  const o = String(occupationValue || "").toLowerCase();
  return (
    r.includes("rough") ||
    r.includes("бандит") ||
    r.includes("brute") ||
    o === "rogue" ||
    o === "craftsman" ||
    o === "guard"
  );
}

function refineMannerForPersona(
  manner: string,
  bucket: StyleBucket,
  roleValue: string,
  occupationValue: string,
  traitFocus: NpcTraitGroup[],
  rng: () => number,
): string {
  if (personaAllowsRoughManner(roleValue, occupationValue)) return manner;
  const scholarly =
    bucket === "intellectual" || traitFocus[0] === "science" || occupationValue === "scholar";
  if (!scholarly || !ROUGH_MANNER_RE.test(manner)) return manner;
  let next = manner;
  for (let i = 0; i < 10 && ROUGH_MANNER_RE.test(next); i += 1) {
    next = weightedPickByFocus(MANNERS_BY_GROUP, traitFocus, rng);
  }
  return ROUGH_MANNER_RE.test(next) ? pick(INTEL_MANNER, rng) : next;
}

const CATCHPHRASE_RULES: ReadonlyArray<{ test: RegExp; lines: readonly string[] }> = [
  {
    test: /золот|денег|долг|заработ|имя,/i,
    lines: [
      "Время — золото, а у вас, похоже, нет ни того, ни другого.",
      "Каждая монета должна работать. Иначе зачем мы вообще говорим?",
      "Я не торгую пустыми обещаниями: покажите ценность — и я покажу условия.",
    ],
  },
  {
    test: /знани|теори|архив|ученик|традици|школ/i,
    lines: [
      "Факты устоят, когда эмоции уже сломались — давайте к фактам.",
      "Ошибку можно исправить; невежество оставляют в наследство.",
      "Я выслушаю легенду, но проверю по первоисточникам.",
    ],
  },
  {
    test: /месть|отомст|враг|предатель|тайн|агент|тенев/i,
    lines: [
      "Тихий зал — не значит безопасный. Говорите по существу.",
      "У каждой двери есть тень. Я предпочитаю знать, чья она.",
      "Слова дешевле клинка, но ранят дольше — выбирайте их аккуратно.",
    ],
  },
  {
    test: /спасти|беззащит|жертв|милосерд|добро/i,
    lines: [
      "Если вы пришли за помощью — не тратьте моё время на гордость.",
      "Я не святой, но и не палач: скажите, кого вы хотите уберечь.",
    ],
  },
  {
    test: /контракт|дух|потусторон|проклят|заклин/i,
    lines: [
      "Любая сделка имеет цену. Вопрос — кто её заплатит первым.",
      "Я не подписываю ничего вслепую — даже под угрозой.",
    ],
  },
];

function pickCatchphraseFromMotivation(motivation: string, rng: () => number): string {
  for (const rule of CATCHPHRASE_RULES) {
    if (rule.test.test(motivation)) {
      return pick(rule.lines, rng);
    }
  }
  return pick(
    [
      "Давайте без лишнего театра: что вам нужно на самом деле?",
      "Я слушаю. Но помните: половина правды — хуже лжи.",
      "Слова — дорога. Куда она ведёт — зависит только от вас.",
    ],
    rng,
  );
}

function weightedPickByFocus(
  groupedPool: Record<NpcTraitGroup, readonly string[]>,
  focus: NpcTraitGroup[],
  rng: () => number,
): string {
  const first = groupedPool[focus[0]] ?? [];
  const second = groupedPool[focus[1]] ?? [];
  const third = groupedPool[focus[2]] ?? [];
  const fourth = groupedPool[focus[3]] ?? [];
  const roll = rng();
  const source = roll < 0.55 ? first : roll < 0.8 ? second : roll < 0.93 ? third : fourth;
  if (source.length) return pick(source, rng);
  const all = [...first, ...second, ...third, ...fourth];
  return all.length ? pick(all, rng) : "";
}

const HUMAN_FIRST_M = [
  "Алдар",
  "Борис",
  "Влад",
  "Горан",
  "Дарен",
  "Иван",
  "Кас",
  "Лорен",
  "Марк",
  "Олег",
  "Пётр",
  "Роман",
  "Стефан",
  "Томас",
  "Юрий",
  "Ян",
  "Эдрик",
  "Феликс",
  "Николай",
  "Мартин",
  "Освальд",
  "Грегор",
  "Арвид",
  "Бром",
  "Кейд",
  "Лют",
  "Мирон",
  "Остин",
  "Рафн",
  "Сорен",
  "Тибальт",
  "Хьюго",
  "Эйгон",
  "Яромир",
] as const;

const HUMAN_FIRST_F = [
  "Ада",
  "Бетта",
  "Вера",
  "Грета",
  "Дина",
  "Елена",
  "Зара",
  "Илза",
  "Кира",
  "Лира",
  "Мира",
  "Нора",
  "Ольга",
  "Рина",
  "Сара",
  "Тара",
  "Уна",
  "Фрея",
  "Хельга",
  "Элира",
  "Яна",
  "Инесса",
  "Амира",
  "Бриенна",
  "Делиа",
  "Жасмин",
  "Калисса",
  "Лиана",
  "Мелисса",
  "Нимэ",
  "Офелия",
  "Пейдж",
  "Рута",
  "Сильви",
] as const;

const ELF_FIRST_M = [
  "Аэлин",
  "Келемвор",
  "Силван",
  "Тариэль",
  "Элронд",
  "Финрод",
  "Лаурат",
  "Мириэль",
  "Орофин",
  "Пеларгир",
  "Румиэль",
  "Селион",
  "Телперион",
  "Ульмо",
  "Феанор",
  "Эредион",
  "Гладион",
  "Истарион",
  "Лунатар",
  "Нерендил",
  "Оссирил",
  "Валарион",
] as const;

const ELF_FIRST_F = [
  "Алариэль",
  "Галадриэль",
  "Лютэнь",
  "Нимродэль",
  "Сирин",
  "Тинувиэль",
  "Эльссара",
  "Илария",
  "Келебриан",
  "Мириэль",
  "Нимриэль",
  "Олатариэль",
  "Ривиэль",
  "Сильмариэль",
  "Тариэль",
  "Феалора",
  "Эловина",
  "Идриль",
  "Линдуил",
  "Мелькорис",
  "Найариэль",
  "Эларина",
] as const;

const DWARF_FIRST_M = [
  "Борин",
  "Двалин",
  "Гимли",
  "Кили",
  "Фили",
  "Торин",
  "Балин",
  "Дори",
  "Нори",
  "Оин",
  "Глоин",
  "Бифур",
  "Бофур",
  "Бомбур",
  "Дроур",
  "Кадрик",
  "Моргрим",
  "Рунек",
  "Стормбир",
  "Торгрим",
  "Ульфгар",
  "Харгрим",
] as const;

const DWARF_FIRST_F = [
  "Дис",
  "Хильда",
  "Бруна",
  "Грета",
  "Дагна",
  "Элина",
  "Фрида",
  "Гуннильд",
  "Хельга",
  "Ингрит",
  "Кара",
  "Лофна",
  "Модра",
  "Нисса",
  "Одна",
  "Рунна",
  "Сифф",
  "Торга",
  "Ульва",
  "Фьёрна",
  "Харга",
  "Эйра",
] as const;

const TIEFLING_GIVEN_M = [
  "Морекай",
  "Зериэль",
  "Каэрвос",
  "Озримар",
  "Серафис",
  "Тазриэль",
  "Валентор",
  "Драконис",
  "Итарион",
  "Касмодей",
  "Мальзар",
  "Никзар",
  "Орикс",
  "Пандемон",
  "Ревус",
  "Солифар",
  "Тайрион",
  "Ульзек",
  "Фенриз",
  "Харзул",
  "Эребус",
  "Заркун",
] as const;

const TIEFLING_GIVEN_F = [
  "Морвен",
  "Зефира",
  "Астраэль",
  "Инферна",
  "Найтера",
  "Сильвария",
  "Темирра",
  "Элипса",
  "Вельзара",
  "Грезия",
  "Демизра",
  "Инфирна",
  "Кальмира",
  "Лилитра",
  "Мизарра",
  "Нексара",
  "Оризма",
  "Пульхера",
  "Резира",
  "Сольвейг",
  "Темира",
  "Ульзабет",
] as const;

/** «фамилии-добродетели» для тифлингов */
const TIEFLING_VIRTUE = [
  "Клятва Света",
  "Память Обета",
  "Наследие Истины",
  "Пепельная Руна",
  "Добродетель Тишины",
  "Знак Решимости",
  "Печать Милосердия",
  "Огонь Совести",
  "Путь Искупления",
  "Крыло Надежды",
  "Камень Веры",
  "Сердце Чести",
  "Воля Стали",
  "След Доблести",
  "Тень Прощения",
  "Свет Упорства",
  "Клинок Справедливости",
  "Пламя Разума",
  "Клятва Стража",
  "Знак Отваги",
  "Метка Смирения",
  "Глас Долга",
  "Осколок Веры",
  "Имя Добродетели",
  "Пепел Искупления",
] as const;

/** Полурослики — уютные, игривые имена */
const HALFLING_FIRST_M = [
  "Бильбо",
  "Бунго",
  "Дрого",
  "Зефир",
  "Мерри",
  "Одо",
  "Перегрин",
  "Регинард",
  "Сэм",
  "Толман",
  "Фастред",
  "Фредегар",
  "Хэмфаст",
  "Эверард",
  "Йорик",
] as const;

const HALFLING_FIRST_F = [
  "Белла",
  "Венора",
  "Груша",
  "Дилайла",
  "Жасминка",
  "Иви",
  "Лобелия",
  "Мирабелла",
  "Нора",
  "Паулина",
  "Примула",
  "Роза",
  "Тила",
  "Эстель",
  "Ягода",
] as const;

/** Драконорождённые — звучные, «латунные» имена */
const DRAGONBORN_FIRST_M = [
  "Арджхан",
  "Баласар",
  "Гараш",
  "Дарган",
  "Иорикс",
  "Каварах",
  "Медраак",
  "Нарахш",
  "Панджар",
  "Райокс",
  "Соратан",
  "Ториннак",
  "Хараш",
  "Эброн",
  "Ярикс",
] as const;

const DRAGONBORN_FIRST_F = [
  "Акта",
  "Бири",
  "Гештана",
  "Драла",
  "Зирая",
  "Имира",
  "Карава",
  "Мирисс",
  "Нулара",
  "Пайри",
  "Рива",
  "Сорака",
  "Тимила",
  "Фейрид",
  "Эриша",
] as const;

/** Гномы — короткие и звонкие */
const GNOME_FIRST_M = [
  "Бингли",
  "Вибли",
  "Гимбл",
  "Дорин",
  "Зук",
  "Корбин",
  "Ниббл",
  "Оррик",
  "Пипин",
  "Рунник",
  "Синджин",
  "Тибо",
  "Фиббл",
  "Элрод",
  "Ярик",
] as const;

const GNOME_FIRST_F = [
  "Бимми",
  "Вика",
  "Гретель",
  "Джилли",
  "Зена",
  "Илва",
  "Кора",
  "Лулу",
  "Мимси",
  "Нисса",
  "Ора",
  "Пиппа",
  "Розик",
  "Тила",
  "Эни",
] as const;

/** Голиафы — камень и ветер */
const GOLIATH_FIRST_M = [
  "Аагам",
  "Бирот",
  "Гейлунт",
  "Дровиг",
  "Кегак",
  "Локаг",
  "Мауглим",
  "Орокан",
  "Сигунт",
  "Тагур",
  "Ульвен",
  "Хурак",
] as const;

const GOLIATH_FIRST_F = [
  "Апека",
  "Ваума",
  "Гейли",
  "Дровни",
  "Каума",
  "Лагани",
  "Мауми",
  "Оруни",
  "Сигей",
  "Тувей",
  "Ульви",
  "Хигра",
] as const;

/** Аасимары — светлые, торжественные */
const AASIMAR_FIRST_M = [
  "Аэларис",
  "Гелиос",
  "Дариэль",
  "Зауриэль",
  "Иларион",
  "Касиэль",
  "Люмиэль",
  "Микаэль",
  "Ориэль",
  "Рафаэль",
  "Соларис",
  "Тариэль",
] as const;

const AASIMAR_FIRST_F = [
  "Анаэль",
  "Гелида",
  "Дариела",
  "Заура",
  "Илария",
  "Кассиель",
  "Люмиана",
  "Микаэла",
  "Ориана",
  "Рафаэлла",
  "Селена",
  "Тариэла",
] as const;

/** Орки — грубые, короткие удары */
const ORC_FIRST_M = [
  "Грок",
  "Дурга",
  "Зуг",
  "Корг",
  "Морг",
  "Огуш",
  "Рагаш",
  "Турк",
  "Угут",
  "Хорг",
  "Шаграт",
  "Эгарш",
] as const;

const ORC_FIRST_F = [
  "Граша",
  "Дурна",
  "Зага",
  "Корга",
  "Морза",
  "Оги",
  "Рагна",
  "Турга",
  "Уша",
  "Хорга",
  "Шага",
  "Эга",
] as const;

const EPITHET_ADJ = [
  "Вороний",
  "Железный",
  "Пепельный",
  "Лунный",
  "Тихий",
  "Красный",
  "Седой",
  "Чёрный",
  "Серебряный",
  "Дымный",
  "Медный",
  "Ледяной",
  "Костяной",
  "Золотой",
  "Ночной",
  "Старый",
  "Дальний",
  "Горький",
  "Острый",
  "Тёмный",
  "Белый",
  "Грозный",
  "Холодный",
  "Дикий",
  "Тайный",
] as const;

const EPITHET_NOUN = [
  "Коготь",
  "Шепот",
  "Клинок",
  "Пепел",
  "След",
  "Заря",
  "Ключ",
  "Камень",
  "Огонь",
  "Тень",
  "Глаз",
  "Знак",
  "Путь",
  "Ворон",
  "Дым",
  "Гром",
  "Кольцо",
  "Печать",
  "Крыло",
  "Клык",
  "Костёр",
  "Ветер",
  "Руна",
  "Капкан",
  "Молот",
] as const;

const MOTIVATIONS_BY_GROUP: Record<NpcTraitGroup, readonly string[]> = {
  social: [
    "Восстановить утраченную репутацию дома.",
    "Заработать достаточно, чтобы выкупить долг семьи.",
    "Найти ученика, достойного передать традицию.",
    "Сорвать сделку, которая уничтожит родной квартал.",
    "Удержать нейтралитет между фракциями ценой собственной безопасности.",
    "Устроить так, чтобы правда о прошлом стала достоянием общественности.",
    "Заработать имя, чтобы ребёнок гордился родом.",
    "Устроить так, чтобы два враждующих клана заключили перемирие.",
  ],
  combat: [
    "Отомстить тем, кто подставил его в прошлой экспедиции.",
    "Спасти беззащитное существо, которое все считают монстром.",
    "Запечатать источник заражения до распространения.",
    "Разрушить культ, питающийся страхом простых людей.",
    "Вернуть украденное и не оставить следов мести.",
  ],
  science: [
    "Раздобыть артефакт до того, как его найдут конкуренты.",
    "Доказать теорию, за которую его высмеивали коллеги.",
    "Расшифровать карту, обещающую доступ к запретному знанию.",
    "Найти редкий материал для завершения шедевра.",
    "Удержать архив от тех, кто хочет его сжечь.",
    "Найти учителя, который сможет снять проклятие.",
    "Доказать, что «неправильная» магия может спасти жизни.",
  ],
  shadow: [
    "Укрыть близкого от охоты гильдии.",
    "Заключить контракт с духом без традиционных посредников.",
    "Устроить переворот в гильдии изнутри.",
    "Добыть наследство, спрятанное предками.",
    "Исполнить условие договора с потусторонней силой.",
  ],
};

const SECRETS_BY_GROUP: Record<NpcTraitGroup, readonly string[]> = {
  social: [
    "Тайно финансирует беглых из рабства.",
    "Когда-то выдал товарища властям ради спасения деревни.",
    "Боится огня после пожара в мастерской.",
    "Клялся никогда не возвращаться в родной город — и нарушил клятву.",
    "Видел бога во сне и теперь сомневается в доктрине храма.",
    "Знает слабое место правителя и молчит из страха за семью печатями.",
    "Каждую неделю отправляет золото под чужим именем.",
  ],
  combat: [
    "Вырос среди нежити и скрывает привычку угадывать запах гнили.",
    "Пережил смерть и вернулся без объяснений.",
    "Хранит ключ от двери, которую приказано никогда не открывать.",
    "Убил человека в дуэли и выдал это за несчастный случай.",
    "Боится воды после того, как чуть не утонул в реке крови во сне.",
  ],
  science: [
    "Хранит шрам от магического ожога под перчаткой.",
    "Не умеет читать, но прекрасно имитирует образ учёного.",
    "Носит амулет, который шепчет имя незнакомца каждую полночь.",
    "Украл рецепт у наставника и живёт с виной.",
    "Его голос — подделка: настоящий голос потерян проклятием.",
    "Носит медальон с волосом умершего — не знает, чей именно.",
  ],
  shadow: [
    "Спит мало: его преследуют сны о чужой жизни.",
    "Является двойным агентом между двумя гильдиями.",
    "Подделывает печати лордов ради спасения беженцев.",
    "Держит в подвале существо, которое обещало исполнить желание.",
    "Тайно кормит информацией обе стороны конфликта.",
    "Влюблён в того, кого должен по долгу службы предавать.",
    "Под видом чертежей передаёт координаты тайных убежищ.",
  ],
};

const INTEL_APPEARANCE = [
  "Опрятный срез плаща, перчатки без пятен, линзы очков слегка дымчатые.",
  "Тонкие пальцы в чернильных подпалинах, книга всегда под мышкой.",
  "Седые виски при раннем возрасте, осанка выправлена привычкой лекций.",
  "Украшения минимальны: только перстень с гербом академии.",
  "Ткань дорогая, но поношенная — явно предпочитает качество моде.",
  "Шляпа с пером архивариуса, чуть смята сзади от ветра бумаг.",
  "Глаза красные от чтения при свече; на столе всегда лежит лупа.",
  "Носит шарф даже в жару — прикрывает старую отметину на шее.",
  "Ровная походка, будто меряет шагами расстояние между полками.",
  "Запонки из серебра с символами школы алхимии.",
  "Борода аккуратно подстрижена линейкой; щётка для одежды на поясе.",
  "Курит трубку с ароматом сухих трав — не табак.",
  "Одежда слегка пахнет озоном после экспериментов.",
  "Редко моргает, когда слушает — будто записывает всё в память.",
  "Носит очки на цепочке; без них щурится даже днём.",
  "Пальцы постукивают ритм, когда думает.",
  "Записки на запястье мелом — список задач на день.",
  "Кожаный футляр для свитков привязан к спине тонкими ремнями.",
  "Лицо бледное от долгих ночей у микроскопа или эфирических линз.",
  "Лёгкая россыпь серебра в волосах — семейная традиция учёных.",
  "Кольцо на указательном перстре слегка туго — признак прежней раны.",
  "Тихий голос, но слова чётко отделяются, как строки в учебнике.",
] as const;

const INTEL_MANNER = [
  "Часто щурится, подбирая слова.",
  "Делает паузу перед ответом, будто сверяется с внутренним указателем.",
  "Кивает коротко, когда согласен — без лишних эмоций.",
  "Поправляет очки жестом, ставшим нервной привычкой.",
  "Говорит тихо, заставляя собеседника наклониться.",
  "Записывает интересные фразы на полях памяти — и иногда вслух повторяет.",
  "Избегает громких жестов; руки остаются в поле зрения.",
  "Улыбается сдержанно, чаще уголком рта.",
  "Переформулирует чужие слова, чтобы убедиться, что понял верно.",
  "Теребит цепочку очков или край рукава при раздумьях.",
  "Отвечает вопросом на вопрос, если тема слишком личная.",
  "Благодарит за точную формулировку — ценит ясность.",
  "Не перебивает, но поднимает палец, когда хочет вставить замечание.",
  "Использует метафоры из геометрии и навигации.",
  "Держит дистанцию физически — полшага дальше обычного.",
  "Вздыхает почти неслышно, услышав логическую ошибку.",
  "Хвалит редко, но конкретно — по пунктам.",
  "Рассеянно путает имена незнакомцев, но помнит факты безошибочно.",
  "Поправляет чужие термины мягко, без уничижения.",
  "Смотрит поверх очков на собеседника, который повышает голос.",
  "Проводит пальцем по воздуху, будто чертит схему.",
  "Закрывает глаза на секунду, вспоминая цитату.",
] as const;

const WORK_APPEARANCE = [
  "Руки в сажу до локтя; ногти коротко подстрижены, но с синяком от ушиба.",
  "Фартук из толстой кожи, испещрён ожогами и кляксами.",
  "Плечи шире дверного косяка; стоит чуть расставив ноги — устойчиво.",
  "Волосы собраны грубой верёвкой; щека в полосе копоти.",
  "Молоток или стамеска за поясом — инструмент как продолжение руки.",
  "Сапоги тяжёлые, подковы стёрты неровно.",
  "На шее платок от пыли — меняет раз в день.",
  "Грубый голос от постоянного крика в цеху.",
  "Кожа пересохшая, на ладони мозоли в необычных местах.",
  "Кожаная нашивка гильдии на груди потёрта до блеска.",
  "Очки с толстыми стёклами для мелкой работы — сидят криво.",
  "Пояс увешан мелкими кольцами и пробными заготовками.",
  "Пахнет углём, маслом и горячим металлом.",
  "Рукава закатаны неровно — одна всегда ниже другой.",
  "Шрам на лбу от отлетевшей искры.",
  "Хромает слегка — старая травма от пресса.",
  "Говорит короткими командами даже в быту.",
  "Борода заплетена в одну косу — чтобы не попадала в станок.",
  "Носит защитные линзы на лбу, опущенные на глаза только при работе.",
  "Пальцы широкие; мизинец без ногтя — жертва долгу.",
  "Куртка застёгнута на одну пуговицу — торопился выйти в зал.",
  "Шрамы на предплечьях от острых щепок и проволоки.",
] as const;

const WORK_MANNER = [
  "Говорит коротко, как отдаёт приказы цеху.",
  "Смотрит на руки собеседника — оценивает ловкость.",
  "Машет рукой, отгоняя комплименты о работе.",
  "Хрустит суставами, когда складывает руки на груди.",
  "Кивает быстро, если согласен — без слов.",
  "Отдувается через рукав, когда жарко.",
  "Смеётся низко и коротко — как стук молота.",
  "Плюёт в сторону перед тем как начать рассказ о деле.",
  "Теребит ремень инструмента, когда нервничает.",
  "Не любит долгих объяснений — показывает на образец.",
  "Топает ногой, чтобы привлечь внимание в шуме.",
  "Жуёт зубочистку или гвоздь-про запас.",
  "Широко расставляет локти за столом — привычка занимать место.",
  "Хвалит только работу, не человека.",
  "Разминает кисти перед любым делом руками.",
  "Бурчит под нос, когда считает разговор пустым.",
  "Постукивает по столу ритмом стругания или ковки.",
  "Держит дистанцию — боится испачкать чужую одежду.",
  "Резко выдыхает носом, услышав фантастический срок заказа.",
  "Показывает шрам как доказательство своей компетенции.",
  "Любит жать руку крепче обычного — проверка характера.",
  "Отвечает «потом» на всё, что отвлекает от текущего заказа.",
] as const;

const GENERAL_APPEARANCE = [
  "Нейтральная одежда дорожного качества — не бросается в глаза.",
  "Лёгкая улыбка не доходит до глаз, пока не начнёт доверять.",
  "Шрам у виска скрыт прядью волос.",
  "Запах дороги: пыль, конь и дешёвое мыло.",
  "Кольца на пальцах разные — каждое с историей.",
  "Плащ подшит карманами больше, чем кажется.",
  "Говорит глядя чуть мимо — привычка наблюдать за отражениями.",
  "Шаг ровный, но осторожный — проверяет поверхность.",
  "Татуировка или бренд скрыт под одеждой — виден только при жесте.",
  "Голос спокойный, тембр средний — запоминается плохо намеренно.",
  "Кожа загорелая неравномерно — много дней в дороге.",
  "Руки чистые, но с царапинами — не чужда работы.",
  "Украшения минимальны; предпочитает практичность.",
  "Постоянно проверяет ремни сумки касанием.",
  "Глаза быстро считывают входы и выходы помещения.",
  "Носит перстень с пустой оправой — камень продан или потерян.",
  "Улыбается вежливо торговцам и холодно чиновникам.",
  "Ткань плаща слегка порвана у подола — не считает нужным чинить.",
  "Запястье перевязано цветной нитью — оберег по обещанию.",
  "В кармане всегда есть монета «на удачу», которую не тратит.",
  "Брови чуть асимметричны — след старой резни.",
  "Говорит с лёгким акцентом чужеземца.",
] as const;

const GENERAL_MANNER = [
  "Держит паузу перед тем как шутить.",
  "Кивает чуть сильнее, если тема ему неприятна.",
  "Избегает прямого «нет», заменяя на «не сейчас».",
  "Поправляет ремень сумки, когда нервничает.",
  "Смотрит на источник света прежде чем ответить.",
  "Говорит мягче с детьми и животными.",
  "Чаще слушает, чем перебивает.",
  "Улыбается односторонне — привычка.",
  "Дотрагивается до амулета в кармане перед решением.",
  "Отводит взгляд, если лжёт — или наоборот не моргает.",
  "Повторяет последнее слово собеседника, сверяя смысл.",
  "Скрещивает руки только когда раздражён.",
  "Теребит ухо, когда слышит знакомое имя.",
  "Смеётся чуть позже всех — обработка шутки задерживается.",
  "Двигается по комнате дугой, не задевая углы.",
  "Опускает голос в толпе; повышает на открытом месте.",
  "Благодарит за мелочи — привычка выживания.",
  "Не злопамятен, но записывает долги мысленно.",
  "Любит заканчивать разговор вопросом.",
  "Трёт переносицу, когда устал.",
  "Держит дистанцию в полтора шага — комфортная зона.",
  "Замирает на полуслове, если замечает ложь.",
] as const;

const MANNERS_BY_GROUP: Record<NpcTraitGroup, readonly string[]> = {
  social: [...GENERAL_MANNER],
  combat: [...WORK_MANNER],
  science: [...INTEL_MANNER],
  shadow: [
    "Отвечает вопросом на вопрос, если тема слишком личная.",
    "Смотрит на источник света прежде чем ответить.",
    "Отводит взгляд, если лжёт — или наоборот не моргает.",
    "Не злопамятен, но записывает долги мысленно.",
    "Замирает на полуслове, если замечает ложь.",
  ],
};

function pickEpithet(rng: () => number): string {
  return `${pick(EPITHET_ADJ, rng)} ${pick(EPITHET_NOUN, rng)}`;
}

function pickInventory(occupationValue: string): string {
  const craft =
    "Инструменты гильдии, потёртый фартук, заклепки и проволока в мешочке для мелкого ремонта.";
  const scholar =
    "Набор стилусов, лупа, пробирки с реагентами и складная подставка для книг.";
  const merchant =
    "Железные весы, мешочек с медными монетами для сдачи, узелок с образцами тканей.";
  const guard =
    "Короткий меч с потёртой гардой, свисток на цепи, потёртая книга устава.";
  const rogue =
    "Отмычки, флакон с дымом, записка с чужим почерком и тонкий кинжал.";
  switch (occupationValue) {
    case "craftsman":
      return craft;
    case "scholar":
      return scholar;
    case "merchant":
      return merchant;
    case "guard":
      return guard;
    case "rogue":
      return rogue;
    default:
      return "Дорожная сумка с припасами, фляга и предмет без истории — пока что.";
  }
}

function pickGivenName(race: string, female: boolean, rng: () => number): string {
  const raceKey = String(race || "").toLowerCase();
  if (raceKey === "tiefling") {
    return female ? pick(TIEFLING_GIVEN_F, rng) : pick(TIEFLING_GIVEN_M, rng);
  }
  if (raceKey === "elf") {
    return female ? pick(ELF_FIRST_F, rng) : pick(ELF_FIRST_M, rng);
  }
  if (raceKey === "dwarf") {
    return female ? pick(DWARF_FIRST_F, rng) : pick(DWARF_FIRST_M, rng);
  }
  if (raceKey === "orc" || raceKey === "half-orc") {
    return female ? pick(ORC_FIRST_F, rng) : pick(ORC_FIRST_M, rng);
  }
  if (raceKey === "halfling") {
    return female ? pick(HALFLING_FIRST_F, rng) : pick(HALFLING_FIRST_M, rng);
  }
  if (raceKey === "dragonborn") {
    return female ? pick(DRAGONBORN_FIRST_F, rng) : pick(DRAGONBORN_FIRST_M, rng);
  }
  if (raceKey === "gnome") {
    return female ? pick(GNOME_FIRST_F, rng) : pick(GNOME_FIRST_M, rng);
  }
  if (raceKey === "goliath") {
    return female ? pick(GOLIATH_FIRST_F, rng) : pick(GOLIATH_FIRST_M, rng);
  }
  if (raceKey === "aasimar") {
    return female ? pick(AASIMAR_FIRST_F, rng) : pick(AASIMAR_FIRST_M, rng);
  }
  return female ? pick(HUMAN_FIRST_F, rng) : pick(HUMAN_FIRST_M, rng);
}

function pickFamilyName(race: string, rng: () => number): string {
  if (String(race || "").toLowerCase() === "tiefling") {
    return pick(TIEFLING_VIRTUE, rng);
  }
  const humanish = [
    "Воронов",
    "Сребролист",
    "Железнобров",
    "Каменный Ручей",
    "Тёмный Дуб",
    "Белый Якорь",
    "Ночной Шаг",
    "Красный Пояс",
    "Тихая Река",
    "Острый Гребень",
    "Северный Ветер",
    "Золотой Гвоздь",
    "Чёрный Тмин",
    "Медный Щит",
    "Солёный Причал",
    "Пепельный Зал",
    "Серый Клин",
    "Грозовой Столп",
    "Дальний Огонь",
    "Добрый Торг",
    "Старый Мост",
    "Быстрый Чекан",
  ] as const;
  return pick(humanish, rng);
}

function filterAppearanceByGender(appearancePool: readonly string[], gender: "female" | "male", race: string): readonly string[] {
  if (gender !== "female") return appearancePool;
  const raceKey = String(race || "").toLowerCase();
  if (raceKey === "dwarf") return appearancePool;
  const blocked =
    /(бород|ус|усищ|шире дверного косяка|заплетена в одну косу|аккуратно подстрижен.*бород|щётка для одежды на поясе.*бород)/i;
  const filtered = appearancePool.filter((line) => !blocked.test(line));
  return filtered.length ? filtered : appearancePool;
}

function pickPortrait(portraits: NpcPortrait[], gender: string): NpcPortrait {
  if (!portraits.length) {
    return { id: "blank", image: "" };
  }
  const keyed = portraits.filter((pic) =>
    gender === "female" ? pic.id.startsWith("f") : gender === "male" ? pic.id.startsWith("m") : true,
  );
  const pool = keyed.length ? keyed : portraits;
  return pool[Math.floor(Math.random() * pool.length)] ?? portraits[0];
}

export function resolvedGenderPhysical(genderId: string): "female" | "male" {
  if (genderId === "female") return "female";
  if (genderId === "male") return "male";
  return Math.random() > 0.5 ? "female" : "male";
}

/**
 * Локальная генерация без Electron (fallback для браузера и аварий IPC).
 */
function resolveNpcCardLegacy(npc: AppContentJson["npc"], form: NpcSummonForm): ResolvedNpcCard | null {
  if (!npc.races?.length) return null;

  const rng = Math.random;
  const occupationRu =
    npc.occupations.find((occupationOpt) => occupationOpt.value === form.occupationValue)?.labelRu ??
    OCCUPATION_VALUE_FALLBACK_RU[form.occupationValue] ??
    "";
  const roleLabelRu =
    npc.roles.find((r) => r.value === form.role)?.labelRu ?? ROLE_VALUE_FALLBACK_RU[form.role] ?? form.role;

  const genderResolved = resolvedGenderPhysical(form.genderId);
  const portrait = pickPortrait(npc.portraits, genderResolved).image;
  const genderRu = genderResolved === "female" ? "Жен." : "Муж.";
  const raceRu =
    npc.races.find((rItem) => rItem.value === form.race)?.labelRu ??
    RACE_VALUE_FALLBACK_RU[form.race] ??
    form.race;

  const bucket = resolveStyleBucket(form.occupationValue, form.role);
  const traitFocus = resolveTraitFocus(form.occupationValue, form.role);
  const female = genderResolved === "female";
  const given = pickGivenName(form.race, female, rng);
  const epithet = pickEpithet(rng);

  let family = "";
  if (form.race === "tiefling") {
    family = pick(TIEFLING_VIRTUE, rng);
  } else if (rng() > 0.25) {
    family = pickFamilyName(form.race, rng);
  }

  const displayName = family ? `${given} ${family}` : given;

  let appearance: string;
  let manner = weightedPickByFocus(MANNERS_BY_GROUP, traitFocus, rng);
  if (bucket === "intellectual") {
    appearance = pick(filterAppearanceByGender(INTEL_APPEARANCE, genderResolved, form.race), rng);
  } else if (bucket === "working") {
    appearance = pick(filterAppearanceByGender(WORK_APPEARANCE, genderResolved, form.race), rng);
  } else {
    appearance = pick(filterAppearanceByGender(GENERAL_APPEARANCE, genderResolved, form.race), rng);
  }

  const motivation = weightedPickByFocus(MOTIVATIONS_BY_GROUP, traitFocus, rng);
  manner = refineMannerForPersona(manner, bucket, form.role, form.occupationValue, traitFocus, rng);
  const catchphrase = pickCatchphraseFromMotivation(motivation, rng);

  return {
    name: displayName,
    epithet,
    raceRu,
    genderRu,
    roleLabelRu,
    occupationRu: occupationRu || "Прохожий",
    appearance,
    manner,
    motivation,
    secret: weightedPickByFocus(SECRETS_BY_GROUP, traitFocus, rng),
    catchphrase,
    inventory: pickInventory(form.occupationValue),
    portrait,
  };
}

function mapEnginePayloadToResolvedCard(
  raw: Record<string, unknown>,
  markdown: string,
  npc: AppContentJson["npc"],
  form: NpcSummonForm,
): ResolvedNpcCard | null {
  const identity = raw.identity as Record<string, unknown> | undefined;
  const role = raw.role as Record<string, unknown> | undefined;
  const portrayal = raw.portrayal as Record<string, unknown> | undefined;
  const plot = raw.plot as Record<string, unknown> | undefined;
  const narrative = raw.narrative as Record<string, unknown> | undefined;
  if (!identity || !role || !portrayal || !plot || !narrative) return null;

  const genderResolved = resolvedGenderPhysical(form.genderId);
  const portrait = pickPortrait(npc.portraits, genderResolved).image;
  const roleLabelRu =
    npc.roles.find((r) => r.value === form.role)?.labelRu ?? ROLE_VALUE_FALLBACK_RU[form.role] ?? form.role;

  const dispositionObj = portrayal.disposition as Record<string, unknown> | undefined;
  const socialStake = plot.socialStake as Record<string, unknown> | undefined;
  const pockets = plot.pockets as unknown;
  const rollup = role.pricingRollup as Record<string, unknown> | undefined;

  const pocketLines = Array.isArray(pockets) ? pockets.map((p) => String(p)).join("; ") : "";

  const totalZm = typeof rollup?.totalZm === "number" ? rollup.totalZm : 0;
  const totalSm = typeof rollup?.totalSm === "number" ? rollup.totalSm : 0;
  const totalCostZm =
    typeof rollup?.totalCostZm === "number" ? rollup.totalCostZm : totalZm;

  const tier = String(role.professionTier ?? "");
  const stakeLab = String(socialStake?.roleLabel ?? "");
  const professionLabelRu =
    role.professionLabelRu != null ? String(role.professionLabelRu) : undefined;
  const profLine = professionLabelRu ?? String(role.profession ?? "");
  const specializationLine =
    role.specialization != null ? String(role.specialization) : undefined;
  const hobbyEclectic =
    portrayal.hobbyEclectic != null ? String(portrayal.hobbyEclectic) : undefined;
  const whereToFindNow =
    portrayal.whereToFindNow != null ? String(portrayal.whereToFindNow) : undefined;
  const craftsmanshipNarrativeHook =
    portrayal.craftsmanshipNarrativeHook != null
      ? String(portrayal.craftsmanshipNarrativeHook)
      : undefined;
  const categoryLab =
    role.professionCategoryLabelRu != null ? String(role.professionCategoryLabelRu) : undefined;
  const repairPricing = role.repairPricing as Record<string, unknown> | undefined;
  const sampleWeapon = repairPricing?.sampleWeapon as Record<string, unknown> | undefined;
  const sampleMagic = repairPricing?.sampleMagicItem as Record<string, unknown> | undefined;

  return {
    name: String(identity.name ?? ""),
    epithet: [tier, stakeLab].filter(Boolean).join(" · "),
    raceRu: String(identity.race ?? ""),
    genderRu: String(identity.gender ?? ""),
    roleLabelRu,
    occupationRu: `${profLine} (${tier})`,
    appearance: String(portrayal.appearance ?? ""),
    manner: String(portrayal.manner ?? ""),
    motivation: String(narrative.backstoryParagraph ?? ""),
    secret: String(plot.secretOrHook ?? ""),
    catchphrase: String(portrayal.greetingFirstPhrase ?? ""),
    inventory: pocketLines,
    portrait,
    markdownFull: markdown,
    pricingRollup: {
      totalZm,
      totalSm,
      totalCostZm,
    },
    dispositionLabelRu: dispositionObj?.label != null ? String(dispositionObj.label) : undefined,
    socialStakeLine: socialStake?.explanation != null ? String(socialStake.explanation) : undefined,
    professionLabelRu,
    professionCategoryLabelRu: categoryLab,
    specializationLine,
    hobbyEclectic,
    whereToFindNow,
    craftsmanshipNarrativeHook,
    repairWeaponSummaryRu:
      sampleWeapon?.summaryRu != null ? String(sampleWeapon.summaryRu) : undefined,
    repairMagicItemSummaryRu:
      sampleMagic?.summaryRu != null ? String(sampleMagic.summaryRu) : undefined,
  };
}

/**
 * Карточка NPC: в Electron — полная генерация через npc-engine.mjs (IPC); иначе локальный fallback.
 */
export async function resolveNpcCard(
  npc: AppContentJson["npc"],
  form: NpcSummonForm,
): Promise<ResolvedNpcCard | null> {
  if (!npc.races?.length) return null;

  if (typeof window !== "undefined" && window.electronAPI?.generateNpc) {
    const genderResolved = resolvedGenderPhysical(form.genderId);
    const professionId =
      OCCUPATION_TO_ENGINE_PROFESSION_ID[form.occupationValue] ?? "merchant";
    try {
      const res = await window.electronAPI.generateNpc({
        raceId: form.race,
        genderId: genderResolved,
        professionId,
      });
      if (res.ok && res.data && typeof res.markdown === "string") {
        const card = mapEnginePayloadToResolvedCard(
          res.data as Record<string, unknown>,
          res.markdown,
          npc,
          form,
        );
        if (card) return card;
      } else if (!res.ok) {
        console.warn("[ZERNIX] generateNpc IPC:", res.error);
      }
    } catch (e) {
      console.warn("[ZERNIX] generateNpc IPC exception:", e);
    }
  }

  return resolveNpcCardLegacy(npc, form);
}
