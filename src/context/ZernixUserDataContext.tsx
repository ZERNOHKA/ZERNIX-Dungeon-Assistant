import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { LootCardModel } from "../zernix/models";
import type { NpcPreviewState } from "../zernix/models";
import { npcFavoriteRefKey, npcJoinSegments } from "../zernix/npcUi";
import { createDefaultParty, type PlaySessionMember, type PlaySessionMeta } from "../lib/playSession";
import {
  DM_TIMELINE_CAP,
  defaultDmSession,
  defaultWorldHints,
  loadZernixUserBundle,
  persistZernixUserBundle,
  type DmSessionBlock,
  type DmTimelineEntry,
  type FavoriteEntry,
  type FavoriteKind,
  type ZernixProfile,
  type ZernixUiSettings,
  type ZernixUserBundle,
  type ZernixWorldHints,
} from "../lib/zernixUserStorage";
import { pickRandomSessionHook } from "../zernix/sessionHookLines";

function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function applyDomFromSettings(s: ZernixUiSettings): void {
  const root = document.documentElement;
  root.dataset.zernixListDensity = s.listDensity;
  root.dataset.zernixCatalogLang = s.catalogLang;
  root.dataset.zernixDark = s.darkMode ? "1" : "";
  root.lang = s.catalogLang === "en" ? "en" : "ru";
}

export type RecentNoteRow = {
  key: string;
  preview: string;
  updatedAt: number;
  titleLabel: string;
};

type ZernixUserDataContextValue = {
  favorites: FavoriteEntry[];
  dmSession: DmSessionBlock;
  isFavorite: (kind: FavoriteKind, refKey: string) => boolean;
  toggleLootFavorite: (card: LootCardModel) => void;
  toggleNpcFavorite: (npc: NpcPreviewState) => void;
  toggleSessionFavorite: (title: string, subtitle?: string) => void;
  removeFavorite: (id: string) => void;
  getNoteBody: (key: string) => string;
  setNoteBody: (key: string, body: string) => void;
  settings: ZernixUiSettings;
  patchSettings: (p: Partial<ZernixUiSettings>) => void;
  profile: ZernixProfile;
  patchProfile: (p: Partial<ZernixProfile>) => void;
  recentNotes: (limit: number) => RecentNoteRow[];
  appendPrepDmNote: (line: string) => void;

  startNewDmSession: (opts?: Partial<PlaySessionMeta>) => void;
  continueDmSession: () => void;
  clearDmSession: () => void;
  ensurePlaySession: () => void;
  syncPlaySessionMeta: (meta: PlaySessionMeta) => void;
  ensureDefaultParty: (playerCount: number, partyLevel: number) => void;
  patchPlaySessionMember: (id: string, patch: Partial<PlaySessionMember>) => void;
  setPlaySessionTitle: (title: string) => void;
  pushDmTimeline: (e: Omit<DmTimelineEntry, "id" | "at">) => void;
  /** Крючок в prep:dm + строка в таймлайне (активирует сессию). */
  appendSessionHookLine: () => string;
  worldHints: ZernixWorldHints;
  patchWorldHints: (p: Partial<ZernixWorldHints>) => void;
  clearWorldHints: () => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
};

const ZernixUserDataContext = createContext<ZernixUserDataContextValue | null>(null);

