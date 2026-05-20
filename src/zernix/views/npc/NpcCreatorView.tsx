import { useEffect, useState } from "react";

import {
  BookOpen,
  ClipboardCopy,
  Compass,
  Eye,
  Gem,
  Heart,
  KeyRound,
  RefreshCw,
  ScrollText,
  ShieldOff,
  Sparkles,
  Target,
  UserCircle,
} from "lucide-react";

import { useZernixUserData } from "../../../context/ZernixUserDataContext";
import { useAppContent } from "../../../hooks/useAppContent";
import { useZernixGenerators } from "../../ZernixGeneratorsContext";
import type { NpcPreviewState } from "../../models";
import type { NarrativeRerollSlot } from "../../npcNarrativeCompose";
import { npcFavoriteRefKey, npcJoinSegments, sanitizeNpcPreviewState } from "../../npcUi";
import { ZernixNpcCardSkeleton } from "../../ZernixSkeletonBlocks";
import { useIdleGlow } from "../../useIdleGlow";
import {
  formatNpcCompact,
  formatNpcDiscord,
  formatNpcMarkdown,
  writeClipboard,
} from "../../zernixCopyExport";

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
  const {
    getNoteBody,
    setNoteBody,
    isFavorite,
    toggleNpcFavorite,
    pushDmTimeline,
    showToast,
    appendPrepDmNote,
  } = useZernixUserData();
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

  useEffect(() => {
    const ok = new Set(["ally", "villain", "rival"]);
    if (!ok.has(npcForm.role)) setNpcForm({ role: "ally" });
  }, [npcForm.role, setNpcForm]);

  const occupations = npcBlock?.occupations ?? [];
  const races = npcBlock?.races ?? [];
  const raceLabel = races.find((r) => r.value === npcForm.race)?.labelRu ?? npc.race ?? "—";
  const occupationLabel =
    occupations.find((o) => o.value === npcForm.occupationValue)?.labelRu ?? npcForm.occupationValue ?? "—";
  const roleTone = npcForm.role === "ally" ? "ally" : npcForm.role === "villain" ? "villain" : "rival";
  const genderLabel = (() => {
    const seg = npcBlock?.genderSegment ?? [];
    const found = seg.find((g) => g.id === npcForm.genderId);
    if (found) return found.labelRu;
    if (npcForm.genderId === "random") return "Случайный";
    return npcForm.genderId || "—";
  })();
  const splitName = (() => {
    const full = (npc.name ?? "").trim();
    if (!full) return { primary: "Безымянный", epithet: "" };
    const m = full.match(/^(.+?)\s+[«"](.+?)[»"]\s*$/);
    if (m) return { primary: m[1].trim(), epithet: m[2].trim() };
    return { primary: full, epithet: "" };
  })();

  type NarrativeBlock = {
    id: string;
    htmlId: string;
    label: string;
    slot: NarrativeRerollSlot;
    Icon: typeof Eye;
    value: string;
    field: keyof NpcPreviewState;
    accent?: "secret";
  };
  const blocks: NarrativeBlock[] = [
    { id: "visual", htmlId: "npc-visual", label: "Внешний признак", slot: "visual", Icon: Eye, value: npc.visualTrait ?? "", field: "visualTrait" },
    { id: "want", htmlId: "npc-want", label: "Желание", slot: "want", Icon: Target, value: npc.wantLine ?? "", field: "wantLine" },
    { id: "avoid", htmlId: "npc-avoid", label: "Страх", slot: "avoid", Icon: ShieldOff, value: npc.avoidLine ?? "", field: "avoidLine" },
    { id: "secret", htmlId: "npc-secret", label: "Секрет", slot: "secret", Icon: KeyRound, value: npc.secretLine ?? "", field: "secretLine", accent: "secret" },
  ];

  return (
    <div className="zx-npc">
      {/* ╔═══════════════════════════════════════════════════════════════╗
          ║  PARAMETERS — compact horizontal bar                         ║
          ╚═══════════════════════════════════════════════════════════════╝ */}
      <section className="zx-block" aria-labelledby="zx-npc-params-label">
        <header className="zx-block-head">
          <span className="zx-block-head__rule" aria-hidden />
          <h2 id="zx-npc-params-label" className="zx-block-head__title">Параметры NPC</h2>
          <span className="zx-block-head__rule" aria-hidden />
        </header>

        <div className="zx-npc-params">
          <label className="zx-npc-field">
            <span className="zx-npc-field__label"><UserCircle width={11} height={11} strokeWidth={1.5} aria-hidden /> Раса</span>
            <select
              className="zx-npc-input zx-npc-input--select"
              value={npcForm.race}
              onChange={(e) => setNpcForm({ race: e.target.value })}
              disabled={!npcBlock}
            >
              {races.map((r) => (
                <option key={r.value} value={r.value}>{r.labelRu}</option>
              ))}
            </select>
          </label>

          <label className="zx-npc-field">
            <span className="zx-npc-field__label"><Compass width={11} height={11} strokeWidth={1.5} aria-hidden /> Ремесло / занятие</span>
            <select
              className="zx-npc-input zx-npc-input--select"
              value={npcForm.occupationValue}
              onChange={(e) => setNpcForm({ occupationValue: e.target.value })}
              disabled={!npcBlock}
            >
              {occupations.map((o) => (
                <option key={o.value} value={o.value}>{o.labelRu}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="zx-cta zx-cta--gold zx-npc-generate"
            disabled={npcBusy || !npcBlock}
            aria-busy={npcBusy}
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
            <Gem width={17} height={17} strokeWidth={1.4} aria-hidden />
            <span>{npcBusy ? "Собираем образ…" : "Сгенерировать NPC"}</span>
          </button>
        </div>

        {npcError ? (
          <p className="zx-loot-error" style={{ marginTop: 14 }}>{npcError}</p>
        ) : null}
      </section>

      {/* ╔═══════════════════════════════════════════════════════════════╗
          ║  DOSSIER — 3-column character codex                          ║
          ╚═══════════════════════════════════════════════════════════════╝ */}
      <section className={`zx-npc-dossier${npcBusy ? " is-busy" : ""}`} aria-label="Карточка NPC">
        {/* LEFT — Portrait + identity */}
        <aside className="zx-npc-portrait-card">
          <div className="zx-npc-portrait-card__frame">
            <div className="zx-npc-portrait-card__inner">
              <div className="zx-npc-portrait-card__letter" aria-hidden>
                {(npc.portraitLetter || "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="zx-npc-portrait-card__shadow" aria-hidden />
              <div className="zx-npc-portrait-card__glyph" aria-hidden>
                <Sparkles width={20} height={20} strokeWidth={1.2} />
              </div>
            </div>
            <button
              type="button"
              className={`zx-npc-portrait-fav${favorited ? " is-on" : ""}${favPulse ? " is-tick" : ""}`}
              aria-label={favorited ? "Убрать из избранного" : "В избранное"}
              aria-pressed={favorited}
              onClick={() => {
                toggleNpcFavorite(npc);
                setFavPulse(true);
                window.setTimeout(() => setFavPulse(false), 420);
              }}
            >
              <Heart width={16} height={16} strokeWidth={1.4} fill={favorited ? "currentColor" : "none"} aria-hidden />
            </button>
          </div>

          <div className="zx-npc-identity">
            <input
              className="zx-npc-identity__name"
              value={splitName.primary}
              onChange={(e) => {
                const epi = splitName.epithet ? ` «${splitName.epithet}»` : "";
                patch({ name: `${e.target.value}${epi}` });
              }}
              placeholder="Имя"
            />
            <input
              className="zx-npc-identity__epithet"
              value={splitName.epithet}
              onChange={(e) => {
                const epi = e.target.value.trim();
                patch({ name: epi ? `${splitName.primary} «${epi}»` : splitName.primary });
              }}
              placeholder="«Эпитет / прозвище»"
            />
            <div className="zx-npc-identity__meta">
              <span>{raceLabel}</span>
              <span className="zx-npc-identity__dot" aria-hidden />
              <span>{occupationLabel}</span>
            </div>
          </div>
        </aside>

        {/* CENTER — Narrative blocks */}
        <div className="zx-npc-narrative">
          {blocks.map(({ id, htmlId, label, slot, Icon, value, field, accent }) => (
            <div key={id} className={`zx-npc-section${accent === "secret" ? " is-secret" : ""}`}>
              <div className="zx-npc-section__head">
                <span className="zx-npc-section__icon-wrap" aria-hidden>
                  <Icon className="zx-npc-section__icon" strokeWidth={1.3} />
                </span>
                <label className="zx-npc-section__label" htmlFor={htmlId}>{label}</label>
                <button
                  type="button"
                  className="zx-npc-reroll"
                  disabled={!canRerollNarrative || npcBusy}
                  aria-label={`Перегенерировать: ${label}`}
                  title={`Перегенерировать: ${label}`}
                  onClick={() => rerollNpcNarrativeField(slot)}
                >
                  <RefreshCw width={13} height={13} strokeWidth={1.5} aria-hidden />
                </button>
              </div>
              <textarea
                id={htmlId}
                className="zx-npc-section__text"
                rows={2}
                value={value}
                onChange={(e) => patch({ [field]: e.target.value } as Partial<NpcPreviewState>)}
              />
            </div>
          ))}
        </div>

        {/* RIGHT — Extras rail */}
        <aside className="zx-npc-extras">
          <div className="zx-npc-extras__card">
            <div className="zx-npc-extras__head">
              <Compass width={14} height={14} strokeWidth={1.4} aria-hidden />
              <span>Дополнительно</span>
            </div>

            <div className="zx-npc-extras__row">
              <span className="zx-npc-extras__label">Буква на жетоне</span>
              <div className="zx-npc-extras__token-wrap">
                <input
                  className="zx-npc-extras__token-input"
                  maxLength={2}
                  value={npc.portraitLetter ?? ""}
                  onChange={(e) => patch({ portraitLetter: e.target.value.slice(0, 2).toUpperCase() })}
                />
                <button
                  type="button"
                  className="zx-npc-reroll zx-npc-reroll--inline"
                  aria-label="Случайная буква"
                  title="Случайная буква"
                  onClick={() => {
                    const letters = "АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ";
                    patch({ portraitLetter: letters.charAt(Math.floor(Math.random() * letters.length)) });
                  }}
                >
                  <RefreshCw width={12} height={12} strokeWidth={1.5} aria-hidden />
                </button>
              </div>
            </div>

            <div className="zx-npc-extras__row">
              <span className="zx-npc-extras__label">Отношение</span>
              <div className={`zx-npc-extras__select-wrap is-${roleTone}`}>
                <select
                  className={`zx-npc-extras__select is-${roleTone}`}
                  value={npcForm.role}
                  onChange={(e) => setNpcForm({ role: e.target.value })}
                  disabled={!npcBlock}
                >
                  {NPC_TABLE_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="zx-npc-extras__row">
              <span className="zx-npc-extras__label">Роль</span>
              <span className="zx-npc-extras__value zx-npc-extras__value--clip" title={npc.creatureClass}>
                {npc.creatureClass || "—"}
              </span>
            </div>

            <div className="zx-npc-extras__row">
              <span className="zx-npc-extras__label">Пол</span>
              <span className="zx-npc-extras__value">{genderLabel}</span>
            </div>
          </div>

          <div className={`zx-npc-extras__card zx-npc-notes${noteGlow.glow ? " is-glow" : ""}`}>
            <div className="zx-npc-extras__head">
              <ScrollText width={14} height={14} strokeWidth={1.4} aria-hidden />
              <span>Заметки мастера</span>
            </div>
            <textarea
              className="zx-npc-notes__input"
              rows={5}
              value={getNoteBody(npcNoteKey)}
              onChange={(e) => {
                setNoteBody(npcNoteKey, e.target.value);
                noteGlow.bump();
              }}
              placeholder="Ваши заметки о персонаже…"
            />
            <button
              type="button"
              className="zx-npc-notes__save"
              onClick={() => {
                showToast("Saved!");
                noteGlow.bump();
              }}
            >
              <ScrollText width={12} height={12} strokeWidth={1.5} aria-hidden />
              Сохранить заметки
            </button>
          </div>
        </aside>

        {npcBusy ? (
          <div className="zx-npc-busy-veil" aria-busy>
            <ZernixNpcCardSkeleton />
          </div>
        ) : null}
      </section>

      {/* ╔═══════════════════════════════════════════════════════════════╗
          ║  ACTION BAR — export + favorite + save-to-session            ║
          ╚═══════════════════════════════════════════════════════════════╝ */}
      <section className="zx-npc-actions-bar" aria-label="Экспорт и действия">
        <div className="zx-npc-actions-bar__group">
          <span className="zx-npc-actions-bar__label">Экспорт</span>
          <button type="button" className="zx-npc-action-pill" disabled={npcBusy} onClick={() => void copyNpc("md")}>
            <ScrollText width={13} height={13} strokeWidth={1.5} aria-hidden /> Markdown
          </button>
          <button type="button" className="zx-npc-action-pill" disabled={npcBusy} onClick={() => void copyNpc("compact")}>
            <BookOpen width={13} height={13} strokeWidth={1.5} aria-hidden /> Кратко
          </button>
          <button type="button" className="zx-npc-action-pill" disabled={npcBusy} onClick={() => void copyNpc("discord")}>
            <Sparkles width={13} height={13} strokeWidth={1.5} aria-hidden /> Discord
          </button>
        </div>

        <div className="zx-npc-actions-bar__group zx-npc-actions-bar__group--end">
          <button
            type="button"
            className={`zx-npc-action-pill zx-npc-action-pill--fav${favorited ? " is-on" : ""}`}
            onClick={() => {
              toggleNpcFavorite(npc);
              setFavPulse(true);
              window.setTimeout(() => setFavPulse(false), 420);
            }}
          >
            <Heart width={13} height={13} strokeWidth={1.5} fill={favorited ? "currentColor" : "none"} aria-hidden />
            {favorited ? "В избранном" : "В избранное"}
          </button>
          <button
            type="button"
            className="zx-npc-action-pill zx-npc-action-pill--save"
            onClick={() => {
              const segs = npcJoinSegments([npc.race, npc.creatureClass]);
              appendPrepDmNote(`[NPC] ${npc.name}${segs ? ` — ${segs}` : ""}`);
              showToast("Сохранено в сессию");
            }}
          >
            <ClipboardCopy width={13} height={13} strokeWidth={1.5} aria-hidden />
            Сохранить в сессию
          </button>
        </div>
      </section>
    </div>
  );
}
