import { generateLootAsync } from "../../services/mocks/database.mjs";
import { dbCategoriesForLootTypes } from "../../lib/lootDbCategories";
import {
  biomeIdForLootUi,
  contextTagForBiome,
  lootEnvironmentForUi,
  type LootLocationUiId,
} from "../../lib/zernixLocationCatalog";
import type { LootDigestPayload } from "../../types/lootDigest";
import type { GenerateLootPayload, GenerateLootResult } from "../../vite-env";
import { cardsFromLootDigest } from "../mapLootDigest";
import type { LootCardModel } from "../models";

export type LootFormBridge = {
  partyLevel: number;
  playerCount: number;
  difficultyUi: "low" | "medium" | "high";
  environmentUi: LootLocationUiId;
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
  return lootEnvironmentForUi(id);
}

export function buildLootPayload(form: LootFormBridge): GenerateLootPayload {
  const biomeId = biomeIdForLootUi(form.environmentUi);
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
    contextTag: contextTagForBiome(biomeId),
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

/**
 * Вычисляет бюджет золота на основе уровня группы, сложности и числа игроков.
 * Используется когда goldGp в форме равен 0 или является значением по умолчанию.
 */
function scaledGoldBudget(form: LootFormBridge): number {
  const lv = Math.max(1, Math.min(20, form.partyLevel));
  const cnt = Math.max(1, Math.min(8, form.playerCount));
  const diff = mapDifficulty(form.difficultyUi);
  const PER_PLAYER_BY_LEVEL: Record<string, number[]> = {
    low:      [8,  10, 15, 20, 35, 50, 75, 100, 130, 160, 200, 260, 320, 400, 480, 580, 680, 800, 950, 1100],
    moderate: [12, 18, 28, 40, 65, 90, 140, 190, 260, 340, 420, 540, 680, 820, 980, 1200, 1450, 1700, 2050, 2450],
    high:     [20, 32, 50, 80, 130, 200, 300, 420, 560, 720, 900, 1200, 1600, 2000, 2600, 3200, 4000, 5000, 6500, 8000],
  };
  return (PER_PLAYER_BY_LEVEL[diff]?.[lv - 1] ?? 100) * cnt;
}

/** Браузер / Vite: мок из `database.mjs` с учётом уровня, сложности и среды. */
async function runMockLootGeneration(form: LootFormBridge): Promise<LootBridgeResult> {
  const difficulty = mapDifficulty(form.difficultyUi);
  const environment = mapEnvironment(form.environmentUi);
  const biomeId = biomeIdForLootUi(form.environmentUi);

  // Pass selected type IDs so the mock respects category filters (e.g. "Potions only")
  const hasPartialSelection =
    form.selectedTypeIds.length > 0 && form.selectedTypeIds.length < form.typeIdsAll.length;
  const selectedTypeIds = hasPartialSelection ? form.selectedTypeIds : [];

  const item = await generateLootAsync({
    partyLevel: form.partyLevel,
    playerCount: form.playerCount,
    difficulty,
    environment,
    biomeId,
    onlyMagic: form.magicOnly,
    selectedTypeIds,
  });

  const goldBudget = form.goldGp > 0 ? form.goldGp : scaledGoldBudget(form);
  const goldLine = item.goldLine ?? `${goldBudget} зм (ур. ${form.partyLevel}, ${form.playerCount} игр., ${difficulty})`;

  const isMagic = ["weapon", "armour", "jewellery", "scroll", "potion"].includes(item.kind ?? "");

  const digest: LootDigestPayload = {
    needsRepair: false,
    labGold: "Найдено монет",
    labItems: "Обычные предметы",
    labMagic: "Магические предметы",
    goldLine,
    mundane: isMagic ? [] : [{ displayLine: item.name, statusLine: item.description, needsRepair: false }],
    magic: isMagic ? [{ displayLine: item.name, statusLine: item.description, needsRepair: false }] : [],
  };

  const cards = cardsFromLootDigest(digest).map((c) => ({
    ...c,
    id: newLootCardId(),
  }));

  const rarityLabel = item.rarity ?? "";
  const markdown = [
    `## ${item.name}`,
    rarityLabel ? `*${rarityLabel.charAt(0).toUpperCase() + rarityLabel.slice(1)}*` : "",
    "",
    item.description,
    "",
    `**${goldLine}**`,
    "",
    "_Браузерный режим: предварительный просмотр. Полная генерация доступна в Electron-версии._",
  ].filter((l) => l !== null).join("\n");

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
