import { Flame, Sparkles, Sword, X } from "lucide-react";
import { useMemo } from "react";

import type { ZernixViewId } from "./types";
import { SessionBriefPanel } from "./components/SessionBriefPanel";
import { useZernixGenerators } from "./ZernixGeneratorsContext";
import { SpellCard } from "./components/SpellCard";

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

  const selectedLoot = useMemo(
    () => lootCards.find((c) => c.id === selectedLootId) ?? null,
    [lootCards, selectedLootId],
  );

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
            Параметры сети и каталогов настраиваются в полной сборке клиента.
          </p>
        </div>
      </div>
    );
  }

  if (view === "loot") {
    const primary = selectedLoot ?? lootCards[0];
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
              <p className="zernix-codex__subtitle">Запустите генерацию</p>
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
            <p className="zernix-codex__prose">{primary.description}</p>
          </div>
        ) : null}

        {lootNarrativeBlock ? (
          <div className="zernix-codex-scroll" style={{ maxHeight: 160, marginTop: 12 }}>
            <div className="zernix-codex__parchment">
              <div className="zernix-field-label">Контекст</div>
              <p className="zernix-codex__prose" style={{ whiteSpace: "pre-wrap" }}>
                {lootNarrativeBlock}
              </p>
            </div>
          </div>
        ) : null}

        <div className="zernix-codex__actions">
          <button type="button" className="zernix-btn-primary zernix-btn-primary--block">
            Сохранить в сессию
          </button>
          <button type="button" className="zernix-btn-secondary zernix-btn-secondary--block">
            Экспорт для Foundry
          </button>
        </div>
      </div>
    );
  }

  if (view === "npc") {
    return (
      <div className="zernix-codex zernix-codex--npc">
        <header className="zernix-codex__header zernix-codex__header--npc">
          <div className="zernix-npc-portrait" aria-hidden>
            {npc.portraitLetter}
          </div>
          <div>
            <div className="zernix-codex__badge">Персонаж</div>
            <h2 className="zernix-codex__title">{npc.name}</h2>
            <p className="zernix-codex__subtitle">
              {npc.race} · {npc.creatureClass}
            </p>
          </div>
        </header>

        <div className="zernix-codex__parchment">
          <div className="zernix-field-label">Визуально</div>
          <p className="zernix-codex__prose">{npc.visualTrait}</p>
          <div className="zernix-gold-rule" />
          <div className="zernix-field-label">Хочет</div>
          <p className="zernix-codex__prose">{npc.wantLine}</p>
          <div className="zernix-gold-rule" />
          <div className="zernix-field-label">Избегает</div>
          <p className="zernix-codex__prose">{npc.avoidLine}</p>
          <div className="zernix-gold-rule" />
          <div className="zernix-field-label">Тайна</div>
          <p className="zernix-codex__prose zernix-codex__prose--secret">{npc.secretLine}</p>
        </div>
      </div>
    );
  }

  if (view === "prep") {
    const bodyPlain = sessionMarkdown?.trim() ? sessionMarkdown : prepSummary;
    const titleLine = sessionPreview?.title ?? "Сводка подготовки";
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
          {sessionBrief ? (
            <SessionBriefPanel brief={sessionBrief} />
          ) : (
            <div className="zernix-codex__parchment">
              <p className="zernix-codex__prose" style={{ whiteSpace: "pre-wrap" }}>
                {bodyPlain}
              </p>
            </div>
          )}
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
              ? "История генераций появится здесь после сохранения сессий."
              : "Добавляйте объекты в избранное из результатов генерации."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="zernix-codex">
      <SpellCard
        badge="Заклинание · 3 уровень"
        name="Огненный шар"
        subtitle="Воплощение · PHB 2024 / SRD"
        body="Яркая полоса огня вырывается из ваших пальцев к точке по вашему выбору в пределах дистанции, где взрывается с оглушительным ревом. Существа в сфере радиусом 20 фт совершают спасбросок Ловкости, при провале получая урон огнём."
        Icon={Flame}
        metaLines={[
          { label: "Время накладывания", value: "1 действие" },
          { label: "Дистанция", value: "150 фт" },
          { label: "Компоненты", value: "В, S, M" },
          { label: "Длительность", value: "Мгновенная" },
        ]}
      />

      <div className="zernix-codex__actions">
        <button type="button" className="zernix-close" aria-label="Закрыть панель" onClick={onClose}>
          <X size={18} strokeWidth={2} />
        </button>
        <button type="button" className="zernix-btn-primary zernix-btn-primary--block">
          Бросить урон
        </button>
        <button type="button" className="zernix-btn-secondary zernix-btn-secondary--block">
          Добавить в заметки
        </button>
      </div>
    </div>
  );
}
