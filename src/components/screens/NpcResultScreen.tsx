import { Dice5, Send, Star, UserRound, X } from "lucide-react";
import { NPC_CARD_LABEL_RU, type ResolvedNpcCard } from "../../lib/npcSummon";
import { GoldButton } from "../GoldButton";
import { HeaderBar } from "../HeaderBar";
import { PageFade } from "../PageFade";
import { notifyTelegramOrFallback } from "../../lib/telegramShare";

interface NpcResultScreenProps {
  npc: ResolvedNpcCard;
  onBack: () => void;
  onReroll: () => void;
  variant?: "page" | "panel";
}

function shareBody(card: ResolvedNpcCard) {
  const epit = card.epithet ? ` «${card.epithet}»` : "";
  let base =
    `${NPC_CARD_LABEL_RU.name}: ${card.name}${epit}\n` +
    `${NPC_CARD_LABEL_RU.race}: ${card.raceRu}\n` +
    `${NPC_CARD_LABEL_RU.role}: ${card.roleLabelRu}\n` +
    `${NPC_CARD_LABEL_RU.occupation}: ${card.occupationRu}\n\n` +
    `${NPC_CARD_LABEL_RU.appearance}: ${card.appearance}\n\n` +
    `${NPC_CARD_LABEL_RU.manner}: ${card.manner}\n\n` +
    `${NPC_CARD_LABEL_RU.quote}: ${card.catchphrase}\n\n` +
    `${NPC_CARD_LABEL_RU.motivation}: ${card.motivation}\n\n` +
    `${NPC_CARD_LABEL_RU.secret}: ${card.secret}\n\n` +
    `${NPC_CARD_LABEL_RU.inventory}: ${card.inventory}`;
  if (card.dispositionLabelRu) {
    base += `\n\nОтношение к партии: ${card.dispositionLabelRu}`;
  }
  if (card.socialStakeLine) {
    base += `\n\nСоциальная роль: ${card.socialStakeLine}`;
  }
  if (card.pricingRollup) {
    const zm = card.pricingRollup.totalCostZm ?? card.pricingRollup.totalZm;
    base += `\n\nПрейскурант (ориентир Σ зм): ${zm}`;
    if (card.pricingRollup.totalSm) base += ` · Σ см: ${card.pricingRollup.totalSm}`;
  }
  if (card.markdownFull) {
    base += `\n\n---\n${card.markdownFull}`;
  }
  if (card.specializationLine) {
    base += `\n\nСпециализация: ${card.specializationLine}`;
  }
  if (card.hobbyEclectic) {
    base += `\n\nХобби: ${card.hobbyEclectic}`;
  }
  if (card.whereToFindNow) {
    base += `\n\nГде сейчас: ${card.whereToFindNow}`;
  }
  if (card.repairWeaponSummaryRu) {
    base += `\n\nРемонт (оружие): ${card.repairWeaponSummaryRu}`;
  }
  return base;
}

