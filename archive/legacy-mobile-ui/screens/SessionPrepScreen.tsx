import { BookOpen, ClipboardCopy, Footprints, Loader2, PackageOpen, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppContentJson } from "../../types/content";
import {
  defaultSessionPrepFallback,
  formatNpcsForPaste,
  generateWholesaleLootText,
  selectNpcsForEnvironment,
} from "../../lib/sessionPrepLogic";
import {
  advanceDungeonRun,
  createInitialDungeonRun,
  dungeonRunToSessionPayload,
  type DungeonRunState,
} from "../../lib/dungeonSessionMemory";
import { SESSION_BIOME_OPTIONS } from "../../lib/sessionBiomeOptions";
import { DungeonCard } from "../DungeonCard";
import { GoldButton } from "../GoldButton";
import { HeaderBar } from "../HeaderBar";
import { PageFade } from "../PageFade";
import { SelectField } from "../SelectField";
import { ZernixMarkdownBody } from "../ZernixMarkdownBody";

interface SessionPrepScreenProps {
  data: AppContentJson;
  onBack: () => void;
}

/** Соответствует нормализации в encounterXpBudget / buildEncounter (данные XP из SQLite). */
type SessionPrepDifficulty = "easy" | "medium" | "hard" | "deadly";

const SESSION_DIFFICULTY_OPTIONS: ReadonlyArray<{ id: SessionPrepDifficulty; label: string }> = [
  { id: "easy", label: "Easy · Лёгкая" },
  { id: "medium", label: "Medium · Средняя" },
  { id: "hard", label: "Hard · Тяжёлая" },
  { id: "deadly", label: "Deadly · Смертельная" },
];

function defaultSessionDifficulty(partyLevel: number): SessionPrepDifficulty {
  const lv = Math.min(20, Math.max(1, Math.floor(partyLevel)));
  if (lv <= 4) return "easy";
  if (lv <= 10) return "medium";
  if (lv <= 16) return "hard";
  return "deadly";
}

