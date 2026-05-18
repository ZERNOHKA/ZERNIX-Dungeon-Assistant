export type FavoriteKind = "loot" | "npc" | "session";

export type FavoriteEntry = {
  id: string;
  kind: FavoriteKind;
  title: string;
  subtitle?: string;
  refKey: string;
  createdAt: number;
};

export type NoteSlot = {
  body: string;
  updatedAt: number;
};

export type ZernixUiSettings = {
  listDensity: "comfortable" | "compact";
  catalogLang: "ru" | "en";
  /** Тёмнее палитра (`data-zernix-dark` на корневом html). */
  darkMode: boolean;
  /** Флаг для UI: заметки и так сохраняются через localStorage bundle. */
  autoSaveNotes: boolean;
};

export type ZernixProfile = {
  displayName: string;
  avatarDataUrl: string;
  /** Подпись под именем (учебное задание, роль и т. п.). */
  affiliation?: string;
};

/** Одна строка журнала «вечеринки» за столом (локально, без новой БД). */
export type DmTimelineKind = "npc" | "loot" | "scene" | "hook" | "fav";

export type DmTimelineEntry = {
  id: string;
  at: number;
  kind: DmTimelineKind;
  title: string;
  subtitle?: string;
  lootId?: string;
};

export type DmSessionBlock = {
  active: boolean;
  startedAt: number;
  timeline: DmTimelineEntry[];
};

export const DM_TIMELINE_CAP = 48;

export type ZernixWorldHints = {
  currentLocation: string;
  activeFaction: string;
  currentThreat: string;
  lastNpcName: string;
  lastHookLine: string;
};

export type ZernixUserBundle = {
  favorites: FavoriteEntry[];
  notes: Record<string, NoteSlot>;
  settings: ZernixUiSettings;
  profile: ZernixProfile;
  dmSession: DmSessionBlock;
  worldHints: ZernixWorldHints;
};

const STORAGE_KEY = "zernix.userBundle.v1";

/** Старый формат npc:Имя|Класс → npc:Имя */
function normalizeNpcFavoriteRefKey(refKey: string): string {
  if (!refKey.startsWith("npc:")) return refKey;
  const tail = refKey.slice(4).trim();
  const pipe = tail.indexOf("|");
  if (pipe === -1) return refKey;
  const namePart = tail.slice(0, pipe).trim();
  return namePart ? `npc:${namePart}` : refKey;
}

export function defaultDmSession(): DmSessionBlock {
  return { active: false, startedAt: 0, timeline: [] };
}

export function defaultWorldHints(): ZernixWorldHints {
  return {
    currentLocation: "",
    activeFaction: "",
    currentThreat: "",
    lastNpcName: "",
    lastHookLine: "",
  };
}

export function defaultZernixUserBundle(): ZernixUserBundle {
  return {
    favorites: [],
    notes: {},
    settings: { listDensity: "comfortable", catalogLang: "ru", darkMode: false, autoSaveNotes: true },
    profile: { displayName: "ZERNOHKA", avatarDataUrl: "", affiliation: "Student · Hexlet College" },
    dmSession: defaultDmSession(),
    worldHints: defaultWorldHints(),
  };
}

function isDmTimelineEntry(x: unknown): x is DmTimelineEntry {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const kind = o.kind;
  if (kind !== "npc" && kind !== "loot" && kind !== "scene" && kind !== "hook" && kind !== "fav") return false;
  return (
    typeof o.id === "string" &&
    typeof o.at === "number" &&
    typeof o.title === "string" &&
    (o.subtitle === undefined || typeof o.subtitle === "string") &&
    (o.lootId === undefined || typeof o.lootId === "string")
  );
}

function capDmTimeline(list: DmTimelineEntry[]): DmTimelineEntry[] {
  if (list.length <= DM_TIMELINE_CAP) return list;
  return list.slice(0, DM_TIMELINE_CAP);
}

