import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAppContent } from "../hooks/useAppContent";
import { resolveNpcCard, type NpcSummonForm } from "../lib/npcSummon";
import type { LootDigestPayload } from "../types/lootDigest";
import type { SessionBrief } from "../vite-env";
import { runLootGeneration, type LootFormBridge } from "./generators/lootBridge";
import { runSessionGeneration, type SessionFormBridge } from "./generators/sessionBridge";
import { resolvedNpcToPreviewState } from "./mapNpcPreview";
import type { LootCardModel, NpcPreviewState, SessionPreviewModel } from "./models";
import { defaultNpcPreview } from "./models";

type ZernixGeneratorsContextValue = {
  contentReady: boolean;

  lootCards: LootCardModel[];
  lootDigest: LootDigestPayload | null;
  lootMarkdown: string;
  lootNarrativeBlock: string | null;
  lootError: string | null;
  lootBusy: boolean;
  selectedLootId: string | null;
  setSelectedLootId: (id: string | null) => void;
  lootForm: LootFormBridge;
  setLootForm: (patch: Partial<LootFormBridge>) => void;
  generateLoot: () => Promise<void>;

  npc: NpcPreviewState;
  setNpc: (n: NpcPreviewState) => void;
  npcForm: NpcSummonForm;
  setNpcForm: (patch: Partial<NpcSummonForm>) => void;
  npcBusy: boolean;
  npcError: string | null;
  generateNpc: () => Promise<void>;

  prepSummary: string;
  setPrepSummary: (s: string) => void;
  sessionMarkdown: string | null;
  /** Структурированный бриф (предпочтительно для UI); plain-текст остаётся в sessionMarkdown. */
  sessionBrief: SessionBrief | null;
  sessionPreview: SessionPreviewModel | null;
  sessionBusy: boolean;
  sessionError: string | null;
  sessionForm: SessionFormBridge;
  setSessionForm: (patch: Partial<SessionFormBridge>) => void;
  generateSession: () => Promise<void>;
};

const ZernixGeneratorsContext = createContext<ZernixGeneratorsContextValue | null>(null);

const DEFAULT_NPC_FORM: NpcSummonForm = {
  race: "human",
  occupationValue: "merchant",
  role: "ally",
  genderId: "random",
};

const DEFAULT_SESSION_FORM: SessionFormBridge = {
  partyLevel: 5,
  playerCount: 4,
  difficulty: "moderate",
  packCount: 2,
  chestCount: 3,
  environmentText: "",
  environmentKey: "dungeon",
  onlyMagic: false,
};

function initialLootForm(): LootFormBridge {
  return {
    partyLevel: 5,
    playerCount: 4,
    difficultyUi: "medium",
    environmentUi: "ruins",
    goldGp: 500,
    selectedTypeIds: [],
    typeIdsAll: [],
    magicOnly: false,
    chestCount: 0,
  };
}