export function NpcResultScreen({ npc, onBack, onReroll, variant = "page" }: NpcResultScreenProps) {
  const parchment = (
    <div className="relative rounded-2xl bg-parchment px-5 py-6 text-[#29231a] shadow-cardLift noise-parchment lg:px-6 lg:py-7">
      <div className="relative z-[1] flex gap-4 lg:gap-5">
        <div
          className="flex size-[88px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#58452c]/55 bg-gradient-to-br from-[#e6dac4] to-[#d2c4a8] shadow-inner lg:size-[104px]"
          aria-hidden
        >
          {npc.portrait?.trim().startsWith("http") ? (
            <img src={npc.portrait} alt="" className="size-full object-cover" loading="lazy" />
          ) : (
            <UserRound className="size-[52px] text-[#58452c]/45 lg:size-[58px]" strokeWidth={1.15} />
          )}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#7a6b55]">{NPC_CARD_LABEL_RU.name}</p>
          <h2 className="font-serif text-lg text-[#3b2f20] lg:text-xl">
            {npc.name}
            {npc.epithet ? (
              <span className="text-[#5b4a39]"> «{npc.epithet}»</span>
            ) : null}
          </h2>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#7a6b55]">{NPC_CARD_LABEL_RU.race}</p>
          <p className="text-sm font-semibold text-[#4b3f2f] lg:text-base">{npc.raceRu}</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#5c4833]">{npc.genderRu}</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#7a6b55]">{NPC_CARD_LABEL_RU.role}</p>
          <p className="text-sm leading-snug text-[#4b3f2f] lg:text-[15px]">
            <span className="italic text-[#5b4a39]">{npc.roleLabelRu}</span>
          </p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#7a6b55]">{NPC_CARD_LABEL_RU.occupation}</p>
          <p className="text-sm leading-snug text-[#4b3f2f] lg:text-[15px]">{npc.occupationRu}</p>
        </div>
      </div>

      {npc.pricingRollup ? (
        <div className="relative z-[1] mt-4 rounded-xl border border-[#c9a227]/45 bg-gradient-to-br from-[#fff9e8] to-[#f5e9c8] px-4 py-3 text-[#3b2f20] shadow-inner">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#7a6b55]">Прейскурант (ориентир, зм / см)</p>
          <p className="mt-1 font-serif text-base text-[#58452e] lg:text-lg">
            Σ зм: <strong>{npc.pricingRollup.totalCostZm ?? npc.pricingRollup.totalZm}</strong>
            {npc.pricingRollup.totalSm ? (
              <>
                {" "}
                · Σ см: <strong>{npc.pricingRollup.totalSm}</strong>
              </>
            ) : null}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-[#6b5c48]">
            Сумма явных чисел в строках услуг после уровня мастера (Подмастерье / Мастер / Грандмастер /
            Легендарный).
          </p>
        </div>
      ) : null}

      {npc.specializationLine ? (
        <Section title="Специализация">{npc.specializationLine}</Section>
      ) : null}
      {npc.professionCategoryLabelRu ? (
        <p className="relative z-[1] mt-3 text-[11px] uppercase tracking-[0.14em] text-[#7a6b55]">
          Категория:{" "}
          <span className="font-semibold normal-case tracking-normal text-[#4b3f2f]">
            {npc.professionCategoryLabelRu}
          </span>
        </p>
      ) : null}

      <Section title={NPC_CARD_LABEL_RU.appearance}>{npc.appearance}</Section>
      {npc.craftsmanshipNarrativeHook ? (
        <Section title="Ремесло в жесте">{npc.craftsmanshipNarrativeHook}</Section>
      ) : null}
      {npc.hobbyEclectic ? (
        <Section title="Хобби вне работы">{npc.hobbyEclectic}</Section>
      ) : null}
      {npc.whereToFindNow ? <Section title="Где найти сейчас">{npc.whereToFindNow}</Section> : null}
      {(npc.repairWeaponSummaryRu || npc.repairMagicItemSummaryRu) ? (
        <div className="relative z-[1] mt-4 rounded-xl border border-[#58452c]/25 bg-[#faf6ee]/90 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#7a6b55]">
            Ремонт и целостность (ориентир)
          </p>
          {npc.repairWeaponSummaryRu ? (
            <p className="mt-2 text-[13px] leading-snug text-[#3b2f20]">{npc.repairWeaponSummaryRu}</p>
          ) : null}
          {npc.repairMagicItemSummaryRu ? (
            <p className="mt-2 text-[13px] leading-snug text-[#3b2f20]">{npc.repairMagicItemSummaryRu}</p>
          ) : null}
        </div>
      ) : null}
      <Section title={NPC_CARD_LABEL_RU.manner}>{npc.manner}</Section>
      {npc.dispositionLabelRu ? <Section title="Отношение к партии">{npc.dispositionLabelRu}</Section> : null}
      {npc.socialStakeLine ? <Section title="Социальная роль к героям">{npc.socialStakeLine}</Section> : null}
      <Section title={NPC_CARD_LABEL_RU.quote}>{npc.catchphrase}</Section>
      <Section title={NPC_CARD_LABEL_RU.motivation}>{npc.motivation}</Section>
      <Section title={NPC_CARD_LABEL_RU.secret}>{npc.secret}</Section>
      <Section title={NPC_CARD_LABEL_RU.inventory}>{npc.inventory}</Section>

      {npc.markdownFull ? (
        <details className="relative z-[1] mt-4 rounded-xl border border-[#58452c]/30 bg-[#faf6ee]/95 px-4 py-3">
          <summary className="cursor-pointer font-serif text-sm tracking-[0.08em] text-[#58452e]">
            Полная запись NPC (Markdown)
          </summary>
          <pre className="mt-3 max-h-[min(50vh,420px)] overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[#3b3428]">
            {npc.markdownFull}
          </pre>
        </details>
      ) : null}
    </div>
  );

  const actions = (
    <div className="flex flex-col gap-3">
      <GoldButton
        variant="gold"
        icon={<Send className="size-5 lg:size-6" aria-hidden />}
        onClick={() => notifyTelegramOrFallback(shareBody(npc), "Поделиться NPC")}
      >
        Переслать в чат
      </GoldButton>
      <GoldButton variant="outline" icon={<Star className="size-5 lg:size-6" aria-hidden />} type="button" onClick={() => {}}>
        В избранное
      </GoldButton>
      <GoldButton
        variant="outline"
        icon={<Dice5 className="size-5 lg:size-6" aria-hidden />}
        type="button"
        onClick={onReroll}
      >
        Реролл
      </GoldButton>
    </div>
  );

  if (variant === "panel") {
    return (
      <div className="animate-fade-in-up rounded-2xl border border-gold/25 bg-abyss-card/85 p-4 shadow-[0_0_20px_rgba(212,175,55,0.12)] backdrop-blur-md lg:p-5">
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-gold/15 pb-3">
          <div>
            <p className="font-serif text-lg text-gold xl:text-xl">ZERNIX Dungeon Assistant</p>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Карточка NPC · {npc.name}</p>
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
        <div className="flex max-h-[min(72vh,720px)] flex-col gap-4 overflow-y-auto pr-1">
          {parchment}
          {actions}
        </div>
      </div>
    );
  }

  return (
    <PageFade>
      <HeaderBar onBack={onBack} title="ZERNIX Dungeon Assistant" subtitle={`Карточка NPC · ${npc.name}`} />

      <div className="mb-10">{parchment}</div>

      <div className="flex flex-col gap-3 pb-28 lg:pb-12">{actions}</div>
    </PageFade>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <div className="relative z-[1] mt-4 space-y-2 lg:mt-5">
      <h3 className="font-serif text-sm tracking-[0.18em] text-[#58452e] lg:text-[15px]">{title}</h3>
      <p className="text-sm leading-relaxed text-[#3b3428] lg:text-[15px] [overflow-wrap:anywhere] pb-0.5">{children}</p>
    </div>
  );
}
