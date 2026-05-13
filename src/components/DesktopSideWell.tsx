interface DesktopSideWellProps {
  title: string;
  hint: string;
}

export function DesktopSideWell({ title, hint }: DesktopSideWellProps) {
  return (
    <div className="zernix-panel flex min-h-[min(420px,60vh)] flex-col items-center justify-center p-10 text-center">
      <p className="font-serif text-xl tracking-[0.14em] text-gold drop-shadow-[0_0_14px_rgba(197,160,89,0.22)]">{title}</p>
      <p className="mt-4 max-w-[18rem] text-sm leading-relaxed text-zinc-500">{hint}</p>
    </div>
  );
}
