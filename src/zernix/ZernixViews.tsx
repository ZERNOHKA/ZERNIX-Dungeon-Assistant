import {
  BookOpen,
  ChevronRight,
  Flame,
  Map,
  Package,
  ScrollText,
  Shield,
  Skull,
  Sparkles,
  UserCircle,
  Users,
  Wind,
} from "lucide-react";

import { useAppContent } from "../hooks/useAppContent";
import type { ZernixViewId } from "./types";
import { LootCard } from "./components/LootCard";
import { useZernixGenerators } from "./ZernixGeneratorsContext";
import type { NpcPreviewState } from "./models";

const PARTY = [
  { name: "Астра", sub: "Чародей · Эльф", cur: 38, max: 45 },
  { name: "Брок", sub: "Варвар · Дварф", cur: 52, max: 58 },
  { name: "Кейд", sub: "Плут · Человек", cur: 27, max: 40 },
  { name: "Мира", sub: "Жрец · Полуэльф", cur: 31, max: 33 },
] as const;

const NOTES = [
  { title: "Логово чёрного дракона", time: "Вчера · 21:14", Icon: Flame },
  { title: "Осада Кремневого форта", time: "Пн · 19:02", Icon: Shield },
  { title: "Рынок Призрачной воды", time: "Сб · 16:40", Icon: Map },
] as const;

const FAVORITES = ["Огненный шар", "Зелье лечения", "Длинный меч +1"] as const;

const QUICK = [
  { id: "loot" as const, label: "Loot Generator", Icon: Package },
  { id: "npc" as const, label: "Create NPC", Icon: Users },
  { id: "prep" as const, label: "Session Prep", Icon: ScrollText },
  { id: "conditions" as const, label: "Conditions", Icon: BookOpen },
] as const;

type HomeProps = {
  onNavigate: (v: ZernixViewId) => void;
};

