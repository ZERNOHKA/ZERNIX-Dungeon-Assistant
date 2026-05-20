import { useMemo, useState } from "react";

import {
  AlertTriangle,
  Anchor,
  Castle,
  ClipboardCopy,
  Coins,
  Compass,
  Crown,
  Feather,
  Gem,
  MapPin,
  Pin,
  ScrollText,
  Skull,
  Sparkles,
  Swords,
  Users,
  Zap,
} from "lucide-react";

import { useZernixUserData } from "../../../context/ZernixUserDataContext";
import { SESSION_BIOME_OPTIONS } from "../../../lib/sessionBiomeOptions";
import { useZernixGenerators } from "../../ZernixGeneratorsContext";
import {
  compactSentence,
  dedupePrepLines,
  prepLinesOverlap,
  sanitizePrepText,
} from "../../lib/prepText";
import { presentSessionAtTable, presentSessionFromLogMarkdown } from "../../sessionAtTablePresent";
import { ZernixSessionSummarySkeleton } from "../../ZernixSkeletonBlocks";
import { useIdleGlow } from "../../useIdleGlow";
import {
  formatSessionCompact,
  formatSessionDiscord,
  formatSessionMarkdown,
  writeClipboard,
} from "../../zernixCopyExport";

export function SessionPrepView() {
  const {
    prepSummary,
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
  const [exportFormat, setExportFormat] = useState<"md" | "compact" | "discord">("md");
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

  const prepDisplay = useMemo(() => {
    const title = compactSentence(sessionPreview?.title?.trim() || sessionBrief?.title?.trim() || "Сессия", 120);

    const introText = compactSentence(
      tablePresentation?.pitch ||
        sessionPreview?.excerpt ||
        sessionBrief?.encounterPitch ||
        sessionBrief?.worldSummary ||
        "",
      300,
    );

    const introContext = [title, introText];

    const tagChips = dedupePrepLines(
      [sessionBrief?.themeLabel, sessionBrief?.sceneTypeLabel, sessionBrief?.biomeLabel].filter(Boolean) as string[],
      introContext,
      5,
      36,
    );

    const happeningLines = dedupePrepLines(tablePresentation?.happenings ?? [], introContext, 4, 180);

    const rawEnemies = dedupePrepLines(sessionBrief?.enemies ?? [], introContext, 4, 120);
    let dangerNote = compactSentence(tablePresentation?.danger?.[0] || sessionBrief?.danger || "", 200);
    if (dangerNote && rawEnemies.some((e) => prepLinesOverlap(dangerNote, e))) {
      dangerNote = "";
    }
    if (dangerNote && introText && prepLinesOverlap(dangerNote, introText)) {
      dangerNote = "";
    }

    const hookContext = [...introContext, ...happeningLines, ...rawEnemies];
    let hookLine = compactSentence(tablePresentation?.hook || sessionBrief?.hook || "", 220);
    if (hookLine && hookContext.some((c) => prepLinesOverlap(hookLine, c))) {
      hookLine = "";
    }

    const rewardLines = dedupePrepLines(
      sessionBrief?.rewardLines ?? [],
      [...hookContext, hookLine].filter(Boolean),
      4,
      160,
    );

    const hasScene = Boolean(
      tablePresentation && (introText || happeningLines.length || rawEnemies.length || hookLine || rewardLines.length),
    );

    return {
      title,
      introText,
      tagChips,
      happeningLines,
      threatLines: { enemies: rawEnemies.slice(0, 3), note: dangerNote },
      hookLine,
      rewardLines,
      hasScene,
    };
  }, [sessionBrief, sessionPreview, tablePresentation]);

  const {
    title: displayTitle,
    introText,
    tagChips,
    happeningLines,
    threatLines,
    hookLine,
    rewardLines,
    hasScene,
  } = prepDisplay;

  const exportPreview = useMemo(() => {
    if (!hasScene) return "";
    const raw =
      exportFormat === "md"
        ? formatSessionMarkdown(sessionTitle, sessionExcerpt, prepSummary, tablePresentation)
        : exportFormat === "compact"
          ? formatSessionCompact(sessionTitle, sessionExcerpt, prepSummary, tablePresentation)
          : formatSessionDiscord(sessionTitle, sessionExcerpt, prepSummary, tablePresentation);
    const cleaned = sanitizePrepText(raw);
    if (cleaned.length <= 3200) return cleaned;
    return cleaned.slice(0, 3200).trimEnd() + "\n…";
  }, [hasScene, exportFormat, sessionTitle, sessionExcerpt, prepSummary, tablePresentation]);

  const threatLevel =
    sessionForm.difficulty === "high" ? "Высокий"
      : sessionForm.difficulty === "low" ? "Низкий"
      : "Средний";
  const threatTone =
    sessionForm.difficulty === "high" ? "high"
      : sessionForm.difficulty === "low" ? "low"
      : "mid";
  const isFav = isFavorite("session", sessionRef);

  return (
    <div className="zx-prep">
      {/* ╔═══════════════════════════════════════════════════════════════╗
          ║  PARAMS — three compact panels                               ║
          ╚═══════════════════════════════════════════════════════════════╝ */}
      <div className="zx-prep-params">
        <div className="zx-prep-param-card">
          <div className="zx-prep-param-card__head">
            <Users width={14} height={14} strokeWidth={1.4} aria-hidden />
            <span>Партия</span>
          </div>
          <div className="zx-prep-param-card__grid">
            <label className="zx-prep-field">
              <span className="zx-prep-field__label">Уровень группы</span>
              <select
                className="zx-prep-input zx-prep-input--select"
                value={sessionForm.partyLevel}
                onChange={(e) => setSessionForm({ partyLevel: Number(e.target.value) })}
              >
                {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="zx-prep-field">
              <span className="zx-prep-field__label">Игроки</span>
              <select
                className="zx-prep-input zx-prep-input--select"
                value={sessionForm.playerCount}
                onChange={(e) => setSessionForm({ playerCount: Number(e.target.value) })}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="zx-prep-field zx-prep-field--difficulty">
              <span className="zx-prep-field__label">Сложность</span>
              <div className={`zx-prep-difficulty is-${threatTone}`}>
                <select
                  className="zx-prep-input zx-prep-input--select zx-prep-input--bare"
                  value={sessionForm.difficulty}
                  onChange={(e) => setSessionForm({ difficulty: e.target.value })}
                >
                  <option value="low">Низкая</option>
                  <option value="moderate">Средняя</option>
                  <option value="high">Высокая</option>
                </select>
                <span className="zx-prep-difficulty__bars" aria-hidden>
                  <span className="zx-prep-difficulty__bar" />
                  <span className="zx-prep-difficulty__bar" />
                  <span className="zx-prep-difficulty__bar" />
                </span>
              </div>
            </label>
          </div>
        </div>

        <div className="zx-prep-param-card">
          <div className="zx-prep-param-card__head">
            <Gem width={14} height={14} strokeWidth={1.4} aria-hidden />
            <span>Добыча и награды</span>
          </div>
          <div className="zx-prep-param-card__grid">
            <label className="zx-prep-field">
              <span className="zx-prep-field__label">Группы монстров</span>
              <select
                className="zx-prep-input zx-prep-input--select"
                value={sessionForm.packCount}
                onChange={(e) => setSessionForm({ packCount: Number(e.target.value) })}
              >
                {Array.from({ length: 25 }, (_, i) => i).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="zx-prep-field">
              <span className="zx-prep-field__label">Сундуки</span>
              <select
                className="zx-prep-input zx-prep-input--select"
                value={sessionForm.chestCount}
                onChange={(e) => setSessionForm({ chestCount: Number(e.target.value) })}
              >
                {Array.from({ length: 25 }, (_, i) => i).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="zx-prep-field zx-prep-field--toggle">
              <span className="zx-prep-field__label">Только магия</span>
              <button
                type="button"
                className={`zx-prep-toggle${sessionForm.onlyMagic ? " is-on" : ""}`}
                aria-pressed={sessionForm.onlyMagic}
                onClick={() => setSessionForm({ onlyMagic: !sessionForm.onlyMagic })}
              >
                <span className="zx-prep-toggle__track">
                  <span className="zx-prep-toggle__knob" />
                </span>
                <span className="zx-prep-toggle__caption">{sessionForm.onlyMagic ? "Да" : "Нет"}</span>
              </button>
            </label>
          </div>
        </div>

        <div className="zx-prep-param-card zx-prep-param-card--wide">
          <div className="zx-prep-param-card__head">
            <MapPin width={14} height={14} strokeWidth={1.4} aria-hidden />
            <span>Окружение</span>
          </div>
          <div className="zx-prep-param-card__grid zx-prep-param-card__grid--env">
            <label className="zx-prep-field">
              <span className="zx-prep-field__label">Тип локации</span>
              <select
                className="zx-prep-input zx-prep-input--select"
                value={sessionForm.environmentKey}
                onChange={(e) => setSessionForm({ environmentKey: e.target.value })}
              >
                {SESSION_BIOME_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="zx-prep-field zx-prep-field--env">
              <span className="zx-prep-field__label">Дополнительные детали (необязательно)</span>
              <input
                type="text"
                className="zx-prep-input"
                value={sessionForm.environmentText}
                onChange={(e) => setSessionForm({ environmentText: e.target.value })}
                placeholder="Например: культ под городом, дворцовый заговор…"
              />
            </label>
          </div>
        </div>
      </div>

      {/* ╔═══════════════════════════════════════════════════════════════╗
          ║  CINEMATIC SCENE STAGE — single unified narrative panel      ║
          ║  Left: hero artwork + threat                                 ║
          ║  Center: title + intro + chips + integrated narrative grid   ║
          ║  Right: utility-only export rail (no lore duplication)       ║
          ╚═══════════════════════════════════════════════════════════════╝ */}
      <section
        className={`zx-prep-stage${sessionBusy ? " is-busy" : ""}${hasScene ? "" : " is-empty"}`}
        aria-label="Готовая сцена"
      >
        {/* LEFT — scene column: hero artwork + danger */}
        <div className="zx-prep-stage__scene-col">
        <div className="zx-prep-stage__hero">
          <div className={`zx-prep-stage__hero-frame is-${threatTone}`}>
            <div className="zx-prep-stage__hero-bg" aria-hidden />
            <div className="zx-prep-stage__hero-vignette" aria-hidden />
            <div className="zx-prep-stage__hero-rays" aria-hidden />
            <div className="zx-prep-stage__hero-glyph" aria-hidden>
              <Castle width={122} height={122} strokeWidth={0.85} />
            </div>
            <div className={`zx-prep-stage__threat is-${threatTone}`} aria-label={`Уровень угрозы: ${threatLevel}`}>
              <span className="zx-prep-stage__threat-dot" aria-hidden />
              <span className="zx-prep-stage__threat-label">Уровень угрозы</span>
              <span className="zx-prep-stage__threat-value">{threatLevel}</span>
            </div>
            <div className="zx-prep-stage__hero-eyebrow" aria-hidden>
              <span className="zx-prep-stage__hero-eyebrow-dot" />
              <span>Готовая сцена</span>
              <span className="zx-prep-stage__hero-eyebrow-dot" />
            </div>
          </div>
        </div>

        {hasScene && (threatLines.enemies.length > 0 || threatLines.note) ? (
          <article
            className="zx-prep-narrative-block zx-prep-narrative-block--threat zx-prep-narrative-block--under-hero"
            aria-label="Опасность"
          >
            <div className="zx-prep-narrative-block__head">
              <span className="zx-prep-narrative-block__icon" aria-hidden>
                <Skull width={15} height={15} strokeWidth={1.4} />
              </span>
              <span className="zx-prep-narrative-block__label">Опасность</span>
            </div>
            {threatLines.enemies.length > 0 ? (
              <ul className="zx-prep-narrative-block__enemies">
                {threatLines.enemies.map((line, idx) => (
                  <li key={`en-hero-${idx}`} className={idx === 0 ? "is-main" : ""}>
                    <span className="zx-prep-narrative-block__enemy-icon" aria-hidden>
                      {idx === 0 ? <Crown width={13} height={13} strokeWidth={1.5} /> : <Swords width={12} height={12} strokeWidth={1.5} />}
                    </span>
                    <span className="zx-prep-narrative-block__enemy-text zx-prep-prose">{line}</span>
                    {idx === 0 ? <span className="zx-prep-narrative-block__enemy-role">Главная угроза</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {threatLines.note ? (
              <p className="zx-prep-narrative-block__note">
                <AlertTriangle width={13} height={13} strokeWidth={1.5} aria-hidden />
                <span className="zx-prep-prose">{threatLines.note}</span>
              </p>
            ) : null}
          </article>
        ) : null}
        </div>

        {/* CENTER — title + intro + tags + integrated narrative */}
        <div className="zx-prep-stage__story">
          {hasScene ? (
            <>
              <header className="zx-prep-stage__story-head">
                <h2 className="zx-prep-stage__title zx-prep-prose">{displayTitle}</h2>
                <span className="zx-prep-stage__rule" aria-hidden />
                {introText ? (
                  <p className="zx-prep-stage__lead zx-prep-prose">{introText}</p>
                ) : null}
                {tagChips.length > 0 ? (
                  <div className="zx-prep-stage__chips">
                    {tagChips.map((tag) => (
                      <span key={tag} className="zx-prep-stage__chip">{tag}</span>
                    ))}
                  </div>
                ) : null}
              </header>

              <div className="zx-prep-stage__narrative" role="list">
                {happeningLines.length > 0 ? (
                  <article className="zx-prep-narrative-block zx-prep-narrative-block--happens" role="listitem">
                    <div className="zx-prep-narrative-block__head">
                      <span className="zx-prep-narrative-block__icon" aria-hidden>
                        <Compass width={15} height={15} strokeWidth={1.4} />
                      </span>
                      <span className="zx-prep-narrative-block__label">Что происходит</span>
                    </div>
                    <ul className="zx-prep-narrative-block__bullets">
                      {happeningLines.map((line, idx) => (
                        <li key={`hap-${idx}`}>
                          <span className="zx-prep-narrative-block__dot" aria-hidden />
                          <span className="zx-prep-prose">{line}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ) : null}

                {hookLine ? (
                  <article className="zx-prep-narrative-block zx-prep-narrative-block--hook" role="listitem">
                    <div className="zx-prep-narrative-block__head">
                      <span className="zx-prep-narrative-block__icon" aria-hidden>
                        <Anchor width={15} height={15} strokeWidth={1.4} />
                      </span>
                      <span className="zx-prep-narrative-block__label">Крючок</span>
                    </div>
                    <p className="zx-prep-narrative-block__hook zx-prep-prose">{hookLine}</p>
                  </article>
                ) : null}

                {rewardLines.length > 0 ? (
                  <article className="zx-prep-narrative-block zx-prep-narrative-block--reward" role="listitem">
                    <div className="zx-prep-narrative-block__head">
                      <span className="zx-prep-narrative-block__icon" aria-hidden>
                        <Coins width={15} height={15} strokeWidth={1.4} />
                      </span>
                      <span className="zx-prep-narrative-block__label">Награда</span>
                    </div>
                    <ul className="zx-prep-narrative-block__rewards">
                      {rewardLines.map((line, idx) => {
                        const isGold = /\b\d[\d\s]*\s?(зм|gp|gold|зол)\b/i.test(line);
                        const isMagic = /редк|очень редк|легендарн|магическ|кольц|жезл|свит|зель/i.test(line);
                        const Icon = isGold ? Coins : isMagic ? Sparkles : Zap;
                        return (
                          <li key={`rw-${idx}`}>
                            <span className="zx-prep-narrative-block__reward-icon" aria-hidden>
                              <Icon width={13} height={13} strokeWidth={1.5} />
                            </span>
                            <span className="zx-prep-narrative-block__reward-text zx-prep-prose">{line}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                ) : null}
              </div>
            </>
          ) : (
            <div className="zx-prep-stage__empty">
              <div className="zx-prep-stage__empty-crest" aria-hidden>
                <Feather strokeWidth={1.1} />
              </div>
              <h2 className="zx-prep-stage__empty-title">Сцена ещё не вызвана</h2>
              <p className="zx-prep-stage__empty-lead">
                Настройте параметры выше и вызовите подготовку — здесь развернётся
                единая кинематографическая сцена: завязка, угрозы, крючок и награды.
              </p>
            </div>
          )}
        </div>

        {/* RIGHT — utility-only export rail (NO lore text duplication) */}
        <aside className="zx-prep-stage__rail" aria-label="Действия и экспорт">
          <div className="zx-prep-stage__rail-head">
            <ScrollText width={13} height={13} strokeWidth={1.4} aria-hidden />
            <span>Действия</span>
          </div>

          <div className="zx-prep-stage__rail-section">
            <span className="zx-prep-stage__rail-section-label">Формат экспорта</span>
            <div className="zx-prep-stage__rail-tabs" role="group" aria-label="Формат экспорта">
              {(["md", "compact", "discord"] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  className={`zx-prep-stage__rail-tab${exportFormat === fmt ? " is-active" : ""}`}
                  onClick={() => setExportFormat(fmt)}
                >
                  {fmt === "md" ? "Markdown" : fmt === "compact" ? "Кратко" : "Discord"}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="zx-prep-stage__rail-copy"
              disabled={sessionBusy || !hasScene}
              onClick={() => void copySession(exportFormat)}
            >
              <ClipboardCopy width={12} height={12} strokeWidth={1.5} aria-hidden />
              Скопировать сводку
            </button>
            {exportPreview ? (
              <div className="zx-prep-export-preview-wrap">
                <span className="zx-prep-stage__rail-section-label">Предпросмотр</span>
                <pre className="zx-prep-export-preview zx-prep-prose">{exportPreview}</pre>
              </div>
            ) : null}
          </div>

          {sessionError ? (
            <p className="zx-prep-stage__rail-error">{sanitizePrepText(sessionError)}</p>
          ) : null}

          <div className="zx-prep-stage__rail-spacer" />

          <button
            type="button"
            className="zx-cta zx-cta--gold zx-prep-stage__rail-cta"
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
            <Sparkles width={15} height={15} strokeWidth={1.4} aria-hidden />
            <span>{sessionBusy ? "Собираем сцену…" : "Сгенерировать подготовку"}</span>
          </button>

          <button
            type="button"
            className={`zx-prep-stage__rail-pin${isFav ? " is-on" : ""}${sessionFavPulse ? " is-tick" : ""}`}
            onClick={() => {
              toggleSessionFavorite(sessionTitle, sessionPreview?.excerpt);
              setSessionFavPulse(true);
              window.setTimeout(() => setSessionFavPulse(false), 420);
            }}
            disabled={!hasScene}
          >
            <Pin width={13} height={13} strokeWidth={1.5} aria-hidden />
            {isFav ? "Сводка закреплена" : "Закрепить в избранном"}
          </button>
        </aside>

        {sessionBusy ? (
          <div className="zx-prep-busy-veil" aria-busy>
            <ZernixSessionSummarySkeleton />
          </div>
        ) : null}
      </section>

      {/* ╔═══════════════════════════════════════════════════════════════╗
          ║  NOTES — handwritten DM notes                                ║
          ╚═══════════════════════════════════════════════════════════════╝ */}
      <section className={`zx-prep-notes${prepNoteGlow.glow ? " is-glow" : ""}`} aria-label="Локальные заметки">
        <div className="zx-prep-notes__head">
          <Feather width={14} height={14} strokeWidth={1.4} aria-hidden />
          <span>Локальные заметки (подготовка)</span>
        </div>
        <textarea
          className="zx-prep-notes__input"
          rows={4}
          value={getNoteBody(prepDmKey)}
          onChange={(e) => {
            setNoteBody(prepDmKey, e.target.value);
            prepNoteGlow.bump();
          }}
          placeholder="Заметки мастера, тайминги, проверки, напоминания…"
        />
        <div className="zx-prep-notes__foot">
          <span className="zx-prep-notes__hint">Сохраняется локально</span>
          <button
            type="button"
            className="zx-prep-notes__save"
            onClick={() => {
              showToast("Saved!");
              prepNoteGlow.bump();
            }}
          >
            <ScrollText width={13} height={13} strokeWidth={1.5} aria-hidden />
            Сохранить заметки
          </button>
        </div>
      </section>
    </div>
  );
}
