import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useZernixUserData } from "../context/ZernixUserDataContext";
import { useAppContent } from "../hooks/useAppContent";
import { resolveNpcCard, type NpcSummonForm, type ResolvedNpcCard } from "../lib/npcSummon";
import type { LootDigestPayload } from "../types/lootDigest";
import type { SessionBrief } from "../vite-env";
import { runLootGeneration, type LootFormBridge } from "./generators/lootBridge";
import { runSessionGeneration, type SessionFormBridge } from "./generators/sessionBridge";
import { resolvedNpcToPreviewState } from "./mapNpcPreview";
import type { LootCardModel, NpcPreviewState, SessionPreviewModel } from "./models";
import { defaultNpcPreview } from "./models";
import { narrativeFieldsFromResolvedNpc, type NarrativeRerollSlot } from "./npcNarrativeCompose";
import { sanitizeNpcPreviewState } from "./npcUi";
import { runQuickPreset as runQuickPresetCore, type QuickPresetId, type QuickPresetResult } from "./quickPresets";
import { composeSessionEnvironmentText } from "./sessionAutoEnvironmentText";
import { finalizeSessionMarkdownForUi } from "./sessionNarrativeCleanup";

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
  generateLoot: () => Promise<LootCardModel | null>;

  npc: NpcPreviewState;
  setNpc: (n: NpcPreviewState) => void;
  npcForm: NpcSummonForm;
  setNpcForm: (patch: Partial<NpcSummonForm>) => void;
  npcBusy: boolean;
  npcError: string | null;
  generateNpc: () => Promise<NpcPreviewState | null>;
  lastResolvedNpcCard: ResolvedNpcCard | null;
  rerollNpcNarrativeField: (slot: NarrativeRerollSlot) => void;

  prepSummary: string;
  setPrepSummary: (s: string) => void;
  sessionMarkdown: string | null;
  sessionBrief: SessionBrief | null;
  sessionPreview: SessionPreviewModel | null;
  sessionBusy: boolean;
  sessionError: string | null;
  sessionForm: SessionFormBridge;
  setSessionForm: (patch: Partial<SessionFormBridge>) => void;
  generateSession: () => Promise<{ title: string; excerpt: string } | null>;

  runQuickPreset: (id: QuickPresetId) => Promise<QuickPresetResult>;
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

/**
 * Возвращает золотой бюджет, масштабированный по уровню и сложности.
 * Используется при инициализации и при изменении partyLevel/difficulty в форме.
 */
function computeDefaultGold(partyLevel: number, difficulty: LootFormBridge["difficultyUi"], playerCount: number): number {
  const lv = Math.max(1, Math.min(20, partyLevel));
  const cnt = Math.max(1, Math.min(8, playerCount));
  const PER_PLAYER: Record<LootFormBridge["difficultyUi"], number[]> = {
    low:    [8,  10, 15, 20, 35, 50, 75, 100, 130, 160, 200, 260, 320, 400, 480, 580, 680, 800, 950, 1100],
    medium: [12, 18, 28, 40, 65, 90, 140, 190, 260, 340, 420, 540, 680, 820, 980, 1200, 1450, 1700, 2050, 2450],
    high:   [20, 32, 50, 80, 130, 200, 300, 420, 560, 720, 900, 1200, 1600, 2000, 2600, 3200, 4000, 5000, 6500, 8000],
  };
  return (PER_PLAYER[difficulty]?.[lv - 1] ?? 100) * cnt;
}

function initialLootForm(): LootFormBridge {
  const partyLevel = 5;
  const playerCount = 4;
  const difficultyUi: LootFormBridge["difficultyUi"] = "medium";
  return {
    partyLevel,
    playerCount,
    difficultyUi,
    environmentUi: "ruins",
    goldGp: computeDefaultGold(partyLevel, difficultyUi, playerCount),
    selectedTypeIds: [],
    typeIdsAll: [],
    magicOnly: false,
    chestCount: 0,
  };
}