export function ZernixGeneratorsProvider({ children }: { children: ReactNode }) {
  const { data: content } = useAppContent();

  const [lootCards, setLootCards] = useState<LootCardModel[]>([]);
  const [lootDigest, setLootDigest] = useState<LootDigestPayload | null>(null);
  const [lootMarkdown, setLootMarkdown] = useState("");
  const [lootNarrativeBlock, setLootNarrativeBlock] = useState<string | null>(null);
  const [lootError, setLootError] = useState<string | null>(null);
  const [lootBusy, setLootBusy] = useState(false);
  const [selectedLootId, setSelectedLootId] = useState<string | null>(null);

  const [lootForm, setLootFormState] = useState<LootFormBridge>(initialLootForm);

  const [npc, setNpc] = useState<NpcPreviewState>(() => defaultNpcPreview());
  const [npcForm, setNpcFormState] = useState<NpcSummonForm>(DEFAULT_NPC_FORM);
  const [npcBusy, setNpcBusy] = useState(false);
  const [npcError, setNpcError] = useState<string | null>(null);

  const [prepSummary, setPrepSummary] = useState(
    "Нажмите «Сгенерировать подготовку» — здесь появится текст для копирования (без разметки).",
  );
  const [sessionMarkdown, setSessionMarkdown] = useState<string | null>(null);
  const [sessionBrief, setSessionBrief] = useState<SessionBrief | null>(null);
  const [sessionPreview, setSessionPreview] = useState<SessionPreviewModel | null>(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionForm, setSessionFormState] = useState<SessionFormBridge>(DEFAULT_SESSION_FORM);

  useEffect(() => {
    if (!content?.loot?.types?.length) return;
    const all = content.loot.types.map((t) => t.id);
    setLootFormState((prev) => ({
      ...prev,
      typeIdsAll: all,
      selectedTypeIds:
        prev.selectedTypeIds.length === 0
          ? [...all]
          : prev.selectedTypeIds.filter((id) => all.includes(id)),
    }));
  }, [content]);

  const setLootForm = useCallback((patch: Partial<LootFormBridge>) => {
    setLootFormState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setNpcForm = useCallback((patch: Partial<NpcSummonForm>) => {
    setNpcFormState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setSessionForm = useCallback((patch: Partial<SessionFormBridge>) => {
    setSessionFormState((prev) => ({ ...prev, ...patch }));
  }, []);

  const generateLoot = useCallback(async () => {
    setLootBusy(true);
    setLootError(null);
    try {
      const res = await runLootGeneration(lootForm);
      if (!res.ok) {
        setLootError(res.error);
        return;
      }
      setLootCards(res.cards);
      setLootDigest(res.digest);
      setLootMarkdown(res.markdown);
      setLootNarrativeBlock(res.narrativeBlock);
      const firstId = res.cards[0]?.id ?? null;
      setSelectedLootId(firstId);
    } finally {
      setLootBusy(false);
    }
  }, [lootForm]);

  const generateNpc = useCallback(async () => {
    setNpcBusy(true);
    setNpcError(null);
    try {
      if (!content?.npc) {
        setNpcError("Контент NPC не загружен.");
        return;
      }
      const card = await resolveNpcCard(content.npc, npcForm);
      if (!card) {
        setNpcError(
          typeof window !== "undefined" && window.electronAPI?.generateNpc
            ? "Не удалось построить карточку NPC."
            : "Создание NPC доступно в Electron с npc-engine.",
        );
        return;
      }
      setNpc(resolvedNpcToPreviewState(card));
    } finally {
      setNpcBusy(false);
    }
  }, [content, npcForm]);

  const generateSession = useCallback(async () => {
    setSessionBusy(true);
    setSessionError(null);
    try {
      const res = await runSessionGeneration(sessionForm);
      if (!res.ok) {
        setSessionError(res.error);
        return;
      }
      setSessionMarkdown(res.markdown);
      setSessionBrief(res.sessionBrief ?? null);
      setSessionPreview(res.preview);
      setPrepSummary(res.markdown);
    } finally {
      setSessionBusy(false);
    }
  }, [sessionForm]);

  const value = useMemo<ZernixGeneratorsContextValue>(
    () => ({
      contentReady: Boolean(content?.loot?.types?.length),
      lootCards,
      lootDigest,
      lootMarkdown,
      lootNarrativeBlock,
      lootError,
      lootBusy,
      selectedLootId,
      setSelectedLootId,
      lootForm,
      setLootForm,
      generateLoot,
      npc,
      setNpc,
      npcForm,
      setNpcForm,
      npcBusy,
      npcError,
      generateNpc,
      prepSummary,
      setPrepSummary,
      sessionMarkdown,
      sessionBrief,
      sessionPreview,
      sessionBusy,
      sessionError,
      sessionForm,
      setSessionForm,
      generateSession,
    }),
    [
      content?.loot?.types?.length,
      lootCards,
      lootDigest,
      lootMarkdown,
      lootNarrativeBlock,
      lootError,
      lootBusy,
      selectedLootId,
      lootForm,
      setLootForm,
      generateLoot,
      npc,
      setNpc,
      npcForm,
      setNpcForm,
      npcBusy,
      npcError,
      generateNpc,
      prepSummary,
      sessionMarkdown,
      sessionBrief,
      sessionPreview,
      sessionBusy,
      sessionError,
      sessionForm,
      setSessionForm,
      generateSession,
    ],
  );

  return <ZernixGeneratorsContext.Provider value={value}>{children}</ZernixGeneratorsContext.Provider>;
}

export function useZernixGenerators(): ZernixGeneratorsContextValue {
  const ctx = useContext(ZernixGeneratorsContext);
  if (!ctx) {
    throw new Error("useZernixGenerators must be used within ZernixGeneratorsProvider");
  }
  return ctx;
}
