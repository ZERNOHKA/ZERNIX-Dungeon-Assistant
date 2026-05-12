import { Settings } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";

import type { LootItem } from "./types/content";
import type { AppRoute, RootTab } from "./types/routes";
import { NetworkSettingsModal } from "./components/NetworkSettingsModal";
import { BottomNav } from "./components/BottomNav";
import { DesktopSideWell } from "./components/DesktopSideWell";
import { DesktopSidebar } from "./components/DesktopSidebar";
import { HomeScreen } from "./components/screens/HomeScreen";
import { LootPickerScreen, type LootRollContext } from "./components/screens/LootPickerScreen";
import { LootResultScreen } from "./components/screens/LootResultScreen";
import { NpcPickerScreen } from "./components/screens/NpcPickerScreen";
import { NpcResultScreen } from "./components/screens/NpcResultScreen";
import { PlaceholderScreen } from "./components/screens/PlaceholderScreen";
import { SessionPrepScreen } from "./components/screens/SessionPrepScreen";
import { StatusScreen } from "./components/screens/StatusScreen";
import { useAppContent } from "./hooks/useAppContent";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useNpcSession } from "./context/NpcSessionContext";
import { resolveNpcCard } from "./lib/npcSummon";
import type { LootDigestPayload } from "./types/lootDigest";

const rarityFallbackStatic = { labelRu: "Неизвестно", colorHex: "#d4af37" };

function desktopSideCopy(route: AppRoute): { title: string; hint: string } {
  switch (route) {
    case "loot-picker":
      return {
        title: "Лут",
        hint: "Бросок: справа — карточка из JSON (браузер) или форматированный отчёт SRD (Electron). На широком экране «Реролл» берёт актуальные CR и gp с формы.",
      };
    case "npc-picker":
      return {
        title: "NPC",
        hint: "Заполните форму и призовите персонажа — пергамент откроется в этой колонке.",
      };
    case "status-list":
      return {
        title: "Состояния",
        hint: "Список по центру; справа можно разместить расширения (детали заклинаний, ссылки).",
      };
    case "session-prep":
      return {
        title: "Сессия",
        hint: "На этом экране своя раскладка: формы и сводка внутри центральной области.",
      };
    case "home-main":
      return {
        title: "Подсказки",
        hint: "Широкая сетка ≥1024px: слева закреплённое меню, по центру основной контент, справа контекстная панель.",
      };
    default:
      return {
        title: "ZERNIX Dungeon Assistant",
        hint: "Разверните окно на всю ширину ноутбука, чтобы увидеть трёхколоночную раскладку.",
      };
  }
}