function isFavoriteEntry(x: unknown): x is FavoriteEntry {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    (o.kind === "loot" || o.kind === "npc" || o.kind === "session") &&
    typeof o.title === "string" &&
    typeof o.refKey === "string" &&
    typeof o.createdAt === "number"
  );
}

function mergeBundle(raw: unknown): ZernixUserBundle {
  const d = defaultZernixUserBundle();
  if (!raw || typeof raw !== "object") return d;
  const p = raw as Partial<ZernixUserBundle>;

  let favorites: FavoriteEntry[] = d.favorites;
  if (Array.isArray(p.favorites)) {
    favorites = p.favorites
      .filter(isFavoriteEntry)
      .map((f) => (f.kind === "npc" ? { ...f, refKey: normalizeNpcFavoriteRefKey(f.refKey) } : f));
  }

  let notes: Record<string, NoteSlot> = d.notes;
  if (p.notes && typeof p.notes === "object") {
    const next: Record<string, NoteSlot> = {};
    for (const [k, v] of Object.entries(p.notes)) {
      if (k === "home:spell") continue;
      if (v && typeof v === "object" && typeof (v as NoteSlot).body === "string") {
        next[k] = {
          body: String((v as NoteSlot).body),
          updatedAt: typeof (v as NoteSlot).updatedAt === "number" ? (v as NoteSlot).updatedAt : Date.now(),
        };
      }
    }
    notes = next;
  }

  const settings: ZernixUiSettings = {
    ...d.settings,
    ...(p.settings && typeof p.settings === "object" ? (p.settings as ZernixUiSettings) : {}),
  };
  if (settings.listDensity !== "comfortable" && settings.listDensity !== "compact") {
    settings.listDensity = d.settings.listDensity;
  }
  if (settings.catalogLang !== "ru" && settings.catalogLang !== "en") {
    settings.catalogLang = d.settings.catalogLang;
  }
  if (typeof settings.darkMode !== "boolean") {
    settings.darkMode = Boolean(d.settings.darkMode);
  }
  if (typeof settings.autoSaveNotes !== "boolean") {
    settings.autoSaveNotes = d.settings.autoSaveNotes !== undefined ? Boolean(d.settings.autoSaveNotes) : true;
  }

  const profile: ZernixProfile = {
    ...d.profile,
    ...(p.profile && typeof p.profile === "object" ? (p.profile as ZernixProfile) : {}),
  };

  let dmSession: DmSessionBlock = d.dmSession;
  if (p.dmSession && typeof p.dmSession === "object") {
    const raw = p.dmSession as Partial<DmSessionBlock>;
    const timelineRaw = Array.isArray(raw.timeline) ? raw.timeline.filter(isDmTimelineEntry) : [];
    dmSession = {
      active: Boolean(raw.active),
      startedAt: typeof raw.startedAt === "number" ? raw.startedAt : 0,
      timeline: capDmTimeline(timelineRaw),
    };
  }

  let worldHints: ZernixWorldHints = d.worldHints;
  if (p.worldHints && typeof p.worldHints === "object") {
    const w = p.worldHints as Partial<ZernixWorldHints>;
    const base = defaultWorldHints();
    worldHints = {
      currentLocation: typeof w.currentLocation === "string" ? w.currentLocation : base.currentLocation,
      activeFaction: typeof w.activeFaction === "string" ? w.activeFaction : base.activeFaction,
      currentThreat: typeof w.currentThreat === "string" ? w.currentThreat : base.currentThreat,
      lastNpcName: typeof w.lastNpcName === "string" ? w.lastNpcName : base.lastNpcName,
      lastHookLine: typeof w.lastHookLine === "string" ? w.lastHookLine : base.lastHookLine,
    };
  }

  return { favorites, notes, settings, profile, dmSession, worldHints };
}

export function loadZernixUserBundle(): ZernixUserBundle {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultZernixUserBundle();
    return mergeBundle(JSON.parse(raw));
  } catch {
    return defaultZernixUserBundle();
  }
}

export function persistZernixUserBundle(b: ZernixUserBundle): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
  } catch {
    /* quota / private mode */
  }
}
