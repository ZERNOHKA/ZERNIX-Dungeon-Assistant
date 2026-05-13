import { Coins, FlaskConical, Hammer, Package, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { LootDigestPayload, LootItemDigestEntry } from "../../types/lootDigest";
import { partitionLootMundane } from "../../lib/partitionLootMundane";
import { OrnateFrame } from "../ui/OrnateFrame";

function ItemLine({ displayLine, needsRepair }: { displayLine: string; needsRepair: boolean }) {
  return (
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
        <strong className="font-semibold text-[#e4dfd6]">{displayLine}</strong>
      </span>
      {needsRepair ? (
        <span className="text-[11px] font-medium text-amber-200/90 sm:whitespace-nowrap">
          Состояние: Ветхое / Требуется ремонт
        </span>
      ) : null}
    </div>
  );
}

function Quadrant({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Coins;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[140px] flex-col rounded-zernix border border-gold/16 bg-black/35 p-3 shadow-innerGold lg:p-4">
      <div className="mb-2 flex items-center gap-2 border-b border-gold/12 pb-2">
        <Icon className="size-4 shrink-0 text-gold" strokeWidth={1.35} aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/95">{title}</span>
      </div>
      <div className="min-h-0 flex-1 text-[13px] leading-snug">{children}</div>
    </div>
  );
}

interface TreasuresPanelProps {
  digest: LootDigestPayload;
  needsBanner: boolean;
}

export function TreasuresPanel({ digest, needsBanner }: TreasuresPanelProps) {
  const { consumables, items } = partitionLootMundane(digest.mundane);

  const coinHead = digest.labGold.trim();
  const goldPreview =
    digest.goldLine.length > 96 ? `${digest.goldLine.slice(0, 93).trim()}…` : digest.goldLine;

  return (
    <div className="space-y-4">
      {needsBanner ? (
        <div className="rounded-lg border border-amber-800/40 bg-amber-950/25 px-3 py-2 text-[11px] leading-snug text-amber-100/90 lg:text-xs">
          В колодце находок есть ветхие предметы — направьте игроков к кузнецу или кожевнику через генератор NPC.
        </div>
      ) : null}

      <OrnateFrame contentClassName="p-0">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gold/18 px-4 py-3 lg:px-5">
          <div>
            <p className="font-serif text-base tracking-wide text-gold lg:text-lg">Сокровища</p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Структурированная сводка</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px border-b border-gold/12 bg-gold/10 sm:grid-cols-4">
          <div className="flex flex-col items-center gap-1 bg-black/50 px-2 py-3 text-center">
            <Coins className="size-5 text-gold" strokeWidth={1.35} aria-hidden />
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{coinHead}</span>
            <span className="line-clamp-3 text-[11px] font-medium leading-snug text-[#d1d1d1]">{goldPreview}</span>
          </div>
          <div className="flex flex-col items-center gap-1 bg-black/50 px-2 py-3 text-center">
            <Package className="size-5 text-gold" strokeWidth={1.35} aria-hidden />
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Предметы</span>
            <span className="font-serif text-lg text-gold">{items.length}</span>
          </div>
          <div className="flex flex-col items-center gap-1 bg-black/50 px-2 py-3 text-center">
            <FlaskConical className="size-5 text-gold" strokeWidth={1.35} aria-hidden />
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Расходники</span>
            <span className="font-serif text-lg text-gold">{consumables.length}</span>
          </div>
          <div className="flex flex-col items-center gap-1 bg-black/50 px-2 py-3 text-center">
            <Sparkles className="size-5 text-gold" strokeWidth={1.35} aria-hidden />
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Магия</span>
            <span className="font-serif text-lg text-gold">{digest.magic.length}</span>
          </div>
        </div>

        <div className="grid gap-3 p-3 sm:grid-cols-2 lg:gap-4 lg:p-4">
          <Quadrant icon={Coins} title={coinHead || "Монеты"}>
            <p className="font-medium leading-relaxed text-[#d1d1d1]">{digest.goldLine}</p>
          </Quadrant>

          <Quadrant icon={Package} title={digest.labItems}>
            {items.length === 0 ? (
              <p className="text-sm text-zinc-500">—</p>
            ) : (
              <ul className="space-y-3">
                {items.map((m: LootItemDigestEntry, idx: number) => (
                  <li key={`it-${idx}-${m.displayLine.slice(0, 24)}`}>
                    <ItemLine displayLine={m.displayLine} needsRepair={m.needsRepair} />
                  </li>
                ))}
              </ul>
            )}
          </Quadrant>

          <Quadrant icon={FlaskConical} title="Расходники">
            {consumables.length === 0 ? (
              <p className="text-sm text-zinc-500">—</p>
            ) : (
              <ul className="space-y-3">
                {consumables.map((m: LootItemDigestEntry, idx: number) => (
                  <li key={`cs-${idx}-${m.displayLine.slice(0, 24)}`}>
                    <ItemLine displayLine={m.displayLine} needsRepair={m.needsRepair} />
                  </li>
                ))}
              </ul>
            )}
          </Quadrant>

          <Quadrant icon={Sparkles} title={digest.labMagic}>
            {digest.magic.length === 0 ? (
              <p className="text-sm text-zinc-500">—</p>
            ) : (
              <ul className="space-y-3">
                {digest.magic.map((m: LootItemDigestEntry, idx: number) => (
                  <li key={`mg-${idx}-${m.displayLine.slice(0, 24)}`}>
                    <ItemLine displayLine={m.displayLine} needsRepair={m.needsRepair} />
                  </li>
                ))}
              </ul>
            )}
          </Quadrant>
        </div>
      </OrnateFrame>

      <p className="text-[11px] leading-snug text-zinc-500">
        Таблицы сокровищ и CR — по DMG 2024 / D&amp;D 5.5; предметы из SQLite SRD.
      </p>
    </div>
  );
}
