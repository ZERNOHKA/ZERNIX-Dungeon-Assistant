import { ChevronDown, Dice5, Hammer, Loader2, Send, Star, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { AppContentJson, LootItem } from "../../types/content";
import type { LootDigestPayload } from "../../types/lootDigest";
import { DungeonCard } from "../DungeonCard";
import { GoldButton } from "../GoldButton";
import { HeaderBar } from "../HeaderBar";
import { PageFade } from "../PageFade";
import { ZernixMarkdownBody } from "../ZernixMarkdownBody";
import { notifyTelegramOrFallback } from "../../lib/telegramShare";

const MASTER_ONLY_SPLIT = "[MASTER_ONLY]";

function MasterAccordion({ gmMarkdown }: { gmMarkdown: string }) {
  const [open, setOpen] = useState(false);
  if (!gmMarkdown.trim()) {
    return null;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-violet-900/45 bg-gradient-to-br from-violet-950/55 via-zinc-950/70 to-rose-950/35 shadow-[0_0_28px_rgba(139,92,246,0.12)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-violet-950/40"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="font-serif text-sm tracking-wide text-violet-200 lg:text-[15px]">Инсайт Мастера</p>
          <p className="text-[10px] uppercase tracking-[0.22em] text-rose-300/70">Скрытый слой · только ГМ</p>
        </div>
        <ChevronDown
          className={`size-5 shrink-0 text-violet-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="max-h-[min(50vh,420px)] overflow-y-auto border-t border-violet-900/40 px-4 py-3 lg:px-5 lg:py-4">
          <ZernixMarkdownBody markdown={gmMarkdown} className="text-[12px] leading-relaxed text-zinc-200 lg:text-[13px]" />
        </div>
      ) : null}
    </div>
  );
}

function LootDigestRich({
  digest,
  needsBanner,
}: {
  digest: LootDigestPayload;
  needsBanner: boolean;
}) {
  const ItemLine = ({ displayLine, needsRepair }: { displayLine: string; needsRepair: boolean }) => (
    <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
      <span className="flex min-w-0 items-start gap-2">
        {needsRepair ? (
          <Hammer
            className="mt-0.5 size-4 shrink-0 text-rose-400/95 drop-shadow-[0_0_8px_rgba(251,113,133,0.35)]"
            strokeWidth={2}
            aria-hidden
          />
        ) : (
          <span className="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-gold/80 shadow-goldGlow" />
        )}
        <strong className="font-semibold text-gold/95">{displayLine}</strong>
      </span>
      {needsRepair ? (
        <span className="text-[11px] font-medium text-amber-200/90 sm:whitespace-nowrap">
          Состояние: Ветхое / Требуется ремонт
        </span>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-5">
      {needsBanner ? (
        <div className="rounded-lg border border-amber-800/40 bg-amber-950/25 px-3 py-2 text-[11px] leading-snug text-amber-100/90 lg:text-xs">
          В колодце находок есть ветхие предметы — направьте игроков к кузнецу или кожевнику через генератор NPC.
        </div>
      ) : null}

      <div className="rounded-xl border border-gold/20 bg-black/40 px-4 py-3 lg:px-5 lg:py-4">
        <p className="font-serif text-sm text-gold lg:text-base">
          <strong>{digest.labGold}</strong> {digest.goldLine}
        </p>
      </div>

      <div className="rounded-xl border border-gold/15 bg-black/35 px-4 py-3 lg:px-5 lg:py-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{digest.labItems}</p>
        {digest.mundane.length === 0 ? (
          <p className="text-sm text-zinc-500">—</p>
        ) : (
          <ul className="space-y-3">
            {digest.mundane.map((m, idx) => (
              <li key={`mun-${idx}-${m.displayLine.slice(0, 24)}`} className="text-[13px] leading-snug text-zinc-200 lg:text-[14px]">
                <ItemLine displayLine={m.displayLine} needsRepair={m.needsRepair} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-gold/15 bg-black/35 px-4 py-3 lg:px-5 lg:py-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{digest.labMagic}</p>
        {digest.magic.length === 0 ? (
          <p className="text-sm text-zinc-500">—</p>
        ) : (
          <ul className="space-y-3">
            {digest.magic.map((m, idx) => (
              <li key={`mag-${idx}-${m.displayLine.slice(0, 24)}`} className="text-[13px] leading-snug text-zinc-200 lg:text-[14px]">
                <ItemLine displayLine={m.displayLine} needsRepair={m.needsRepair} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[11px] leading-snug text-zinc-500">
        Таблицы сокровищ и CR — по DMG 2024 / D&amp;D 5.5; предметы из SQLite SRD.
      </p>
    </div>
  );
}

interface LootResultScreenProps {
  item: LootItem | null;
  markdown: string | null;
  /** Блок «контекстный поиск»; после `[MASTER_ONLY]` — только для ГМ */
  narrativeBlock?: string | null;
  /** Структурированная сводка с иконками износа */
  lootDigest?: LootDigestPayload | null;
  rarity: AppContentJson["loot"]["rarities"][keyof AppContentJson["loot"]["rarities"]];
  onBack: () => void;
  onReroll: () => void | Promise<void>;
  variant?: "page" | "panel";
  rerollBusy?: boolean;
}

export function LootResultScreen({
  item,
  markdown,
  narrativeBlock = null,
  lootDigest = null,
  rarity,
  onBack,
  onReroll,
  variant = "page",
  rerollBusy = false,
}: LootResultScreenProps) {
  const isMarkdown = markdown != null && markdown.length > 0;
  const rawEn = item ? (item.name ?? "").trim() : "";
  const rawRu = item ? (item.nameRu ?? "").trim() : "";
  const titlePrimary = rawRu || rawEn;
  const titleShowEnglishParen =
    Boolean(rawEn && rawRu) &&
    rawRu !== rawEn &&
    rawRu.toLowerCase() !== rawEn.toLowerCase();
  const displayFlavor = item ? item.flavorRu?.trim() || item.flavor : "";

  const { playerNarrative, gmInsight } = useMemo(() => {
    const raw = narrativeBlock?.trim() ?? "";
    if (!raw.includes(MASTER_ONLY_SPLIT)) {
      return { playerNarrative: raw, gmInsight: "" };
    }
    const [p, ...rest] = raw.split(MASTER_ONLY_SPLIT);
    return {
      playerNarrative: (p ?? "").trim(),
      gmInsight: rest.join(MASTER_ONLY_SPLIT).trim(),
    };
  }, [narrativeBlock]);

  const sharePayload = isMarkdown
    ? narrativeBlock != null && narrativeBlock.trim().length > 0
      ? `${narrativeBlock.trim()}\n\n✦ **───────────────** ✦\n\n${markdown}`
      : markdown
    : item
      ? `${titlePrimary}${titleShowEnglishParen ? ` (${rawEn})` : ""} (${rarity.labelRu})\n${displayFlavor}`
      : "";

  const imageClass = variant === "panel" ? "size-[100px] lg:size-[128px]" : "size-[120px] lg:size-[140px]";
  const titleClass =
    variant === "panel" ? "font-serif text-lg text-gold xl:text-xl" : "font-serif text-xl text-gold lg:text-2xl";

  const card =
    item && !isMarkdown ? (
      <DungeonCard glow className="overflow-hidden shadow-goldGlow">
        <div className={`flex gap-4 p-4 lg:gap-5 lg:p-5 ${variant === "panel" ? "flex-col sm:flex-row" : ""}`}>
          <div
            className={`relative shrink-0 overflow-hidden rounded-xl border border-gold/35 bg-black/40 ${imageClass}`}
          >
            <img src={item.image} alt="" className="size-full object-cover" loading="lazy" />
            <span
              className="absolute bottom-2 right-2 rounded-full px-2.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase lg:text-[10px]"
              style={{
                backgroundColor: `${rarity.colorHex}22`,
                color: rarity.colorHex,
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: `${rarity.colorHex}55`,
              }}
            >
              {rarity.labelRu}
            </span>
          </div>
          <div className="min-w-0 space-y-2">
            <h2 className={titleClass}>
              {titlePrimary}
              {titleShowEnglishParen ? (
                <span className="text-[0.65em] font-normal normal-case tracking-normal text-zinc-500">
                  {" "}
                  ({rawEn})
                </span>
              ) : null}
            </h2>
            <p className="font-sans text-sm leading-relaxed text-zinc-400 lg:text-[15px]">{displayFlavor}</p>
          </div>
        </div>
        <div className="space-y-2 border-t border-gold/10 bg-black/30 px-4 py-3 lg:px-5 lg:py-4">
          {item.stats.map((line, idx) => (
            <p key={`${line}-${idx}`} className="flex gap-2 text-sm leading-snug text-zinc-200 lg:text-[15px]">
              <span className="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-gold/80 shadow-goldGlow" />
              <span>{line}</span>
            </p>
          ))}
        </div>
      </DungeonCard>
    ) : null;

  const narrativeCard =
    isMarkdown && playerNarrative.length > 0 ? (
      <DungeonCard className="overflow-hidden border border-gold/35 bg-black/55 shadow-[0_0_24px_rgba(212,175,55,0.08)]">
        <div className="border-b border-gold/15 bg-black/35 px-4 py-2 lg:px-5">
          <p className="font-serif text-sm tracking-wide text-gold lg:text-base">Контекстный поиск</p>
          <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">История находки · DMG 2024</p>
        </div>
        <div className="max-h-[min(42vh,320px)] overflow-y-auto px-4 py-3 lg:px-5 lg:py-4">
          <ZernixMarkdownBody markdown={playerNarrative} className="text-[13px] leading-relaxed lg:text-[14px]" />
        </div>
      </DungeonCard>
    ) : null;

  const markdownBlock = isMarkdown ? (
    <div className="max-h-[min(70vh,560px)] overflow-y-auto rounded-xl border border-gold/20 bg-black/45 p-4 shadow-inner lg:p-5">
      <p className="mb-3 text-[11px] leading-snug text-zinc-500">
        В шапке отчёта — параметры <span className="text-zinc-400">последнего броска</span>. На широкой вёрстке поля слева
        синхронизированы с «Реролл», на узкой сначала нажмите «Назад», чтобы изменить группу, сложность и окружение.
        Монстры и предметы: основное имя на русском, оригинал SRD в скобках, если он отличается.
      </p>
      {narrativeCard}
      {narrativeCard && gmInsight ? <div className="my-4" /> : null}
      {gmInsight ? <MasterAccordion gmMarkdown={gmInsight} /> : null}
      {(narrativeCard || gmInsight) && lootDigest ? (
        <div className="my-4 h-px bg-gradient-to-r from-transparent via-gold/25 to-transparent" aria-hidden />
      ) : null}
      {lootDigest ? (
        <LootDigestRich digest={lootDigest} needsBanner={lootDigest.needsRepair} />
      ) : markdown ? (
        <ZernixMarkdownBody markdown={markdown} />
      ) : null}
    </div>
  ) : null;

  const buttons = (
    <>
      <div className={`flex flex-col gap-3 ${variant === "panel" ? "" : ""}`}>
        <GoldButton
          variant="gold"
          icon={<Send className="size-5 lg:size-6" aria-hidden />}
          onClick={() => notifyTelegramOrFallback(sharePayload, isMarkdown ? "Поделиться текстом" : "Поделиться предметом")}
        >
          Переслать в чат
        </GoldButton>
        <GoldButton
          variant="outline"
          icon={<Star className="size-5 lg:size-6" aria-hidden />}
          type="button"
          onClick={() => {}}
        >
          В избранное
        </GoldButton>
        <GoldButton
          variant="outline"
          icon={
            rerollBusy ? (
              <Loader2 className="size-5 animate-spin lg:size-6" aria-hidden />
            ) : (
              <Dice5 className="size-5 lg:size-6" aria-hidden />
            )
          }
          type="button"
          disabled={rerollBusy}
          onClick={() => void onReroll()}
        >
          Реролл
        </GoldButton>
      </div>
      {variant === "page" && (
        <p className="text-center text-xs text-zinc-500 lg:text-sm">
          В Telegram отправка идёт через <code className="text-gold">WebApp.sendData</code>; в браузере — через системный
          диалог или буфер обмена.
        </p>
      )}
    </>
  );

  const panelSubtitle = isMarkdown ? "SRD · SQLite" : rarity.labelRu;

  if (variant === "panel") {
    return (
      <div className="animate-fade-in-up rounded-2xl border border-gold/25 bg-abyss-card/80 p-4 shadow-[0_0_20px_rgba(212,175,55,0.12)] backdrop-blur-md lg:p-5">
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-gold/15 pb-3">
          <div className="min-w-0">
            <p className="font-serif text-lg tracking-wide text-gold xl:text-xl">
              {isMarkdown ? "ZERNIX Dungeon Assistant" : "Результат"}
            </p>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{panelSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold/35 text-gold transition hover:bg-gold/10 hover:shadow-goldGlow"
            aria-label="Закрыть панель"
          >
            <X className="size-5" strokeWidth={1.45} aria-hidden />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          {markdownBlock}
          {card}
          {buttons}
        </div>
      </div>
    );
  }

  const pageTitle = isMarkdown ? "ZERNIX Dungeon Assistant" : titlePrimary || "Результат";
  const pageSubtitle = isMarkdown ? "SRD · SQLite" : rarity.labelRu.toUpperCase();

  return (
    <PageFade>
      <HeaderBar onBack={onBack} title={pageTitle} subtitle={pageSubtitle} />

      <div className="flex flex-col gap-5 pb-32 lg:gap-6 lg:pb-12">
        {markdownBlock}
        {card}
        {buttons}
      </div>
    </PageFade>
  );
}
