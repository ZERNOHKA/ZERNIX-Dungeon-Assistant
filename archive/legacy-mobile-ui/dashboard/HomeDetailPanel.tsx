import { Flame } from "lucide-react";
import type { DashboardFeaturedSpell } from "../../types/content";
import { GoldButton } from "../GoldButton";
import { IconByName } from "../IconByName";
import { OrnateFrame } from "../ui/OrnateFrame";

interface HomeDetailPanelProps {
  spell: DashboardFeaturedSpell;
}

export function HomeDetailPanel({ spell }: HomeDetailPanelProps) {
  const showLucideFlame = spell.iconHint === "flame";

  return (
    <OrnateFrame contentClassName="flex flex-col gap-4 p-4 lg:gap-5 lg:p-5" className="animate-fade-in-up">
      <div className="flex flex-col items-center gap-3 border-b border-gold/15 pb-4 text-center">
        <div className="relative">
          <div
            className="pointer-events-none absolute inset-0 blur-2xl"
            style={{ background: "radial-gradient(circle, rgba(251,146,60,0.35), transparent 65%)" }}
            aria-hidden
          />
          {showLucideFlame ? (
            <Flame className="relative size-16 text-orange-400 drop-shadow-[0_0_18px_rgba(251,146,60,0.55)] lg:size-[4.5rem]" strokeWidth={1.25} />
          ) : (
            <div className="relative flex size-16 items-center justify-center rounded-2xl border border-orange-500/35 bg-orange-950/30 text-orange-300 lg:size-[4.5rem]">
              <IconByName name={spell.iconHint} className="size-12 lg:size-14" strokeWidth={1.2} />
            </div>
          )}
        </div>
        <div>
          <h2 className="font-serif text-xl tracking-wide text-gold lg:text-2xl">{spell.titleRu}</h2>
          <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-zinc-500">{spell.subtitleRu}</p>
        </div>
      </div>

      <dl className="space-y-2.5">
        {spell.stats.map((row) => (
          <div
            key={`${row.labelRu}-${row.valueRu}`}
            className="flex justify-between gap-3 border-b border-gold/10 pb-2 text-[13px] last:border-b-0 last:pb-0"
          >
            <dt className="shrink-0 text-zinc-500">{row.labelRu}</dt>
            <dd className="min-w-0 text-right font-medium text-[#e4dfd6]">{row.valueRu}</dd>
          </div>
        ))}
      </dl>

      <div className="zernix-inset-plaque px-3 py-3 text-[13px] leading-relaxed text-[#e5e7eb]">
        {spell.description}
      </div>

      <div className="flex flex-col gap-2.5 pt-1">
        <GoldButton variant="gold" type="button" onClick={() => {}} className="!text-[12px] !tracking-[0.16em]">
          БРОСИТЬ УРОН
        </GoldButton>
        <GoldButton variant="outline" type="button" onClick={() => {}} className="!font-semibold !uppercase !tracking-[0.14em]">
          Добавить в заметки
        </GoldButton>
        <GoldButton variant="outline" type="button" onClick={() => {}} className="!font-semibold !uppercase !tracking-[0.14em]">
          В избранное
        </GoldButton>
      </div>
    </OrnateFrame>
  );
}
