import { useEffect, useMemo, useState } from "react";

import {
  BookOpen,
  ChevronRight,
  Heart,
  Package,
  ScrollText,
  Shield,
  Skull,
  Sparkles,
  UserCircle,
  Wind,
} from "lucide-react";

import { useZernixUserData } from "../context/ZernixUserDataContext";
import { useAppContent } from "../hooks/useAppContent";
import type { ZernixViewId } from "./types";
import { LootCard } from "./components/LootCard";
import { SessionSceneAtTableCard } from "./components/SessionBriefPanel";
import { useZernixGenerators } from "./ZernixGeneratorsContext";
import type { NpcPreviewState } from "./models";
import type { NarrativeRerollSlot } from "./npcNarrativeCompose";
import { npcFavoriteRefKey, npcJoinSegments, sanitizeNpcPreviewState } from "./npcUi";
import { QUICK_PRESETS, type QuickPresetId } from "./quickPresets";
import { presentSessionAtTable, presentSessionFromLogMarkdown } from "./sessionAtTablePresent";
import { ZernixLootResultsSkeleton, ZernixNpcCardSkeleton, ZernixSessionSummarySkeleton } from "./ZernixSkeletonBlocks";
import { useIdleGlow } from "./useIdleGlow";
import {
  formatLootCompact,
  formatLootDiscord,
  formatLootMarkdown,
  formatNpcCompact,
  formatNpcDiscord,
  formatNpcMarkdown,
  formatSessionCompact,
  formatSessionDiscord,
  formatSessionMarkdown,
  writeClipboard,
} from "./zernixCopyExport";

const TRIO = [
  { id: "npc" as const, labelRu: "NPC", subRu: "За столом", Icon: UserCircle },
  { id: "loot" as const, labelRu: "Лут", subRu: "Сундуки", Icon: Package },
  { id: "prep" as const, labelRu: "Сессия", subRu: "Сцена и нить", Icon: ScrollText },
] as const;

type HomeProps = {
  onNavigate: (v: ZernixViewId) => void;
  onOpenLootCard: (lootCardId: string) => void;
  onOpenNoteKey: (key: string) => void;
};

function formatNoteTime(ts: number): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(ts));
}

function dmKindRu(kind: string): string {
  if (kind === "npc") return "NPC";
  if (kind === "loot") return "Лут";
  if (kind === "scene") return "Сцена";
  if (kind === "hook") return "Крючок";
  if (kind === "fav") return "Избранное";
  return "Запись";
}

