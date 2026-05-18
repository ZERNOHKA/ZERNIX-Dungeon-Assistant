import type { LucideIcon } from "lucide-react";

/** Состояние превью NPC в кодексе и форме — только короткие стол-блоки */
export type NpcPreviewState = {
  name: string;
  race: string;
  creatureClass: string;
  portraitLetter: string;
  visualTrait: string;
  wantLine: string;
  avoidLine: string;
  secretLine: string;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
};

export const DEFAULT_NPC_PREVIEW: NpcPreviewState = {
  name: "Жми «Сгенерировать NPC»",
  race: "—",
  creatureClass: "Союзник",
  portraitLetter: "?",
  visualTrait: "Жест или деталь одежды — чтобы узнать за столом без имени.",
  wantLine: "Выгода или спокойствие: конкретная цель, без лирики.",
  avoidLine: "Тема, от которой он отмахивается или уходит в молчание.",
  secretLine: "Один факт, который можно вытащить давлением или сделкой.",
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
};

export function defaultNpcPreview(): NpcPreviewState {
  return { ...DEFAULT_NPC_PREVIEW };
}

/** Карточка лута для сетки и кодекса — из lootDigest + генератора */
export interface LootCardModel {
  id: string;
  title: string;
  rarityLabel: string;
  kindLabel: string;
  description: string;
  needsRepair?: boolean;
  source: "magic" | "mundane";
  /** Исходная строка движка */
  displayLine: string;
}

/** Краткая сводка сессии для превью (полный текст — sessionMarkdown) */
export interface SessionPreviewModel {
  title: string;
  excerpt: string;
}

/** Заклинание / состояние для кодекса */
export interface SpellCardModel {
  id: string;
  name: string;
  subtitle: string;
  badge: string;
  body: string;
  metaLines?: { label: string; value: string }[];
  Icon?: LucideIcon;
}
