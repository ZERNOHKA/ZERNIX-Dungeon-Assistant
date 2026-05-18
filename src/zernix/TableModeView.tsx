import { useCallback, useState } from "react";
import { Gem, Heart, Home, Map, Sparkles, UserRound } from "lucide-react";

import { useZernixUserData } from "../context/ZernixUserDataContext";
import { useAppContent } from "../hooks/useAppContent";
import { LootCard } from "./components/LootCard";
import { npcFavoriteRefKey, npcJoinSegments, npcSafeField } from "./npcUi";
import { QUICK_PRESETS, type QuickPresetId } from "./quickPresets";
import { useZernixGenerators } from "./ZernixGeneratorsContext";
import type { ZernixViewId } from "./types";

type Slot = "npc" | "loot" | "scene" | "hook" | null;

type Props = {
  onExit: (v: ZernixViewId) => void;
};

export function TableModeView({ onExit }: Props) {
  const { data: appContent } = useAppContent();
  const { ensurePlaySession, pushDmTimeline, appendSessionHookLine, isFavorite, toggleLootFavorite, toggleNpcFavorite } =
    useZernixUserData();
  const {
    generateNpc,
    generateLoot,
    generateSession,
    runQuickPreset,
    npc,
    npcBusy,
    lootCards,
    selectedLootId,
    setSelectedLootId,
    lootBusy,
    sessionBusy,
    contentReady,
    rerollNpcNarrativeField,
    lastResolvedNpcCard,
  } = useZernixGenerators();

  const [pending, setPending] = useState<Slot>(null);
  const [npcFavTick, setNpcFavTick] = useState(false);

  const primaryLoot = lootCards.find((c) => c.id === selectedLootId) ?? lootCards[0] ?? null;

  const canRerollNarrative = Boolean(lastResolvedNpcCard);

  function presetSlot(id: QuickPresetId): Slot {
    if (id === "loot_quick") return "loot";
    if (id === "scene_random" || id === "scene_dungeon") return "scene";
    if (id === "hook") return "hook";
    return "npc";
  }

  const runNpc = useCallback(async () => {
    ensurePlaySession();
    setPending("npc");
    try {
      const n = await generateNpc();
      if (n) {
        pushDmTimeline({
          kind: "npc",
          title: npcSafeField(n.name),
          subtitle: npcJoinSegments([n.race, n.creatureClass]) || undefined,
        });
      }
    } finally {
      setPending(null);
    }
  }, [ensurePlaySession, generateNpc, pushDmTimeline]);

  const runLoot = useCallback(async () => {
    ensurePlaySession();
    setPending("loot");
    try {
      const card = await generateLoot();
      if (card) {
        pushDmTimeline({
          kind: "loot",
          title: card.title,
          subtitle: `${card.rarityLabel} · ${card.kindLabel}`,
          lootId: card.id,
        });
      }
    } finally {
      setPending(null);
    }
  }, [ensurePlaySession, generateLoot, pushDmTimeline]);

  const runScene = useCallback(async () => {
    ensurePlaySession();
    setPending("scene");
    try {
      const meta = await generateSession();
      if (meta) {
        pushDmTimeline({
          kind: "scene",
          title: meta.title,
          subtitle: meta.excerpt || "Сцена и подготовка",
        });
      }
    } finally {
      setPending(null);
    }
  }, [ensurePlaySession, generateSession, pushDmTimeline]);

  const runHook = useCallback(() => {
    ensurePlaySession();
    setPending("hook");
    appendSessionHookLine();
    setPending(null);
  }, [appendSessionHookLine, ensurePlaySession]);

  const runPreset = useCallback(
    async (id: QuickPresetId) => {
      ensurePlaySession();
      setPending(presetSlot(id));
      try {
        const r = await runQuickPreset(id);
        if (r.kind === "npc") {
          pushDmTimeline({
            kind: "npc",
            title: npcSafeField(r.npc.name),
            subtitle: npcJoinSegments([r.npc.race, r.npc.creatureClass]) || undefined,
          });
        } else if (r.kind === "loot") {
          pushDmTimeline({
            kind: "loot",
            title: r.card.title,
            subtitle: `${r.card.rarityLabel} · ${r.card.kindLabel}`,
            lootId: r.card.id,
          });
        } else if (r.kind === "scene") {
          pushDmTimeline({
            kind: "scene",
            title: r.title,
            subtitle: r.excerpt || "Сцена и подготовка",
          });
        } else if (r.kind === "hook") {
          pushDmTimeline({
            kind: "hook",
            title: r.line,
            subtitle: "Крючок в заметках подготовки",
          });
        }
      } finally {
        setPending(null);
      }
    },
    [ensurePlaySession, pushDmTimeline, runQuickPreset],
  );

  const busy = npcBusy || lootBusy || sessionBusy || pending !== null;
  const npcFavKey = npcFavoriteRefKey(npc);

  return (
    <div className="zernix-table-root">
      <div className="zernix-table-topbar">
        <button type="button" className="zernix-table-exit" onClick={() => onExit("home")}>
          <Home className="zernix-table-exit__icon" strokeWidth={1.35} aria-hidden />
          Выход
        </button>
        <div className="zernix-table-topbar__stack">
          <p className="zernix-table-topbar__title">За столом</p>
          <p className="zernix-table-topbar__sub">Быстрые генерации · без форм</p>
        </div>
      </div>

      <div className="zernix-table-actions" role="toolbar" aria-label="Быстрые генерации">
        <button
          type="button"
          className="zernix-table-action"
          disabled={busy || !appContent?.npc}
          onClick={() => void runNpc()}
        >
          <UserRound className="zernix-table-action__icon" strokeWidth={1.2} aria-hidden />
          <span className="zernix-table-action__label">NPC</span>
        </button>
        <button
          type="button"
          className="zernix-table-action"
          disabled={busy || !contentReady}
          onClick={() => void runLoot()}
        >
          <Gem className="zernix-table-action__icon" strokeWidth={1.2} aria-hidden />
          <span className="zernix-table-action__label">Лут</span>
        </button>
        <button type="button" className="zernix-table-action" disabled={busy} onClick={() => void runScene()}>
          <Map className="zernix-table-action__icon" strokeWidth={1.2} aria-hidden />
          <span className="zernix-table-action__label">Сцена</span>
        </button>
        <button type="button" className="zernix-table-action" disabled={busy} onClick={runHook}>
          <Sparkles className="zernix-table-action__icon" strokeWidth={1.2} aria-hidden />
          <span className="zernix-table-action__label">Крючок</span>
        </button>
      </div>

      <div className="zernix-table-presets" role="group" aria-label="Быстрый старт">
        {QUICK_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="zernix-table-preset"
            disabled={busy || (p.id.startsWith("npc_") && !appContent?.npc) || ((p.id === "loot_quick") && !contentReady)}
            title={p.labelRu}
            onClick={() => void runPreset(p.id)}
          >
            {p.shortRu}
          </button>
        ))}
      </div>

      <div className="zernix-table-stage-outer">
        <div className="zernix-table-stage" aria-live="polite">
        {pending ? (
          <div className="zernix-table-skeleton" aria-busy>
            <div className="zernix-table-skeleton__line zernix-table-skeleton__line--lg" />
            <div className="zernix-table-skeleton__line" />
            <div className="zernix-table-skeleton__line" />
            <div className="zernix-table-skeleton__line zernix-table-skeleton__line--sm" />
          </div>
        ) : null}

        {!pending && primaryLoot ? (
          <div className="zernix-table-card-wrap zernix-content-fade">
            <LootCard
              card={primaryLoot}
              selected
              onSelect={() => {}}
              favorited={isFavorite("loot", `loot:${primaryLoot.id}`)}
              onToggleFavorite={() => toggleLootFavorite(primaryLoot)}
            />
          </div>
        ) : null}

        {!pending && !primaryLoot ? (
          <div className="zernix-table-npc-card zernix-premium-panel zernix-panel-pad">
            <div className="zernix-table-npc-head">
              <div>
                <div className="zernix-table-npc-name">{npcSafeField(npc.name)}</div>
                <div className="zernix-table-npc-role">{npcSafeField(npc.creatureClass)}</div>
              </div>
              <button
                type="button"
                className={`zernix-loot-card__fav ${isFavorite("npc", npcFavKey) ? "is-on" : ""} ${npcFavTick ? "is-tick" : ""}`}
                style={{ width: 48, height: 48 }}
                aria-label="Избранное"
                aria-pressed={isFavorite("npc", npcFavKey)}
                onClick={() => {
                  toggleNpcFavorite(npc);
                  setNpcFavTick(true);
                  window.setTimeout(() => setNpcFavTick(false), 420);
                }}
              >
                <Heart size={20} strokeWidth={1.35} fill={isFavorite("npc", npcFavKey) ? "currentColor" : "none"} aria-hidden />
              </button>
            </div>
            <p className="zernix-table-npc-field">
              <span className="zernix-table-npc-kwrap">
                <span className="zernix-table-npc-k">Образ</span>
                <button
                  type="button"
                  className="zernix-table-npc-reroll"
                  disabled={busy || !canRerollNarrative}
                  aria-label="Перегенерировать образ"
                  onClick={() => rerollNpcNarrativeField("visual")}
                >
                  ↻
                </button>
              </span>
              {npcSafeField(npc.visualTrait)}
            </p>
            <p className="zernix-table-npc-field">
              <span className="zernix-table-npc-kwrap">
                <span className="zernix-table-npc-k">Хочет</span>
                <button
                  type="button"
                  className="zernix-table-npc-reroll"
                  disabled={busy || !canRerollNarrative}
                  aria-label="Перегенерировать мотив"
                  onClick={() => rerollNpcNarrativeField("want")}
                >
                  ↻
                </button>
              </span>
              {npcSafeField(npc.wantLine)}
            </p>
            <p className="zernix-table-npc-field">
              <span className="zernix-table-npc-kwrap">
                <span className="zernix-table-npc-k">Не хочет</span>
                <button
                  type="button"
                  className="zernix-table-npc-reroll"
                  disabled={busy || !canRerollNarrative}
                  aria-label="Перегенерировать страхи"
                  onClick={() => rerollNpcNarrativeField("avoid")}
                >
                  ↻
                </button>
              </span>
              {npcSafeField(npc.avoidLine)}
            </p>
            <p className="zernix-table-npc-field">
              <span className="zernix-table-npc-kwrap">
                <span className="zernix-table-npc-k">Секрет</span>
                <button
                  type="button"
                  className="zernix-table-npc-reroll"
                  disabled={busy || !canRerollNarrative}
                  aria-label="Перегенерировать секрет"
                  onClick={() => rerollNpcNarrativeField("secret")}
                >
                  ↻
                </button>
              </span>
              {npcSafeField(npc.secretLine)}
            </p>
            <p className="zernix-table-empty-hint">
              Сгенерируйте NPC для текущей сцены — или нажмите «Лут», чтобы выдать сокровища без переключения вкладок.
            </p>
          </div>
        ) : null}
        </div>
      </div>

      {primaryLoot && lootCards.length > 1 ? (
        <div className="zernix-table-loot-strip" role="tablist" aria-label="Карточки добычи">
          {lootCards.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`zernix-table-loot-pill ${selectedLootId === c.id ? "is-on" : ""}`}
              onClick={() => setSelectedLootId(c.id)}
            >
              {c.title.length > 22 ? `${c.title.slice(0, 20)}…` : c.title}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
