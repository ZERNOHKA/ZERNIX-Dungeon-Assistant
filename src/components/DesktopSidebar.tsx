import { Crown } from "lucide-react";
import type { AppContentJson } from "../types/content";
import type { AppRoute, RootTab } from "../types/routes";
import { IconByName } from "./IconByName";

const SIDEBAR_W = "w-[248px] xl:w-[264px]";

interface DesktopSidebarProps {
  meta: AppContentJson["meta"];
  navigation: AppContentJson["navigation"];
  activeTab: RootTab;
  currentRoute: AppRoute;
  onTabSelect: (tab: RootTab, route: AppRoute) => void;
  onOpenCard: (route: AppRoute) => void;
}

export function DesktopSidebar({
  meta,
  navigation,
  activeTab,
  currentRoute,
  onTabSelect,
  onOpenCard,
}: DesktopSidebarProps) {
  return (
    <aside
      className={`fixed left-0 top-0 z-40 hidden h-[100dvh] ${SIDEBAR_W} flex-col border-r border-gold/20 bg-[#08090d]/95 shadow-[4px_0_32px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:flex`}
    >
      <div className="flex flex-col gap-1 border-b border-gold/15 px-5 pb-6 pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-serif text-2xl tracking-[0.28em] text-gold drop-shadow-[0_0_14px_rgba(212,175,55,0.35)] xl:text-3xl">
              {meta.title}
            </p>
            <p className="mt-1 text-[10px] font-sans uppercase tracking-[0.22em] text-zinc-500">{meta.subtitle}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gold/35 bg-gold/10 px-2 py-1 text-[10px] font-medium text-gold xl:text-[11px]">
            <Crown className="size-3.5 xl:size-4" strokeWidth={1.75} aria-hidden />
            GOLD
          </span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6">
        <div>
          <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-600">Разделы</p>
          <ul className="flex flex-col gap-2">
            {navigation.homeCards.map((card) => {
              const active = currentRoute === card.route;
              return (
                <li key={card.id}>
                  <button
                    type="button"
                    onClick={() => onOpenCard(card.route)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-gold/50 bg-gold/10 text-gold shadow-goldGlow"
                        : "border-gold/15 bg-black/30 text-zinc-300 hover:border-gold/35 hover:text-gold"
                    }`}
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-gold/25 bg-black/40 text-gold xl:size-12">
                      <IconByName name={card.icon} className="size-6 xl:size-7" strokeWidth={1.35} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-serif text-[15px] leading-tight xl:text-base">{card.titleRu}</span>
                      <span className="mt-1 line-clamp-2 text-[11px] text-zinc-500">{card.subtitleRu}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-600">Меню</p>
          <ul className="flex flex-col gap-1">
            {navigation.footerTabs.map((tab) => {
              const routeHit = tab.route === currentRoute;
              const active = tab.id === activeTab || routeHit;
              return (
                <li key={tab.id}>
                  <button
                    type="button"
                    onClick={() => onTabSelect(tab.id, tab.route)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      active ? "bg-gold/12 text-gold shadow-goldGlow" : "text-zinc-500 hover:bg-gold/5 hover:text-gold/90"
                    }`}
                  >
                    <IconByName name={tab.icon} className="size-7 shrink-0 xl:size-8" strokeWidth={1.35} />
                    <span className="font-medium xl:text-[15px]">{tab.labelRu}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </aside>
  );
}
