import type { LootItemDigestEntry } from "../types/lootDigest";

const CONSUMABLE_RE =
  /зелье|свиток|эликсир|фляжка|склянка|умбер|лечени|склян|настой|фильтр|potion|scroll/i;

/** Делит бытовые строки сводки на «расходники» и «прочие предметы» по эвристике текста. */
export function partitionLootMundane(entries: LootItemDigestEntry[]) {
  const consumables: LootItemDigestEntry[] = [];
  const items: LootItemDigestEntry[] = [];
  for (const e of entries) {
    if (CONSUMABLE_RE.test(e.displayLine)) consumables.push(e);
    else items.push(e);
  }
  return { consumables, items };
}
