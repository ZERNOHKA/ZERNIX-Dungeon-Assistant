/** Данные сводки лута из Electron loot-core (Master's Insight / износ). */

export interface LootItemDigestEntry {
  displayLine: string;
  needsRepair: boolean;
  /** Подпись для карточки состояния */
  statusLine?: string;
  /** Префикс NEXUS (ржавый / мастерской работы …) */
  conditionPrefixRu?: string;
  /** Заметка об ориентире цены после префикса */
  costAdjustNoteRu?: string;
}

export interface LootDigestPayload {
  needsRepair: boolean;
  labGold: string;
  labItems: string;
  labMagic: string;
  goldLine: string;
  mundane: LootItemDigestEntry[];
  magic: LootItemDigestEntry[];
}

/** Ответ IPC generate-loot — расширение контекста для UI */
export interface LootGenerateExtras {
  narrativeBlock?: string | null;
  lootDigest?: LootDigestPayload | null;
  needsRepair?: boolean;
}
