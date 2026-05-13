import "./ZernixTheme.css";

import { useState } from "react";
import type { ReactNode } from "react";
import {
  BookOpen,
  Coins,
  Heart,
  History as HistoryIcon,
  Home,
  Package,
  ScrollText,
  Settings,
  UserCircle,
} from "lucide-react";

import type { ZernixViewId } from "./zernix/types";
import { ZernixPreview } from "./zernix/ZernixPreview";
import {
  ConditionsEncyclopediaView,
  FavoritesView,
  HistoryView,
  HomeDashboard,
  LootGeneratorView,
  NpcCreatorView,
  SessionPrepView,
  SettingsView,
} from "./zernix/ZernixViews";

const NAV_CREATION: ReadonlyArray<{
  id: Exclude<ZernixViewId, "home" | "history" | "favorites" | "settings">;
  title: string;
  hint: string;
  Icon: typeof Package;
}> = [
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

  const header = HEAD_COPY[view];

  let main: ReactNode;
  switch (view) {
    case "home":
      main = <HomeDashboard onNavigate={setView} />;
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
      main = <HistoryView />;
      break;
    case "favorites":
      main = <FavoritesView />;
      break;
    case "settings":
      main = <SettingsView />;
      break;
  }

  return (
    <div className="zernix-app-root">
      <div className="zernix-bg-stack" aria-hidden>
        <div className="zernix-bg-stack__art" />
        <div className="zernix-bg-stack__silhouette" />
        <div className="zernix-bg-stack__dragon" />
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

      <div className="zernix-app-shell">
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
                onClick={() => setView(id)}
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
                onClick={() => setView(id)}
              >
                <Icon className="zernix-nav-icon" strokeWidth={1.2} />
                <span>
                  <div className="zernix-nav-btn__title">{title}</div>
                </span>
              </button>
            ))}

            <div className="zernix-d20-slot" aria-hidden title="d20_dice.png" />
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
              <button type="button" className="zernix-icon-btn" onClick={() => setView("settings")}>
                <Settings size={16} strokeWidth={1.5} />
                Settings
              </button>
              <button type="button" className="zernix-icon-btn">
                <Coins size={16} strokeWidth={1.5} />
                Gold
              </button>
              <div className="zernix-avatar" aria-hidden />
            </div>
          </header>

          {main}
        </main>

        <aside className="zernix-region-detail" aria-label="Кодекс и превью">
          <div className="zernix-region-detail-inner">
            <ZernixPreview view={view} conditionKey={conditionKey} />
          </div>
        </aside>

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