export function HomeDashboard({ onNavigate }: HomeProps) {
  return (
    <>
      <section className="zernix-quick-grid" aria-label="Быстрый старт">
        {QUICK.map(({ id, label, Icon }) => (
          <div key={id} className="zernix-premium-panel zernix-quick-cell">
            <button type="button" className="zernix-quick-tile" onClick={() => onNavigate(id)}>
              <Icon className="zernix-quick-icon" strokeWidth={1.15} />
              <div className="zernix-quick-label">{label}</div>
            </button>
          </div>
        ))}
      </section>

      <div className="zernix-dashboard-row">
        <div className="zernix-premium-panel zernix-panel-pad">
          <div className="zernix-panel-heading">Проклятые Реликвии</div>
          <div className="zernix-meta-tags">
            <span className="zernix-tag">Уровень 5</span>
            <span className="zernix-tag">Средняя сложность</span>
            <span className="zernix-tag">4 игрока</span>
          </div>
          {PARTY.map((p) => (
            <div key={p.name} className="zernix-char-row">
              <div className="zernix-char-portrait" aria-hidden />
              <div>
                <div className="zernix-char-name">{p.name}</div>
                <div className="zernix-char-sub">{p.sub}</div>
              </div>
              <div>
                <div className="zernix-hp-track">
                  <div className="zernix-hp-fill" style={{ width: `${Math.round((p.cur / p.max) * 100)}%` }} />
                </div>
                <div className="zernix-hp-label">
                  {p.cur}/{p.max}
                </div>
              </div>
            </div>
          ))}
          <button type="button" className="zernix-btn-primary zernix-btn-primary--block zernix-mt-lg" onClick={() => onNavigate("prep")}>
            Открыть подготовку сессии
          </button>
        </div>

        <div className="zernix-stack">
          <div className="zernix-premium-panel zernix-panel-pad zernix-fade-in">
            <div className="zernix-list-title">Недавние заметки</div>
            {NOTES.map(({ title, time, Icon }) => (
              <div key={title} className="zernix-list-item zernix-list-item--rich">
                <Icon className="zernix-list-icon" strokeWidth={1.2} aria-hidden />
                <div className="zernix-list-text">
                  <div>{title}</div>
                  <div className="zernix-list-meta">{time}</div>
                </div>
                <ChevronRight className="zernix-list-chevron" strokeWidth={1.25} aria-hidden />
              </div>
            ))}
          </div>

          <div className="zernix-premium-panel zernix-panel-pad zernix-fade-in">
            <div className="zernix-list-title">Избранное</div>
            {FAVORITES.map((t) => (
              <div key={t} className="zernix-list-item">
                <span className="zernix-list-dot" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export function LootGeneratorView() {
  const { data: content } = useAppContent();
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
  } = useZernixGenerators();

  const types = content?.loot.types ?? [];

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
        onClick={() => void generateLoot()}
      >
        {lootBusy ? "Генерация…" : "Сгенерировать добычу"}
      </button>

      <div className="zernix-section-head">
        <span>Сгенерированная добыча</span>
        <div className="zernix-gold-rule" />
      </div>

      <div className="zernix-loot-grid">
        {lootCards.length === 0 ? (
          <div className="zernix-premium-panel zernix-panel-pad" style={{ gridColumn: "1 / -1" }}>
            <p className="zernix-codex__prose" style={{ margin: 0 }}>
              Запустите генерацию — карточки появятся здесь и в кодексе справа.
            </p>
          </div>
        ) : (
          lootCards.map((card) => (
            <LootCard
              key={card.id}
              card={card}
              selected={selectedLootId === card.id}
              onSelect={() => setSelectedLootId(card.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function NpcCreatorView() {
  const { data: content } = useAppContent();
  const { npc, setNpc, npcForm, setNpcForm, npcBusy, npcError, generateNpc } = useZernixGenerators();

  const patch = (partial: Partial<NpcPreviewState>) => setNpc({ ...npc, ...partial });

  const npcBlock = content?.npc;

  return (
    <div className="zernix-page">
      <div className="zernix-npc-form">
        <div className="zernix-premium-panel zernix-panel-pad">
          <div className="zernix-panel-heading">Параметры генерации</div>
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
              <span className="zernix-field-label">Занятие</span>
              <select
                className="zernix-input zernix-select"
                value={npcForm.occupationValue}
                onChange={(e) => setNpcForm({ occupationValue: e.target.value })}
                disabled={!npcBlock}
              >
                {(npcBlock?.occupations ?? []).map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.labelRu}
                  </option>
                ))}
              </select>
            </label>
            <label className="zernix-field">
              <span className="zernix-field-label">Роль</span>
              <select
                className="zernix-input zernix-select"
                value={npcForm.role}
                onChange={(e) => setNpcForm({ role: e.target.value })}
                disabled={!npcBlock}
              >
                {(npcBlock?.roles ?? []).map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.labelRu}
                  </option>
                ))}
              </select>
            </label>
            <label className="zernix-field">
              <span className="zernix-field-label">Пол</span>
              <select
                className="zernix-input zernix-select"
                value={npcForm.genderId}
                onChange={(e) => setNpcForm({ genderId: e.target.value })}
                disabled={!npcBlock}
              >
                {(npcBlock?.genderSegment ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.labelRu}
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
            onClick={() => void generateNpc()}
          >
            {npcBusy ? "Генерация…" : "Сгенерировать NPC"}
          </button>
        </div>

        <div className="zernix-premium-panel zernix-panel-pad">
          <div className="zernix-panel-heading">Идентичность</div>
          <div className="zernix-form-grid zernix-form-grid--2">
            <label className="zernix-field">
              <span className="zernix-field-label">Имя</span>
              <input className="zernix-input" value={npc.name} onChange={(e) => patch({ name: e.target.value })} />
            </label>
            <label className="zernix-field">
              <span className="zernix-field-label">Портрет (буква)</span>
              <input
                className="zernix-input"
                maxLength={2}
                value={npc.portraitLetter}
                onChange={(e) => patch({ portraitLetter: e.target.value.slice(0, 2).toUpperCase() })}
              />
            </label>
            <label className="zernix-field">
              <span className="zernix-field-label">Раса</span>
              <input className="zernix-input" value={npc.race} onChange={(e) => patch({ race: e.target.value })} />
            </label>
            <label className="zernix-field">
              <span className="zernix-field-label">Класс / роль</span>
              <input
                className="zernix-input"
                value={npc.creatureClass}
                onChange={(e) => patch({ creatureClass: e.target.value })}
              />
            </label>
          </div>
        </div>

        <div className="zernix-premium-panel zernix-panel-pad">
          <div className="zernix-panel-heading">Характеристики</div>
          <div className="zernix-abilities">
            {(
              [
                ["str", "СИЛ"],
                ["dex", "ЛВК"],
                ["con", "ТЕЛ"],
                ["int", "ИНТ"],
                ["wis", "МДР"],
                ["cha", "ХАР"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="zernix-ability">
                <span className="zernix-ability__label">{label}</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  className="zernix-input zernix-input--center"
                  value={npc[key]}
                  onChange={(e) => patch({ [key]: Number(e.target.value) } as Partial<NpcPreviewState>)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="zernix-premium-panel zernix-panel-pad">
          <div className="zernix-panel-heading">Стол — заметки</div>
          <label className="zernix-field">
            <span className="zernix-field-label">Визуально</span>
            <textarea
              className="zernix-input zernix-textarea"
              rows={2}
              value={npc.visualTrait}
              onChange={(e) => patch({ visualTrait: e.target.value })}
            />
          </label>
          <label className="zernix-field">
            <span className="zernix-field-label">Хочет</span>
            <textarea
              className="zernix-input zernix-textarea"
              rows={2}
              value={npc.wantLine}
              onChange={(e) => patch({ wantLine: e.target.value })}
            />
          </label>
          <label className="zernix-field">
            <span className="zernix-field-label">Избегает</span>
            <textarea
              className="zernix-input zernix-textarea"
              rows={2}
              value={npc.avoidLine}
              onChange={(e) => patch({ avoidLine: e.target.value })}
            />
          </label>
          <label className="zernix-field">
            <span className="zernix-field-label">Тайна</span>
            <textarea
              className="zernix-input zernix-textarea"
              rows={3}
              value={npc.secretLine}
              onChange={(e) => patch({ secretLine: e.target.value })}
            />
          </label>
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
  } = useZernixGenerators();

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
            <span className="zernix-field-label">Описание для генератора</span>
            <textarea
              className="zernix-input zernix-textarea"
              rows={5}
              value={sessionForm.environmentText}
              onChange={(e) => setSessionForm({ environmentText: e.target.value })}
              placeholder="Атмосфера, ключевые NPC, угрозы, линии сюжета…"
            />
          </label>
        </div>

        <div className="zernix-premium-panel zernix-panel-pad">
          <div className="zernix-panel-heading">Сводка сессии</div>
          <label className="zernix-field">
            <span className="zernix-field-label">Текст (редактируется после генерации)</span>
            <textarea
              className="zernix-input zernix-textarea"
              rows={8}
              value={prepSummary}
              onChange={(e) => setPrepSummary(e.target.value)}
            />
          </label>
          {sessionError ? (
            <p className="zernix-codex__prose" style={{ color: "#fca5a5", marginTop: 8 }}>
              {sessionError}
            </p>
          ) : null}
          <button
            type="button"
            className="zernix-btn-primary zernix-btn-primary--block zernix-mt-lg"
            disabled={sessionBusy}
            onClick={() => void generateSession()}
          >
            {sessionBusy ? "Генерация…" : "Сгенерировать подготовку"}
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

export function HistoryView() {
  return (
    <div className="zernix-page">
      <div className="zernix-premium-panel zernix-panel-pad">
        <div className="zernix-timeline">
          {NOTES.map(({ title, time }) => (
            <div key={title} className="zernix-timeline__item">
              <span className="zernix-timeline__dot" />
              <div>
                <div className="zernix-timeline__title">{title}</div>
                <div className="zernix-timeline__meta">{time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FavoritesView() {
  return (
    <div className="zernix-page">
      <div className="zernix-premium-panel zernix-panel-pad">
        <div className="zernix-fav-grid">
          {FAVORITES.map((t) => (
            <div key={t} className="zernix-fav-chip">
              <UserCircle className="zernix-fav-chip__icon" strokeWidth={1.15} aria-hidden />
              <span>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SettingsView() {
  return (
    <div className="zernix-page">
      <div className="zernix-premium-panel zernix-panel-pad">
        <div className="zernix-panel-heading">Интерфейс</div>
        <label className="zernix-field">
          <span className="zernix-field-label">Плотность списков</span>
          <select className="zernix-input zernix-select" defaultValue="comfortable">
            <option value="comfortable">Комфортная</option>
            <option value="compact">Компактная</option>
          </select>
        </label>
        <label className="zernix-field">
          <span className="zernix-field-label">Язык справочников</span>
          <select className="zernix-input zernix-select" defaultValue="ru">
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>
    </div>
  );
}
