import { generateNpcAsync } from "../services/mocks/database.mjs";
import type { AppContentJson, NpcPortrait, NpcTemplateEntry } from "../types/content";
import { contextTagForBiome, getBiome } from "./zernixLocationCatalog";

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
  /** Короткие поля для стола — из npc-engine dmQuick */
  dmQuick?: {
    visual: string;
    wants: string;
    avoids: string;
    secret: string;
  };
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
  /** Сцена первой встречи (профессия + роли) из npc-engine */
  encounterMeetingRu?: string;
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
  /** Биом сессии / стола — для contextTag IPC и фильтра шаблонов в браузере */
  biomeKey?: string;
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

/** Значение занятия из UI → id профессии в npc-engine.mjs */
const OCCUPATION_TO_ENGINE_PROFESSION_ID: Record<string, string> = {
  merchant: "merchant",
  scholar: "sage",
  craftsman: "blacksmith",
  blacksmith: "blacksmith",
  guard: "mercenary",
  rogue: "fence",
  innkeeper: "innkeeper",
  alchemist: "alchemist",
  guide: "guide",
  herbalist: "apothecary_dry",
  apothecary: "apothecary_dry",
  sailor: "shipwright",
  fisher: "guide",
  hunter: "guide",
  priest: "temple_acolyte",
  lawyer: "lawyer_guild",
  smuggler: "smuggler_boss",
  jeweler: "jeweler",
  cooper: "cooper",
  brewer: "brewer",
  bookbinder: "bookbinder",
  prospector: "guide",
  witch: "cartomancer_nonmagic",
  druid: "natural_philosopher",
  survivalist: "guide",
  trader: "merchant",
  temple_acolyte: "temple_acolyte",
};

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
  const roleLabelRu = npc.roles.find((r) => r.value === form.role)?.labelRu ?? form.role;

  const dispositionObj = portrayal.disposition as Record<string, unknown> | undefined;
  const socialStake = plot.socialStake as Record<string, unknown> | undefined;
  const pockets = plot.pockets as unknown;
  const rollup = role.pricingRollup as Record<string, unknown> | undefined;

  const pocketLines = Array.isArray(pockets) ? pockets.map((p) => String(p)).join("; ") : "";

  const totalZm = typeof rollup?.totalZm === "number" ? rollup.totalZm : 0;
  const totalSm = typeof rollup?.totalSm === "number" ? rollup.totalSm : 0;
  const totalCostZm = typeof rollup?.totalCostZm === "number" ? rollup.totalCostZm : totalZm;

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

  const dmRaw = raw.dmQuick as Record<string, unknown> | undefined;
  const dmQuick =
    dmRaw && typeof dmRaw === "object"
      ? {
          visual: String(dmRaw.visual ?? ""),
          wants: String(dmRaw.wants ?? ""),
          avoids: String(dmRaw.avoids ?? ""),
          secret: String(dmRaw.secret ?? ""),
        }
      : undefined;

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
    dmQuick,
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
    encounterMeetingRu:
      narrative.encounterMeeting != null ? String(narrative.encounterMeeting) : undefined,
  };
}

function splitMotivationAndSecret(raw: string): { motivation: string; secret: string } {
  const t = String(raw).replace(/\s+/g, " ").trim();
  if (!t) return { motivation: "Ищет понятную выгоду без лишней огласки.", secret: "Скрывает слабое место, которое дорого могут купить." };
  // JS regex `\b` — ASCII-only word-boundary и не срабатывает перед кириллицей,
  // поэтому используем явный «безопасный» разделитель: начало строки или пробел/пунктуация.
  const m = /(?:^|[\s.;:,—\-])(Тайна|Секрет)\s*:\s*/iu.exec(t);
  if (m && typeof m.index === "number") {
    const sepLen = m[0]!.length - (m[1]!.length + 1 + /\s*$/.exec(m[0]!)![0].length);
    void sepLen;
    // Срез делаем от начала захваченного слова «Тайна/Секрет», а не от пробела перед ним.
    const headStart = m.index + (m[0]!.startsWith(m[1]!) ? 0 : 1);
    const motivation = t.slice(0, headStart).replace(/[.;,:\-—\s]+$/g, "").trim();
    const secret = t.slice(headStart).replace(/^[^:]+:\s*/i, "").trim();
    return {
      motivation: motivation || secret,
      secret: secret || motivation,
    };
  }
  return { motivation: t, secret: "Прячет вторую сделку, о которой не говорит при свидетелях." };
}

