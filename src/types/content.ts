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

export interface DashboardPartyMember {
  name: string;
  subtitle: string;
  level: number;
  hpCurrent: number;
  hpMax: number;
  /** Пусто или отсутствует — используются инициалы */
  avatarUrl?: string;
}

export interface DashboardActiveSession {
  title: string;
  tags: string[];
  members: DashboardPartyMember[];
  ctaLabel: string;
  ctaRoute: AppRoute;
}

export interface DashboardNoteEntry {
  icon: string;
  text: string;
  time: string;
}

export interface DashboardFavoriteEntry {
  icon: string;
  labelRu: string;
  sublabelRu?: string;
}

export interface DashboardSpellStat {
  labelRu: string;
  valueRu: string;
}

export interface DashboardFeaturedSpell {
  titleRu: string;
  subtitleRu: string;
  description: string;
  stats: DashboardSpellStat[];
  /** Имя иконки из IconByName или lucide-hint */
  iconHint?: string;
}

export interface DashboardJson {
  tagline?: string;
  activeSession?: DashboardActiveSession;
  recentNotes?: DashboardNoteEntry[];
  favorites?: DashboardFavoriteEntry[];
  featuredSpell?: DashboardFeaturedSpell;
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
  /** Макет главной (дашборд) и демо правой панели — подставляется из JSON */
  dashboard?: DashboardJson;
}
