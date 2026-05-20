/**
 * Единый каталог локаций ZERNIX: биомы, лут, сессии, NPC и contextTag для SQLite.
 * Значения `lootIpcEnvironment` согласованы с `tools/dnd-loot-sqlite` / encounter-build.
 */

export type BiomeId =
  | "any"
  | "coastal"
  | "cave"
  | "forest"
  | "mountain"
  | "dungeon"
  | "urban"
  | "arctic"
  | "swamp";

export type ContextTag = "urban" | "dungeon" | "wilderness";

export interface BiomeDefinition {
  id: BiomeId;
  /** Подпись для UI и markdown */
  labelRu: string;
  /** Ключ для IPC loot / session prep (SQLite) */
  lootIpcEnvironment: string;
  /** Веса `items.tags` / lore в SQLite */
  contextTag: ContextTag;
  /** Ключи для фильтра mock `LOOT_DATASET[].env` */
  mockEnvKeys: readonly string[];
  /** Теги монстров/сцен (session prep, dedup hints) */
  monsterTags: readonly string[];
  /** id занятий NPC (`app-content.json` occupations[].value), типичные для биома */
  occupationAffinity: readonly string[];
  /** Короткие сцены-конфликты для auto-environment */
  sceneBeats: readonly string[];
  /** Строки атмосферы для mock session */
  atmosphereLines: readonly string[];
  /** Патрули / угрозы для mock session */
  enemyLines: readonly string[];
  /** Подсказки наград для mock session */
  rewardHints: readonly string[];
}

/** UI лута: id селекта → биом */
export const LOOT_LOCATION_OPTIONS = [
  { id: "ruins", biomeId: "dungeon" as BiomeId, labelRu: "Древние руины" },
  { id: "dungeon", biomeId: "dungeon" as BiomeId, labelRu: "Подземелье" },
  { id: "city", biomeId: "urban" as BiomeId, labelRu: "Город" },
  { id: "wild", biomeId: "forest" as BiomeId, labelRu: "Дикие земли / лес" },
  { id: "coastal", biomeId: "coastal" as BiomeId, labelRu: "Побережье" },
  { id: "cave", biomeId: "cave" as BiomeId, labelRu: "Пещера" },
  { id: "mountain", biomeId: "mountain" as BiomeId, labelRu: "Горы" },
  { id: "swamp", biomeId: "swamp" as BiomeId, labelRu: "Болото" },
  { id: "arctic", biomeId: "arctic" as BiomeId, labelRu: "Север / тundra" },
] as const;

export type LootLocationUiId = (typeof LOOT_LOCATION_OPTIONS)[number]["id"];

export const SESSION_BIOME_OPTIONS = [
  { id: "any", label: "Any · Любое" },
  { id: "coastal", label: "Coastal · Побережье" },
  { id: "cave", label: "Cave · Пещера" },
  { id: "forest", label: "Forest · Лес" },
  { id: "mountain", label: "Mountain · Горы" },
  { id: "dungeon", label: "Dungeon · Подземелье / руины" },
  { id: "urban", label: "Urban · Город" },
  { id: "arctic", label: "Arctic · Север" },
  { id: "swamp", label: "Swamp · Болото" },
] as const;