function pickNpcTemplate(npc: AppContentJson["npc"], form: NpcSummonForm): NpcTemplateEntry | null {
  const templates = npc.templates;
  if (!templates?.length) return null;

  let pool = templates.filter((x) => x.raceKey === form.race);
  if (!pool.length) pool = [...templates];

  const biome = form.biomeKey ? getBiome(form.biomeKey) : null;
  if (biome && biome.id !== "any") {
    const byOcc = pool.filter((x) => {
      const occMatch = biome.occupationAffinity.some((id) => {
        const occ = npc.occupations.find((o) => o.value === id);
        return occ && (x.occupationRu === occ.labelRu || form.occupationValue === id);
      });
      const tagMatch = (x.tags ?? []).some((t) => biome.monsterTags.includes(String(t)));
      return occMatch || tagMatch;
    });
    if (byOcc.length) pool = byOcc;
  }

  if (form.genderId === "female") {
    const sub = pool.filter((x) => /жен/i.test(x.genderRu));
    if (sub.length) pool = sub;
  } else if (form.genderId === "male") {
    const sub = pool.filter((x) => /муж/i.test(x.genderRu));
    if (sub.length) pool = sub;
  }

  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

/**
 * Имена под каждую известную UI-расу (мужские / женские).
 * Используется, когда шаблон выбранной расы отсутствует в app-content.json
 * и нужно «переодеть» донора-шаблон в подходящего расового NPC.
 */
const RACE_NAME_POOLS: Record<string, { male: string[]; female: string[] }> = {
  human:     { male: ["Райн", "Калеб", "Йорик", "Тейн", "Орен", "Гаспар"],         female: ["Мара", "Лина", "Изольда", "Тея", "Иола", "Эстер"] },
  elf:       { male: ["Тарион", "Селандор", "Лириан", "Аэлион", "Иллиан"],          female: ["Аэлин", "Сильвиэль", "Маэлис", "Нириэль", "Тинар"] },
  dwarf:     { male: ["Борин", "Тордак", "Грумли", "Дварн", "Хорга"],               female: ["Хильд", "Брунна", "Тордис", "Гуна", "Ингваль"] },
  halfling:  { male: ["Перри", "Финн", "Бромби", "Шкварн", "Ллойд"],                female: ["Поппи", "Розан", "Мильда", "Ниса", "Тилли"] },
  dragonborn:{ male: ["Растор", "Васкар", "Тарганор", "Зарфир", "Хелдрак"],         female: ["Зэйра", "Виспара", "Талура", "Аркания", "Шорна"] },
  tiefling:  { male: ["Морвин", "Аздан", "Лютий", "Кален", "Версаль"],              female: ["Морвен", "Иссара", "Лилит", "Венерия", "Шеррит"] },
  gnome:     { male: ["Финбо", "Никси", "Гарбл", "Тимблтон", "Виксен"],             female: ["Гленди", "Бимба", "Никки", "Фло", "Меллита"] },
  orc:       { male: ["Грунн", "Морга", "Кхазр", "Угрум", "Дрог"],                  female: ["Шура", "Грева", "Уфтра", "Жара", "Дрена"] },
  goliath:   { male: ["Каврак", "Урдан", "Брамм", "Тенгин", "Айвен"],               female: ["Орика", "Хаурга", "Нелда", "Кейра", "Мирса"] },
  aasimar:   { male: ["Кассиэль", "Илиан", "Орион", "Зорин", "Серан"],              female: ["Светана", "Аэрин", "Лучия", "Селена", "Иварра"] },
};

/** Лаконичный appearance, не противоречащий расе. Доставляет ремесло из occupation. */
function appearanceForRace(raceValue: string, raceRu: string, occupationRu: string, seed: number): string {
  const physical: Record<string, string[]> = {
    human:     ["среднего роста, с обветренным лицом и спокойным взглядом", "коренастый, с короткой стрижкой и шрамом у виска", "высокий и сухощавый, плечи опущены от усталости"],
    elf:       ["высокий и тонкокостный, серебристые пряди заплетены ремешком", "с миндалевидными глазами и тихой, плавной речью", "бледный, в светлых одеждах, кожа отливает прохладой"],
    dwarf:     ["коренастый, с густой бородой, пахнущей дымом кузни", "широкоплечий, на руках — следы ожогов и старых сколов", "невысокий, но плотный, с медными бусинами в бороде"],
    halfling:  ["низкорослый и быстрый, с лукавой улыбкой и босыми ногами", "коротконогий, в потёртом дорожном плаще, с курчавыми волосами", "невысокий, веснушчатый, в карманах слышно мелочь"],
    dragonborn:["с чешуйчатой кожей цвета бронзы, гребень тянется по черепу", "массивный, с короткими рогами и хвостом, который шевелится сам по себе", "с матовой синей чешуёй и янтарными глазами"],
    tiefling:  ["с лиловой кожей, изогнутыми рогами и хвостом, обвёрнутым кушаком", "глаза без зрачков светятся углями, в речи прорывается шипение", "с тонкими рожками и тенью, которая иногда отстаёт"],
    gnome:     ["низенький и подвижный, с яркими бусинами в кудрях и хитринкой в глазах", "в очках с круглыми линзами, на пальцах чернильные пятна", "с птичьим темпом речи и заметной жестикуляцией"],
    orc:       ["высокий и плечистый, нижние клыки выступают из-под губы", "с зеленовато-серой кожей и шрамами от ударов через лицо", "массивный, на руках — выбитые татуировки клана"],
    goliath:   ["огромного роста, с серой кожей, расчерченной природными узорами", "плечи как у каменотёса, глаза горные — синие и холодные", "с гладко выбритой головой и татуировками-линиями по щекам"],
    aasimar:   ["лицо чуть светится изнутри, в глазах золотистая искра", "с серебристыми волосами и едва различимыми крыльями-тенями за спиной", "со светящимся узором на коже, который проступает в волнении"],
  };
  const pool = physical[raceValue] ?? physical["human"]!;
  const phys = pool[seed % pool.length]!;
  const occ = occupationRu.trim() ? occupationRu.toLowerCase() : "путник";
  return `${raceRu}, ${phys}. По манере — ${occ}: жест, взгляд и осанка выдают ремесло.`;
}

/** Простой стабильный хеш строки (FNV-1a 32-bit). */
function fnvHash(s: string): number {
  let h = 2166436261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function synthesizeNameForRace(race: string, genderPhysical: "male" | "female", seed: number): string {
  const pool = RACE_NAME_POOLS[race];
  const fallback = RACE_NAME_POOLS["human"]!;
  const arr = pool ? pool[genderPhysical] : fallback[genderPhysical];
  return arr[seed % arr.length]!;
}

function templateToResolvedCard(
  template: NpcTemplateEntry,
  npc: AppContentJson["npc"],
  form: NpcSummonForm,
): ResolvedNpcCard {
  const raceRu = npc.races.find((r) => r.value === form.race)?.labelRu ?? template.raceKey;
  const roleLabelRu =
    npc.roles.find((r) => r.value === form.role)?.labelRu ??
    npc.roles.find((r) => r.value === template.roleKey)?.labelRu ??
    "Союзник";
  const occupationRu =
    npc.occupations.find((o) => o.value === form.occupationValue)?.labelRu ?? template.occupationRu;

  const { motivation, secret } = splitMotivationAndSecret(template.motivation);

  // Если выбранная пользователем раса не совпадает с расой шаблона —
  // переодеваем «донора»: новое имя из таблицы расы и нейтральный appearance,
  // совместимый с выбранной расой. Сохраняем motivation/secret/inventory/role.
  const raceMismatch = template.raceKey !== form.race;
  const genderPhysical = resolvedGenderPhysical(form.genderId);
  const seed = fnvHash(`${form.race}|${form.occupationValue}|${form.role}|${form.genderId}|${template.id ?? template.name}`);
  const displayName = raceMismatch
    ? synthesizeNameForRace(form.race, genderPhysical, seed)
    : template.name;
  const displayAppearance = raceMismatch
    ? appearanceForRace(form.race, raceRu, occupationRu, seed >>> 3)
    : template.appearance;
  const displayGenderRu = raceMismatch
    ? genderPhysical === "female"
      ? "Жен."
      : "Муж."
    : template.genderRu;

  const mannerSeed =
    "Держится уверенно, отмечает детали среды и заранее прикидывает две линии отступления.";

  const portraitPic = pickPortrait(npc.portraits, genderPhysical);
  const portrait = portraitPic.image ?? "";

  const markdownFull = [
    `# ${displayName}`,
    `- **Раса:** ${raceRu} · ${displayGenderRu}`,
    `- **Роль:** ${roleLabelRu} · **Занятие:** ${occupationRu}`,
    "",
    "## Облик",
    displayAppearance,
    "",
    "## Мотивация",
    motivation,
    "",
    "## Тайна",
    secret,
    "",
    "## Имущество",
    template.inventory,
    "",
    "_Браузерный режим: шаблон из app-content.json._",
  ].join("\n");

  return {
    name: displayName,
    epithet: "",
    raceRu,
    genderRu: displayGenderRu,
    roleLabelRu,
    occupationRu,
    appearance: displayAppearance,
    manner: mannerSeed,
    motivation,
    secret,
    catchphrase: "Сначала границы, потом доверие — и только потом имена.",
    inventory: template.inventory,
    portrait,
    dmQuick: {
      visual: displayAppearance.replace(/\s+/g, " ").trim().slice(0, 200),
      wants: motivation.slice(0, 200),
      avoids: mannerSeed.slice(0, 160),
      secret: secret.slice(0, 200),
    },
    markdownFull,
    pricingRollup: { totalZm: 0, totalSm: 0 },
    encounterMeetingRu: `Первая встреча: ${occupationRu} как ${roleLabelRu.toLowerCase()} — торг, намёки, проверка намерений.`,
  };
}

/**
 * Electron / IPC (npc-engine) или браузер: шаблоны из контента (`npc.templates`) + задержка из `database.mjs`.
 */
export type ResolveNpcCardResult = {
  card: ResolvedNpcCard | null;
  error?: string;
};

export async function resolveNpcCard(
  npc: AppContentJson["npc"],
  form: NpcSummonForm,
): Promise<ResolveNpcCardResult> {
  if (!npc.races?.length) {
    return { card: null, error: "В контенте нет рас NPC." };
  }

  const ipc = typeof window !== "undefined" ? window.electronAPI : undefined;

  if (typeof ipc?.generateNpc !== "function") {
    await generateNpcAsync();
    const tmpl = pickNpcTemplate(npc, form);
    if (!tmpl) {
      return { card: null, error: "Нет шаблонов NPC в app-content.json." };
    }
    return { card: templateToResolvedCard(tmpl, npc, form) };
  }

  const genderResolved = resolvedGenderPhysical(form.genderId);
  const professionId = OCCUPATION_TO_ENGINE_PROFESSION_ID[form.occupationValue] ?? "merchant";
  const partyRoleLabelRu = npc.roles.find((r) => r.value === form.role)?.labelRu ?? form.role;
  const contextTag = contextTagForBiome(form.biomeKey ?? "any");

  try {
    const res = await ipc.generateNpc({
      raceId: form.race,
      genderId: genderResolved,
      professionId,
      partyRoleLabelRu,
      contextTag,
    });
    if (res.ok && res.data && typeof res.markdown === "string") {
      const card = mapEnginePayloadToResolvedCard(
        res.data as Record<string, unknown>,
        res.markdown,
        npc,
        form,
      );
      if (card) return { card };
      return {
        card: null,
        error: "Движок вернул данные, но карточку собрать не удалось. Проверьте npc-engine.",
      };
    }
    if (!res.ok) {
      const msg = res.error?.trim() || "Ошибка генерации NPC.";
      console.warn("[ZERNIX] generateNpc IPC:", msg);
      return { card: null, error: msg };
    }
    return { card: null, error: "Пустой ответ от генератора NPC." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[ZERNIX] generateNpc IPC exception:", msg);
    return { card: null, error: msg };
  }
}
