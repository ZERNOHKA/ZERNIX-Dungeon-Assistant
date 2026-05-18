import type { LootDigestPayload, LootItemDigestEntry } from "../types/lootDigest";
import type { LootCardModel } from "./models";

function extractTitle(displayLine: string): string {
  const line = displayLine.trim();
  if (!line) return "Предмет";
  const cut = line.split(/[—–\-]/)[0]?.trim() ?? line;
  return cut.length > 72 ? `${cut.slice(0, 69)}…` : cut;
}

function inferRarity(displayLine: string): string {
  const lower = displayLine.toLowerCase();
  if (/легендарн|legendary/i.test(lower)) return "Легендарный";
  if (/очень редк|very rare/i.test(lower)) return "Очень редкий";
  if (/редк|rare(?!\w)/i.test(lower)) return "Редкий";
  if (/необычн|uncommon/i.test(lower)) return "Необычный";
  if (/обычн|common/i.test(lower)) return "Обычный";
  return "—";
}

function buildDescription(entry: LootItemDigestEntry): string {
  const title = extractTitle(entry.displayLine);
  const extra = [entry.conditionPrefixRu, entry.statusLine].filter(Boolean).join(" · ");
  const line = extra ? `${title} — ${extra}` : title;
  const t = line.replace(/\s+/g, " ").trim();
  if (t.length <= 88) return t;
  const cut = t.slice(0, 85);
  const sp = cut.lastIndexOf(" ");
  return `${sp > 32 ? cut.slice(0, sp) : cut}…`;
}

function entryToCard(entry: LootItemDigestEntry, index: number, prefix: "m" | "g", source: LootCardModel["source"]): LootCardModel {
  const kindLabel = source === "magic" ? "Магический предмет" : "Обычный предмет";
  return {
    id: `${prefix}-${index}`,
    title: extractTitle(entry.displayLine),
    rarityLabel: inferRarity(entry.displayLine),
    kindLabel,
    description: buildDescription(entry),
    needsRepair: entry.needsRepair,
    source,
    displayLine: entry.displayLine,
  };
}

/** Преобразование digest IPC → карточки UI */
export function cardsFromLootDigest(digest: LootDigestPayload): LootCardModel[] {
  const mundane = digest.mundane.map((e, i) => entryToCard(e, i, "m", "mundane"));
  const magic = digest.magic.map((e, i) => entryToCard(e, i, "g", "magic"));
  return [...mundane, ...magic];
}
