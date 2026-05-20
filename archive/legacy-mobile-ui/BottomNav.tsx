import { IconByName } from "./IconByName";
import type { AppContentJson } from "../types/content";
import type { RootTab } from "../types/routes";
import type { AppRoute } from "../types/routes";

interface BottomNavProps {
  tabs: AppContentJson["navigation"]["footerTabs"];
  activeTab: RootTab;
  currentRoute: AppRoute;
  onSelect: (tab: RootTab, route: AppRoute) => void;
  className?: string;
}

export function BottomNav({
  tabs,
  activeTab,
  currentRoute,
  onSelect,
  className = "",
}: BottomNavProps) {
  return (
    <footer
      className={`fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 rounded-t-[20px] border border-gold/22 border-b-0 bg-[#050505]/94 px-6 pb-[calc(14px+env(safe-area-inset-bottom))] pt-4 shadow-[0_-24px_48px_rgba(0,0,0,.6)] backdrop-blur-xl supports-[backdrop-filter]:bg-[#050505]/88 lg:hidden ${className}`.trim()}
    >
      <div className="flex items-center justify-between gap-4">
        {tabs.map((tab) => {
          const selectedRoute = tab.route === currentRoute;
          const active = tab.id === activeTab || selectedRoute;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect(tab.id, tab.route)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-zernix px-1 py-1 text-[11px] font-semibold transition ${
                active ? "bg-gold/[0.1] text-gold shadow-innerGold" : "text-zinc-500 hover:text-gold/85"
              }`}
              aria-current={active}
            >
              <IconByName name={tab.icon} className="size-6" strokeWidth={1.4} />
              <span>{tab.labelRu}</span>
            </button>
          );
        })}
      </div>
    </footer>
  );
}
