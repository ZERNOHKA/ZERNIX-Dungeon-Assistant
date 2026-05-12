import type { LootItem, SessionPrepEnvironmentHint } from "../types/content";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateWholesaleLootText(
  catalog: LootItem[],
  chestCount: number,
  packCount: number,
  wholesale: { chestPrefix: string; packPrefix: string; packItemCountMin: number; packItemCountMax: number },
  rarityLabels: Record<string, string>
): string {
  if (catalog.length === 0) return "Каталог предметов пуст.";
  const lines: string[] = ["— ОПТОВЫЙ ЛУТ —", ""];

  for (let i = 1; i <= chestCount; i++) {
    const item = pick(catalog);
    const rar = rarityLabels[item.rarityKey] ?? item.rarityKey;
    lines.push(`${wholesale.chestPrefix} ${i}: ${item.name} (${rar})`);
  }

  for (let g = 1; g <= packCount; g++) {
    const count = Math.min(
      catalog.length,
      Math.max(1, randomInt(wholesale.packItemCountMin, wholesale.packItemCountMax))
    );
    const shuffled = [...catalog].sort(() => Math.random() - 0.5);
    const names: string[] = [];
    const uniqueTake = Math.min(count, shuffled.length);
    for (let i = 0; i < uniqueTake; i++) {
      const item = shuffled[i];
      const rar = rarityLabels[item.rarityKey] ?? item.rarityKey;
      names.push(`${item.name} (${rar})`);
    }
    while (names.length < count) {
      const item = pick(catalog);
      const rar = rarityLabels[item.rarityKey] ?? item.rarityKey;
      names.push(`${item.name} (${rar})`);
    }
    lines.push(`${wholesale.packPrefix} ${g}: ${names.join(", ")}`);
  }

  if (chestCount === 0 && packCount === 0) {
    lines.push("(Укажите хотя бы один сундук или одну группу монстров.)");
  }

  return lines.join("\n").trimEnd();
}

export function inferTagsFromDescription(description: string, hints: SessionPrepEnvironmentHint[]): Set<string> {
  const normalized = description.trim().toLocaleLowerCase("ru-RU");
  const out = new Set<string>();
  if (!normalized) return out;
  for (const row of hints) {
    for (const frag of row.fragments) {
      if (normalized.includes(frag.toLocaleLowerCase("ru-RU"))) {
        row.tags.forEach((t) => out.add(t));
        break;
      }
    }
  }
  return out;
}

export interface NpcForSession {
  id: string;
  name: string;
  raceRu: string;
  occupationRu: string;
  motivation: string;
  tags: string[];
}

/** Теги NPC, несовместимые с выбранным биомом (подготовка сессии). */
const BIOME_EXCLUDES_TAGS: Record<string, readonly string[]> = {
  cave: ["forest", "coastal", "swamp"],
  forest: ["cave", "urban"],
  mountain: ["swamp", "coastal", "urban"],
  coastal: ["mountain", "cave"],
  urban: ["forest", "coastal"],
  swamp: ["mountain", "arctic"],
  arctic: ["swamp", "coastal"],
  dungeon: ["forest", "coastal"],
  crypt: ["forest", "coastal"],
  any: [],
};

function npcExcludedByBiome(tags: string[], biomeKey: string): boolean {
  const b = biomeKey.trim().toLowerCase();
  if (!b || b === "any") return false;
  const blocked = BIOME_EXCLUDES_TAGS[b];
  if (!blocked?.length) return false;
  return tags.some((t) => blocked.includes(String(t).toLowerCase()));
}

export function selectNpcsForEnvironment(
  npcs: Array<{
    id: string;
    name: string;
    raceKey: string;
    occupationRu: string;
    motivation: string;
    tags?: string[];
  }>,
  raceLabels: Record<string, string>,
  description: string,
  hints: SessionPrepEnvironmentHint[],
  maxShown = 3,
  biomeKey = "any"
): NpcForSession[] {
  const tagSet = inferTagsFromDescription(description, hints);

  const enriched = npcs.map((n) => ({
    id: n.id,
    name: n.name,
    raceRu: raceLabels[n.raceKey] ?? n.raceKey,
    occupationRu: n.occupationRu,
    motivation: n.motivation,
    tags: n.tags ?? [],
  }));

  let pool = enriched.filter((n) => !npcExcludedByBiome(n.tags, biomeKey));
  if (pool.length === 0) {
    pool = enriched;
  }
  if (tagSet.size > 0) {
    const matched = pool.filter((n) => n.tags.some((t) => tagSet.has(t)));
    if (matched.length > 0) pool = matched;
  }

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(maxShown, shuffled.length));
}

export function formatNpcsForPaste(npcs: NpcForSession[]): string {
  if (npcs.length === 0) return "Подходящих жителей по тегам не найдено.";
  const lines: string[] = ["— ЖИТЕЛИ ЛОКАЦИИ —", ""];
  npcs.forEach((n, idx) => {
    lines.push(`${idx + 1}. ${n.name} — ${n.raceRu}, ${n.occupationRu}`);
    lines.push(`   Мотивация / тайна: ${n.motivation}`);
    if (n.tags.length) lines.push(`   Теги: ${n.tags.join(", ")}`);
    lines.push("");
  });
  return lines.join("\n").trimEnd();
}

export const defaultSessionPrepFallback = {
  wholesaleLoot: {
    chestPrefix: "Сундук",
    packPrefix: "Добыча с группы монстров",
    packItemCountMin: 2,
    packItemCountMax: 4,
  },
  environmentHints: [] as SessionPrepEnvironmentHint[],
};