export default function App() {
  const { data, error } = useAppContent();
  const isWide = useMediaQuery("(min-width: 1024px)");
  const { npcCard, npcSummonForm, setNpcSession, resetNpcSession: wipeNpcState } = useNpcSession();

  const [networkSettingsOpen, setNetworkSettingsOpen] = useState(false);
  const [showNetworkGear, setShowNetworkGear] = useState(false);

  const [route, setRoute] = useState<AppRoute>("home-main");
  const [tab, setTab] = useState<RootTab>("home");
  const [lootItem, setLootItem] = useState<LootItem | null>(null);
  const [lootMarkdown, setLootMarkdown] = useState<string | null>(null);
  /** Контекстный поиск (Electron): текст карточки истории под сводкой золота */
  const [lootNarrativeBlock, setLootNarrativeBlock] = useState<string | null>(null);
  const [lootDigest, setLootDigest] = useState<LootDigestPayload | null>(null);
  const [lootContext, setLootContext] = useState<LootRollContext | null>(null);
  const [lootRerollBusy, setLootRerollBusy] = useState(false);

  const effectiveRoute = useMemo((): AppRoute => {
    if (isWide) {
      if (lootItem != null && route === "loot-result") return "loot-picker";
      if (lootMarkdown != null && route === "loot-result") return "loot-picker";
      if (npcCard != null && route === "npc-result") return "npc-picker";
      return route;
    }
    if (lootItem != null && route === "loot-picker") return "loot-result";
    if (lootMarkdown != null && route === "loot-picker") return "loot-result";
    if (npcCard != null && route === "npc-picker") return "npc-result";
    return route;
  }, [route, isWide, lootItem, lootMarkdown, npcCard]);

  useEffect(() => {
    setShowNetworkGear(typeof window !== "undefined" && Boolean(window.electronAPI?.getNetworkSettings));
  }, []);

  /** Клиентская сборка без локальных движков: сразу открыть настройки, пока не задан хост */
  useEffect(() => {
    if (!window.electronAPI?.getNetworkSettings) return;
    window.electronAPI.getNetworkSettings().then((s) => {
      if (s.needsHostConnection) setNetworkSettingsOpen(true);
    });
  }, []);

  useEffect(() => {
    const unsub = window.electronAPI?.onRequireRemoteConfig?.(() => {
      setNetworkSettingsOpen(true);
    });
    return () => unsub?.();
  }, []);

  const syncElectronLootContext = useCallback((ctx: LootRollContext) => {
    setLootContext(ctx);
  }, []);

  const lootRarity = useMemo(() => {
    if (!data || !lootItem) return rarityFallbackStatic;
    return (
      data.loot.rarities[lootItem.rarityKey as keyof typeof data.loot.rarities] ?? rarityFallbackStatic
    );
  }, [data, lootItem]);

  const rerollLoot = useCallback(async () => {
    if (!lootContext) {
      setRoute("loot-picker");
      return;
    }
    if (
      lootContext.source === "sqlite" &&
      typeof window !== "undefined" &&
      window.electronAPI &&
      lootContext.goldGp != null
    ) {
      setLootRerollBusy(true);
      try {
        const gold = lootContext.goldGp;
        const categories = lootContext.dbCategories ?? [];
        const partyLevel = lootContext.partyLevel ?? 5;
        const playerCount = lootContext.playerCount ?? 4;
        const difficulty = lootContext.difficulty ?? "moderate";
        const environment = lootContext.environment ?? "any";
        const onlyMagic = Boolean(lootContext.magicOnly);
        const chestCount = lootContext.chestCount ?? 0;
        const res = await window.electronAPI.generateLoot({
          gold,
          categories,
          partyLevel,
          playerCount,
          difficulty,
          environment,
          onlyMagic,
          chestCount,
          debugSql: true,
        });
        if (res.ok) {
          if (res.sqlLog?.length) {
            for (const line of res.sqlLog) {
              console.log("[loot-sql]", line);
            }
          }
          setLootMarkdown(res.markdown);
          setLootNarrativeBlock(res.narrativeBlock ?? null);
          setLootDigest(res.lootDigest ?? null);
        } else {
          setLootMarkdown(`_Ошибка:_ ${res.error}`);
          setLootNarrativeBlock(null);
          setLootDigest(null);
        }
      } catch (e) {
        setLootMarkdown(`_Ошибка:_ ${e instanceof Error ? e.message : String(e)}`);
        setLootNarrativeBlock(null);
        setLootDigest(null);
      } finally {
        setLootRerollBusy(false);
      }
      return;
    }
    if (!data) return;
    const ids =
      lootContext.typeIds.length > 0 ? lootContext.typeIds : data.loot.types.map((t) => t.id);
    const primary = data.loot.catalog.filter(
      (entry) => ids.includes(entry.typeId) && (!lootContext.magicOnly || entry.magic),
    );
    const secondary =
      primary.length === 0
        ? data.loot.catalog.filter((entry) => ids.includes(entry.typeId))
        : primary;
    const pool = secondary.length ? secondary : data.loot.catalog;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    setLootItem({
      ...picked,
      flavor: `[Уровень: ${lootContext.level}] ${picked.flavor}`,
    });
  }, [data, lootContext]);

  const closeLootResult = useCallback(() => {
    setLootItem(null);
    setLootMarkdown(null);
    setLootNarrativeBlock(null);
    setLootDigest(null);
    setLootContext(null);
    setRoute("loot-picker");
  }, []);

  const resetNpcSession = useCallback(() => {
    wipeNpcState();
    setRoute("npc-picker");
  }, [wipeNpcState]);

  const rerollNpc = useCallback(async () => {
    if (!data || !npcSummonForm) {
      resetNpcSession();
      return;
    }
    const next = await resolveNpcCard(data.npc, npcSummonForm);
    if (!next) {
      resetNpcSession();
      return;
    }
    setNpcSession(next, npcSummonForm);
  }, [data, npcSummonForm, resetNpcSession, setNpcSession]);

  if (error || !data) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-[430px] flex-col px-6 py-16 lg:max-w-none">
        <p className="text-center font-serif text-xl text-gold">ZERNIX Dungeon Assistant</p>
        <p className="mt-6 text-center text-sm text-zinc-400 lg:text-base">
          {error ?? "Загрузка контента из /data/app-content.json…"}
        </p>
      </main>
    );
  }

  const footerSelect = (nextTab: RootTab, nextRoute: AppRoute) => {
    setTab(nextTab);
    setRoute(nextRoute);
    if (nextTab === "home") {
      setLootItem(null);
      setLootMarkdown(null);
      setLootNarrativeBlock(null);
      setLootDigest(null);
      setLootContext(null);
      wipeNpcState();
    }
  };

  const openFlow = (flowRoute: AppRoute) => {
    setLootItem(null);
    setLootMarkdown(null);
    setLootNarrativeBlock(null);
    setLootDigest(null);
    setLootContext(null);
    wipeNpcState();
    setTab("home");
    setRoute(flowRoute);
  };

  let body: ReactElement | null = null;

  switch (effectiveRoute) {
    case "home-main":
      body = <HomeScreen data={{ meta: data.meta, navigation: data.navigation }} onOpenCard={openFlow} />;
      break;
    case "loot-picker":
      body = (
        <LootPickerScreen
          loot={data.loot}
          onBack={() => {
            setLootItem(null);
            setLootMarkdown(null);
            setLootNarrativeBlock(null);
            setLootDigest(null);
            setLootContext(null);
            setRoute("home-main");
          }}
          onGenerate={(item, context) => {
            setLootMarkdown(null);
            setLootNarrativeBlock(null);
            setLootDigest(null);
            setLootContext(context);
            setLootItem(item);
            if (!isWide) setRoute("loot-result");
          }}
          onGenerateMarkdown={(markdown, context, extras) => {
            setLootItem(null);
            setLootContext(context);
            setLootMarkdown(markdown);
            setLootNarrativeBlock(extras?.narrativeBlock ?? null);
            setLootDigest(extras?.lootDigest ?? null);
            if (!isWide) setRoute("loot-result");
          }}
          onElectronLootContextSync={syncElectronLootContext}
        />
      );
      break;
    case "loot-result":
      body =
        lootMarkdown !== null ? (
          <LootResultScreen
            markdown={lootMarkdown}
            narrativeBlock={lootNarrativeBlock}
            lootDigest={lootDigest}
            item={null}
            rarity={rarityFallbackStatic}
            variant="page"
            onBack={closeLootResult}
            onReroll={rerollLoot}
            rerollBusy={lootRerollBusy}
          />
        ) : lootItem !== null ? (
          <LootResultScreen
            markdown={null}
            item={lootItem}
            rarity={lootRarity}
            variant="page"
            onBack={closeLootResult}
            onReroll={rerollLoot}
            rerollBusy={lootRerollBusy}
          />
        ) : null;
      break;
    case "npc-picker":
      body = (
        <NpcPickerScreen
          npc={data.npc}
          onBack={() => {
            wipeNpcState();
            setRoute("home-main");
          }}
          onReveal={(card, form) => {
            setNpcSession(card, form);
            if (!isWide) setRoute("npc-result");
          }}
        />
      );
      break;
    case "npc-result":
      body =
        npcCard !== null ? (
          <NpcResultScreen
            npc={npcCard}
            variant="page"
            onBack={resetNpcSession}
            onReroll={rerollNpc}
          />
        ) : null;
      break;
    case "status-list":
      body = <StatusScreen statuses={data.statuses} onBack={() => setRoute("home-main")} />;
      break;
    case "session-prep":
      body = <SessionPrepScreen data={data} onBack={() => setRoute("home-main")} />;
      break;
    case "placeholder-history":
      body = (
        <PlaceholderScreen
          title="История генераций"
          description="Подключите API или локальную SQLite через адаптер данных — используйте тот же JSON-формат, что и `/data/app-content.json`."
          onBack={() => setRoute("home-main")}
        />
      );
      break;
    case "placeholder-favorites":
      body = (
        <PlaceholderScreen
          title="Избранное"
          description="Сохраняйте ссылки или сериализованные карты в любимых — компоненты уже поддерживают кнопки."
          onBack={() => setRoute("home-main")}
        />
      );
      break;
    case "placeholder-help":
      body = (
        <PlaceholderScreen
          title="Помощь"
          description="Откройте Mini App после `/start` бота: `telegram-web-app.js` подключается в index.html и инициализируется через `window.Telegram.WebApp`."
          onBack={() => setRoute("home-main")}
        />
      );
      break;
    default:
      body = null;
  }

  const hideGlobalAside = effectiveRoute === "session-prep";

  const lootPanel =
    isWide && lootMarkdown !== null && effectiveRoute === "loot-picker" ? (
      <LootResultScreen
        markdown={lootMarkdown}
        narrativeBlock={lootNarrativeBlock}
        lootDigest={lootDigest}
        item={null}
        rarity={rarityFallbackStatic}
        variant="panel"
        onBack={() => {
          setLootMarkdown(null);
          setLootNarrativeBlock(null);
          setLootDigest(null);
        }}
        onReroll={rerollLoot}
        rerollBusy={lootRerollBusy}
      />
    ) : isWide && lootItem != null && effectiveRoute === "loot-picker" ? (
      <LootResultScreen
        markdown={null}
        item={lootItem}
        rarity={lootRarity}
        variant="panel"
        onBack={() => setLootItem(null)}
        onReroll={rerollLoot}
        rerollBusy={lootRerollBusy}
      />
    ) : null;

  const npcPanel =
    isWide && npcCard != null && effectiveRoute === "npc-picker" ? (
      <NpcResultScreen
        npc={npcCard}
        variant="panel"
        onBack={() => {
          wipeNpcState();
        }}
        onReroll={rerollNpc}
      />
    ) : null;

  const sideCopy = desktopSideCopy(effectiveRoute);
  const rightColumn = lootPanel ?? npcPanel ?? <DesktopSideWell title={sideCopy.title} hint={sideCopy.hint} />;

  return (
    <div className="relative min-h-[100dvh] bg-abyss-bg">
      <DesktopSidebar
        meta={data.meta}
        navigation={data.navigation}
        activeTab={tab}
        currentRoute={effectiveRoute}
        onTabSelect={footerSelect}
        onOpenCard={openFlow}
      />

      <div className="lg:pl-[248px] xl:pl-[264px]">
        <div
          className={
            hideGlobalAside
              ? "lg:block lg:w-full lg:max-w-[1200px] lg:mx-auto"
              : isWide
                ? "lg:mx-auto lg:grid lg:min-h-[100dvh] lg:w-full lg:max-w-[1240px] lg:grid-cols-[minmax(0,620px)_minmax(300px,440px)] lg:items-start lg:gap-10 xl:max-w-[1320px] xl:gap-14 2xl:grid-cols-[minmax(0,640px)_minmax(320px,460px)]"
                : ""
          }
        >
          <main
            className={`flex min-h-[100dvh] flex-col px-4 pb-[calc(120px+env(safe-area-inset-bottom))] pt-[calc(14px+env(safe-area-inset-top))] lg:max-w-none lg:px-8 lg:pb-12 lg:pt-10 ${
              isWide ? "mx-auto w-full max-w-[430px] lg:mx-0 lg:max-w-none" : "mx-auto max-w-[430px]"
            }`}
          >
            {body ?? (
              <PlaceholderScreen title="Страница не найдена" description="" onBack={() => setRoute("home-main")} />
            )}
          </main>

          {isWide && !hideGlobalAside && (
            <aside className="sticky top-10 hidden h-fit max-h-[calc(100dvh-3rem)] overflow-y-auto pb-12 pr-2 pt-10 lg:block xl:top-12 xl:max-h-[calc(100dvh-4rem)] xl:pt-12">
              <div className="pr-2">{rightColumn}</div>
            </aside>
          )}
        </div>
      </div>

      <BottomNav
        tabs={data.navigation.footerTabs}
        activeTab={tab}
        currentRoute={effectiveRoute}
        onSelect={footerSelect}
      />

      {showNetworkGear ? (
        <button
          type="button"
          onClick={() => setNetworkSettingsOpen(true)}
          className="fixed right-4 top-[calc(12px+env(safe-area-inset-top))] z-50 flex size-11 items-center justify-center rounded-xl border border-gold/25 bg-black/60 text-gold shadow-lg backdrop-blur-md transition hover:border-gold/50 hover:bg-gold/10 lg:right-8"
          aria-label="Настройки сети"
        >
          <Settings className="size-5" strokeWidth={1.5} />
        </button>
      ) : null}

      <NetworkSettingsModal open={networkSettingsOpen} onClose={() => setNetworkSettingsOpen(false)} />
    </div>
  );
}
