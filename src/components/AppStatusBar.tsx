import pkg from "../../package.json";

export function AppStatusBar() {
  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-20 hidden h-11 items-center justify-between gap-4 border-t border-gold/22 bg-[#050505]/94 px-6 text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-500 backdrop-blur-md lg:left-[248px] lg:flex xl:left-[264px]"
      role="contentinfo"
    >
      <span className="max-w-[38%] truncate text-zinc-400 normal-case tracking-[0.12em]">
        Готово к приключениям
      </span>
      <span className="hidden min-w-0 flex-1 truncate text-center text-zinc-500 normal-case tracking-[0.14em] sm:block">
        D&amp;D 5.5 — официальные правила 2024
      </span>
      <span className="flex max-w-[42%] shrink-0 items-center justify-end gap-3 normal-case tracking-normal">
        <span className="text-[11px] text-zinc-500">v{pkg.version}</span>
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400/95">
          <span
            className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.55)]"
            aria-hidden
          />
          Онлайн
        </span>
      </span>
    </footer>
  );
}
