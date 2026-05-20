import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

export function SelectField({ label, className = "", children, ...rest }: SelectFieldProps) {
  return (
    <label className="flex w-full flex-col gap-2 text-sm text-zinc-400">
      <span className="tracking-wide">{label}</span>
      <div className="relative">
        <select
          {...rest}
          className={[
            "w-full appearance-none rounded-zernix border border-gold/28 bg-abyss-elevated py-3 pl-4 pr-12 text-[15px] text-zinc-100 outline-none shadow-innerGold",
            "focus:border-gold/55 focus:shadow-goldGlow",
            className,
          ].join(" ")}
        >
          {children}
        </select>
        <ChevronDown
          strokeWidth={1.5}
          className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-gold"
          aria-hidden
        />
      </div>
    </label>
  );
}
