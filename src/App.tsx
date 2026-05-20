import "./ZernixTheme.css";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { getSectionBackgrounds } from "./lib/sectionBackgrounds";
import { ZERNIX_ART } from "./lib/zernixArt";

const SECTION_BG_ROTATION_MS = 14000;

import { ZernixProfileModal, ZernixQuickSettingsModal } from "./components/ZernixDeskModals";
import {
  BookOpen,
  Coins,
  Dices,
  Heart,
  History as HistoryIcon,
  Home,
  Package,
  ScrollText,
  Settings,
  UserCircle,
} from "lucide-react";

import { useZernixUserData } from "./context/ZernixUserDataContext";
import type { ZernixViewId } from "./zernix/types";
import { ZernixPreview } from "./zernix/ZernixPreview";
import { TableModeView } from "./zernix/TableModeView";
import { useZernixGenerators } from "./zernix/ZernixGeneratorsContext";
import {
  ConditionsEncyclopediaView,
  FavoritesView,
  HistoryView,
  HomeDashboard,
  LootGeneratorView,
  NpcCreatorView,
  SessionPrepView,
  SettingsView,
} from "./zernix/views";

const NAV_CREATION: ReadonlyArray<{
  id: Exclude<ZernixViewId, "home" | "history" | "favorites" | "settings">;
  title: string;
  hint: string;
  Icon: typeof Package;
}> = [
  { id: "table", title: "За столом", hint: "Большие кнопки, один клик", Icon: Dices },
  { id: "loot", title: "Loot Generator", hint: "Сокровища и таблицы", Icon: Package },
  { id: "npc", title: "Create NPC", hint: "Персонаж за минуту", Icon: UserCircle },
  { id: "prep", title: "Session Preparation", hint: "Заметки и таймлайн", Icon: ScrollText },
  { id: "conditions", title: "Conditions Encyclopedia", hint: "Состояния SRD", Icon: BookOpen },
];

const NAV_MENU: ReadonlyArray<{ id: ZernixViewId; title: string; Icon: typeof Home }> = [
  { id: "home", title: "Home", Icon: Home },
  { id: "history", title: "History", Icon: HistoryIcon },
  { id: "favorites", title: "Favorites", Icon: Heart },
  { id: "settings", title: "Settings", Icon: Settings },
];

const HEAD_COPY: Record<
  ZernixViewId,
  {
    title: string;
    subtitle: string;
  }
> = {
  home: {
    title: "ZERNIX Dungeon Assistant",
    subtitle: "ТВОЙ МАСТЕР. ТВОЙ МИР. ТВОИ ЛЕГЕНДЫ.",
  },
  table: {
    title: "За столом",
    subtitle: "Минимум интерфейса — максимум скорости",
  },
  loot: {
    title: "Генератор добычи",
    subtitle: "D&D 5.5 · таблицы сокровищ и магические предметы",
  },
  npc: {
    title: "Создание NPC",
    subtitle: "Кинематографичные лица, мотивы и тайны для стола",
  },
  prep: {
    title: "Подготовка сессии",
    subtitle: "Столкновения, окружение, лут и нити кампании",
  },
  conditions: {
    title: "Энциклопедия состояний",
    subtitle: "Краткие формулировки для быстрого напоминания",
  },
  history: {
    title: "История",
    subtitle: "Недавние генерации и заметки мастера",
  },
  favorites: {
    title: "Избранное",
    subtitle: "Заклинания, предметы и NPC под рукой",
  },
  settings: {
    title: "Настройки",
    subtitle: "Клиент, языки и параметры каталогов",
  },
};