export function ZernixGeneratorsProvider({ children }: { children: ReactNode }) {
  const { data: content } = useAppContent();
  const { worldHints, patchWorldHints, appendSessionHookLine, syncPlaySessionMeta, ensureDefaultParty, continueDmSession } =
    useZernixUserData();

  const [lootCards, setLootCards] = useState<LootCardModel[]>([]);
  const [lootDigest, setLootDigest] = useState<LootDigestPayload | null>(null);
  const [lootMarkdown, setLootMarkdown] = useState("");
  const [lootNarrativeBlock, setLootNarrativeBlock] = useState<string | null>(null);
  const [lootError, setLootError] = useState<string | null>(null);
  const [lootBusy, setLootBusy] = useState(false);
  const [selectedLootId, setSelectedLootId] = useState<string | null>(null);

  /** Ref-флаг для защиты от двойного запроса (spam-protection помимо lootBusy). */
  const lootInFlightRef = useRef(false);
  /** Fingerprint последних N наборов карточек для дедупликации. */
  const recentLootFingerprints = useRef<string[]>([]);

  const [lootForm, setLootFormState] = useState<LootFormBridge>(initialLootForm);

  const [npc, setNpc] = useState<NpcPreviewState>(() => sanitizeNpcPreviewState(defaultNpcPreview()));
  const [npcForm, setNpcFormState] = useState<NpcSummonForm>(DEFAULT_NPC_FORM);
  const [npcBusy, setNpcBusy] = useState(false);
  const [npcError, setNpcError] = useState<string | null>(null);
  const [lastResolvedNpcCard, setLastResolvedNpcCard] = useState<ResolvedNpcCard | null>(null);

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

  const generateLoot = useCallback(async (): Promise<LootCardModel | null> => {
    // Двойная защита: state + ref (ref срабатывает до рендера)
    if (lootInFlightRef.current) return null;
    lootInFlightRef.current = true;
    setLootBusy(true);
    setLootError(null);
    try {
      const res = await runLootGeneration(lootForm);
      if (!res.ok) {
        setLootError(res.error);
        return null;
      }

      // Дедупликация: fingerprint = имена карточек через запятую
      const fingerprint = res.cards.map((c) => c.title).sort().join("|");
      const DEDUP_WINDOW = 5;
      if (recentLootFingerprints.current.includes(fingerprint) && res.cards.length > 0) {
        // Помечаем как soft-duplicate: карточки всё равно показываем, но логируем
        console.debug("[loot] soft-duplicate fingerprint:", fingerprint);
      }
      recentLootFingerprints.current.push(fingerprint);
      if (recentLootFingerprints.current.length > DEDUP_WINDOW) {
        recentLootFingerprints.current.shift();
      }

      setLootCards(res.cards);
      setLootDigest(res.digest);
      setLootMarkdown(res.markdown);
      setLootNarrativeBlock(res.narrativeBlock);
      const firstId = res.cards[0]?.id ?? null;
      setSelectedLootId(firstId);
      return res.cards[0] ?? null;
    } finally {
      lootInFlightRef.current = false;
      setLootBusy(false);
    }
  }, [lootForm]);

  const generateNpc = useCallback(async (): Promise<NpcPreviewState | null> => {
    setNpcBusy(true);
    setNpcError(null);
    try {
      if (!content?.npc) {
        setNpcError("Контент NPC не загружен.");
        return null;
      }
      const hasOcc = content.npc.occupations.some((o) => o.value === npcForm.occupationValue);
      const occ = hasOcc
        ? npcForm.occupationValue
        : content.npc.occupations[Math.floor(Math.random() * content.npc.occupations.length)]?.value ?? "merchant";
      const { card, error } = await resolveNpcCard(content.npc, {
        ...npcForm,
        occupationValue: occ,
        biomeKey: sessionForm.environmentKey,
      });
      if (!card) {
        setLastResolvedNpcCard(null);
        setNpcError(
          error?.trim() ||
            (typeof window !== "undefined" && window.electronAPI?.generateNpc
              ? "Не удалось построить карточку NPC."
              : "Не удалось выбрать шаблон NPC в контенте. Обновите data/app-content.json."),
        );
        return null;
      }
      const preview = resolvedNpcToPreviewState(card, worldHints);
      setLastResolvedNpcCard(card);
      setNpc(preview);
      patchWorldHints({ lastNpcName: card.name.trim() });
      return preview;
    } finally {
      setNpcBusy(false);
    }
  }, [content, npcForm, patchWorldHints, sessionForm.environmentKey, worldHints]);

  const generateSession = useCallback(async (): Promise<{ title: string; excerpt: string } | null> => {
    setSessionBusy(true);
    setSessionError(null);
    try {
      const envBody = composeSessionEnvironmentText(sessionForm, worldHints, Date.now());
      const merged: SessionFormBridge = {
        ...sessionForm,
        environmentText: envBody,
      };
      const res = await runSessionGeneration(merged);
      if (!res.ok) {
        setSessionError(res.error);
        return null;
      }
      const mdClean = finalizeSessionMarkdownForUi(res.markdown);
      setSessionMarkdown(mdClean);
      setSessionBrief(res.sessionBrief ?? null);
      setSessionPreview(res.preview);
      setPrepSummary(mdClean);
      const title = res.preview?.title?.trim() || res.sessionBrief?.title?.trim() || "Сессия";
      const excerpt = res.preview?.excerpt?.trim() || "";
      syncPlaySessionMeta({
        title,
        partyLevel: sessionForm.partyLevel,
        playerCount: sessionForm.playerCount,
        difficulty: sessionForm.difficulty,
        environmentKey: sessionForm.environmentKey,
        updatedAt: Date.now(),
      });
      ensureDefaultParty(sessionForm.playerCount, sessionForm.partyLevel);
      continueDmSession();
      return { title, excerpt };
    } finally {
      setSessionBusy(false);
    }
  }, [continueDmSession, ensureDefaultParty, sessionForm, syncPlaySessionMeta, worldHints]);

  const rerollNpcNarrativeField = useCallback(
    (slot: NarrativeRerollSlot) => {
      const card = lastResolvedNpcCard;
      if (!card) return;
      const narr = narrativeFieldsFromResolvedNpc(card, {
        rerollSlot: slot,
        entropyMs: Date.now(),
        world: worldHints,
      });
      setNpc((prev) =>
        sanitizeNpcPreviewState({
          ...prev,
          ...(slot === "visual" ? { visualTrait: narr.visualTrait } : {}),
          ...(slot === "want" ? { wantLine: narr.wantLine } : {}),
          ...(slot === "avoid" ? { avoidLine: narr.avoidLine } : {}),
          ...(slot === "secret" ? { secretLine: narr.secretLine } : {}),
        }),
      );
    },
    [lastResolvedNpcCard, worldHints],
  );

  const runQuickPreset = useCallback(
    async (id: QuickPresetId): Promise<QuickPresetResult> => {
      return runQuickPresetCore(id, {
        setNpcForm,
        setLootForm,
        setSessionForm,
        generateNpc,
        generateLoot,
        generateSession,
        appendSessionHookLine,
      });
    },
    [appendSessionHookLine, generateLoot, generateNpc, generateSession, setLootForm, setNpcForm, setSessionForm],
  );

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
      lastResolvedNpcCard,
      rerollNpcNarrativeField,
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
      runQuickPreset,
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
      lastResolvedNpcCard,
      rerollNpcNarrativeField,
      prepSummary,
      sessionMarkdown,
      sessionBrief,
      sessionPreview,
      sessionBusy,
      sessionError,
      sessionForm,
      setSessionForm,
      generateSession,
      runQuickPreset,
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