export function SessionPrepScreen({ data, onBack }: SessionPrepScreenProps) {
  const wholesaleConfig = data.sessionPrep?.wholesaleLoot ?? defaultSessionPrepFallback.wholesaleLoot;
  const hints = data.sessionPrep?.environmentHints ?? defaultSessionPrepFallback.environmentHints;

  const rarityLabels = useMemo(() => {
    const entries = Object.entries(data.loot.rarities).map(([k, v]) => [k, v.labelRu] as const);
    return Object.fromEntries(entries) as Record<string, string>;
  }, [data.loot.rarities]);

  const raceLabels = useMemo(() => {
    return Object.fromEntries(data.npc.races.map((r) => [r.value, r.labelRu]));
  }, [data.npc.races]);

  const hasElectron = typeof window !== "undefined" && Boolean(window.electronAPI);

  const [partyLevel, setPartyLevel] = useState(5);
  const [playerCount, setPlayerCount] = useState(4);
  const [difficulty, setDifficulty] = useState<SessionPrepDifficulty>(() => defaultSessionDifficulty(5));
  const [chests, setChests] = useState(3);
  const [packs, setPacks] = useState(2);
  const [environmentKey, setEnvironmentKey] = useState("any");
  const [environment, setEnvironment] = useState("");
  const [onlyMagicSql, setOnlyMagicSql] = useState(false);

  const [lootText, setLootText] = useState("");
  const [sessionMarkdown, setSessionMarkdown] = useState<string | null>(null);
  const [npcText, setNpcText] = useState("");
  const [busy, setBusy] = useState(false);
  const [copyOk, setCopyOk] = useState(false);
  const [dungeonRun, setDungeonRun] = useState<DungeonRunState>(() => createInitialDungeonRun());

  const partyLevelOptions = useMemo(() => Array.from({ length: 20 }, (_, i) => i + 1), []);

  useEffect(() => {
    setDifficulty(defaultSessionDifficulty(partyLevel));
  }, [partyLevel]);

  const summary = useMemo(() => {
    const parts = [lootText.trim(), npcText.trim()].filter(Boolean);
    return parts.join("\n\n").trim();
  }, [lootText, npcText]);

  const fullCopyPayload = useMemo(() => {
    const md = sessionMarkdown?.trim() ?? "";
    const tail = summary;
    if (md && tail) return `${md}\n\n---\n\n${tail}`;
    return md || tail;
  }, [sessionMarkdown, summary]);

  const runSessionFromSqlite = useCallback(
    async (runOverride?: DungeonRunState) => {
      if (!window.electronAPI?.generateSessionPrep) return;
      const run = runOverride ?? dungeonRun;
      setBusy(true);
      setCopyOk(false);
      try {
        const res = await window.electronAPI.generateSessionPrep({
          partyLevel,
          playerCount,
          difficulty,
          packCount: clampInt(packs, 0, 48),
          chestCount: clampInt(chests, 0, 48),
          environmentText: environment,
          environmentKey,
          onlyMagic: onlyMagicSql,
          dungeonSession: dungeonRunToSessionPayload(run),
        });
        if (res.ok) {
          setSessionMarkdown(res.markdown);
          setLootText("");
          setDungeonRun({
            ...run,
            traceFromLastRoom: res.meta ? res.meta.primaryEncounterTrace || null : run.traceFromLastRoom,
            transitionMarkdown: null,
            pendingScoutAlarmBias: res.meta
              ? Number(res.meta.scoutAlarmNextRoomXpBonus) || 0
              : run.pendingScoutAlarmBias,
          });
        } else {
          setSessionMarkdown(`_Ошибка:_ ${res.error}`);
        }
      } catch (e) {
        setSessionMarkdown(`_Ошибка:_ ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setBusy(false);
      }
    },
    [partyLevel, playerCount, difficulty, packs, chests, environment, environmentKey, onlyMagicSql, dungeonRun],
  );

  const handleNextRoom = useCallback(() => {
    if (!window.electronAPI?.generateSessionPrep) return;
    setDungeonRun((prev) => {
      const next = advanceDungeonRun(prev);
      queueMicrotask(() => {
        void runSessionFromSqlite(next);
      });
      return next;
    });
  }, [runSessionFromSqlite]);

  const resetNewDungeon = useCallback(() => {
    setDungeonRun(createInitialDungeonRun());
    setSessionMarkdown(null);
    setCopyOk(false);
  }, []);

  const runLootGenJson = useCallback(() => {
    setBusy(true);
    setCopyOk(false);
    const chestCount = clampInt(chests, 0, 48);
    const packCount = clampInt(packs, 0, 48);
    const text = generateWholesaleLootText(
      data.loot.catalog,
      chestCount,
      packCount,
      wholesaleConfig,
      rarityLabels,
    );
    queueMicrotask(() => {
      setLootText(text);
      setSessionMarkdown(null);
      setBusy(false);
    });
  }, [chests, packs, data.loot.catalog, rarityLabels, wholesaleConfig]);

  const runNpcGen = useCallback(() => {
    setBusy(true);
    setCopyOk(false);
    const desc = environment.trim();
    const picked = selectNpcsForEnvironment(
      data.npc.templates,
      raceLabels,
      desc,
      hints,
      3,
      environmentKey,
    );
    const text = formatNpcsForPaste(picked);
    queueMicrotask(() => {
      setNpcText(
        desc || environmentKey !== "any"
          ? text
          : "Выберите биом (не «Любое») или введите минимум 2 символа в доп. тексте.",
      );
      setBusy(false);
    });
  }, [environment, environmentKey, data.npc.templates, raceLabels, hints]);

  const copyAll = async () => {
    const payload = fullCopyPayload || summary;
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload);
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 2000);
    } catch {
      setCopyOk(false);
    }
  };

  const lootDisabledJson = clampInt(chests, 0, 999) <= 0 && clampInt(packs, 0, 999) <= 0;
  const npcDisabled = environmentKey === "any" && environment.trim().length < 2;
  const sqlDisabled = clampInt(packs, 0, 999) <= 0 && clampInt(chests, 0, 999) <= 0;

  return (
    <PageFade>
      <HeaderBar
        onBack={onBack}
        title="ZERNIX Dungeon Assistant"
        subtitle="Подготовка сессии · отряды, сундуки и NPC"
      />

      <div className="flex flex-col gap-8 pb-28 lg:flex-row lg:items-start lg:gap-10 lg:pb-12 xl:gap-12">
        <div className="flex min-w-0 flex-1 flex-col gap-6 lg:max-w-[520px]">
          <DungeonCard glow className="border-gold/30 p-5 shadow-goldGlow lg:p-6">
            <div className="mb-4 flex items-center gap-3 border-b border-gold/15 pb-4">
              <span className="flex size-12 items-center justify-center rounded-xl border border-gold/30 bg-black/35 text-gold lg:size-14">
                <PackageOpen className="size-6 lg:size-7" strokeWidth={1.35} aria-hidden />
              </span>
              <div>
                <h2 className="font-serif text-lg text-gold lg:text-xl">
                  {hasElectron ? "Отряды и сундуки (SRD SQLite)" : "Оптовый лут (демо JSON)"}
                </h2>
                <p className="text-sm text-zinc-500">
                  {hasElectron
                    ? "Локация в списке задаёт биом для SQLite (монстры и тематический лут). Текст ниже — дополнительные подстроки-фильтры. Каждый сундук — отдельная сокровищница по CR отряда."
                    : "В браузере — упрощённый лут из JSON. Откройте Electron для полной логики."}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Уровень группы"
                value={String(partyLevel)}
                onChange={(e) => setPartyLevel(Number(e.target.value))}
              >
                {partyLevelOptions.map((lv) => (
                  <option key={lv} value={lv}>
                    {lv}
                  </option>
                ))}
              </SelectField>
              <label className="flex flex-col gap-2 text-sm text-zinc-300">
                <span>Число игроков</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={playerCount}
                  onChange={(e) => setPlayerCount(Math.min(12, Math.max(1, Number(e.target.value) || 4)))}
                  className="rounded-xl border border-gold/25 bg-black/35 px-4 py-3 text-[15px] text-zinc-100 outline-none focus:border-gold/50 focus:shadow-goldGlow"
                />
              </label>
              <SelectField
                label="Сложность встречи"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as SessionPrepDifficulty)}
              >
                {SESSION_DIFFICULTY_OPTIONS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Локация (SQL: monsters + лут)"
                value={environmentKey}
                onChange={(e) => setEnvironmentKey(e.target.value)}
              >
                {SESSION_BIOME_OPTIONS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </SelectField>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <NumberField label="Число сундуков" value={chests} onChange={setChests} max={48} />
              <NumberField label="Групп монстров (отрядов)" value={packs} onChange={setPacks} max={48} />
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-gold/20 bg-black/35 px-4 py-3 text-sm">
              <input
                type="checkbox"
                className="size-5 accent-gold"
                checked={onlyMagicSql}
                onChange={(e) => setOnlyMagicSql(e.target.checked)}
                disabled={!hasElectron}
              />
              <span className="font-medium text-zinc-200">
                Только магия не-Common (SQL){" "}
                {!hasElectron ? (
                  <span className="text-[11px] font-normal text-zinc-500">— только в Electron</span>
                ) : null}
              </span>
            </label>

            {hasElectron ? (
              <GoldButton
                variant="gold"
                className="mt-6"
                disabled={busy || sqlDisabled}
                onClick={() => void runSessionFromSqlite()}
                icon={busy ? <Loader2 className="size-5 animate-spin lg:size-6" /> : undefined}
              >
                Собрать отряды и лут (SRD)
              </GoldButton>
            ) : null}

            {!hasElectron ? (
              <GoldButton
                variant="gold"
                className="mt-6"
                disabled={lootDisabledJson || busy}
                onClick={runLootGenJson}
                icon={busy ? <Loader2 className="size-5 animate-spin lg:size-6" /> : undefined}
              >
                Собрать лут данжа (демо)
              </GoldButton>
            ) : (
              <GoldButton variant="outline" className="mt-3" disabled={lootDisabledJson || busy} onClick={runLootGenJson}>
                Демо: случайный лут из JSON
              </GoldButton>
            )}
          </DungeonCard>

          <DungeonCard className="border-gold/25 p-5 shadow-innerGold lg:p-6">
            <div className="mb-4 flex items-center gap-3 border-b border-gold/15 pb-4">
              <span className="flex size-12 items-center justify-center rounded-xl border border-gold/30 bg-black/35 text-gold lg:size-14">
                <BookOpen className="size-6 lg:size-7" strokeWidth={1.35} aria-hidden />
              </span>
              <div>
                <h2 className="font-serif text-lg text-gold lg:text-xl">NPC по контексту</h2>
                <p className="text-sm text-zinc-500">
                  Биом из списка слева; доп. текст — ключевые слова. Несовместимые с биомом теги NPC отфильтровываются.
                </p>
              </div>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-zinc-300">
                Доп. текст окружения (ключевые слова, опционально)
              </span>
              <textarea
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                placeholder="Например: водопад, засада у дороги, заброшенная библиотека"
                rows={5}
                className="rounded-xl border border-gold/25 bg-abyss-elevated px-4 py-3 text-[15px] text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-gold/50 focus:shadow-goldGlow lg:text-base"
              />
            </label>

            <GoldButton variant="outline" className="mt-4" disabled={npcDisabled || busy} onClick={runNpcGen}>
              Создать жителей
            </GoldButton>
          </DungeonCard>
        </div>

        <DungeonCard className="min-h-[260px] flex-1 border-gold/30 p-5 shadow-[0_0_18px_rgba(212,175,55,0.12)] lg:sticky lg:top-28 lg:min-w-[280px] lg:max-w-[560px] lg:self-start xl:top-32">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gold/15 pb-4">
            <h3 className="font-serif text-lg text-gold">Итоговая сводка</h3>
            <GoldButton
              variant="outline"
              className="!w-auto shrink-0 px-4 py-2.5 text-sm"
              type="button"
              disabled={!fullCopyPayload && !summary}
              onClick={() => void copyAll()}
              icon={<ClipboardCopy className="size-4 lg:size-[18px]" aria-hidden />}
            >
              {copyOk ? "Скопировано" : "Копировать всё"}
            </GoldButton>
          </div>

          <div className="max-h-[min(72vh,620px)] space-y-4 overflow-y-auto">
            {sessionMarkdown ? (
              <div className="rounded-lg border border-gold/15 bg-black/45 p-4 shadow-inner">
                <ZernixMarkdownBody markdown={sessionMarkdown} />
                {hasElectron ? (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-gold/10 pt-4">
                    <GoldButton
                      type="button"
                      variant="outline"
                      className="!w-auto shrink-0 gap-2 px-3 py-2 text-sm"
                      disabled={busy || !sessionMarkdown}
                      onClick={() => handleNextRoom()}
                      icon={<Footprints className="size-4" aria-hidden />}
                    >
                      Продолжить путь (Next Room)
                    </GoldButton>
                    <GoldButton
                      type="button"
                      variant="outline"
                      className="!w-auto shrink-0 gap-2 px-3 py-2 text-sm"
                      disabled={
                        busy ||
                        (!sessionMarkdown &&
                          dungeonRun.floorDepth === 0 &&
                          dungeonRun.persistentTags.length === 0 &&
                          !dungeonRun.traceFromLastRoom)
                      }
                      onClick={() => resetNewDungeon()}
                      icon={<RotateCcw className="size-4" aria-hidden />}
                    >
                      Новое подземелье
                    </GoldButton>
                  </div>
                ) : null}
              </div>
            ) : null}
            {lootText ? (
              <pre className="whitespace-pre-wrap rounded-lg border border-gold/15 bg-black/45 p-4 font-sans text-sm leading-relaxed text-zinc-300 lg:text-[15px]">
                {lootText}
              </pre>
            ) : null}
            {npcText ? (
              <pre className="whitespace-pre-wrap rounded-lg border border-gold/15 bg-black/35 p-4 font-sans text-sm leading-relaxed text-zinc-300 lg:text-[15px]">
                {npcText}
              </pre>
            ) : null}
            {!sessionMarkdown && !lootText && !npcText ? (
              <p className="text-sm text-zinc-500">
                Сгенерируйте блок из SRD или демо JSON, добавьте NPC — результат появится здесь.
              </p>
            ) : null}
          </div>
        </DungeonCard>
      </div>
    </PageFade>
  );
}

function clampInt(raw: number, min: number, max: number): number {
  if (Number.isNaN(raw)) return min;
  return Math.min(max, Math.max(min, Math.floor(raw)));
}

function NumberField({
  label,
  value,
  onChange,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  max: number;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm text-zinc-300">
      <span>{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-xl border border-gold/25 bg-black/35 px-4 py-3 text-[15px] text-zinc-100 outline-none focus:border-gold/50 focus:shadow-goldGlow"
      />
    </label>
  );
}
