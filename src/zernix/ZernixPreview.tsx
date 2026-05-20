import { Heart, Sparkles, Sword, X } from "lucide-react";
import { useMemo, useState } from "react";

import { useZernixUserData } from "../context/ZernixUserDataContext";
import type { ZernixViewId } from "./types";
import { SessionSceneAtTableCard } from "./components/SessionBriefPanel";
import { npcJoinSegments, npcSafeField } from "./npcUi";
import { useZernixGenerators } from "./ZernixGeneratorsContext";
import { SpellCard } from "./components/SpellCard";
import { useIdleGlow } from "./useIdleGlow";
import { presentSessionAtTable, presentSessionFromLogMarkdown } from "./sessionAtTablePresent";

type Props = {
  view: ZernixViewId;
  conditionKey: string;
  onClose?: () => void;
};

export function ZernixPreview({ view, conditionKey, onClose }: Props) {
  const {
    lootCards,
    lootDigest,
    lootNarrativeBlock,
    selectedLootId,
    npc,
    prepSummary,
    sessionMarkdown,
    sessionBrief,
    sessionPreview,
  } = useZernixGenerators();

  const {
    getNoteBody,
    setNoteBody,
    isFavorite,
    toggleLootFavorite,
    toggleSessionFavorite,
    appendPrepDmNote,
    favorites,
    recentNotes,
    profile,
    settings,
    showToast,
  } = useZernixUserData();

  const lootNoteGlow = useIdleGlow();
  const sessionCodexGlow = useIdleGlow();
  const homeDeskGlow = useIdleGlow();
  const [lootCodexFavPulse, setLootCodexFavPulse] = useState(false);

  const selectedLoot = useMemo(
    () => lootCards.find((c) => c.id === selectedLootId) ?? null,
    [lootCards, selectedLootId],
  );

  if (view === "table") {
    return (
      <div className="zernix-codex">
        <header className="zernix-codex__header">
          <div>
            <div className="zernix-codex__badge">Стол</div>
            <h2 className="zernix-codex__title">Режим «За столом»</h2>
          </div>
        </header>
        <p className="zernix-codex__prose" style={{ marginTop: 10 }}>
          Колонка кодекса скрыта — карточка и кнопки занимают весь экран. Выйдите через кнопку «Выход» слева в режиме.
        </p>
      </div>
    );
  }

  if (view === "settings") {
    return (
      <div className="zernix-codex">
        <header className="zernix-codex__header">
          <div>
            <div className="zernix-codex__badge">Система</div>
            <h2 className="zernix-codex__title">Настройки</h2>
          </div>
        </header>
        <div className="zernix-codex__parchment">
          <p className="zernix-codex__prose">
            Быстрые переключатели доступны через кнопку <strong>Settings</strong> в шапке. В этой же панели — плотность
            списков: <strong>{settings.listDensity}</strong>, язык: <strong>{settings.catalogLang}</strong>, тема:{" "}
            <strong>{settings.darkMode ? "тёмная" : "основная"}</strong>.
          </p>
          <div className="zernix-gold-rule" />
          <div className="zernix-field-label">Профиль</div>
          <p className="zernix-codex__prose" style={{ marginTop: 8 }}>
            {profile.displayName || "—"}
            {profile.affiliation?.trim() ? (
              <>
                <br />
                <span style={{ opacity: 0.85 }}>{profile.affiliation.trim()}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>
    );
  }

  if (view === "loot") {
    const primary = selectedLoot ?? lootCards[0];
    const lootNoteKey = primary ? `loot:${primary.id}` : "";
    const lootRef = primary ? `loot:${primary.id}` : "";

    return (
      <div className="zernix-codex">
        <header className="zernix-codex__header">
          <div>
            <div className="zernix-codex__badge">Добыча</div>
            <h2 className="zernix-codex__title">{primary ? primary.title : "Генератор"}</h2>
            {primary ? (
              <p className="zernix-codex__subtitle">
                {primary.rarityLabel} · {primary.kindLabel}
              </p>
            ) : (
              <p className="zernix-codex__subtitle">Сгенерируйте добычу — карта откроется здесь автоматически.</p>
            )}
          </div>
        </header>

        {lootDigest ? (
          <div className="zernix-codex__parchment" style={{ marginBottom: 14 }}>
            <div className="zernix-field-label">Золото и сводка</div>
            <p className="zernix-codex__prose">{lootDigest.goldLine}</p>
            {lootDigest.labGold ? (
              <>
                <div className="zernix-gold-rule" />
                <div className="zernix-field-label">Лаборатория</div>
                <p className="zernix-codex__prose">{lootDigest.labGold}</p>
              </>
            ) : null}
          </div>
        ) : null}

        {primary ? (
          <div className="zernix-codex__parchment">
            <p className="zernix-codex__prose" style={{ fontSize: 14, lineHeight: 1.45 }}>
              {primary.description.length > 100 ? `${primary.description.slice(0, 97)}…` : primary.description}
            </p>
          </div>
        ) : null}

        {lootNarrativeBlock ? (
          <div className="zernix-codex-scroll" style={{ maxHeight: 88, marginTop: 10 }}>
            <div className="zernix-codex__parchment">
              <div className="zernix-field-label">Контекст</div>
              <p className="zernix-codex__prose" style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>
                {lootNarrativeBlock.length > 180 ? `${lootNarrativeBlock.slice(0, 177)}…` : lootNarrativeBlock}
              </p>
            </div>
          </div>
        ) : null}

        {primary ? (
          <div className={`zernix-codex__parchment${lootNoteGlow.glow ? " is-save-glow" : ""}`} style={{ marginTop: 12 }}>
            <div className="zernix-field-label">Заметки к этой карточке</div>
            <textarea
              className="zernix-input zernix-textarea"
              rows={4}
              value={getNoteBody(lootNoteKey)}
              onChange={(e) => {
                setNoteBody(lootNoteKey, e.target.value);
                lootNoteGlow.bump();
              }}
              placeholder="Сцена, владелец, модификаторы…"
            />
            <button
              type="button"
              className="zernix-btn-secondary zernix-btn-secondary--block zernix-mt-sm zernix-btn-press"
              disabled={!primary}
              onClick={() => {
                console.debug("[ZERNIX] save loot card notes", lootNoteKey);
                showToast("Saved!");
                lootNoteGlow.bump();
              }}
            >
              Сохранить заметку
            </button>
          </div>
        ) : null}

        <div className="zernix-codex__actions">
          <button
            type="button"
            className={`zernix-btn-secondary zernix-btn-secondary--block${lootCodexFavPulse ? " is-tick" : ""}`}
            disabled={!primary}
            onClick={() => {
              if (!primary) return;
              toggleLootFavorite(primary);
              console.debug("[ZERNIX] toggle loot favorite", primary.id);
              setLootCodexFavPulse(true);
              window.setTimeout(() => setLootCodexFavPulse(false), 420);
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
              <Heart
                size={16}
                strokeWidth={1.5}
                fill={primary && isFavorite("loot", lootRef) ? "currentColor" : "none"}
                aria-hidden
              />
              {primary && isFavorite("loot", lootRef) ? "Убрать из избранного" : "В избранное"}
            </span>
          </button>
          <button
            type="button"
            className="zernix-btn-primary zernix-btn-primary--block"
            disabled={!primary}
            onClick={() => {
              if (!primary) return;
              appendPrepDmNote(`[Loot] ${primary.title}: ${primary.displayLine}`);
              showToast("Saved!");
            }}
          >
            Сохранить в сессию
          </button>
          <button
            type="button"
            className="zernix-btn-secondary zernix-btn-secondary--block"
            disabled={!primary}
            onClick={async () => {
              if (!primary) return;
              const text = `${primary.title}\n${primary.displayLine}\n${primary.description}`;
              try {
                await navigator.clipboard.writeText(text);
              } catch {
                /* ignore */
              }
            }}
          >
            Экспорт для Foundry
          </button>
        </div>
      </div>
    );
  }

  if (view === "npc") {
    const subtitle = npcJoinSegments([npc.race, npc.creatureClass]);

    return (
      <div className="zernix-codex zernix-codex--npc">
        <header className="zernix-codex__header zernix-codex__header--npc">
          <div className="zernix-npc-portrait" aria-hidden>
            {npc.portraitLetter}
          </div>
          <div>
            <div className="zernix-codex__badge">Персонаж</div>
            <h2 className="zernix-codex__title">{npcSafeField(npc.name)}</h2>
            <p className="zernix-codex__subtitle">{subtitle || npcSafeField("")}</p>
          </div>
        </header>

        <div className="zernix-codex__parchment">
          <div className="zernix-field-label">Внешний признак</div>
          <p className="zernix-codex__prose">{npc.visualTrait}</p>
          <div className="zernix-gold-rule" />
          <div className="zernix-field-label">Цель</div>
          <p className="zernix-codex__prose">{npc.wantLine}</p>
          <div className="zernix-gold-rule" />
          <div className="zernix-field-label">Страх</div>
          <p className="zernix-codex__prose">{npc.avoidLine}</p>
          <div className="zernix-gold-rule" />
          <div className="zernix-field-label">Секрет</div>
          <p className="zernix-codex__prose zernix-codex__prose--secret">{npc.secretLine}</p>
        </div>
      </div>
    );
  }

  if (view === "prep") {
    const bodyPlain = sessionMarkdown?.trim() ? sessionMarkdown : prepSummary;
    const titleLine = sessionPreview?.title ?? "Сводка подготовки";
    const sessionTitle = sessionPreview?.title?.trim() || sessionBrief?.title?.trim() || "Сессия";
    const sessionRef = `session:${sessionTitle}`;
    const sessionNoteKey = "session:last";
    const tableP = sessionBrief
      ? presentSessionAtTable(sessionBrief)
      : presentSessionFromLogMarkdown(bodyPlain || "");

    return (
      <div className="zernix-codex">
        <header className="zernix-codex__header">
          <div>
            <div className="zernix-codex__badge">Сессия</div>
            <h2 className="zernix-codex__title">{titleLine}</h2>
            {sessionPreview ? <p className="zernix-codex__subtitle">{sessionPreview.excerpt}</p> : null}
          </div>
          <Sparkles className="zernix-codex__icon" strokeWidth={1.25} aria-hidden />
        </header>
        <div className="zernix-codex-scroll">
          {tableP ? (
            <SessionSceneAtTableCard presentation={tableP} />
          ) : (
            <div className="zernix-codex__parchment">
              <p className="zernix-codex__prose" style={{ whiteSpace: "pre-wrap" }}>
                {bodyPlain.length > 380 ? `${bodyPlain.slice(0, 377)}…` : bodyPlain}
              </p>
            </div>
          )}
        </div>

        <div className={`zernix-codex__parchment${sessionCodexGlow.glow ? " is-save-glow" : ""}`} style={{ marginTop: 12 }}>
          <div className="zernix-field-label">Заметки к последней сводке</div>
          <textarea
            className="zernix-input zernix-textarea"
            rows={5}
            value={getNoteBody(sessionNoteKey)}
            onChange={(e) => {
              setNoteBody(sessionNoteKey, e.target.value);
              sessionCodexGlow.bump();
            }}
            placeholder="Что произошло на столе, крючки на следующий раз…"
          />
          <button
            type="button"
            className="zernix-btn-primary zernix-btn-primary--block zernix-mt-sm zernix-btn-press"
            onClick={() => {
              setNoteBody(sessionNoteKey, getNoteBody(sessionNoteKey));
              console.debug("[ZERNIX] save session:last notes");
              showToast("Saved!");
              sessionCodexGlow.bump();
            }}
          >
            Сохранить заметку
          </button>
        </div>

        <div className="zernix-codex__actions">
          <button
            type="button"
            className="zernix-btn-secondary zernix-btn-secondary--block"
            onClick={() => toggleSessionFavorite(sessionTitle, sessionPreview?.excerpt)}
          >
            {isFavorite("session", sessionRef) ? "Убрать сводку из избранного" : "Закрепить сводку"}
          </button>
        </div>
      </div>
    );
  }

  if (view === "conditions") {
    const library: Record<string, { title: string; body: string }> = {
      frightened: {
        title: "Испуг",
        body: "Помеха на проверки и спасброски, пока источник страха в пределах видимости; не можете добровольно приблизиться к нему.",
      },
      restrained: {
        title: "Схвачен",
        body: "Скорость 0; помеха на спасброски Ловкости; атаки по вам имеют преимущество; ваши атаки имеют помеху.",
      },
      charm: {
        title: "Очарован",
        body: "Не можете атаковать очаровавшее существо и делаете для него всё, что признаёте безопасным.",
      },
    };
    const entry = library[conditionKey] ?? library.frightened;

    return (
      <div className="zernix-codex">
        <SpellCard
          badge="Справочник · состояние"
          name={entry.title}
          subtitle="D&D 5.5"
          body={entry.body}
          Icon={Sword}
        />
      </div>
    );
  }

  if (view === "history" || view === "favorites") {
    const noteCount = recentNotes(20).length;
    const favCount = favorites.length;
    return (
      <div className="zernix-codex">
        <header className="zernix-codex__header">
          <div>
            <div className="zernix-codex__badge">{view === "history" ? "Хроника" : "Избранное"}</div>
            <h2 className="zernix-codex__title">{view === "history" ? "Журнал" : "Закреплено"}</h2>
          </div>
        </header>
        <div className="zernix-codex__parchment">
          <p className="zernix-codex__prose">
            {view === "history"
              ? `Сохранённых заметок: ${noteCount}. Откройте «История» слева и нажмите строку, чтобы перейти к источнику.`
              : `Закреплено объектов: ${favCount}. Управляйте списком в основной колонке.`}
          </p>
        </div>
      </div>
    );
  }

  if (view === "home") {
    const deskKey = "home:desk";
    return (
      <div className="zernix-codex">
        <header className="zernix-codex__header">
          <div>
            <div className="zernix-codex__badge">Стартовая панель</div>
            <h2 className="zernix-codex__title">ZERNIX MVP</h2>
            <p className="zernix-codex__subtitle">Учебный режим без демо-заклинаний в журнале</p>
          </div>
          <Sparkles className="zernix-codex__icon" strokeWidth={1.25} aria-hidden />
        </header>

        <div className="zernix-codex__parchment">
          <p className="zernix-codex__prose">
            История заметок и генераций берётся только из <strong>localStorage</strong> — без зашитых демо-строк.
          </p>
          <ul className="zernix-home-codex-tips">
            <li>Запустите «Новая сессия» на главной — тогда генераторы добавят строки в ленту.</li>
            <li>
              Кнопки <strong>Settings</strong> и аватар в шапке открывают рабочие модалки (настройки и профиль).
            </li>
          </ul>
        </div>

        <div className={`zernix-codex__parchment${homeDeskGlow.glow ? " is-save-glow" : ""}`}>
          <div className="zernix-field-label">Заметки сессии (рабочий стол)</div>
          <textarea
            className="zernix-input zernix-textarea"
            rows={5}
            value={getNoteBody(deskKey)}
            onChange={(e) => {
              setNoteBody(deskKey, e.target.value);
              homeDeskGlow.bump();
            }}
            placeholder="Мини-лог стола: таймеры, напоминания…"
          />
          <button
            type="button"
            className="zernix-btn-primary zernix-btn-primary--block zernix-mt-sm zernix-btn-press"
            onClick={() => {
              setNoteBody(deskKey, getNoteBody(deskKey));
              console.debug("[ZERNIX] save home:desk");
              showToast("Saved!");
              homeDeskGlow.bump();
            }}
          >
            Сохранить
          </button>
        </div>

        <div className="zernix-codex__actions">
          {onClose ? (
            <button type="button" className="zernix-close" aria-label="Закрыть панель" onClick={onClose}>
              <X size={18} strokeWidth={2} />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="zernix-codex">
      <header className="zernix-codex__header">
        <div>
          <div className="zernix-codex__badge">ZERNIX</div>
          <h2 className="zernix-codex__title">Панель</h2>
        </div>
      </header>
      <p className="zernix-codex__prose">Неизвестный экран превью.</p>
    </div>
  );
}
