import {
  BookOpen,
  ChevronRight,
  Heart,
  Package,
  PlayCircle,
  Plus,
  ScrollText,
  Sparkles,
  UserCircle,
} from "lucide-react";

import { useZernixUserData } from "../../../context/ZernixUserDataContext";
import type { ZernixViewId } from "../../types";
import { useZernixGenerators } from "../../ZernixGeneratorsContext";
import { QUICK_PRESETS, type QuickPresetId } from "../../quickPresets";
import { formatNoteTime } from "../../lib/formatNoteTime";

type HomeProps = {
  onNavigate: (v: ZernixViewId) => void;
  onOpenLootCard: (lootCardId: string) => void;
  onOpenNoteKey: (key: string) => void;
};

export function HomeDashboard({ onNavigate, onOpenLootCard, onOpenNoteKey }: HomeProps) {
  const {
    recentNotes,
    favorites,
    startNewDmSession,
  } = useZernixUserData();
  const { runQuickPreset, sessionForm, sessionPreview } = useZernixGenerators();
  const noteRows = recentNotes(6);
  const favPreview = favorites.slice(0, 6);

  async function handleQuickPreset(id: QuickPresetId) {
    const r = await runQuickPreset(id);
    if (r.kind === "npc") onNavigate("npc");
    else if (r.kind === "loot") onNavigate("loot");
    else if (r.kind === "scene" || r.kind === "hook") onNavigate("prep");
  }

  const QS_CARDS = [
    { id: "loot" as const, Icon: Package, title: "Генератор лута", sub: "Сокровища, предметы и магические награды" },
    { id: "npc" as const, Icon: UserCircle, title: "Создать NPC", sub: "Персонажи, монстры и торговцы" },
    { id: "prep" as const, Icon: ScrollText, title: "Подготовка сессии", sub: "Отряды, локации, планы и заметки" },
    { id: "conditions" as const, Icon: BookOpen, title: "Справочник состояний", sub: "Состояния, эффекты и условия" },
  ] as const;

  return (
    <div className="zx-home">
      {/* ╔═══════════════════════════════════════════════════════════════╗
          ║  HERO — cinematic visual anchor                              ║
          ╚═══════════════════════════════════════════════════════════════╝ */}
      <section className="zx-hero" aria-labelledby="zx-hero-title">
        <div className="zx-hero__bg" aria-hidden />
        <div className="zx-hero__vignette" aria-hidden />
        <div className="zx-hero__embers" aria-hidden />

        <div className="zx-hero__content">
          <div className="zx-hero__eyebrow">
            <span className="zx-hero__eyebrow-dot" aria-hidden />
            <span>AI CO‑DM · D&amp;D 5.5</span>
          </div>

          <h1 id="zx-hero-title" className="zx-hero__title">
            Готовы к новой <span className="zx-hero__title-accent">легенде?</span>
          </h1>
          <p className="zx-hero__lead">
            Полная мастерская: NPC, лут, сцены и журнал — в одном тёмном кабинете.
          </p>

          <div className="zx-hero__divider" aria-hidden>
            <span className="zx-hero__divider-rune" />
          </div>

          <div className="zx-hero__cta">
            <button type="button" className="zx-cta zx-cta--gold" onClick={() => onNavigate("table")}>
              <PlayCircle width={18} height={18} strokeWidth={1.4} aria-hidden />
              <span>Открыть режим «За столом»</span>
            </button>
            <button
              type="button"
              className="zx-cta zx-cta--ghost"
              onClick={() => {
                startNewDmSession({
                  title: sessionPreview?.title?.trim() || "Новая сессия",
                  partyLevel: sessionForm.partyLevel,
                  playerCount: sessionForm.playerCount,
                  difficulty: sessionForm.difficulty,
                  environmentKey: sessionForm.environmentKey,
                });
                onNavigate("prep");
              }}
            >
              <Plus width={18} height={18} strokeWidth={1.4} aria-hidden />
              <span>Новая сессия</span>
            </button>
          </div>

          <div className="zx-hero__presets" role="group" aria-label="Быстрые пресеты">
            {QUICK_PRESETS.slice(0, 6).map((p) => (
              <button
                key={p.id}
                type="button"
                className="zx-hero__preset"
                title={p.labelRu}
                onClick={() => void handleQuickPreset(p.id)}
              >
                <Sparkles width={11} height={11} strokeWidth={1.4} aria-hidden />
                {p.shortRu}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ╔═══════════════════════════════════════════════════════════════╗
          ║  QUICK ACTIONS — compact premium cards                       ║
          ╚═══════════════════════════════════════════════════════════════╝ */}
      <section className="zx-block" aria-labelledby="zx-qs-label">
        <header className="zx-block-head">
          <span className="zx-block-head__rule" aria-hidden />
          <h2 id="zx-qs-label" className="zx-block-head__title">Быстрый старт</h2>
          <span className="zx-block-head__rule" aria-hidden />
        </header>
        <div className="zx-qs-grid">
          {QS_CARDS.map(({ id, Icon, title, sub }) => (
            <button
              key={id}
              type="button"
              className={`zx-qs-card zx-qs-card--${id}`}
              onClick={() => onNavigate(id)}
            >
              <div className="zx-qs-card__icon-wrap">
                <Icon className="zx-qs-card__icon" strokeWidth={1.15} aria-hidden />
                {/* Слот под пользовательскую иконку: задаётся через CSS-переменные
                    --zx-qs-icon-loot / --zx-qs-icon-npc / --zx-qs-icon-prep / --zx-qs-icon-conditions
                    в src/index.css. Если переменная пустая (none) — слой невидим. */}
                <span className="zx-qs-card__icon-slot" aria-hidden />
              </div>
              <div className="zx-qs-card__title">{title}</div>
              <div className="zx-qs-card__sub">{sub}</div>
            </button>
          ))}
        </div>
      </section>

      {/* ╔═══════════════════════════════════════════════════════════════╗
          ║  NOTES + FAVORITES — compact split                           ║
          ╚═══════════════════════════════════════════════════════════════╝ */}
      <section className="zx-block" aria-labelledby="zx-nb-label">
        <header className="zx-block-head">
          <span className="zx-block-head__rule" aria-hidden />
          <h2 id="zx-nb-label" className="zx-block-head__title">Журнал кабинета</h2>
          <span className="zx-block-head__rule" aria-hidden />
        </header>

        <div className="zx-nb">
          <div className="zx-nb__panel">
            <div className="zx-nb__head">
              <ScrollText width={14} height={14} strokeWidth={1.4} aria-hidden />
              <span>Недавние заметки</span>
            </div>
            {noteRows.length === 0 ? (
              <p className="zx-dm__empty zx-dm__empty--rail">
                Заметки появятся сами — пишите в карточках NPC, подготовки и подсказках.
              </p>
            ) : (
              <ul className="zx-nb__list">
                {noteRows.slice(0, 5).map((n) => (
                  <li key={n.key}>
                    <button
                      type="button"
                      className="zx-nb__row"
                      onClick={() => onOpenNoteKey(n.key)}
                    >
                      <span className="zx-nb__row-title">
                        {n.titleLabel}{n.preview ? ` — ${n.preview}` : ""}
                      </span>
                      <span className="zx-nb__row-meta">{formatNoteTime(n.updatedAt)}</span>
                      <ChevronRight className="zx-nb__row-chevron" width={14} height={14} strokeWidth={1.4} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="zx-nb__panel">
            <div className="zx-nb__head">
              <Heart width={14} height={14} strokeWidth={1.4} aria-hidden />
              <span>Избранное</span>
            </div>
            {favPreview.length === 0 ? (
              <p className="zx-dm__empty zx-dm__empty--rail">
                Отметьте сердечком лут, NPC или сводку — избранное окажется здесь сразу.
              </p>
            ) : (
              <ul className="zx-nb__list">
                {favPreview.slice(0, 5).map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      className="zx-nb__row"
                      onClick={() => {
                        if (f.kind === "loot" && f.refKey.startsWith("loot:")) { onOpenLootCard(f.refKey.slice(5)); return; }
                        if (f.kind === "npc") { onNavigate("npc"); return; }
                        if (f.kind === "session") { onNavigate("prep"); return; }
                        onNavigate("favorites");
                      }}
                    >
                      <span className="zx-nb__row-title">{f.title}</span>
                      <span className="zx-nb__row-meta">{f.subtitle ?? ""}</span>
                      <ChevronRight className="zx-nb__row-chevron" width={14} height={14} strokeWidth={1.4} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