export function HomeDashboard({ onNavigate, onOpenLootCard, onOpenNoteKey }: HomeProps) {
  const {
    recentNotes,
    favorites,
    dmSession,
    startNewDmSession,
    continueDmSession,
    clearDmSession,
    worldHints,
    patchWorldHints,
    clearWorldHints,
  } = useZernixUserData();
  const { runQuickPreset } = useZernixGenerators();
  const noteRows = recentNotes(6);
  const sessionNoteRows =
    dmSession.active && dmSession.startedAt > 0
      ? noteRows.filter((n) => n.updatedAt >= dmSession.startedAt).slice(0, 4)
      : [];
  const favPreview = favorites.slice(0, 6);

  async function handleQuickPreset(id: QuickPresetId) {
    const r = await runQuickPreset(id);
    if (r.kind === "npc") onNavigate("npc");
    else if (r.kind === "loot") onNavigate("loot");
    else if (r.kind === "scene" || r.kind === "hook") onNavigate("prep");
  }

  return (
    <>
      <section className="zernix-home-hero" aria-labelledby="zernix-hero-title">
        <p className="zernix-home-hero__eyebrow">AI co‑DM · D&amp;D 5.5</p>
        <h2 id="zernix-hero-title" className="zernix-home-hero__title">
          Быстро за столом
        </h2>
        <p className="zernix-home-hero__lead">NPC, лут, сессия — локально, без лишнего шума.</p>
        <div className="zernix-home-hero__row">
          <button type="button" className="zernix-home-hero__primary" onClick={() => onNavigate("table")}>
            Запустить Table Mode
          </button>
          <button
            type="button"
            className="zernix-home-hero__ghost"
            onClick={() => void (async () => {
              await runQuickPreset("npc_ally");
              onNavigate("npc");
            })()}
          >
            Быстрый NPC
          </button>
          <button
            type="button"
            className="zernix-home-hero__ghost"
            onClick={() => void (async () => {
              await runQuickPreset("scene_random");
              onNavigate("prep");
            })()}
          >
            Сцена за 1 клик
          </button>
        </div>
      </section>

      <section className="zernix-premium-panel zernix-panel-pad zernix-world-panel" aria-labelledby="zernix-world-label">
        <div className="zernix-panel-heading" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <span id="zernix-world-label">Состояние мира</span>
          <button type="button" className="zernix-btn-secondary zernix-btn-secondary--tight" onClick={clearWorldHints}>
            Очистить
          </button>
        </div>
        <div className="zernix-form-grid zernix-form-grid--2" style={{ marginTop: 10 }}>
          <label className="zernix-field">
            <span className="zernix-field-label">Локация</span>
            <input
              className="zernix-input"
              value={worldHints.currentLocation}
              onChange={(e) => patchWorldHints({ currentLocation: e.target.value })}
              placeholder="Железный порт…"
            />
          </label>
          <label className="zernix-field">
            <span className="zernix-field-label">Фракция</span>
            <input
              className="zernix-input"
              value={worldHints.activeFaction}
              onChange={(e) => patchWorldHints({ activeFaction: e.target.value })}
              placeholder="Серые клинки…"
            />
          </label>
          <label className="zernix-field">
            <span className="zernix-field-label">Угроза</span>
            <input
              className="zernix-input"
              value={worldHints.currentThreat}
              onChange={(e) => patchWorldHints({ currentThreat: e.target.value })}
              placeholder="Культ пепла…"
            />
          </label>
          <label className="zernix-field">
            <span className="zernix-field-label">Последний NPC</span>
            <input className="zernix-input" value={worldHints.lastNpcName} readOnly tabIndex={-1} />
          </label>
        </div>
      </section>

      <section aria-labelledby="zernix-quick-presets-label">
        <div id="zernix-quick-presets-label" className="zernix-list-title" style={{ margin: "0 0 10px" }}>
          Быстрый старт
        </div>
        <div className="zernix-home-presets">
          {QUICK_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="zernix-home-preset-chip"
              title={p.labelRu}
              onClick={() => void handleQuickPreset(p.id)}
            >
              {p.shortRu}
            </button>
          ))}
        </div>
      </section>

      <section className="zernix-home-trio" aria-label="Три главных действия">
        {TRIO.map(({ id, labelRu, subRu, Icon }) => (
          <div key={id} className="zernix-premium-panel zernix-home-trio__cell">
            <button type="button" className="zernix-home-trio__btn" onClick={() => onNavigate(id)}>
              <Icon className="zernix-home-trio__icon" strokeWidth={1.15} aria-hidden />
              <span className="zernix-home-trio__label">{labelRu}</span>
              <span className="zernix-home-trio__sub">{subRu}</span>
            </button>
          </div>
        ))}
      </section>

      <div className="zernix-dashboard-row">
        <div className="zernix-premium-panel zernix-panel-pad zernix-session-panel">
          <div className="zernix-panel-heading">Эта сессия</div>
          <p className="zernix-codex__prose zernix-session-panel__hint">
            Лента вечера: генерации и избранное. «Новая сессия» сбрасывает журнал.
          </p>
          <div className="zernix-session-btns">
            <button type="button" className="zernix-btn-primary" onClick={startNewDmSession}>
              Новая сессия
            </button>
            <button type="button" className="zernix-btn-secondary" onClick={continueDmSession}>
              Продолжить
            </button>
            <button type="button" className="zernix-btn-secondary" onClick={clearDmSession}>
              Очистить
            </button>
          </div>

          <div className="zernix-list-title" style={{ marginTop: 18 }}>
            Лента активности
          </div>
          {dmSession.timeline.length === 0 ? (
            <p className="zernix-codex__prose" style={{ margin: "8px 0 0", fontSize: 13 }}>
              {dmSession.active
                ? "Пока тихо — сгенерируйте NPC, лут или сцену (в том числе в режиме «За столом»)."
                : "Включите «Продолжить» или откройте «За столом» — сюда попадут генерации и избранное."}
            </p>
          ) : (
            dmSession.timeline.slice(0, 14).map((row) => (
              <button
                key={row.id}
                type="button"
                className="zernix-list-item zernix-list-item--rich"
                onClick={() => {
                  if (row.kind === "loot" && row.lootId) {
                    onOpenLootCard(row.lootId);
                    return;
                  }
                  if (row.kind === "npc") {
                    onNavigate("npc");
                    return;
                  }
                  if (row.kind === "scene" || row.kind === "hook") {
                    onNavigate("prep");
                    return;
                  }
                  if (row.kind === "fav") {
                    onNavigate("favorites");
                    return;
                  }
                  onOpenNoteKey("prep:dm");
                }}
              >
                <Sparkles className="zernix-list-icon" strokeWidth={1.2} aria-hidden />
                <div className="zernix-list-text">
                  <div>
                    <span className="zernix-session-chip">{dmKindRu(row.kind)}</span> {row.title}
                    {row.subtitle ? ` — ${row.subtitle}` : ""}
                  </div>
                  <div className="zernix-list-meta">{formatNoteTime(row.at)}</div>
                </div>
                <ChevronRight className="zernix-list-chevron" strokeWidth={1.25} aria-hidden />
              </button>
            ))
          )}

          {sessionNoteRows.length > 0 ? (
            <>
              <div className="zernix-list-title" style={{ marginTop: 16 }}>
                Заметки этой сессии
              </div>
              {sessionNoteRows.map((n) => (
                <button
                  key={n.key}
                  type="button"
                  className="zernix-list-item zernix-list-item--rich"
                  onClick={() => onOpenNoteKey(n.key)}
                >
                  <ScrollText className="zernix-list-icon" strokeWidth={1.2} aria-hidden />
                  <div className="zernix-list-text">
                    <div>
                      {n.titleLabel}
                      {n.preview ? ` — ${n.preview}` : ""}
                    </div>
                    <div className="zernix-list-meta">{formatNoteTime(n.updatedAt)}</div>
                  </div>
                  <ChevronRight className="zernix-list-chevron" strokeWidth={1.25} aria-hidden />
                </button>
              ))}
            </>
          ) : null}
        </div>

        <div className="zernix-stack">
          <div className="zernix-premium-panel zernix-panel-pad zernix-fade-in">
            <div className="zernix-list-title">Недавние заметки</div>
            {noteRows.length === 0 ? (
              <p className="zernix-codex__prose zernix-empty-hint">
                Заметки появятся сами — пишите в кодексе справа или в карточках NPC и подготовки.
              </p>
            ) : (
              noteRows.map((n) => (
                <button
                  key={n.key}
                  type="button"
                  className="zernix-list-item zernix-list-item--rich"
                  onClick={() => onOpenNoteKey(n.key)}
                >
                  <ScrollText className="zernix-list-icon" strokeWidth={1.2} aria-hidden />
                  <div className="zernix-list-text">
                    <div>
                      {n.titleLabel}
                      {n.preview ? ` — ${n.preview}` : ""}
                    </div>
                    <div className="zernix-list-meta">{formatNoteTime(n.updatedAt)}</div>
                  </div>
                  <ChevronRight className="zernix-list-chevron" strokeWidth={1.25} aria-hidden />
                </button>
              ))
            )}
          </div>

          <div className="zernix-premium-panel zernix-panel-pad zernix-fade-in">
            <div className="zernix-list-title">Избранное</div>
            {favPreview.length === 0 ? (
              <p className="zernix-codex__prose zernix-empty-hint">
                Отметьте сердечком лут, NPC или сводку — избранное окажется здесь сразу.
              </p>
            ) : (
              favPreview.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="zernix-list-item zernix-list-item--rich"
                  onClick={() => {
                    if (f.kind === "loot" && f.refKey.startsWith("loot:")) {
                      onOpenLootCard(f.refKey.slice(5));
                      return;
                    }
                    if (f.kind === "npc") {
                      onNavigate("npc");
                      return;
                    }
                    if (f.kind === "session") {
                      onNavigate("prep");
                      return;
                    }
                    onNavigate("favorites");
                  }}
                >
                  <Heart className="zernix-list-icon" strokeWidth={1.2} aria-hidden />
                  <div className="zernix-list-text">
                    <div>{f.title}</div>
                    <div className="zernix-list-meta">{f.subtitle ?? ""}</div>
                  </div>
                  <ChevronRight className="zernix-list-chevron" strokeWidth={1.25} aria-hidden />
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <section className="zernix-quick-grid zernix-quick-grid--solo" aria-label="Справочник">
        <div className="zernix-premium-panel zernix-quick-cell">
          <button type="button" className="zernix-quick-tile" onClick={() => onNavigate("conditions")}>
            <BookOpen className="zernix-quick-icon" strokeWidth={1.15} />
            <div className="zernix-quick-label">Состояния SRD</div>
          </button>
        </div>
      </section>
    </>
  );
}

