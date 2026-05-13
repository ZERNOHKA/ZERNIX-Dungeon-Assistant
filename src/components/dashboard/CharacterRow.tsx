interface CharacterRowProps {
  name: string;
  subtitle: string;
  level: number;
  hpCurrent: number;
  hpMax: number;
  avatarUrl?: string;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function CharacterRow({ name, subtitle, level, hpCurrent, hpMax, avatarUrl }: CharacterRowProps) {
  const pct = hpMax > 0 ? Math.min(100, Math.round((hpCurrent / hpMax) * 100)) : 0;

  return (
    <div className="flex items-center gap-3 border-b border-gold/10 py-2.5 last:border-b-0">
      <div
        className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gold/35 bg-black/60 text-[11px] font-semibold uppercase tracking-wide text-gold shadow-innerGold"
        aria-hidden
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <span>{initials(name)}</span>
        )}
        <span className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full border border-gold/40 bg-black/90 text-[9px] font-bold text-gold">
          {level}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-[14px] leading-tight text-[#e8e4dc]">{name}</p>
        <p className="truncate text-[11px] text-zinc-500">{subtitle}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-sm bg-[#7f1d1d]/95 ring-1 ring-black/60">
            <div
              className="h-full rounded-sm bg-gradient-to-r from-red-700 via-[#ef4444] to-orange-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="shrink-0 tabular-nums text-[11px] text-[#d1d1d1]">
            {hpCurrent} / {hpMax}
          </span>
        </div>
      </div>
    </div>
  );
}