const BIOMES: Record<BiomeId, BiomeDefinition> = {
  any: {
    id: "any",
    labelRu: "Смешанный биом",
    lootIpcEnvironment: "any",
    contextTag: "wilderness",
    mockEnvKeys: ["any"],
    monsterTags: ["humanoid", "beast"],
    occupationAffinity: ["merchant", "guide", "rogue"],
    sceneBeats: [
      "две стороны спорят за один узел — герои оказываются между",
      "исчезнувший караван оставил только клеймо фракции",
      "старый союзник просит услугу, которую нельзя отказать вслух",
    ],
    atmosphereLines: ["тишина «неправильная», будто кто-то затаился за углом"],
    enemyLines: ["Патруль с экономией сил («мы не враги, пока платят железом или информацией»)."],
    rewardHints: ["Смесь мундейна и магии: ценный ключ не от тех дверей, что хотелось."],
  },
  coastal: {
    id: "coastal",
    labelRu: "Побережье",
    lootIpcEnvironment: "coastal",
    contextTag: "wilderness",
    mockEnvKeys: ["coastal", "wild", "city"],
    monsterTags: ["humanoid", "bandit", "beast", "aquatic"],
    occupationAffinity: ["merchant", "rogue", "sailor", "fisher", "smuggler"],
    sceneBeats: [
      "контрабандисты используют старый дварфийский ход под причалом",
      "корабль/караван застрял: груз слишком «горячий» для таможни",
      "шторм выбросил на берег то, что должно было утонуть",
      "маяк горит не тем цветом — сигнал для чужих кораблей",
    ],
    atmosphereLines: ["слышен далёкий бой или колокол — порт на взводе", "пахнет озоном и железом — недавняя магия"],
    enemyLines: [
      "Банда контрабандистов с арбалетами на крышах складов.",
      "Морские рейдеры торгуются за проход, а не за жизни.",
    ],
    rewardHints: [
      "Якорная цепь с руной — ключ не от двери, а от тайника в рифах.",
      "Солёные монеты и печать гавани, которой не должно быть в этом порту.",
    ],
  },
  cave: {
    id: "cave",
    labelRu: "Пещера",
    lootIpcEnvironment: "cave",
    contextTag: "dungeon",
    mockEnvKeys: ["cave", "dungeon", "ruins"],
    monsterTags: ["beast", "undead", "construct"],
    occupationAffinity: ["guide", "guard", "prospector", "alchemist"],
    sceneBeats: [
      "тоннель затапливает — время на исходе",
      "камень стены свежий — кто-то недавно открыл проход",
      "эхо отвечает с задержкой, будто комната чуть шире, чем кажется",
      "колодец даёт не воду, а отголоски чужих разговоров",
    ],
    atmosphereLines: ["холод ползёт по костям даже у костра", "свет редкий — тени двигаются быстрее людей"],
    enemyLines: [
      "Стая летучих мышей-вампиров у потолка — шум поднимет их.",
      "Охрана простого аппарата: сигнал, ловушка, второй вход.",
    ],
    rewardHints: ["Кристаллы с зарядом «Огненный шар» — но только если не разбить при добыче."],
  },
  forest: {
    id: "forest",
    labelRu: "Лес",
    lootIpcEnvironment: "forest",
    contextTag: "wilderness",
    mockEnvKeys: ["wild", "forest", "ruins"],
    monsterTags: ["beast", "fey", "humanoid", "bandit"],
    occupationAffinity: ["guide", "hunter", "druid", "herbalist", "rogue"],
    sceneBeats: [
      "магическая болезнь расползается от источника в чаще",
      "пропал патруль; остались только знаки и тишина",
      "в тумане силуэты двигаются с задержкой — как код",
      "две фракции спорят за священную рощу — герои между",
    ],
    atmosphereLines: ["туман держит запах гнили и духов", "шёпот толпы: слухи уже побежали вперёд фактов"],
    enemyLines: [
      "Охотники на головы с ловушками на тропах.",
      "Друиды не пуска дальше без «дани» — не золотом.",
    ],
    rewardHints: ["Зелья и карты троп — следы недавнего каравана, который не дошёл."],
  },
  mountain: {
    id: "mountain",
    labelRu: "Горы",
    lootIpcEnvironment: "mountain",
    contextTag: "wilderness",
    mockEnvKeys: ["mountain", "wild", "cave"],
    monsterTags: ["giant", "beast", "humanoid", "dragon"],
    occupationAffinity: ["guide", "prospector", "guard", "blacksmith"],
    sceneBeats: [
      "перевал закрыт лавиной — альтернативный путь ведёт через чужой лагерь",
      "орлы кружат над телом — кто-то уже проиграл эту высоту",
      "каменные големы просыпаются от звона металла",
      "обвал открыл вход в дварфийскую кладовую",
    ],
    atmosphereLines: ["воздух сырой, как старый плащ", "ветер режет слух — команды слышны за сотню футов"],
    enemyLines: [
      "Наёмники у перевала берут плату за проход — или за молчание.",
      "Грифы на скалах — знак, что добычу уже нашли.",
    ],
    rewardHints: ["Руда и кузнечные клейма — след ордена, который здесь не должен быть."],
  },
  dungeon: {
    id: "dungeon",
    labelRu: "Подземелье",
    lootIpcEnvironment: "dungeon",
    contextTag: "dungeon",
    mockEnvKeys: ["dungeon", "ruins", "cave"],
    monsterTags: ["undead", "construct", "humanoid", "cultist"],
    occupationAffinity: ["guard", "scholar", "rogue", "temple_acolyte"],
    sceneBeats: [
      "культ прячет тело и спешит замести следы",
      "ритуал почти завершён — осталось одно действие",
      "поддельные документы ведут к настоящей ловушке",
      "подземный аукцион чужих имён",
    ],
    atmosphereLines: ["свет редкий — тени двигаются быстрее людей"],
    enemyLines: [
      "Патруль с экономией сил («мы не враги, пока платят железом или информацией»).",
      "Охрана простого аппарата: сигнал, ловушка, второй вход.",
    ],
    rewardHints: ["Магические следы сильнее мундейна: ценный ключ не от тех дверей, что хотелось."],
  },
  urban: {
    id: "urban",
    labelRu: "Город",
    lootIpcEnvironment: "urban",
    contextTag: "urban",
    mockEnvKeys: ["city", "urban"],
    monsterTags: ["humanoid", "bandit", "cultist"],
    occupationAffinity: ["merchant", "scholar", "guard", "rogue", "innkeeper", "lawyer"],
    sceneBeats: [
      "дворяне продают пленников под видом «найма»",
      "стража берёт взятки, но кто-то всё равно сдаёт сигнал",
      "на площади объявление с чужим портретом — похож на одного из героев",
      "ложная охота на ведьму: кто-то подставляет чужое имя",
    ],
    atmosphereLines: ["слышен далёкий бой или колокол — город на взводе", "шёпот толпы: слухи уже побежали вперёд фактов"],
    enemyLines: [
      "Гильдейские стражи и частная охрана торгуют доступом.",
      "Информатор продаёт адрес — но адрес ведёт в засаду.",
    ],
    rewardHints: ["Гильдейские печати и контракты — цена в репутации, не в золоте."],
  },
  arctic: {
    id: "arctic",
    labelRu: "Север",
    lootIpcEnvironment: "arctic",
    contextTag: "wilderness",
    mockEnvKeys: ["arctic", "wild", "mountain"],
    monsterTags: ["beast", "undead", "giant"],
    occupationAffinity: ["guide", "hunter", "trader", "survivalist"],
    sceneBeats: [
      "метель скрывает следы — к утру их не будет вовсе",
      "замёрзший караван: товары целы, людей нет",
      "aurora над ледяным озером — под льдом что-то движется",
      "белый медведь охраняет не добычу, а круг рун",
    ],
    atmosphereLines: ["холод ползёт по костям даже у костра"],
    enemyLines: [
      "Охотники северных племён проверяют, чужак ли ты.",
      "Нежить из замёрзшей экспедиции — они не чувствуют холода.",
    ],
    rewardHints: ["Тёплые шкуры и зачарованные обогреватели — редкость, за которую убивают."],
  },
  swamp: {
    id: "swamp",
    labelRu: "Болото",
    lootIpcEnvironment: "swamp",
    contextTag: "wilderness",
    mockEnvKeys: ["swamp", "wild", "coastal"],
    monsterTags: ["beast", "undead", "fey", "humanoid"],
    occupationAffinity: ["guide", "herbalist", "witch", "rogue"],
    sceneBeats: [
      "сделка с hag: цена формулируется двусмысленно",
      "заражённый источник воды/кристалла портит всё вокруг",
      "тоннель затапливает — время на исходе",
      "светлячки складываются в стрелку — кто-то хочет, чтобы за вами пошли",
    ],
    atmosphereLines: ["туман держит запах гнили и духов", "воздух сырой, как старый плащ"],
    enemyLines: [
      "Болотные тrollы торгуются за безопасный проход.",
      "Ядовитые змеи и лягушки-стражи у кочек.",
    ],
    rewardHints: ["Редкие травы и ампулы — но каждая пузырька может быть проклята."],
  },
};

