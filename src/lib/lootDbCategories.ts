/**
 * Ключи UI (`loot.types[].id`) → подстроки для фильтра строк SQLite (`items.category` / `subcategory`).
 * В БД магические предметы имеют вид `Magic: Weapon` и т.д. (см. импорт SRD).
 */
export const LOOT_TYPE_DB_KEYWORDS: Record<string, string[]> = {
  weapon: ["magic: weapon"],
  armor: ["magic: armor"],
  potion: ["magic: potion"],
  scroll: ["scroll"],
  trinket: ["wondrous"],
  misc: ["ring", "rod", "staff", "wand", "ammunition", "tattoo"],
};

/**
 * @param selectedTypeIds выбранные id типов из контента
 * @param allTypeIds все id типов на экране; если выбрано всё или ничего — без фильтра (`[]`)
 * @returns строки для `generateLootHybrid(..., categories)`
 */
export function dbCategoriesForLootTypes(selectedTypeIds: string[], allTypeIds: string[]): string[] {
  const all = new Set(allTypeIds);
  const sel = selectedTypeIds.filter((id) => all.has(id));
  if (sel.length === 0 || sel.length === all.size) {
    return [];
  }
  const out: string[] = [];
  for (const id of sel) {
    const kws = LOOT_TYPE_DB_KEYWORDS[id];
    if (kws) {
      out.push(...kws);
    }
  }
  return [...new Set(out)];
}
