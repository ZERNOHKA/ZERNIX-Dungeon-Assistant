/**
 * Type declarations for the browser mock database (database.mjs).
 * Electron path uses IPC (window.electronAPI.generateLoot) instead.
 */

export interface MockLootOpts {
  partyLevel?: number;
  playerCount?: number;
  /** "low" | "moderate" | "high" */
  difficulty?: string;
  /** "ruins" | "dungeon" | "city" | "wild" | "coastal" | "any" */
  environment?: string;
  /** Биом из zernixLocationCatalog — фильтр mock env-тегов */
  biomeId?: string;
  onlyMagic?: boolean;
  /**
   * Selected type IDs from UI (weapon | armor | potion | scroll | trinket | misc).
   * Empty array = no category filter (show all).
   */
  selectedTypeIds?: string[];
}

export interface MockLootRow {
  name: string;
  description: string;
  rarity: string;
  kind: string;
  /** Formatted gold string, e.g. "12 пм, 4 зм (ур. 5, 4 игр., high)" */
  goldLine: string;
  env?: string[];
}

export function generateLootAsync(opts?: MockLootOpts): Promise<MockLootRow>;
export function generateNpcAsync(): Promise<void>;
export function generateSessionAsync(): Promise<void>;