export function getBiome(id: string): BiomeDefinition {
  const k = String(id ?? "any").trim().toLowerCase() as BiomeId;
  return BIOMES[k] ?? BIOMES.any;
}

export function biomeLabelRu(id: string): string {
  return getBiome(id).labelRu;
}

export function lootEnvironmentForBiome(id: string): string {
  return getBiome(id).lootIpcEnvironment;
}

export function contextTagForBiome(id: string): ContextTag {
  return getBiome(id).contextTag;
}

export function lootEnvironmentForUi(uiId: string): string {
  const row = LOOT_LOCATION_OPTIONS.find((o) => o.id === uiId);
  return lootEnvironmentForBiome(row?.biomeId ?? "dungeon");
}

export function biomeIdForLootUi(uiId: string): BiomeId {
  const row = LOOT_LOCATION_OPTIONS.find((o) => o.id === uiId);
  return row?.biomeId ?? "dungeon";
}

export function mockEnvKeysForBiome(id: string): readonly string[] {
  return getBiome(id).mockEnvKeys;
}

export function allSceneBeatsFlat(): string[] {
  const out: string[] = [];
  for (const b of Object.values(BIOMES)) {
    out.push(...b.sceneBeats);
  }
  return out;
}

export function sceneBeatsForBiome(id: string): readonly string[] {
  const b = getBiome(id);
  return b.sceneBeats.length ? b.sceneBeats : BIOMES.any.sceneBeats;
}

export function pickFromBiome<T>(_biomeId: string, pool: readonly T[], seed: number): T {
  if (!pool.length) return pool[0] as T;
  return pool[Math.abs(seed) % pool.length]!;
}

/** Занятия, логичные для биома (для фильтра шаблонов NPC в браузере). */
export function occupationMatchesBiome(occupationValue: string, biomeId: string): boolean {
  const aff = getBiome(biomeId).occupationAffinity;
  if (!aff.length) return true;
  return aff.includes(occupationValue);
}
