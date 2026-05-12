import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { NpcSummonForm, ResolvedNpcCard } from "../lib/npcSummon";

const STORAGE_KEY = "zernix-npc-session-v1";

type Stored = { card: ResolvedNpcCard | null; form: NpcSummonForm | null };

function readSession(): Stored {
  try {
    if (typeof sessionStorage === "undefined") return { card: null, form: null };
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { card: null, form: null };
    const o = JSON.parse(raw) as Partial<Stored>;
    return { card: o.card ?? null, form: o.form ?? null };
  } catch {
    return { card: null, form: null };
  }
}

interface NpcSessionContextValue {
  npcCard: ResolvedNpcCard | null;
  npcSummonForm: NpcSummonForm | null;
  setNpcSession: (card: ResolvedNpcCard | null, form: NpcSummonForm | null) => void;
  resetNpcSession: () => void;
}

const NpcSessionContext = createContext<NpcSessionContextValue | null>(null);

export function NpcSessionProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => readSession(), []);
  const [npcCard, setNpcCard] = useState<ResolvedNpcCard | null>(initial.card);
  const [npcSummonForm, setNpcSummonForm] = useState<NpcSummonForm | null>(initial.form);

  useEffect(() => {
    try {
      if (npcCard == null && npcSummonForm == null) {
        sessionStorage.removeItem(STORAGE_KEY);
      } else {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ card: npcCard, form: npcSummonForm }));
      }
    } catch {
      /* ignore quota */
    }
  }, [npcCard, npcSummonForm]);

  const setNpcSession = useCallback((card: ResolvedNpcCard | null, form: NpcSummonForm | null) => {
    setNpcCard(card);
    setNpcSummonForm(form);
  }, []);

  const resetNpcSession = useCallback(() => {
    setNpcCard(null);
    setNpcSummonForm(null);
  }, []);

  const value = useMemo(
    () => ({
      npcCard,
      npcSummonForm,
      setNpcSession,
      resetNpcSession,
    }),
    [npcCard, npcSummonForm, setNpcSession, resetNpcSession],
  );

  return <NpcSessionContext.Provider value={value}>{children}</NpcSessionContext.Provider>;
}

export function useNpcSession(): NpcSessionContextValue {
  const ctx = useContext(NpcSessionContext);
  if (!ctx) {
    throw new Error("useNpcSession must be used within NpcSessionProvider");
  }
  return ctx;
}
