import { ArrowLeft, Crown } from "lucide-react";
import type { MouseEventHandler, ReactNode } from "react";
import type { RootTab } from "../types/routes";

interface HeaderBarProps {
  title?: string;
  subtitle?: string;
  centerBrand?: ReactNode;
  onBack?: MouseEventHandler<HTMLButtonElement>;
  leading?: ReactNode;
  trailing?: ReactNode;
  badge?: RootTab | null;
}

export function HeaderBar({
  title,
  subtitle,
  centerBrand,
  onBack,
  leading,
  trailing,
  badge,
}: HeaderBarProps) {
  const leftElement = onBack ? (
    <button
      type="button"
      onClick={onBack}
      className="flex size-11 items-center justify-center rounded-xl border border-gold/35 text-gold transition hover:border-gold/60 hover:bg-gold/5"
      aria-label="Назад"
    >
      <ArrowLeft className="size-5" strokeWidth={1.5} aria-hidden />
    </button>
  ) : (
    leading ?? <div className="size-11" aria-hidden />
  );

  return (
    <header className="flex w-full min-w-0 shrink-0 items-center justify-between gap-2 pb-6 sm:gap-3">
      {leftElement}
      <div className="min-w-0 flex-1 text-center">
        {centerBrand ??
          (title && (
            <div>
              <h1 className="font-serif text-lg font-semibold tracking-[0.2em] text-gold">{title}</h1>
              {subtitle && <p className="text-[11px] font-sans uppercase tracking-[0.18em] text-zinc-500">{subtitle}</p>}
            </div>
          ))}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {trailing}
        {badge === null ? null : (
          <span className="inline-flex items-center gap-1 rounded-full border border-gold/35 bg-gold/10 px-2.5 py-1 text-[11px] font-medium text-gold">
            <Crown className="size-3.5" strokeWidth={1.75} aria-hidden />
            GOLD
          </span>
        )}
      </div>
    </header>
  );
}
