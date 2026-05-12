/**
 * Единый список биомов для «Подготовка сессии» и генератора лута (Electron / SQLite).
 * Значения `id` совпадают с `EncounterEnvironmentKey` в encounter-build.mjs.
 */
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
