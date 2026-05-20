import { Dice5, Info, Loader2, Sparkle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LootItem } from "../../types/content";
import type { AppContentJson } from "../../types/content";
import type { EncounterThreat55 } from "../../lib/dnd55Threat";
import { defaultThreatForPartyLevel } from "../../lib/dnd55Threat";
import { dbCategoriesForLootTypes } from "../../lib/lootDbCategories";
import { SESSION_BIOME_OPTIONS } from "../../lib/sessionBiomeOptions";
import type { LootGenerateExtras } from "../../types/lootDigest";
import { GoldButton } from "../GoldButton";
import { HeaderBar } from "../HeaderBar";
import { IconByName } from "../IconByName";
import { PageFade } from "../PageFade";
import { SelectField } from "../SelectField";

export interface LootRollContext {
  /** Для строк в JSON-демо (уровень персонажей как число) */
  level: string;
  typeIds: string[];
  magicOnly: boolean;
  source: "json" | "sqlite";
  /** Electron: новый генератор встречи + лут */
  partyLevel?: number;
  playerCount?: number;
  difficulty?: EncounterThreat55;
  environment?: string;
  goldGp?: number;
  dbCategories?: string[];
  /** Отдельный hoard на каждый сундук */
  chestCount?: number;
}

interface LootPickerScreenProps {
  loot: AppContentJson["loot"];
  onBack: () => void;
  onGenerate: (item: LootItem, context: LootRollContext) => void;
  /** Electron: результат из SQLite (SRD). extras — narrativeBlock, lootDigest, needsRepair. */
  onGenerateMarkdown?: (
    markdown: string,
    context: LootRollContext,
    extras: LootGenerateExtras | null,
  ) => void;
  /**
   * Electron: держим в родителе актуальные CR / gp / категории с формы,
   * чтобы «Реролл» в панели результата совпадал с текущими ползунками.
   */
  onElectronLootContextSync?: (context: LootRollContext) => void;
}

/** SqliteLootScreen: значения совпадают с encounter-build / SQLite. */
const DIFFICULTY_OPTIONS: ReadonlyArray<{ id: EncounterThreat55; label: string }> = [
  { id: "low", label: "Easy · Лёгкая (low)" },
  { id: "moderate", label: "Medium · Средняя (moderate)" },
  { id: "high", label: "Hard · Тяжёлая (high)" },
  { id: "deadly", label: "Deadly · Смертельная (deadly)" },
];

