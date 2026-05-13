/// <reference types="vite/client" />

export interface GenerateLootPayload {
  /** Бюджет гибридного лота (gp) и верхний ориентир для генератора */
  gold: number;
  /** Подстроки категорий БД; пустой = без фильтра по категории */
  categories?: string[];
  partyLevel: number;
  playerCount: number;
  /** D&D 5.5: low | moderate | high (принимаются и старые easy…deadly) */
  difficulty: string;
  environment: string;
  onlyMagic: boolean;
  /** Отдельный бросок hoard на каждый сундук */
  chestCount?: number;
  /** Логировать SQL и контекст в консоль (DevTools) и в ответе `sqlLog` */
  debugSql?: boolean;
  /** Контекстный тег для весов `items.tags` / lore (urban, dungeon, wilderness) */
  contextTag?: string;
  /** Только старый «гибрид по CR» без встречи */
  legacyHybrid?: boolean;
  /** @deprecated Использовалось в старой версии Electron */
  cr?: number;
}

export interface SessionPrepMeta {
  primaryEncounterTrace: string;
  chainTagsFromPrimaryTrace: string[];
  floorDepthEcho: number;
  /** +0.15 если отряд прошлой генерации был в роли разведки (тревога в следующей комнате). */
  scoutAlarmNextRoomXpBonus?: number;
  partyLevel?: number;
  playerCount?: number;
  difficulty?: string;
  /** Идентификатор сценической темы из `session-scene-themes.mjs`. */
  sessionThemeId?: string;
  /** Тип сцены: combat | social | exploration | mystery | horror | chase — см. `session-scene-types.mjs`. */
  sessionSceneTypeId?: string;
  /** Нарративный биом (laboratory, city, cave, …) — см. `location-context.mjs`. */
  narrativeBiomeId?: string;
  /** Id структурированной локации из `dm-location-catalog.mjs`. */
  dmLocationId?: string;
}

/** Компактный стол-бриф для живой игры — без markdown; стилизует UI. */
export interface SessionBrief {
  title: string;
  /** Сцена привязана к теме — все блоки согласованы с ней. */
  themeLabel: string;
  /** Тип сцены (ритм): бой, социалка, тайна… */
  sceneTypeLabel?: string;
  sceneTypeId?: string;
  /** Логический биом для кураторства врагов/опасностей */
  biomeLabel?: string;
  /** Одно предложение: что происходит и кто в центре */
  encounterPitch?: string;
  /** Краткий контекст региона / угрозы */
  worldSummary?: string;
  /** Фракции сцены для ГМ */
  factionHintsLine?: string;
  /** Имя структурированной локации (каталог DM) */
  locationStructuredName?: string;
  /** Зоны / комнаты цепочкой */
  locationZonesLine?: string;
  location: string;
  atmosphere: string;
  danger: string;
  enemies: string[];
  rewardLines: string[];
  hook: string;
}

/** Сводка предметов с флагами износа — см. `lootDigest.ts` (идентичная форма). */
export interface LootDigestPayload {
  needsRepair: boolean;
  labGold: string;
  labItems: string;
  labMagic: string;
  goldLine: string;
  mundane: Array<{
    displayLine: string;
    needsRepair: boolean;
    statusLine?: string;
    conditionPrefixRu?: string;
    costAdjustNoteRu?: string;
  }>;
  magic: Array<{
    displayLine: string;
    needsRepair: boolean;
    statusLine?: string;
    conditionPrefixRu?: string;
    costAdjustNoteRu?: string;
  }>;
}

export type GenerateLootResult =
  | {
      ok: true;
      markdown: string;
      sqlLog?: string[];
      meta?: SessionPrepMeta;
      sessionBrief?: SessionBrief;
      /** Связный текст контекстного поиска (карточка истории под сводкой золота); включает `[MASTER_ONLY]` для ГМ */
      narrativeBlock?: string;
      lootDigest?: LootDigestPayload;
      /** Хотя бы один предмет с износом (ремонт через NPC-ремесленников) */
      needsRepair?: boolean;
    }
  | { ok: false; error: string };

/** Память подземелья (цепочка комнат) — см. `dungeonSessionMemory.ts`. */
export interface DungeonSessionPayload {
  floorDepth: number;
  persistentTags: string[];
  difficultyBias: number;
  previousTraceForHeader?: string | null;
  transitionMarkdown?: string | null;
}

export interface SessionPrepPayload {
  partyLevel: number;
  playerCount: number;
  difficulty: string;
  packCount: number;
  chestCount: number;
  environmentText: string;
  /** Явный биом для SQL-пула монстров: cave | forest | dungeon | urban | any */
  environmentKey?: string;
  onlyMagic?: boolean;
  dungeonSession?: DungeonSessionPayload | null;
  /** `desecrated` — проклятие жадности на сокровищнице (ZERNIX Legacy Loot Ultra); иначе ~6% случайно */
  hoardOrigin?: string;
}

export interface SceneLootPayload {
  /** Биом как в генераторе лута: forest | cave | dungeon | urban | … */
  environment?: string;
  environmentKey?: string;
  /** Сколько разных «точек» на сцене (1–8) */
  stashCount?: number;
}

/** Запрос к npc-engine.generateNPC (IPC). */
export interface GenerateNpcPayload {
  raceId?: string;
  genderId?: "female" | "male";
  greetingMood?: string;
  professionId?: string;
  /** Подпись роли из UI (Союзник, Наставник…) — во фразу «встречи» */
  partyRoleLabelRu?: string;
  /** Контекст для БД: urban | dungeon | wilderness */
  contextTag?: string;
  /** Режим «Босс»: +50% HP, +2 КД, легендарная черта */
  bossMode?: boolean;
}

export type GenerateNpcResult =
  | { ok: true; data: Record<string, unknown>; markdown: string }
  | { ok: false; error: string };

/** Настройки сети (Electron main ↔ JSON в userData). */
export interface NetworkSettingsState {
  serveAsHost: boolean;
  serverPort: number;
  remoteServerUrl: string;
  apiKey: string;
  /** Вычисленный базовый URL с учётом REMOTE_SERVER_URL */
  effectiveRemoteUrl?: string;
  envRemoteOverride?: boolean;
  serving?: boolean;
  /** Полная сборка с loot-core / npc-engine */
  localEnginesPresent?: boolean;
  /** Нет движков и не задан удалённый хост (полная сборка) */
  needsHostConnection?: boolean;
  /** Клиентская сборка NSIS: только удалённый API */
  isClientOnlyBuild?: boolean;
  /** Клиентская сборка: не заполнены URL и/или API-ключ */
  needsRemoteCredentials?: boolean;
  clientRemoteRequiredMessage?: string;
}

export interface NetworkSettingsSetResult {
  ok: boolean;
  settings?: NetworkSettingsState;
}

export interface ElectronAPI {
  generateLoot: (payload: GenerateLootPayload) => Promise<GenerateLootResult>;
  generateSessionPrep: (payload: SessionPrepPayload) => Promise<GenerateLootResult>;
  generateSceneLoot: (payload: SceneLootPayload) => Promise<GenerateLootResult>;
  generateNpc: (payload: GenerateNpcPayload) => Promise<GenerateNpcResult>;
  getNetworkSettings: () => Promise<NetworkSettingsState>;
  setNetworkSettings: (partial: Partial<NetworkSettingsState>) => Promise<NetworkSettingsSetResult>;
  onRequireRemoteConfig?: (callback: (payload: { message?: string }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
