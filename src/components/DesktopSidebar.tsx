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
      className={`fixed left-0 top-0 z-40 hidden h-[100dvh] ${SIDEBAR_W} flex-col overflow-visible border-r border-[#d4af37]/14 bg-[#050505]/98 shadow-[6px_0_48px_rgba(0,0,0,0.65)] backdrop-blur-xl lg:flex`}
    >
      {/* Слот под логотип: положите logo_dragon.png в public/ и задайте в CSS --zernix-logo-dragon: url("/logo_dragon.png"); */}
      <div className="relative flex flex-col gap-4 border-b border-[#d4af37]/10 px-5 pb-5 pt-[calc(1rem+env(safe-area-inset-top))]">
        <span className="absolute right-5 top-[calc(0.65rem+env(safe-area-inset-top))] inline-flex items-center gap-1 rounded-none border border-[#d4af37]/45 bg-[rgba(212,175,55,0.08)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#d4af37] xl:text-[10px]">
          <Crown className="size-3 xl:size-3.5" strokeWidth={1.75} aria-hidden />
          Gold
        </span>
        <div className="flex items-start gap-3 pr-14">
          <div
            className="zernix-logo-slot mt-0.5 size-[52px] shrink-0 border border-[#d4af37]/38 bg-black/55 bg-[length:82%] bg-center bg-no-repeat xl:size-14"
            style={{ backgroundImage: "var(--zernix-logo-dragon, none)" }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="font-serif text-[1.05rem] leading-snug tracking-[0.16em] text-[#d4af37] drop-shadow-[0_0_18px_rgba(212,175,55,0.28)] xl:text-[1.15rem]">
              {meta.title}
            </p>
            <p className="mt-1.5 font-sans text-[10px] uppercase leading-snug tracking-[0.2em] text-[#e2e2e2]/55">
              {meta.subtitle}
            </p>
          </div>
        </div>
      </div>

      <nav className="zernix-scrollbar flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 pb-36">
        <div>
          <p className="mb-3 px-2 font-sans text-[10px] font-semibold uppercase tracking-[0.34em] text-[#e2e2e2]/35">
            СОЗДАНИЕ
          </p>
          <ul className="flex flex-col gap-2">
            {navigation.homeCards.map((card) => {
              const active = currentRoute === card.route;
              return (
                <li key={card.id}>
                  <button
                    type="button"
                    onClick={() => onOpenCard(card.route)}
                    className={`flex w-full items-center gap-3 rounded-none border px-3 py-3 text-left font-sans transition ${
                      active
                        ? "border-[#d4af37]/70 bg-black/50 text-[#d4af37] shadow-[inset_0_0_15px_rgba(212,175,55,0.1)]"
                        : "border-[#d4af37]/14 bg-black/30 text-[#e2e2e2]/85 hover:border-[#d4af37]/35 hover:text-[#d4af37]"
                    }`}
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-none border border-[#d4af37]/26 bg-black/55 text-[#d4af37] xl:size-12">
                      <IconByName name={card.icon} className="size-6 xl:size-7" strokeWidth={1.35} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-serif text-[15px] leading-tight text-[#d4af37] xl:text-base">{card.titleRu}</span>
                      <span className="mt-1 line-clamp-2 text-[11px] text-[#e2e2e2]/45">{card.subtitleRu}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <p className="mb-3 px-2 font-sans text-[10px] font-semibold uppercase tracking-[0.34em] text-[#e2e2e2]/35">МЕНЮ</p>
          <ul className="flex flex-col gap-1">
            {navigation.footerTabs.map((tabItem) => {
              const routeHit = tabItem.route === currentRoute;
              const active = tabItem.id === activeTab || routeHit;
              return (
                <li key={tabItem.id}>
                  <button
                    type="button"
                    onClick={() => onTabSelect(tabItem.id, tabItem.route)}
                    className={`flex w-full items-center gap-3 rounded-none border px-3 py-2.5 text-left font-sans text-sm transition ${
                      active
                        ? "border-[#d4af37]/65 bg-black/45 text-[#d4af37] shadow-[inset_0_0_15px_rgba(212,175,55,0.1)]"
                        : "border-transparent text-[#e2e2e2]/50 hover:border-[#d4af37]/18 hover:bg-[#d4af37]/[0.04] hover:text-[#d4af37]/90"
                    }`}
                  >
                    <IconByName name={tabItem.icon} className="size-7 shrink-0 xl:size-8" strokeWidth={1.35} />
                    <span className="font-medium xl:text-[15px]">{tabItem.labelRu}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Кубик d20: absolute, слегка выходит за сайдбар. Файл public/d20_dice.png → --zernix-d20-art в index.css */}
      <div
        className="pointer-events-none absolute -bottom-2 left-0 z-50 hidden h-[7.5rem] w-[7.5rem] -translate-x-1/4 lg:block xl:h-32 xl:w-32 xl:-translate-x-[18%]"
        aria-hidden
      >
        <div
          className="h-full w-full bg-contain bg-bottom bg-no-repeat opacity-[0.92] drop-shadow-[0_0_28px_rgba(212,175,55,0.28)]"
          style={{ backgroundImage: "var(--zernix-d20-art, none)" }}
        />
      </div>
    </aside>
  );
}