export default function App() {
  const [view, setView] = useState<ZernixViewId>("home");
  const [conditionKey, setConditionKey] = useState("frightened");
  const [profileOpen, setProfileOpen] = useState(false);
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false);
  const { setSelectedLootId } = useZernixGenerators();
  const { profile, toastMessage } = useZernixUserData();

  const sectionImages = useMemo(() => getSectionBackgrounds(view), [view]);
  const [bgIndex, setBgIndex] = useState(0);
  const [bgPrevUrl, setBgPrevUrl] = useState<string | null>(null);
  const lastUrlRef = useRef<string | null>(null);

  const bgCurrentUrl = sectionImages.length > 0
    ? sectionImages[bgIndex % sectionImages.length]
    : null;

  useEffect(() => {
    setBgIndex(0);
  }, [view]);

  useEffect(() => {
    if (bgCurrentUrl === lastUrlRef.current) return;
    setBgPrevUrl(lastUrlRef.current);
    lastUrlRef.current = bgCurrentUrl;
  }, [bgCurrentUrl]);

  useEffect(() => {
    if (sectionImages.length < 2) return;
    const id = window.setInterval(() => {
      setBgIndex((i) => (i + 1) % sectionImages.length);
    }, SECTION_BG_ROTATION_MS);
    return () => window.clearInterval(id);
  }, [sectionImages.length]);

  const artStyle: CSSProperties = {
    ["--zernix-home-dragon" as unknown as keyof CSSProperties]:
      bgCurrentUrl ? `url("${bgCurrentUrl}")` : "none",
    ["--zernix-home-dragon-prev" as unknown as keyof CSSProperties]:
      bgPrevUrl ? `url("${bgPrevUrl}")` : "none",
    ["--zernix-logo-dragon" as unknown as keyof CSSProperties]: `url("${ZERNIX_ART.logoDragon}")`,
    ["--zernix-d20-art" as unknown as keyof CSSProperties]: `url("${ZERNIX_ART.d20Dice}")`,
  } as CSSProperties;

  const hasSectionBg = Boolean(bgCurrentUrl);

  function handleOpenLootCard(lootCardId: string) {
    setView("loot");
    setSelectedLootId(lootCardId);
  }

  function handleOpenNoteKey(key: string) {
    if (key.startsWith("loot:")) {
      handleOpenLootCard(key.slice(5));
      return;
    }
    if (key.startsWith("npc:") || key === "npc:current") {
      setView("npc");
      return;
    }
    if (key.startsWith("prep:") || key.startsWith("session:")) {
      setView("prep");
      return;
    }
    if (key.startsWith("home:")) {
      setView("home");
      return;
    }
    setView("history");
  }

  const header = HEAD_COPY[view];

  let main: ReactNode;
  switch (view) {
    case "home":
      main = (
        <HomeDashboard
          onNavigate={setView}
          onOpenLootCard={handleOpenLootCard}
          onOpenNoteKey={handleOpenNoteKey}
        />
      );
      break;
    case "table":
      main = <TableModeView onExit={setView} />;
      break;
    case "loot":
      main = <LootGeneratorView />;
      break;
    case "npc":
      main = <NpcCreatorView />;
      break;
    case "prep":
      main = <SessionPrepView />;
      break;
    case "conditions":
      main = <ConditionsEncyclopediaView conditionKey={conditionKey} onPickCondition={setConditionKey} />;
      break;
    case "history":
      main = <HistoryView onOpenNoteKey={handleOpenNoteKey} />;
      break;
    case "favorites":
      main = <FavoritesView onNavigate={setView} onOpenLootCard={handleOpenLootCard} />;
      break;
    case "settings":
      main = <SettingsView />;
      break;
  }

  return (
    <div
      className={`zernix-app-root${hasSectionBg ? " zernix-app-root--has-section-bg" : ""}`}
      data-view={view}
      style={artStyle}
    >
      <ZernixProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <ZernixQuickSettingsModal open={quickSettingsOpen} onClose={() => setQuickSettingsOpen(false)} />

      {toastMessage ? (
        <div className="zernix-toast" role="status">
          {toastMessage}
        </div>
      ) : null}
      <div className="zernix-bg-stack" aria-hidden>
        <div className="zernix-bg-stack__art" />
        <div className="zernix-bg-stack__silhouette" />
        <div className="zernix-bg-stack__dragon" />
        {/* Section dragon backdrop — driven by --zernix-home-dragon (current)
            and --zernix-home-dragon-prev (outgoing) for smooth crossfade. */}
        <div className="zernix-bg-stack__home-dragon-prev" key={`bgp-${bgPrevUrl ?? "none"}`} />
        <div className="zernix-bg-stack__home-dragon" key={`bgc-${bgCurrentUrl ?? "none"}`} />
        <div className="zernix-bg-stack__ruins-mist" />
        <div className="zernix-bg-stack__fog" />
        <div className="zernix-bg-stack__mist-drift" />
        <div className="zernix-bg-stack__fog-deep" />
        <div className="zernix-bg-stack__vignette" />
        <div className="zernix-bg-stack__overlay" />
        <div className="zernix-bg-stack__smoke" />
        <div className="zernix-bg-stack__smoke-wisp" />
        <div className="zernix-bg-stack__grain" />
        <div className="zernix-bg-stack__embers" />
        <div className="zernix-bg-stack__runes" />
      </div>

      <div
        className={`zernix-app-shell${view === "table" ? " zernix-app-shell--table" : ""}${
          view === "home" ? " zernix-app-shell--home" : ""
        }${view === "loot" ? " zernix-app-shell--loot" : ""}${
          view === "npc" ? " zernix-app-shell--npc" : ""
        }${view === "prep" ? " zernix-app-shell--prep" : ""}`}
      >
        <aside className="zernix-region-sidebar">
          <div className="zernix-sidebar-inner">
            <div className="zernix-logo-slot" aria-label="Логотип ZERNIX" />

            <div className="zernix-brand-title">
              ZERNIX
              <br />
              DUNGEON
              <br />
              ASSISTANT
            </div>

            <div className="zernix-section-label">СОЗДАНИЕ</div>
            {NAV_CREATION.map(({ id, title, hint, Icon }) => (
              <button
                key={id}
                type="button"
                className={`zernix-nav-btn ${view === id ? "is-active" : ""}`}
                onClick={() => {
                  console.debug("[ZERNIX] nav", id);
                  setView(id);
                }}
              >
                <Icon className="zernix-nav-icon" strokeWidth={1.25} />
                <span>
                  <div className="zernix-nav-btn__title">{title}</div>
                  <div className="zernix-nav-btn__hint">{hint}</div>
                </span>
              </button>
            ))}

            <div className="zernix-section-label">МЕНЮ</div>
            {NAV_MENU.map(({ id, title, Icon }) => (
              <button
                key={id}
                type="button"
                className={`zernix-nav-btn ${view === id ? "is-active" : ""}`}
                onClick={() => {
                  console.debug("[ZERNIX] nav", id);
                  setView(id);
                }}
              >
                <Icon className="zernix-nav-icon" strokeWidth={1.2} />
                <span>
                  <div className="zernix-nav-btn__title">{title}</div>
                </span>
              </button>
            ))}

            <div className="zernix-sidebar-footer">
              <div className="zernix-d20-slot" aria-hidden />
              <p className="zernix-sidebar-credit">Developed ZERNOHKA</p>
            </div>
          </div>
        </aside>

        <main className="zernix-region-main">
          <header className="zernix-topbar">
            <div style={{ minWidth: 120 }} aria-hidden />
            <div className="zernix-topbar-center">
              <h1 className="zernix-page-title">{header.title}</h1>
              <p className="zernix-tagline">{header.subtitle}</p>
            </div>
            <div className="zernix-topbar-actions">
              <button
                type="button"
                className="zernix-icon-btn zernix-btn-press"
                onClick={() => {
                  console.debug("[ZERNIX] open quick settings");
                  setQuickSettingsOpen(true);
                }}
              >
                <Settings size={16} strokeWidth={1.5} />
                Settings
              </button>
              <button
                type="button"
                className="zernix-icon-btn zernix-btn-press"
                onClick={() => {
                  console.debug("[ZERNIX] nav gold shortcut");
                  setView("loot");
                }}
              >
                <Coins size={16} strokeWidth={1.5} />
                Gold
              </button>
              <button
                type="button"
                className="zernix-avatar zernix-avatar-btn zernix-btn-press"
                aria-label="Профиль"
                title="Профиль"
                onClick={() => {
                  console.debug("[ZERNIX] open profile modal");
                  setProfileOpen(true);
                }}
              >
                {profile.avatarDataUrl ? (
                  <img src={profile.avatarDataUrl} alt="" />
                ) : (
                  <span className="zernix-avatar__placeholder" aria-hidden>
                    {(profile.displayName || "Z").trim().slice(0, 1).toUpperCase() || "Z"}
                  </span>
                )}
              </button>
            </div>
          </header>

          {main}
        </main>

        {view !== "home" && view !== "loot" && view !== "npc" && view !== "prep" ? (
          <aside className="zernix-region-detail" aria-label="Кодекс и превью">
            <div className="zernix-region-detail-inner">
              <ZernixPreview view={view} conditionKey={conditionKey} />
            </div>
          </aside>
        ) : null}

        <footer className="zernix-region-footer zernix-footer-bar">
          <span>ГОТОВ К ПРИКЛЮЧЕНИЮ</span>
          <span>D&amp;D 5.5 · OFFICIAL RULES 2024</span>
          <span className="zernix-footer-online">
            <span className="zernix-footer-dot" aria-hidden />
            v1.0.0 · Online
          </span>
        </footer>
      </div>
    </div>
  );
}