export function ZernixUserDataProvider({ children }: { children: ReactNode }) {
  const [bundle, setBundle] = useState<ZernixUserBundle>(() => loadZernixUserBundle());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useLayoutEffect(() => {
    applyDomFromSettings(bundle.settings);
  }, [bundle.settings]);

  useEffect(() => {
    persistZernixUserBundle(bundle);
  }, [bundle]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 2200);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg.trim() || "Готово");
  }, []);

  const patchWorldHints = useCallback((p: Partial<ZernixWorldHints>) => {
    setBundle((prev) => ({
      ...prev,
      worldHints: { ...defaultWorldHints(), ...prev.worldHints, ...p },
    }));
  }, []);

  const clearWorldHints = useCallback(() => {
    setBundle((prev) => ({ ...prev, worldHints: defaultWorldHints() }));
  }, []);

  const isFavorite = useCallback(
    (kind: FavoriteKind, refKey: string) => bundle.favorites.some((f) => f.kind === kind && f.refKey === refKey),
    [bundle.favorites],
  );

  const toggleLootFavorite = useCallback((card: LootCardModel) => {
    const refKey = `loot:${card.id}`;
    setBundle((prev) => {
      const hit = prev.favorites.find((f) => f.refKey === refKey);
      if (hit) {
        return { ...prev, favorites: prev.favorites.filter((f) => f.id !== hit.id) };
      }
      const entry: FavoriteEntry = {
        id: randomId(),
        kind: "loot",
        title: card.title,
        subtitle: `${card.rarityLabel} · ${card.kindLabel}`,
        refKey,
        createdAt: Date.now(),
      };
      const dm0 = prev.dmSession ?? defaultDmSession();
      const dmSession =
        dm0.active
          ? {
              ...dm0,
              timeline: [
                {
                  id: randomId(),
                  at: Date.now(),
                  kind: "fav" as const,
                  title: `Избранное: ${card.title}`,
                  subtitle: card.rarityLabel,
                  lootId: card.id,
                },
                ...dm0.timeline,
              ].slice(0, DM_TIMELINE_CAP),
            }
          : dm0;
      return { ...prev, favorites: [entry, ...prev.favorites], dmSession };
    });
  }, []);

  const toggleNpcFavorite = useCallback((npc: NpcPreviewState) => {
    const refKey = npcFavoriteRefKey(npc);
    setBundle((prev) => {
      const hit = prev.favorites.find((f) => f.kind === "npc" && f.refKey === refKey);
      if (hit) {
        return { ...prev, favorites: prev.favorites.filter((f) => f.id !== hit.id) };
      }
      const subtitle = npcJoinSegments([npc.race, npc.creatureClass]);
      const entry: FavoriteEntry = {
        id: randomId(),
        kind: "npc",
        title: npc.name.trim() || "Без имени",
        subtitle: subtitle || undefined,
        refKey,
        createdAt: Date.now(),
      };
      const dm0 = prev.dmSession ?? defaultDmSession();
      const titleNpc = npc.name.trim() || "NPC";
      const dmSession =
        dm0.active
          ? {
              ...dm0,
              timeline: [
                {
                  id: randomId(),
                  at: Date.now(),
                  kind: "fav" as const,
                  title: `Избранное: ${titleNpc}`,
                  subtitle: subtitle || undefined,
                },
                ...dm0.timeline,
              ].slice(0, DM_TIMELINE_CAP),
            }
          : dm0;
      return { ...prev, favorites: [entry, ...prev.favorites], dmSession };
    });
  }, []);

  const toggleSessionFavorite = useCallback((title: string, subtitle?: string) => {
    const t = title.trim() || "Сессия";
    const refKey = `session:${t}`;
    setBundle((prev) => {
      const hit = prev.favorites.find((f) => f.kind === "session" && f.refKey === refKey);
      if (hit) {
        return { ...prev, favorites: prev.favorites.filter((f) => f.id !== hit.id) };
      }
      const entry: FavoriteEntry = {
        id: randomId(),
        kind: "session",
        title: t,
        subtitle,
        refKey,
        createdAt: Date.now(),
      };
      const dm0 = prev.dmSession ?? defaultDmSession();
      const dmSession =
        dm0.active
          ? {
              ...dm0,
              timeline: [
                {
                  id: randomId(),
                  at: Date.now(),
                  kind: "fav" as const,
                  title: `Избранное: ${t}`,
                  subtitle: subtitle ?? "Сессия",
                },
                ...dm0.timeline,
              ].slice(0, DM_TIMELINE_CAP),
            }
          : dm0;
      return { ...prev, favorites: [entry, ...prev.favorites], dmSession };
    });
  }, []);

  const removeFavorite = useCallback((id: string) => {
    setBundle((prev) => ({ ...prev, favorites: prev.favorites.filter((f) => f.id !== id) }));
  }, []);

  const getNoteBody = useCallback((key: string) => bundle.notes[key]?.body ?? "", [bundle.notes]);

  const setNoteBody = useCallback((key: string, body: string) => {
    setBundle((prev) => ({
      ...prev,
      notes: {
        ...prev.notes,
        [key]: { body, updatedAt: Date.now() },
      },
    }));
  }, []);

  const patchSettings = useCallback((p: Partial<ZernixUiSettings>) => {
    setBundle((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...p },
    }));
  }, []);

  const patchProfile = useCallback((p: Partial<ZernixProfile>) => {
    setBundle((prev) => ({
      ...prev,
      profile: { ...prev.profile, ...p },
    }));
  }, []);

  const recentNotes = useCallback(
    (limit: number): RecentNoteRow[] => {
      const rows: RecentNoteRow[] = Object.entries(bundle.notes)
        .filter(([key]) => key !== "home:spell")
        .map(([key, slot]) => {
          const firstLine = slot.body.trim().split("\n")[0] ?? "";
          let titleLabel = "Заметка";
          if (key.startsWith("loot:")) titleLabel = "Добыча";
          else if (key.startsWith("npc:")) titleLabel = "NPC";
          else if (key.startsWith("prep:")) titleLabel = "Подготовка";
          else if (key.startsWith("session:")) titleLabel = "Сессия";
          else if (key.startsWith("home:")) titleLabel = "Рабочий стол";
          return {
            key,
            preview: firstLine.slice(0, 96),
            updatedAt: slot.updatedAt,
            titleLabel,
          };
        });
      rows.sort((a, b) => b.updatedAt - a.updatedAt);
      return rows.slice(0, limit);
    },
    [bundle.notes],
  );

  const appendPrepDmNote = useCallback((line: string) => {
    const key = "prep:dm";
    setBundle((prev) => {
      const cur = prev.notes[key]?.body ?? "";
      const next = cur ? `${cur}\n${line}` : line;
      return {
        ...prev,
        notes: { ...prev.notes, [key]: { body: next, updatedAt: Date.now() } },
      };
    });
  }, []);

  const startNewDmSession = useCallback((opts?: Partial<PlaySessionMeta>) => {
    const now = Date.now();
    const partyLevel = opts?.partyLevel ?? 5;
    const playerCount = opts?.playerCount ?? 4;
    const meta: PlaySessionMeta = {
      title: opts?.title?.trim() || "Новая сессия",
      partyLevel,
      playerCount,
      difficulty: opts?.difficulty ?? "moderate",
      environmentKey: opts?.environmentKey ?? "dungeon",
      updatedAt: now,
    };
    setBundle((prev) => ({
      ...prev,
      dmSession: {
        active: true,
        startedAt: now,
        timeline: [],
        meta,
        party: createDefaultParty(playerCount, partyLevel),
      },
    }));
  }, []);

  const continueDmSession = useCallback(() => {
    setBundle((prev) => {
      const dm0 = prev.dmSession ?? defaultDmSession();
      return {
        ...prev,
        dmSession: {
          ...dm0,
          active: true,
          startedAt: dm0.startedAt || Date.now(),
        },
      };
    });
  }, []);

  const clearDmSession = useCallback(() => {
    setBundle((prev) => ({
      ...prev,
      dmSession: defaultDmSession(),
    }));
  }, []);

  const ensurePlaySession = useCallback(() => {
    setBundle((prev) => {
      const dm0 = prev.dmSession ?? defaultDmSession();
      if (dm0.active && dm0.meta && dm0.party?.length) return prev;
      const now = Date.now();
      const meta =
        dm0.meta ??
        ({
          title: "Сессия за столом",
          partyLevel: 5,
          playerCount: 4,
          difficulty: "moderate",
          environmentKey: "dungeon",
          updatedAt: now,
        } satisfies PlaySessionMeta);
      const party =
        dm0.party?.length ? dm0.party : createDefaultParty(meta.playerCount, meta.partyLevel);
      return {
        ...prev,
        dmSession: {
          ...dm0,
          active: true,
          startedAt: dm0.startedAt || now,
          meta,
          party,
        },
      };
    });
  }, []);

  const syncPlaySessionMeta = useCallback((meta: PlaySessionMeta) => {
    setBundle((prev) => {
      const dm0 = prev.dmSession ?? defaultDmSession();
      return {
        ...prev,
        dmSession: {
          ...dm0,
          active: true,
          startedAt: dm0.startedAt || Date.now(),
          meta: { ...meta, updatedAt: Date.now() },
        },
      };
    });
  }, []);

  const ensureDefaultParty = useCallback((playerCount: number, partyLevel: number) => {
    setBundle((prev) => {
      const dm0 = prev.dmSession ?? defaultDmSession();
      if (dm0.party?.length) return prev;
      return {
        ...prev,
        dmSession: {
          ...dm0,
          party: createDefaultParty(playerCount, partyLevel),
        },
      };
    });
  }, []);

  const patchPlaySessionMember = useCallback((id: string, patch: Partial<PlaySessionMember>) => {
    setBundle((prev) => {
      const dm0 = prev.dmSession ?? defaultDmSession();
      const party = dm0.party;
      if (!party?.length) return prev;
      const next = party.map((m) => {
        if (m.id !== id) return m;
        const hpMax = patch.hpMax ?? m.hpMax;
        let hpCurrent = patch.hpCurrent ?? m.hpCurrent;
        hpCurrent = Math.max(0, Math.min(hpMax, hpCurrent));
        return {
          ...m,
          ...patch,
          hpMax,
          hpCurrent,
        };
      });
      return { ...prev, dmSession: { ...dm0, party: next } };
    });
  }, []);

  const setPlaySessionTitle = useCallback((title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setBundle((prev) => {
      const dm0 = prev.dmSession ?? defaultDmSession();
      const meta = dm0.meta;
      if (!meta) return prev;
      return {
        ...prev,
        dmSession: {
          ...dm0,
          meta: { ...meta, title: trimmed, updatedAt: Date.now() },
        },
      };
    });
  }, []);

  const pushDmTimeline = useCallback((partial: Omit<DmTimelineEntry, "id" | "at">) => {
    setBundle((prev) => {
      const dm0 = prev.dmSession ?? defaultDmSession();
      if (!dm0.active) return prev;
      const entry: DmTimelineEntry = { ...partial, id: randomId(), at: Date.now() };
      return {
        ...prev,
        dmSession: {
          ...dm0,
          timeline: [entry, ...dm0.timeline].slice(0, DM_TIMELINE_CAP),
        },
      };
    });
  }, []);

  const appendSessionHookLine = useCallback((): string => {
    const line = pickRandomSessionHook();
    setBundle((prev) => {
      const dm0 = prev.dmSession ?? defaultDmSession();
      const dmSession = {
        ...dm0,
        active: true,
        startedAt: dm0.startedAt || Date.now(),
        timeline: [
          {
            id: randomId(),
            at: Date.now(),
            kind: "hook" as const,
            title: line,
            subtitle: "Крючок в заметках подготовки",
          },
          ...dm0.timeline,
        ].slice(0, DM_TIMELINE_CAP),
      };
      const prepKey = "prep:dm";
      const cur = prev.notes[prepKey]?.body ?? "";
      const nextBody = cur ? `${cur}\n🪝 ${line}` : `🪝 ${line}`;
      return {
        ...prev,
        dmSession,
        worldHints: { ...defaultWorldHints(), ...prev.worldHints, lastHookLine: line },
        notes: { ...prev.notes, [prepKey]: { body: nextBody, updatedAt: Date.now() } },
      };
    });
    return line;
  }, []);

  const value = useMemo(
    () => ({
      favorites: bundle.favorites,
      dmSession: bundle.dmSession ?? defaultDmSession(),
      worldHints: bundle.worldHints ?? defaultWorldHints(),
      toastMessage,
      showToast,
      patchWorldHints,
      clearWorldHints,
      isFavorite,
      toggleLootFavorite,
      toggleNpcFavorite,
      toggleSessionFavorite,
      removeFavorite,
      getNoteBody,
      setNoteBody,
      settings: bundle.settings,
      patchSettings,
      profile: bundle.profile,
      patchProfile,
      recentNotes,
      appendPrepDmNote,

      startNewDmSession,
      continueDmSession,
      clearDmSession,
      ensurePlaySession,
      syncPlaySessionMeta,
      ensureDefaultParty,
      patchPlaySessionMember,
      setPlaySessionTitle,
      pushDmTimeline,
      appendSessionHookLine,
    }),
    [
      appendPrepDmNote,
      appendSessionHookLine,
      bundle.dmSession,
      bundle.favorites,
      bundle.profile,
      bundle.settings,
      bundle.worldHints,
      clearDmSession,
      clearWorldHints,
      continueDmSession,
      ensurePlaySession,
      getNoteBody,
      isFavorite,
      patchProfile,
      patchSettings,
      patchWorldHints,
      pushDmTimeline,
      recentNotes,
      removeFavorite,
      setNoteBody,
      showToast,
      startNewDmSession,
      syncPlaySessionMeta,
      ensureDefaultParty,
      patchPlaySessionMember,
      setPlaySessionTitle,
      toastMessage,
      toggleLootFavorite,
      toggleNpcFavorite,
      toggleSessionFavorite,
    ],
  );

  return <ZernixUserDataContext.Provider value={value}>{children}</ZernixUserDataContext.Provider>;
}

export function useZernixUserData(): ZernixUserDataContextValue {
  const ctx = useContext(ZernixUserDataContext);
  if (!ctx) {
    throw new Error("useZernixUserData must be used within ZernixUserDataProvider");
  }
  return ctx;
}