export function LootGeneratorView() {
  const { data: content } = useAppContent();
  const { isFavorite, toggleLootFavorite, pushDmTimeline, showToast } = useZernixUserData();
  const {
    lootCards,
    lootBusy,
    lootError,
    selectedLootId,
    setSelectedLootId,
    lootForm,
    setLootForm,
    generateLoot,
    contentReady,
    lootMarkdown,
    lootNarrativeBlock,
  } = useZernixGenerators();

  const types = content?.loot.types ?? [];

  const primaryLoot = lootCards.find((c) => c.id === selectedLootId) ?? lootCards[0] ?? null;

  async function copyLoot(kind: "md" | "compact" | "discord") {
    const text =
      kind === "md"
        ? formatLootMarkdown(lootMarkdown, lootNarrativeBlock)
        : kind === "compact"
          ? formatLootCompact(primaryLoot, lootMarkdown)
          : formatLootDiscord(lootMarkdown, lootNarrativeBlock);
    const ok = await writeClipboard(text);
    if (ok) showToast("Скопировано");
  }

  function toggleLootType(id: string) {
    const prev = lootForm.selectedTypeIds;
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    setLootForm({ selectedTypeIds: next });
  }

  return (
    <div className="zernix-page">
      <div className="zernix-form-grid">
        <label className="zernix-field">
          <span className="zernix-field-label">Уровень группы</span>
          <select
            className="zernix-input zernix-select"
            value={lootForm.partyLevel}
            onChange={(e) => setLootForm({ partyLevel: Number(e.target.value) })}
          >
            {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="zernix-field">
          <span className="zernix-field-label">Игроки</span>
          <select
            className="zernix-input zernix-select"
            value={lootForm.playerCount}
            onChange={(e) => setLootForm({ playerCount: Number(e.target.value) })}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="zernix-field">
          <span className="zernix-field-label">Сложность</span>
          <select
            className="zernix-input zernix-select"
            value={lootForm.difficultyUi}
            onChange={(e) =>
              setLootForm({ difficultyUi: e.target.value as typeof lootForm.difficultyUi })
            }
          >
            <option value="low">Низкая</option>
            <option value="medium">Средняя</option>
            <option value="high">Высокая</option>
          </select>
        </label>
        <label className="zernix-field">
          <span className="zernix-field-label">Локация</span>
          <select
            className="zernix-input zernix-select"
            value={lootForm.environmentUi}
            onChange={(e) =>
              setLootForm({ environmentUi: e.target.value as typeof lootForm.environmentUi })
            }
          >
            <option value="ruins">Древние руины</option>
            <option value="dungeon">Подземелье</option>
            <option value="city">Город</option>
            <option value="wild">Дикие земли</option>
          </select>
        </label>
        <label className="zernix-field">
          <span className="zernix-field-label">Золото (зм)</span>
          <input
            type="number"
            min={1}
            className="zernix-input"
            value={lootForm.goldGp}
            onChange={(e) => setLootForm({ goldGp: Number(e.target.value) })}
          />
        </label>
        <label className="zernix-field">
          <span className="zernix-field-label">Сундуки</span>
          <input
            type="number"
            min={0}
            max={24}
            className="zernix-input"
            value={lootForm.chestCount}
            onChange={(e) => setLootForm({ chestCount: Number(e.target.value) })}
          />
        </label>
        <label className="zernix-field zernix-field--checkboxes">
          <span className="zernix-field-label">Только магические предметы</span>
          <div className="zernix-toggle-row">
            <label className="zernix-check">
              <input
                type="checkbox"
                className="zernix-checkbox"
                checked={lootForm.magicOnly}
                onChange={(e) => setLootForm({ magicOnly: e.target.checked })}
              />
              <span>Да</span>
            </label>
          </div>
        </label>
        <label className="zernix-field zernix-field--checkboxes">
          <span className="zernix-field-label">Категории добычи</span>
          <div className="zernix-toggle-row" style={{ flexWrap: "wrap", gap: 8 }}>
            {types.map((t) => (
              <label key={t.id} className="zernix-check">
                <input
                  type="checkbox"
                  className="zernix-checkbox"
                  checked={lootForm.selectedTypeIds.includes(t.id)}
                  onChange={() => toggleLootType(t.id)}
                  disabled={!contentReady}
                />
                <span>{t.labelRu}</span>
              </label>
            ))}
          </div>
        </label>
      </div>

      {lootError ? (
        <p className="zernix-codex__prose" style={{ color: "#fca5a5", marginTop: 12 }}>
          {lootError}
        </p>
      ) : null}

      <button
        type="button"
        className="zernix-btn-primary zernix-btn-primary--block zernix-mt-lg"
        disabled={lootBusy || !contentReady}
        aria-busy={lootBusy}
        onClick={async () => {
          const card = await generateLoot();
          if (card) {
            pushDmTimeline({
              kind: "loot",
              title: card.title,
              subtitle: `${card.rarityLabel} · ${card.kindLabel}`,
              lootId: card.id,
            });
          }
        }}
      >
        {lootBusy ? "Собираем добычу…" : "Сгенерировать добычу"}
      </button>

      <div className="zernix-section-head">
        <span>Сгенерированная добыча</span>
        <div className="zernix-copy-row zernix-copy-row--inline">
          <button type="button" className="zernix-copy-pill" disabled={lootBusy} onClick={() => void copyLoot("md")}>
            Markdown
          </button>
          <button type="button" className="zernix-copy-pill" disabled={lootBusy} onClick={() => void copyLoot("compact")}>
            Кратко
          </button>
          <button type="button" className="zernix-copy-pill" disabled={lootBusy} onClick={() => void copyLoot("discord")}>
            Discord
          </button>
        </div>
        <div className="zernix-gold-rule" />
      </div>

      <div className={`zernix-loot-results-shell${lootBusy ? " is-busy" : ""}`}>
        <div
          className={`zernix-loot-grid${lootBusy && lootCards.length > 0 ? " is-veiled" : ""}${
            !lootBusy && lootCards.length > 0 ? " zernix-content-fade" : ""
          }`}
        >
          {lootBusy && lootCards.length === 0 ? (
            <div className="zernix-loot-skel-slot">
              <ZernixLootResultsSkeleton />
            </div>
          ) : null}
          {!lootBusy && lootCards.length === 0 ? (
            <div className="zernix-premium-panel zernix-panel-pad zernix-empty-panel">
              <p className="zernix-empty-hint">
                Сгенерируйте лут под уровень и локацию — карточки появятся здесь и в кодексе справа.
              </p>
            </div>
          ) : null}
          {lootCards.length > 0
            ? lootCards.map((card) => (
                <LootCard
                  key={card.id}
                  card={card}
                  selected={selectedLootId === card.id}
                  onSelect={() => setSelectedLootId(card.id)}
                  favorited={isFavorite("loot", `loot:${card.id}`)}
                  onToggleFavorite={() => toggleLootFavorite(card)}
                />
              ))
            : null}
        </div>
        {lootBusy && lootCards.length > 0 ? (
          <div className="zernix-loot-busy-veil" aria-live="polite">
            <span className="zernix-loot-busy-caption">Обновляем добычу…</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const NPC_TABLE_ROLES = [
  { value: "ally", label: "Союзник" },
  { value: "villain", label: "Враг" },
  { value: "rival", label: "Нейтрал" },
] as const;

export function NpcCreatorView() {
  const { data: content } = useAppContent();
  const {
    npc,
    setNpc,
    npcForm,
    setNpcForm,
    npcBusy,
    npcError,
    generateNpc,
    rerollNpcNarrativeField,
    lastResolvedNpcCard,
  } = useZernixGenerators();
  const { getNoteBody, setNoteBody, isFavorite, toggleNpcFavorite, pushDmTimeline, showToast } = useZernixUserData();
  const noteGlow = useIdleGlow();
  const [favPulse, setFavPulse] = useState(false);

  const patch = (partial: Partial<NpcPreviewState>) =>
    setNpc(sanitizeNpcPreviewState({ ...npc, ...partial }));
  const npcNoteKey = "npc:current";
  const npcBlock = content?.npc;
  const favKey = npcFavoriteRefKey(npc);
  const favorited = isFavorite("npc", favKey);
  const canRerollNarrative = Boolean(lastResolvedNpcCard);

  async function copyNpc(kind: "md" | "compact" | "discord") {
    const text =
      kind === "md" ? formatNpcMarkdown(npc) : kind === "compact" ? formatNpcCompact(npc) : formatNpcDiscord(npc);
    const ok = await writeClipboard(text);
    if (ok) showToast("Скопировано");
  }

  function NarrativeRerollLabel({
    htmlFor,
    label,
    slot,
  }: {
    htmlFor: string;
    label: string;
    slot: NarrativeRerollSlot;
  }) {
    return (
      <div className="zernix-field-label-row">
        <label className="zernix-field-label" htmlFor={htmlFor}>
          {label}
        </label>
        <button
          type="button"
          className="zernix-reroll-btn"
          disabled={!canRerollNarrative || npcBusy}
          aria-label={`Перегенерировать: ${label}`}
          onClick={() => rerollNpcNarrativeField(slot)}
        >
          ↻
        </button>
      </div>
    );
  }

  useEffect(() => {
    const ok = new Set(["ally", "villain", "rival"]);
    if (!ok.has(npcForm.role)) setNpcForm({ role: "ally" });
  }, [npcForm.role, setNpcForm]);

  return (
    <div className="zernix-page">
      <div className="zernix-npc-form">
        <div className="zernix-premium-panel zernix-panel-pad">
          <div className="zernix-panel-heading">NPC за столом</div>
          <p className="zernix-codex__prose" style={{ marginTop: 0, fontSize: 12, opacity: 0.88 }}>
            Один клик — занятие и пол подбираются автоматически. Можно сменить только расу и отношение к партии.
          </p>
          <div className="zernix-form-grid zernix-form-grid--2">
            <label className="zernix-field">
              <span className="zernix-field-label">Раса</span>
              <select
                className="zernix-input zernix-select"
                value={npcForm.race}
                onChange={(e) => setNpcForm({ race: e.target.value })}
                disabled={!npcBlock}
              >
                {(npcBlock?.races ?? []).map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.labelRu}
                  </option>
                ))}
              </select>
            </label>
            <label className="zernix-field">
              <span className="zernix-field-label">К партии</span>
              <select
                className="zernix-input zernix-select"
                value={npcForm.role}
                onChange={(e) => setNpcForm({ role: e.target.value })}
                disabled={!npcBlock}
              >
                {NPC_TABLE_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {npcError ? (
            <p className="zernix-codex__prose" style={{ color: "#fca5a5", marginTop: 12 }}>
              {npcError}
            </p>
          ) : null}
          <button
            type="button"
            className="zernix-btn-primary zernix-btn-primary--block zernix-mt-lg"
            disabled={npcBusy || !npcBlock}
            onClick={async () => {
              const n = await generateNpc();
              if (n) {
                pushDmTimeline({
                  kind: "npc",
                  title: n.name.trim() || "NPC",
                  subtitle: npcJoinSegments([n.race, n.creatureClass]) || undefined,
                });
              }
            }}
          >
            {npcBusy ? "Собираем образ…" : "Сгенерировать NPC"}
          </button>
        </div>

        <div className="zernix-premium-panel zernix-panel-pad zernix-npc-card-shell">
          <div className="zernix-panel-heading" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ flex: 1 }}>Карточка</span>
            <div className="zernix-copy-row zernix-copy-row--inline">
              <button type="button" className="zernix-copy-pill" disabled={npcBusy} onClick={() => void copyNpc("md")}>
                Markdown
              </button>
              <button type="button" className="zernix-copy-pill" disabled={npcBusy} onClick={() => void copyNpc("compact")}>
                Кратко
              </button>
              <button type="button" className="zernix-copy-pill" disabled={npcBusy} onClick={() => void copyNpc("discord")}>
                Discord
              </button>
            </div>
            <button
              type="button"
              className={`zernix-loot-card__fav ${favorited ? "is-on" : ""} ${favPulse ? "is-tick" : ""}`}
              style={{ width: 44, height: 44 }}
              aria-label={favorited ? "Убрать из избранного" : "В избранное"}
              aria-pressed={favorited}
              onClick={() => {
                toggleNpcFavorite(npc);
                setFavPulse(true);
                window.setTimeout(() => setFavPulse(false), 420);
              }}
            >
              <Heart size={18} strokeWidth={1.35} fill={favorited ? "currentColor" : "none"} aria-hidden />
            </button>
          </div>

          <div className="zernix-form-grid zernix-form-grid--2" style={{ marginTop: 8 }}>
            <label className="zernix-field">
              <span className="zernix-field-label">Имя и эпитет</span>
              <input className="zernix-input" value={npc.name ?? ""} onChange={(e) => patch({ name: e.target.value })} />
            </label>
            <label className="zernix-field">
              <span className="zernix-field-label">Буква на жетоне</span>
              <input
                className="zernix-input"
                maxLength={2}
                value={npc.portraitLetter ?? ""}
                onChange={(e) => patch({ portraitLetter: e.target.value.slice(0, 2).toUpperCase() })}
              />
            </label>
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="zernix-field-label">Роль (одна строка)</div>
            <p className="zernix-codex__prose" style={{ margin: "6px 0 0", fontSize: 14 }}>
              {npc.creatureClass}
            </p>
          </div>

          <div className="zernix-gold-rule" style={{ margin: "18px 0" }} />

          <div className="zernix-field">
            <NarrativeRerollLabel htmlFor="npc-visual" label="Внешний признак" slot="visual" />
            <textarea
              id="npc-visual"
              className="zernix-input zernix-textarea"
              rows={2}
              value={npc.visualTrait ?? ""}
              onChange={(e) => patch({ visualTrait: e.target.value })}
            />
          </div>
          <div className="zernix-field">
            <NarrativeRerollLabel htmlFor="npc-want" label="Чего хочет" slot="want" />
            <textarea
              id="npc-want"
              className="zernix-input zernix-textarea"
              rows={2}
              value={npc.wantLine ?? ""}
              onChange={(e) => patch({ wantLine: e.target.value })}
            />
          </div>
          <div className="zernix-field">
            <NarrativeRerollLabel htmlFor="npc-avoid" label="Чего не хочет" slot="avoid" />
            <textarea
              id="npc-avoid"
              className="zernix-input zernix-textarea"
              rows={2}
              value={npc.avoidLine ?? ""}
              onChange={(e) => patch({ avoidLine: e.target.value })}
            />
          </div>
          <div className="zernix-field">
            <NarrativeRerollLabel htmlFor="npc-secret" label="Секрет" slot="secret" />
            <textarea
              id="npc-secret"
              className="zernix-input zernix-textarea"
              rows={2}
              value={npc.secretLine ?? ""}
              onChange={(e) => patch({ secretLine: e.target.value })}
            />
          </div>

          <div className="zernix-gold-rule" style={{ margin: "18px 0" }} />

          <label className={`zernix-field ${noteGlow.glow ? "is-save-glow" : ""}`}>
            <span className="zernix-field-label">Заметки мастера</span>
            <textarea
              className="zernix-input zernix-textarea"
              rows={4}
              value={getNoteBody(npcNoteKey)}
              onChange={(e) => {
                setNoteBody(npcNoteKey, e.target.value);
                noteGlow.bump();
              }}
              placeholder="Голос, сцена, напоминание — сразу на карточке, без модалок."
            />
          </label>
          <button
            type="button"
            className="zernix-btn-primary zernix-mt-lg zernix-btn-press"
            onClick={() => {
              console.debug("[ZERNIX] save npc notes", npcNoteKey);
              showToast("Saved!");
              noteGlow.bump();
            }}
          >
            Сохранить заметки мастера
          </button>

          {npcBusy ? (
            <div className="zernix-busy-veil" aria-busy>
              <ZernixNpcCardSkeleton />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function SessionPrepView() {
  const {
    prepSummary,
    setPrepSummary,
    sessionForm,
    setSessionForm,
    sessionBusy,
    sessionError,
    generateSession,
    sessionBrief,
    sessionPreview,
    sessionMarkdown,
  } = useZernixGenerators();
  const { getNoteBody, setNoteBody, toggleSessionFavorite, isFavorite, pushDmTimeline, showToast } = useZernixUserData();
  const prepNoteGlow = useIdleGlow();
  const [sessionFavPulse, setSessionFavPulse] = useState(false);
  const prepDmKey = "prep:dm";
  const sessionTitle = sessionPreview?.title?.trim() || sessionBrief?.title?.trim() || "Сессия";
  const sessionRef = `session:${sessionTitle}`;
  const sessionExcerpt =
    sessionPreview?.excerpt?.trim() ||
    sessionBrief?.encounterPitch?.trim() ||
    sessionBrief?.hook?.trim() ||
    "";

  const tablePresentation = useMemo(
    () =>
      sessionBrief ? presentSessionAtTable(sessionBrief) : presentSessionFromLogMarkdown(prepSummary || sessionMarkdown || ""),
    [sessionBrief, prepSummary, sessionMarkdown],
  );

  async function copySession(kind: "md" | "compact" | "discord") {
    const text =
      kind === "md"
        ? formatSessionMarkdown(sessionTitle, sessionExcerpt, prepSummary, tablePresentation)
        : kind === "compact"
          ? formatSessionCompact(sessionTitle, sessionExcerpt, prepSummary, tablePresentation)
          : formatSessionDiscord(sessionTitle, sessionExcerpt, prepSummary, tablePresentation);
    const ok = await writeClipboard(text);
    if (ok) showToast("Скопировано");
  }

  return (
    <div className="zernix-page">
      <div className="zernix-prep-grid">
        <div className="zernix-premium-panel zernix-panel-pad">
          <div className="zernix-panel-heading">Партия</div>
          <label className="zernix-field">
            <span className="zernix-field-label">Уровень группы</span>
            <select
              className="zernix-input zernix-select"
              value={sessionForm.partyLevel}
              onChange={(e) => setSessionForm({ partyLevel: Number(e.target.value) })}
            >
              {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="zernix-field">
            <span className="zernix-field-label">Игроки</span>
            <select
              className="zernix-input zernix-select"
              value={sessionForm.playerCount}
              onChange={(e) => setSessionForm({ playerCount: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="zernix-field">
            <span className="zernix-field-label">Сложность</span>
            <select
              className="zernix-input zernix-select"
              value={sessionForm.difficulty}
              onChange={(e) => setSessionForm({ difficulty: e.target.value })}
            >
              <option value="low">Низкая</option>
              <option value="moderate">Средняя</option>
              <option value="high">Высокая</option>
            </select>
          </label>
        </div>

        <div className="zernix-premium-panel zernix-panel-pad">
          <div className="zernix-panel-heading">Оптовый лут</div>
          <label className="zernix-field">
            <span className="zernix-field-label">Группы монстров</span>
            <input
              type="number"
              min={0}
              max={48}
              className="zernix-input"
              value={sessionForm.packCount}
              onChange={(e) => setSessionForm({ packCount: Number(e.target.value) })}
            />
          </label>
          <label className="zernix-field">
            <span className="zernix-field-label">Сундуки</span>
            <input
              type="number"
              min={0}
              max={48}
              className="zernix-input"
              value={sessionForm.chestCount}
              onChange={(e) => setSessionForm({ chestCount: Number(e.target.value) })}
            />
          </label>
          <label className="zernix-field zernix-field--checkboxes">
            <span className="zernix-field-label">Только магия</span>
            <div className="zernix-toggle-row">
              <label className="zernix-check">
                <input
                  type="checkbox"
                  className="zernix-checkbox"
                  checked={sessionForm.onlyMagic}
                  onChange={(e) => setSessionForm({ onlyMagic: e.target.checked })}
                />
                <span>Да</span>
              </label>
            </div>
          </label>
        </div>

        <div className="zernix-premium-panel zernix-panel-pad">
          <div className="zernix-panel-heading">Окружение</div>
          <label className="zernix-field">
            <span className="zernix-field-label">Тип локации</span>
            <select
              className="zernix-input zernix-select"
              value={sessionForm.environmentKey}
              onChange={(e) => setSessionForm({ environmentKey: e.target.value })}
            >
              <option value="any">Любое</option>
              <option value="dungeon">Подземелье</option>
              <option value="forest">Лес</option>
              <option value="cave">Пещера</option>
              <option value="urban">Город</option>
            </select>
          </label>
          <label className="zernix-field">
            <span className="zernix-field-label">Дополнительные детали (необязательно)</span>
            <textarea
              className="zernix-input zernix-textarea"
              rows={5}
              value={sessionForm.environmentText}
              onChange={(e) => setSessionForm({ environmentText: e.target.value })}
              placeholder="Например: культ под городом, дворцовый заговор, охота на ведьму…"
            />
            <p
              className="zernix-codex__prose"
              style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.45, color: "rgba(245, 230, 184, 0.48)" }}
            >
              Можно оставить пустым — сцена сгенерируется автоматически.
            </p>
          </label>
        </div>

        <div className="zernix-premium-panel zernix-panel-pad zernix-prep-summary-shell">
          <div className="zernix-panel-heading" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1, minWidth: 120 }}>Сводка сессии</span>
            <div className="zernix-copy-row zernix-copy-row--inline">
              <button type="button" className="zernix-copy-pill" disabled={sessionBusy} onClick={() => void copySession("md")}>
                Markdown
              </button>
              <button type="button" className="zernix-copy-pill" disabled={sessionBusy} onClick={() => void copySession("compact")}>
                Кратко
              </button>
              <button type="button" className="zernix-copy-pill" disabled={sessionBusy} onClick={() => void copySession("discord")}>
                Discord
              </button>
            </div>
          </div>
          <div className="zernix-prep-summary-body">
            {tablePresentation ? (
              <>
                <div className="zernix-scene-card-wrap zernix-content-fade">
                  <SessionSceneAtTableCard presentation={tablePresentation} />
                </div>
                <details className="zernix-prep-raw-details" style={{ marginTop: 16 }}>
                  <summary className="zernix-prep-raw-summary">Полный текст генератора (редактируемый)</summary>
                  <label className="zernix-field" style={{ marginTop: 10 }}>
                    <textarea
                      className="zernix-input zernix-textarea"
                      rows={8}
                      value={prepSummary}
                      onChange={(e) => setPrepSummary(e.target.value)}
                    />
                  </label>
                </details>
              </>
            ) : (
              <label className="zernix-field">
                <span className="zernix-field-label">Текст (редактируется после генерации)</span>
                <textarea
                  className="zernix-input zernix-textarea"
                  rows={8}
                  value={prepSummary}
                  onChange={(e) => setPrepSummary(e.target.value)}
                />
              </label>
            )}
            {sessionError ? (
              <p className="zernix-codex__prose" style={{ color: "#fca5a5", marginTop: 8 }}>
                {sessionError}
              </p>
            ) : null}
            <button
              type="button"
              className="zernix-btn-primary zernix-btn-primary--block zernix-mt-lg"
              disabled={sessionBusy}
              aria-busy={sessionBusy}
              onClick={async () => {
                const meta = await generateSession();
                if (meta) {
                  pushDmTimeline({
                    kind: "scene",
                    title: meta.title,
                    subtitle: meta.excerpt || undefined,
                  });
                }
              }}
            >
              {sessionBusy ? "Собираем сводку…" : "Сгенерировать подготовку"}
            </button>
            <button
              type="button"
              className={`zernix-btn-secondary zernix-btn-secondary--block zernix-mt-lg${sessionFavPulse ? " is-tick" : ""}`}
              onClick={() => {
                toggleSessionFavorite(sessionTitle, sessionPreview?.excerpt);
                setSessionFavPulse(true);
                window.setTimeout(() => setSessionFavPulse(false), 420);
              }}
            >
              {isFavorite("session", sessionRef) ? "Убрать сводку из избранного" : "Закрепить сводку в избранном"}
            </button>
            {sessionBusy ? (
              <div className="zernix-busy-veil" aria-busy>
                <ZernixSessionSummarySkeleton />
              </div>
            ) : null}
          </div>
        </div>

        <div className="zernix-premium-panel zernix-panel-pad" style={{ gridColumn: "1 / -1" }}>
          <div className="zernix-panel-heading">Локальные заметки (подготовка)</div>
          <p className="zernix-codex__prose zernix-session-panel__hint">
            Отдельно от текста генератора — сохраняются на устройстве.
          </p>
          <label className={`zernix-field ${prepNoteGlow.glow ? "is-save-glow" : ""}`}>
            <span className="zernix-field-label">Заметки мастера</span>
            <textarea
              className="zernix-input zernix-textarea"
              rows={6}
              value={getNoteBody(prepDmKey)}
              onChange={(e) => {
                setNoteBody(prepDmKey, e.target.value);
                prepNoteGlow.bump();
              }}
              placeholder="Тайминги, проверки, напоминания…"
            />
          </label>
          <button
            type="button"
            className="zernix-btn-primary zernix-mt-lg zernix-btn-press"
            onClick={() => {
              console.debug("[ZERNIX] save prep:dm notes");
              showToast("Saved!");
              prepNoteGlow.bump();
            }}
          >
            Сохранить заметки подготовки
          </button>
        </div>
      </div>
    </div>
  );
}

type ConditionsProps = {
  conditionKey: string;
  onPickCondition: (k: string) => void;
};

const CONDITIONS = [
  { key: "frightened", title: "Испуг", Icon: Skull },
  { key: "restrained", title: "Схвачен", Icon: Shield },
  { key: "charm", title: "Очарован", Icon: Sparkles },
] as const;

export function ConditionsEncyclopediaView({ conditionKey, onPickCondition }: ConditionsProps) {
  return (
    <div className="zernix-page">
      <div className="zernix-conditions-list">
        {CONDITIONS.map(({ key, title, Icon }) => (
          <button
            key={key}
            type="button"
            className={`zernix-condition-row ${conditionKey === key ? "is-active" : ""}`}
            onClick={() => onPickCondition(key)}
          >
            <Icon className="zernix-condition-icon" strokeWidth={1.2} aria-hidden />
            <div>
              <div className="zernix-condition-title">{title}</div>
              <div className="zernix-condition-hint">Нажмите, чтобы открыть в кодексе</div>
            </div>
            <Wind className="zernix-list-chevron" strokeWidth={1.15} aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}

export function HistoryView({ onOpenNoteKey }: { onOpenNoteKey: (key: string) => void }) {
  const { recentNotes } = useZernixUserData();
  const rows = recentNotes(32);

  return (
    <div className="zernix-page">
      <div className="zernix-premium-panel zernix-panel-pad">
        <div className="zernix-panel-heading">Журнал заметок</div>
        {rows.length === 0 ? (
          <p className="zernix-codex__prose zernix-empty-hint" style={{ margin: 0 }}>
            Пока тихо — как только сохраните заметку в кодексе или в форме NPC/подготовки, она появится в журнале.
          </p>
        ) : (
          <div className="zernix-timeline">
            {rows.map((n) => (
              <button
                key={n.key}
                type="button"
                className="zernix-timeline__item zernix-timeline__item--btn"
                onClick={() => onOpenNoteKey(n.key)}
              >
                <span className="zernix-timeline__dot" />
                <div style={{ textAlign: "left" }}>
                  <div className="zernix-timeline__title">
                    {n.titleLabel}
                    {n.preview ? ` — ${n.preview}` : ""}
                  </div>
                  <div className="zernix-timeline__meta">{formatNoteTime(n.updatedAt)}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function FavoritesView({
  onNavigate,
  onOpenLootCard,
}: {
  onNavigate: (v: ZernixViewId) => void;
  onOpenLootCard: (lootCardId: string) => void;
}) {
  const { favorites, removeFavorite } = useZernixUserData();

  return (
    <div className="zernix-page">
      <div className="zernix-premium-panel zernix-panel-pad">
        <div className="zernix-panel-heading">Список</div>
        {favorites.length === 0 ? (
          <p className="zernix-codex__prose zernix-empty-hint" style={{ margin: 0 }}>
            Здесь окажется то, что вы отметите сердечком во время игры — лут, NPC или сводка сессии.
          </p>
        ) : (
          <div className="zernix-fav-grid">
            {favorites.map((f) => (
              <div key={f.id} className="zernix-fav-row">
                <button
                  type="button"
                  className="zernix-fav-chip zernix-fav-chip--grow"
                  onClick={() => {
                    if (f.kind === "loot" && f.refKey.startsWith("loot:")) {
                      onOpenLootCard(f.refKey.slice(5));
                      return;
                    }
                    if (f.kind === "npc") {
                      onNavigate("npc");
                      return;
                    }
                    if (f.kind === "session") {
                      onNavigate("prep");
                      return;
                    }
                    onNavigate("home");
                  }}
                >
                  <UserCircle className="zernix-fav-chip__icon" strokeWidth={1.15} aria-hidden />
                  <span className="zernix-fav-chip__text">
                    <span className="zernix-fav-chip__title">{f.title}</span>
                    {f.subtitle ? <span className="zernix-fav-chip__sub">{f.subtitle}</span> : null}
                  </span>
                </button>
                <button
                  type="button"
                  className="zernix-fav-remove"
                  aria-label="Удалить из избранного"
                  onClick={() => removeFavorite(f.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsView() {
  const { settings, patchSettings, profile, patchProfile, showToast } = useZernixUserData();

  return (
    <div className="zernix-page">
      <div className="zernix-premium-panel zernix-panel-pad">
        <div className="zernix-panel-heading">Интерфейс</div>
        <label className="zernix-field">
          <span className="zernix-field-label">Плотность списков</span>
          <select
            className="zernix-input zernix-select"
            value={settings.listDensity}
            onChange={(e) => patchSettings({ listDensity: e.target.value as "comfortable" | "compact" })}
          >
            <option value="comfortable">Комфортная</option>
            <option value="compact">Компактная</option>
          </select>
        </label>
        <label className="zernix-field">
          <span className="zernix-field-label">Язык справочников</span>
          <select
            className="zernix-input zernix-select"
            value={settings.catalogLang}
            onChange={(e) => patchSettings({ catalogLang: e.target.value as "ru" | "en" })}
          >
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>

      <div className="zernix-premium-panel zernix-panel-pad" style={{ marginTop: 22 }}>
        <div className="zernix-panel-heading">Режим отображения (MVP)</div>
        <div className="zernix-quick-settings" style={{ marginTop: 10 }}>
          <label className="zernix-toggle-row-mvp">
            <div>
              <div className="zernix-toggle-row-mvp__label">Тёмная тема</div>
              <div className="zernix-toggle-row-mvp__hint">Глубже фон — удобно для демонстрации.</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.darkMode}
              className={`zernix-switch ${settings.darkMode ? "is-on" : ""} zernix-btn-press`}
              onClick={() => {
                patchSettings({ darkMode: !settings.darkMode });
                console.debug("[ZERNIX] settings dark", !settings.darkMode);
                showToast("Настройки сохранены");
              }}
            >
              <span className="zernix-switch__knob" />
            </button>
          </label>
          <label className="zernix-toggle-row-mvp">
            <div>
              <div className="zernix-toggle-row-mvp__label">Автосохранение</div>
              <div className="zernix-toggle-row-mvp__hint">Флажок для зачёта; заметки всё равно пишутся в bundle.</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoSaveNotes}
              className={`zernix-switch ${settings.autoSaveNotes ? "is-on" : ""} zernix-btn-press`}
              onClick={() => {
                patchSettings({ autoSaveNotes: !settings.autoSaveNotes });
                showToast("Настройки сохранены");
              }}
            >
              <span className="zernix-switch__knob" />
            </button>
          </label>
          <label className="zernix-toggle-row-mvp">
            <div>
              <div className="zernix-toggle-row-mvp__label">Компактный режим</div>
              <div className="zernix-toggle-row-mvp__hint">Синхронизирован с «Компактная» плотность выше.</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.listDensity === "compact"}
              className={`zernix-switch ${settings.listDensity === "compact" ? "is-on" : ""} zernix-btn-press`}
              onClick={() => {
                patchSettings({ listDensity: settings.listDensity === "compact" ? "comfortable" : "compact" });
                showToast("Настройки сохранены");
              }}
            >
              <span className="zernix-switch__knob" />
            </button>
          </label>
        </div>
      </div>

      <div className="zernix-premium-panel zernix-panel-pad" style={{ marginTop: 22 }}>
        <div className="zernix-panel-heading">Профиль</div>
        <label className="zernix-field">
          <span className="zernix-field-label">Имя на столе</span>
          <input
            className="zernix-input"
            value={profile.displayName}
            onChange={(e) => patchProfile({ displayName: e.target.value })}
            autoComplete="nickname"
          />
        </label>
        <label className="zernix-field">
          <span className="zernix-field-label">Подпись (учебный профиль)</span>
          <input
            className="zernix-input"
            value={profile.affiliation ?? ""}
            onChange={(e) => patchProfile({ affiliation: e.target.value })}
            placeholder="Student · Hexlet College"
          />
        </label>
        <label className="zernix-field">
          <span className="zernix-field-label">Аватар (файл)</span>
          <input
            className="zernix-input"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const url = String(reader.result ?? "");
                if (url.length > 400_000) {
                  window.alert("Файл слишком большой для локального сохранения.");
                  return;
                }
                patchProfile({ avatarDataUrl: url });
              };
              reader.readAsDataURL(file);
              e.target.value = "";
            }}
          />
        </label>
        {profile.avatarDataUrl ? (
          <button
            type="button"
            className="zernix-btn-secondary zernix-mt-lg"
            onClick={() => patchProfile({ avatarDataUrl: "" })}
          >
            Убрать аватар
          </button>
        ) : null}
      </div>
    </div>
  );
}
