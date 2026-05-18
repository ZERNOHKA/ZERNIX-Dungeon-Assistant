import { generateLootAsync } from "../../database.mjs";
import { dbCategoriesForLootTypes } from "../../lib/lootDbCategories";
import type { LootDigestPayload } from "../../types/lootDigest";
import type { GenerateLootPayload, GenerateLootResult } from "../../vite-env";
import { cardsFromLootDigest } from "../mapLootDigest";
import type { LootCardModel } from "../models";

export type LootFormBridge = {
  partyLevel: number;
  playerCount: number;
  difficultyUi: "low" | "medium" | "high";
  environmentUi: "ruins" | "dungeon" | "city" | "wild";
  goldGp: number;
  selectedTypeIds: string[];
  typeIdsAll: string[];
  magicOnly: boolean;
  chestCount: number;
};

function mapDifficulty(id: LootFormBridge["difficultyUi"]): string {
  if (id === "low") return "low";
  if (id === "high") return "high";
  return "moderate";
}

function mapEnvironment(id: LootFormBridge["environmentUi"]): string {
  const map: Record<LootFormBridge["environmentUi"], string> = {
    ruins: "dungeon",
    dungeon: "dungeon",
    city: "urban",
    wild: "wilderness",
  };
  return map[id] ?? "dungeon";
}

export function buildLootPayload(form: LootFormBridge): GenerateLootPayload {
  const categories =
    form.selectedTypeIds.length > 0 && form.selectedTypeIds.length < form.typeIdsAll.length
      ? dbCategoriesForLootTypes(form.selectedTypeIds, form.typeIdsAll)
      : undefined;
  return {
    gold: Math.max(1, Math.floor(form.goldGp)),
    categories,
    partyLevel: form.partyLevel,
    playerCount: form.playerCount,
    difficulty: mapDifficulty(form.difficultyUi),
    environment: mapEnvironment(form.environmentUi),
    onlyMagic: form.magicOnly,
    chestCount: Math.max(0, Math.min(24, form.chestCount)),
  };
}

export type LootBridgeResult =
  | {
      ok: true;
      cards: LootCardModel[];
      markdown: string;
      digest: LootDigestPayload | null;
      narrativeBlock: string | null;
      needsRepair: boolean;
    }
  | { ok: false; error: string; cards: LootCardModel[] };

function newLootCardId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `loot-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Браузер / Vite: мок из `database.mjs` (те же карточки + digest, что и у IPC-пайплайна). */
async function runMockLootGeneration(form: LootFormBridge): Promise<LootBridgeResult> {
  const item = await generateLootAsync();

  const goldLine = `Браузерный режим: случайная строка из mock-таблицы LOOT_DATASET — ${form.environmentUi}, ур. ${form.partyLevel}, ${form.playerCount} игр., золото формы ${Math.max(1, Math.floor(form.goldGp))} зм.`;

  const digest: LootDigestPayload = {
    needsRepair: false,
    labGold: "",
    labItems: "",
    labMagic: "",
    goldLine,
    mundane: [],
    magic: [
      {
        displayLine: item.name,
        statusLine: item.description,
        needsRepair: false,
      },
    ],
  };

  const cards = cardsFromLootDigest(digest).map((c) => ({
    ...c,
    id: newLootCardId(),
  }));

  const markdown = `## ${item.name}\n\n${item.description}\n\n*${goldLine}*\n`;

  return {
    ok: true,
    cards,
    markdown,
    digest,
    narrativeBlock: null,
    needsRepair: false,
  };
}

/** IPC generateLoot в Electron или mock из `database.mjs` в браузере — одна точка входа для UI. */
export async function runLootGeneration(form: LootFormBridge): Promise<LootBridgeResult> {
  const ipc = typeof window !== "undefined" ? window.electronAPI : undefined;

  if (typeof ipc?.generateLoot !== "function") {
    return await runMockLootGeneration(form);
  }

  const payload = buildLootPayload(form);
  let res: GenerateLootResult;
  try {
    res = await ipc.generateLoot(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, cards: [] };
  }
  if (!res.ok) {
    return { ok: false, error: res.error, cards: [] };
  }
  const digest = res.lootDigest ?? null;
  const cards = digest ? cardsFromLootDigest(digest) : [];
  return {
    ok: true,
    cards,
    markdown: res.markdown,
    digest,
    narrativeBlock: res.narrativeBlock ?? null,
    needsRepair: Boolean(res.needsRepair),
  };
}
