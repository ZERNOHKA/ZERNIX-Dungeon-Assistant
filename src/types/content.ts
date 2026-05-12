import type { AppRoute, RootTab } from "./routes";

export type LootRarityKey = keyof AppContentJson["loot"]["rarities"];

export interface StatusEntry {
  id: string;
  name: string;
  summary: string;
  iconHint: string;
}

export interface LootItem {
  id: string;
  name: string;
  /** Локализованное имя (если когда-либо придёт с бэкенда / каталога); иначе UI использует `name`. */
  nameRu?: string;
  rarityKey: LootRarityKey;
  flavor: string;
  /** Локализованное описание (опционально). */
  flavorRu?: string;
  image: string;
  stats: string[];
  typeId: string;
  magic: boolean;
}

export interface NpcOccupationOption {
  value: string;
  labelRu: string;
}

export interface NpcRoleOption {
  value: string;
  labelRu: string;
}

export interface NpcRaceOption {
  value: string;
  labelRu: string;
}

export interface NpcPortrait {
  id: string;
  image: string;
}

export interface NpcTemplateEntry {
  id: string;
  raceKey: string;
  roleKey: string;
  name: string;
  genderRu: string;
  occupationRu: string;
  appearance: string;
  motivation: string;
  inventory: string;
  portraitKey: string;
  /** Теги для подбора по описанию локации (session-prep) */
  tags?: string[];
}

export interface SessionPrepEnvironmentHint {
  fragments: string[];
  tags: string[];
}

export interface SessionPrepJson {
  wholesaleLoot: {
    chestPrefix: string;
    packPrefix: string;
    packItemCountMin: number;
    packItemCountMax: number;
  };
  environmentHints: SessionPrepEnvironmentHint[];
}

export interface AppContentJson {
  meta: {
    title: string;
    subtitle: string;
  };
  navigation: {
    homeCards: Array<{
      id: string;
      titleRu: string;
      subtitleRu: string;
      icon: string;
      route: AppRoute;
    }>;
    footerTabs: Array<{
      id: RootTab;
      labelRu: string;
      route: AppRoute;
      icon: string;
    }>;
  };
  loot: {
    partyLevels: string[];
    types: Array<{ id: string; labelRu: string; icon: string }>;
    rarities: Record<string, { labelRu: string; colorHex: string }>;
    catalog: LootItem[];
  };
  npc: {
    races: NpcRaceOption[];
    occupations: NpcOccupationOption[];
    roles: NpcRoleOption[];
    genderSegment: Array<{ id: string; labelRu: string }>;
    portraits: NpcPortrait[];
    templates: NpcTemplateEntry[];
  };
  statuses: StatusEntry[];
  sessionPrep?: SessionPrepJson;
}
