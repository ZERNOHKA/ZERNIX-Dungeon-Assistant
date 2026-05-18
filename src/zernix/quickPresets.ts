import type { NpcSummonForm } from "../lib/npcSummon";
import type { LootCardModel } from "./models";
import type { NpcPreviewState } from "./models";
import type { LootFormBridge } from "./generators/lootBridge";
import type { SessionFormBridge } from "./generators/sessionBridge";

export type QuickPresetId =
  | "npc_tavern"
  | "npc_merchant"
  | "npc_guard"
  | "npc_bandit"
  | "npc_ally"
  | "npc_boss"
  | "scene_random"
  | "scene_dungeon"
  | "loot_quick"
  | "hook";

export type QuickPresetMeta = {
  id: QuickPresetId;
  labelRu: string;
  shortRu: string;
};

export const QUICK_PRESETS: readonly QuickPresetMeta[] = [
  { id: "npc_tavern", labelRu: "NPC в трактире", shortRu: "Трактир" },
  { id: "npc_merchant", labelRu: "Подозрительный торговец", shortRu: "Торговец" },
  { id: "npc_guard", labelRu: "Городской стражник", shortRu: "Страж" },
  { id: "npc_bandit", labelRu: "Бандит с секретом", shortRu: "Бандит" },
  { id: "npc_ally", labelRu: "Союзник партии", shortRu: "Союзник" },
  { id: "npc_boss", labelRu: "Босс сцены", shortRu: "Босс" },
  { id: "scene_random", labelRu: "Случайная сцена", shortRu: "Сцена" },
  { id: "scene_dungeon", labelRu: "Подземелье", shortRu: "Подземелье" },
  { id: "loot_quick", labelRu: "Быстрый лут", shortRu: "Лут" },
  { id: "hook", labelRu: "Крючок приключения", shortRu: "Крючок" },
] as const;

export type QuickPresetResult =
  | { kind: "npc"; npc: NpcPreviewState }
  | { kind: "loot"; card: LootCardModel }
  | { kind: "scene"; title: string; excerpt: string }
  | { kind: "hook"; line: string }
  | { kind: "noop" };

type Ctx = {
  setNpcForm: (p: Partial<NpcSummonForm>) => void;
  setLootForm: (p: Partial<LootFormBridge>) => void;
  setSessionForm: (p: Partial<SessionFormBridge>) => void;
  generateNpc: () => Promise<NpcPreviewState | null>;
  generateLoot: () => Promise<LootCardModel | null>;
  generateSession: () => Promise<{ title: string; excerpt: string } | null>;
  appendSessionHookLine: () => string;
};

const ENV_KEYS = ["any", "dungeon", "forest", "cave", "urban"] as const;

export async function runQuickPreset(id: QuickPresetId, ctx: Ctx): Promise<QuickPresetResult> {
  switch (id) {
    case "npc_tavern":
      ctx.setNpcForm({ race: "human", role: "rival", occupationValue: "merchant" });
      {
        const n = await ctx.generateNpc();
        return n ? { kind: "npc", npc: n } : { kind: "noop" };
      }
    case "npc_merchant":
      ctx.setNpcForm({ race: "human", role: "villain", occupationValue: "merchant" });
      {
        const n = await ctx.generateNpc();
        return n ? { kind: "npc", npc: n } : { kind: "noop" };
      }
    case "npc_guard":
      ctx.setNpcForm({ race: "human", role: "rival", occupationValue: "guard" });
      {
        const n = await ctx.generateNpc();
        return n ? { kind: "npc", npc: n } : { kind: "noop" };
      }
    case "npc_bandit":
      ctx.setNpcForm({ race: "human", role: "villain", occupationValue: "rogue" });
      {
        const n = await ctx.generateNpc();
        return n ? { kind: "npc", npc: n } : { kind: "noop" };
      }
    case "npc_ally":
      ctx.setNpcForm({ race: "human", role: "ally", occupationValue: "merchant" });
      {
        const n = await ctx.generateNpc();
        return n ? { kind: "npc", npc: n } : { kind: "noop" };
      }
    case "npc_boss":
      ctx.setNpcForm({ race: "human", role: "villain", occupationValue: "scholar" });
      {
        const n = await ctx.generateNpc();
        return n ? { kind: "npc", npc: n } : { kind: "noop" };
      }
    case "scene_random": {
      const k = ENV_KEYS[Math.floor(Math.random() * ENV_KEYS.length)]!;
      ctx.setSessionForm({
        environmentKey: k,
        environmentText: `Случайная сцена: ${k === "any" ? "нейтральная локация" : k}.`,
      });
      const m = await ctx.generateSession();
      return m ? { kind: "scene", title: m.title, excerpt: m.excerpt } : { kind: "noop" };
    }
    case "scene_dungeon":
      ctx.setSessionForm({
        environmentKey: "dungeon",
        environmentText: "Подземелье: сырость, факелы, узкие коридоры, следы недавней схватки.",
      });
      {
        const m = await ctx.generateSession();
        return m ? { kind: "scene", title: m.title, excerpt: m.excerpt } : { kind: "noop" };
      }
    case "loot_quick":
      ctx.setLootForm({
        chestCount: 2,
        goldGp: 380,
        difficultyUi: "medium",
        environmentUi: "dungeon",
        magicOnly: false,
      });
      {
        const card = await ctx.generateLoot();
        return card ? { kind: "loot", card } : { kind: "noop" };
      }
    case "hook": {
      const line = ctx.appendSessionHookLine();
      return { kind: "hook", line };
    }
    default:
      return { kind: "noop" };
  }
}
