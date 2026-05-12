import { ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { StatusEntry } from "../../types/content";
import { DungeonCard } from "../DungeonCard";
import { HeaderBar } from "../HeaderBar";
import { IconByName } from "../IconByName";
import { PageFade } from "../PageFade";

interface StatusScreenProps {
  statuses: StatusEntry[];
  onBack: () => void;
}

export function StatusScreen({ statuses, onBack }: StatusScreenProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return statuses;
    return statuses.filter((entry) =>
      `${entry.name} ${entry.summary}`.toLowerCase().includes(q)
    );
  }, [statuses, query]);

  return (
    <PageFade>
      <HeaderBar onBack={onBack} title="Справочник" subtitle="Состояния и эффекты" />

      <label className="relative mb-5 block">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-gold/85 lg:left-5 lg:size-6"
          strokeWidth={1.5}
        />
        <input
          value={query}
          placeholder="Найти состояние..."
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded-2xl border border-gold/25 bg-black/35 py-3 pl-12 pr-4 text-[15px] text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-gold/55 focus:bg-black/55 focus:shadow-goldGlow lg:py-3.5 lg:pl-14 lg:text-base"
        />
      </label>

      <div className="flex flex-col gap-4 pb-28 lg:pb-10">
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-gold/20 bg-black/30 px-4 py-6 text-center text-sm text-zinc-500">
            Ничего не найдено — попробуйте другой запрос.
          </p>
        ) : (
          filtered.map((status) => (
            <DungeonCard key={status.id} className="flex items-start gap-3 p-4" glow={false}>
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-gold/35 bg-black/35 text-gold lg:size-14">
                <IconByName name={status.iconHint} className="size-6 lg:size-7" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-serif text-[17px] text-gold">{status.name}</p>
                <p className="text-sm leading-snug text-zinc-400">{status.summary}</p>
              </div>
              <ChevronRight className="mt-3 size-4 shrink-0 text-gold/80 lg:size-5" aria-hidden strokeWidth={1.5} />
            </DungeonCard>
          ))
        )}
      </div>
    </PageFade>
  );
}
