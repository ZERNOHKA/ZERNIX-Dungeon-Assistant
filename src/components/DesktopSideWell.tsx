interface DesktopSideWellProps {
  title: string;
  hint: string;
}

export function DesktopSideWell({ title, hint }: DesktopSideWellProps) {
  return (
    <div className="flex min-h-[min(420px,60vh)] flex-col items-center justify-center rounded-2xl border border-dashed border-gold/30 bg-black/35 p-10 text-center shadow-innerGold backdrop-blur-sm">
      <p className="font-serif text-xl tracking-wide text-gold drop-shadow-[0_0_12px_rgba(212,175,55,0.25)]">{title}</p>
      <p className="mt-4 max-w-[18rem] text-sm leading-relaxed text-zinc-500">{hint}</p>
    </div>
  );
}