export function LootPickerScreen({
  loot,
  onBack,
  onGenerate,
  onGenerateMarkdown,
  onElectronLootContextSync,
}: LootPickerScreenProps) {
  const typeIdsAll = useMemo(() => loot.types.map((t) => t.id), [loot.types]);
  const [partyLevel, setPartyLevel] = useState(5);
  const [playerCount, setPlayerCount] = useState(4);
  const [difficulty, setDifficulty] = useState<EncounterThreat55>(() => defaultThreatForPartyLevel(5));
  /** Пустое поле или 0 → Individual Treasure (без сундуков-сокровищниц) */
  const [chestInput, setChestInput] = useState("");
  const [environment, setEnvironment] = useState<string>("forest");
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>(() => [...typeIdsAll]);
  const [magicOnly, setMagicOnly] = useState(false);
  const [goldLimit, setGoldLimit] = useState(() => {
    // Level-aware default gold budget (Lv5, medium, 4 players → 260gp)
    return String(65 * 4);
  });
  const [ipcBusy, setIpcBusy] = useState(false);
  /** Ref-флаг: защита от двойного IPC-запроса до перерендера кнопки. */
  const ipcInFlightRef = useRef(false);

  const hasElectron = typeof window !== "undefined" && Boolean(window.electronAPI);

  const toggleType = useCallback(
    (id: string) => {
      setSelectedTypeIds((prev) => {
        if (prev.includes(id)) {
          return prev.filter((x) => x !== id);
        }
        return [...prev, id];
      });
    },
    [],
  );

  const selectAllTypes = useCallback(() => setSelectedTypeIds([...typeIdsAll]), [typeIdsAll]);
  const clearTypes = useCallback(() => setSelectedTypeIds([]), []);

  const pool = useMemo(() => {
    const ids =
      selectedTypeIds.length > 0 && selectedTypeIds.length < typeIdsAll.length
        ? new Set(selectedTypeIds)
        : null;
    return loot.catalog.filter((item) => {
      if (ids && !ids.has(item.typeId)) {
        return false;
      }
      return !magicOnly || item.magic;
    });
  }, [loot.catalog, magicOnly, selectedTypeIds, typeIdsAll.length]);

  const rollJson = useCallback(() => {
    if (selectedTypeIds.length === 0) {
      return;
    }
    const source = pool.length
      ? pool
      : loot.catalog.filter((i) => selectedTypeIds.includes(i.typeId));
    const fallback = loot.catalog.length ? loot.catalog : [];
    const list = source.length ? source : fallback;
    if (!list.length) {
      return;
    }
    const pick = list[Math.floor(Math.random() * list.length)];
    const typeIdsForCtx =
      selectedTypeIds.length > 0 && selectedTypeIds.length < typeIdsAll.length
        ? [...selectedTypeIds]
        : [...typeIdsAll];
    const context: LootRollContext = {
      level: String(partyLevel),
      typeIds: typeIdsForCtx,
      magicOnly,
      source: "json",
    };
    onGenerate(
      {
        ...pick,
        flavor: `[Уровень: ${partyLevel}] ${pick.flavor}`,
      },
      context,
    );
  }, [
    partyLevel,
    loot.catalog,
    magicOnly,
    onGenerate,
    pool,
    selectedTypeIds,
    typeIdsAll,
  ]);

  useEffect(() => {
    setDifficulty(defaultThreatForPartyLevel(partyLevel));
  }, [partyLevel]);

  /** Автоматически пересчитывает goldLimit при смене уровня / сложности / числа игроков. */
  useEffect(() => {
    const PER_PLAYER: Record<string, number[]> = {
      low:      [8,  10, 15, 20, 35, 50, 75, 100, 130, 160, 200, 260, 320, 400, 480, 580, 680, 800, 950, 1100],
      moderate: [12, 18, 28, 40, 65, 90, 140, 190, 260, 340, 420, 540, 680, 820, 980, 1200, 1450, 1700, 2050, 2450],
      high:     [20, 32, 50, 80, 130, 200, 300, 420, 560, 720, 900, 1200, 1600, 2000, 2600, 3200, 4000, 5000, 6500, 8000],
      deadly:   [30, 50, 80, 130, 200, 320, 500, 700, 940, 1200, 1500, 2100, 2900, 3600, 4600, 5800, 7200, 9000, 12000, 16000],
    };
    const lv = Math.max(1, Math.min(20, partyLevel));
    const cnt = Math.max(1, Math.min(8, playerCount));
    const budget = (PER_PLAYER[difficulty]?.[lv - 1] ?? 100) * cnt;
    setGoldLimit(String(budget));
  }, [partyLevel, difficulty, playerCount]);

  const rollSqlite = useCallback(async () => {
    if (!window.electronAPI || !onGenerateMarkdown) {
      return;
    }
    if (selectedTypeIds.length === 0) {
      return;
    }
    // Двойная защита от спама: ref срабатывает до перерендера кнопки
    if (ipcInFlightRef.current) return;
    ipcInFlightRef.current = true;

    const gold = Number(String(goldLimit).replace(",", "."));
    const categories = dbCategoriesForLootTypes(selectedTypeIds, typeIdsAll);
    const chestParsed =
      chestInput.trim() === ""
        ? 0
        : Math.max(0, Math.min(24, Math.floor(Number(chestInput.replace(",", ".")) || 0)));
    const sqliteCtxBase = {
      level: String(partyLevel),
      typeIds: [...selectedTypeIds],
      magicOnly,
      source: "sqlite" as const,
      partyLevel,
      playerCount,
      difficulty,
      environment,
      goldGp: Number.isFinite(gold) && gold > 0 ? gold : 0,
      dbCategories: categories,
      chestCount: chestParsed,
    };
    if (!Number.isFinite(gold) || gold <= 0) {
      ipcInFlightRef.current = false;
      onGenerateMarkdown(
        `_Ошибка:_ Укажите **положительный** лимит золота (gp) в поле «Лимит золота». Сейчас значение не распознано как число больше нуля.`,
        sqliteCtxBase,
        null,
      );
      return;
    }
    setIpcBusy(true);
    try {
      const result = await window.electronAPI.generateLoot({
        gold,
        categories,
        partyLevel,
        playerCount,
        difficulty,
        environment,
        onlyMagic: magicOnly,
        chestCount: chestParsed,
      });
      if (!result.ok) {
        onGenerateMarkdown(`_Ошибка:_ ${result.error}`, sqliteCtxBase, null);
        return;
      }
      onGenerateMarkdown(result.markdown, sqliteCtxBase, {
        narrativeBlock: result.narrativeBlock ?? null,
        lootDigest: result.lootDigest ?? null,
        needsRepair: Boolean(result.needsRepair),
      });
    } finally {
      ipcInFlightRef.current = false;
      setIpcBusy(false);
    }
  }, [
    chestInput,
    difficulty,
    environment,
    goldLimit,
    magicOnly,
    onGenerateMarkdown,
    partyLevel,
    playerCount,
    selectedTypeIds,
    typeIdsAll,
  ]);

  useEffect(() => {
    if (!hasElectron || !onElectronLootContextSync) return;
    if (selectedTypeIds.length === 0) return;
    const gold = Number(String(goldLimit).replace(",", "."));
    if (!Number.isFinite(gold) || gold <= 0) return;
    const typeIdsForCtx =
      selectedTypeIds.length > 0 && selectedTypeIds.length < typeIdsAll.length
        ? [...selectedTypeIds]
        : [...typeIdsAll];
    const categories = dbCategoriesForLootTypes(selectedTypeIds, typeIdsAll);
    const chestParsed =
      chestInput.trim() === ""
        ? 0
        : Math.max(0, Math.min(24, Math.floor(Number(chestInput.replace(",", ".")) || 0)));
    onElectronLootContextSync({
      level: String(partyLevel),
      typeIds: typeIdsForCtx,
      magicOnly,
      source: "sqlite",
      partyLevel,
      playerCount,
      difficulty,
      environment,
      goldGp: gold,
      dbCategories: categories,
      chestCount: chestParsed,
    });
  }, [
    chestInput,
    difficulty,
    environment,
    goldLimit,
    hasElectron,
    magicOnly,
    onElectronLootContextSync,
    partyLevel,
    playerCount,
    selectedTypeIds,
    typeIdsAll,
  ]);

  const roll = useCallback(() => {
    if (selectedTypeIds.length === 0) {
      return;
    }
    if (hasElectron && onGenerateMarkdown) {
      void rollSqlite();
      return;
    }
    rollJson();
  }, [hasElectron, onGenerateMarkdown, rollJson, rollSqlite, selectedTypeIds.length]);

  const busy = ipcBusy;

  const partyLevelOptions = useMemo(() => Array.from({ length: 20 }, (_, i) => i + 1), []);

  return (
    <PageFade>
      <HeaderBar
        onBack={onBack}
        title="ZERNIX Dungeon Assistant"
        subtitle="Генератор лута"
        trailing={
          <button
            type="button"
            className="flex size-11 shrink-0 items-center justify-center rounded-zernix border border-gold/35 text-gold shadow-innerGold transition hover:bg-gold/[0.06] lg:size-12"
            aria-label="Подсказка"
          >
            <Info className="size-5 lg:size-6" strokeWidth={1.45} aria-hidden />
          </button>
        }
      />

      <div className="flex flex-col gap-6 pb-28 lg:pb-10">
        <SelectField
          label="Уровень группы"
          value={String(partyLevel)}
          onChange={(event) => setPartyLevel(Number(event.target.value))}
        >
          {partyLevelOptions.map((lv) => (
            <option key={lv} value={lv}>
              {lv}
            </option>
          ))}
        </SelectField>

        {hasElectron ? (
          <div className="zernix-panel space-y-3 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">SRD SQLite · D&D 5.5 · только результат обыска</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-[11px] text-zinc-400">Число игроков</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={playerCount}
                  onChange={(e) => setPlayerCount(Math.min(12, Math.max(1, Number(e.target.value) || 4)))}
                  className="w-full rounded-lg border border-gold/25 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-gold/55"
                />
              </label>
              <SelectField
                label="Сложность (Easy / Medium / Hard / Deadly)"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as EncounterThreat55)}
              >
                {DIFFICULTY_OPTIONS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Локация (Cave / Forest / Dungeon / Urban)"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
              >
                {SESSION_BIOME_OPTIONS.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.label}
                  </option>
                ))}
              </SelectField>
            </div>
            <label className="block space-y-2">
              <span className="text-[11px] text-zinc-400">
                Число сундуков (0 или пусто — только карманное золото / Individual Treasure)
              </span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={chestInput}
                onChange={(e) => setChestInput(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
                className="w-full max-w-md rounded-lg border border-gold/25 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-gold/55"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-[11px] text-zinc-400">Лимит золота для доп. гибридного блока (gp)</span>
              <input
                type="text"
                inputMode="decimal"
                value={goldLimit}
                onChange={(e) => setGoldLimit(e.target.value)}
                className="w-full max-w-md rounded-lg border border-gold/25 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-gold/55"
              />
            </label>
            <p className="text-[11px] leading-snug text-zinc-500">
              Бюджет XP — DMG 2024 (Low / Moderate / High), без множителя за число монстров. CR для сокровищ считается в фоне;
              в отчёт попадают только золото и предметы.
            </p>
          </div>
        ) : (
          <p className="rounded-zernix border border-gold/18 bg-black/40 px-4 py-3 text-sm text-zinc-500 shadow-innerGold">
            Откройте приложение через <strong className="text-zinc-400">Electron</strong> (<code className="text-gold/90">npm run electron</code>
            ), чтобы бросать лут из локальной базы SRD. В браузере доступен только демо-каталог JSON.
          </p>
        )}

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">Типы предметов (несколько)</p>
            <div className="flex gap-2 text-[11px]">
              <button type="button" onClick={selectAllTypes} className="text-gold/90 underline underline-offset-2">
                Все
              </button>
              <span className="text-zinc-600">·</span>
              <button type="button" onClick={clearTypes} className="text-gold/90 underline underline-offset-2">
                Снять
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 lg:grid-cols-3 lg:gap-4 xl:gap-5">
            {loot.types.slice(0, 6).map((typeItem) => {
              const selected = selectedTypeIds.includes(typeItem.id);
              return (
                <button
                  key={typeItem.id}
                  type="button"
                  onClick={() => toggleType(typeItem.id)}
                  className={[
                    "flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 transition lg:gap-2.5 lg:rounded-[18px] lg:px-4 lg:py-5 xl:py-6",
                    selected
                      ? "border-gold bg-gold/10 shadow-goldGlow text-gold"
                      : "border-gold/20 bg-black/35 text-zinc-500 hover:border-gold/40",
                  ].join(" ")}
                  aria-pressed={selected}
                >
                  <IconByName name={typeItem.icon} className="size-6 lg:size-8 xl:size-9" />
                  <span className="text-center text-[11px] font-medium leading-tight lg:text-xs xl:text-[13px]">{typeItem.labelRu}</span>
                </button>
              );
            })}
          </div>
          {selectedTypeIds.length === 0 ? (
            <p className="mt-2 text-sm text-amber-200/90">Выберите хотя бы один тип.</p>
          ) : null}
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-zernix border border-gold/22 bg-black/40 px-4 py-3 text-sm shadow-innerGold">
          <input
            type="checkbox"
            className="zernix-checkbox size-5"
            checked={magicOnly}
            onChange={(event) => setMagicOnly(event.target.checked)}
          />
          <span className="flex items-center gap-2 font-medium text-zinc-200">
            Только магия необычная и выше <Sparkle className="size-4 text-gold lg:size-5" aria-hidden strokeWidth={1.55} />
            {!hasElectron ? (
              <span className="text-[11px] font-normal text-zinc-500">(для демо JSON — любой тип редкости)</span>
            ) : (
              <span className="text-[11px] font-normal text-zinc-500">
                Common не попадает в SQL-выборку (Uncommon+, Very Rare и т.д.)
              </span>
            )}
          </span>
        </label>

        <GoldButton
          variant="gold"
          onClick={roll}
          disabled={busy || selectedTypeIds.length === 0}
          icon={
            busy ? (
              <Loader2 className="size-5 animate-spin stroke-[2] lg:size-6" aria-hidden />
            ) : (
              <Dice5 className="size-5 stroke-[2] lg:size-6" aria-hidden />
            )
          }
        >
          {hasElectron ? "Бросить кости (SRD)" : "Бросить кости"}
        </GoldButton>
      </div>
    </PageFade>
  );
}
