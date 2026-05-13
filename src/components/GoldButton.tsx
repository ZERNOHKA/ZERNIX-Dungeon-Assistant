import type { MouseEventHandler, ReactNode } from "react";

type Variant = "gold" | "outline" | "summon";

const base =
  "w-full rounded-zernix px-5 py-3.5 font-sans font-semibold tracking-[0.04em] transition active:scale-[0.985] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 text-[15px]";

const variants: Record<Variant, string> = {
  gold:
    "uppercase tracking-[0.18em] text-[13px] bg-[linear-gradient(to_bottom,#d4af37,#8a6d3b)] font-bold text-black shadow-[0_6px_28px_rgba(212,175,55,0.28)] border border-[#5c4818]/90 hover:brightness-105",
  outline:
    "border border-gold/55 text-gold bg-transparent hover:bg-gold/[0.08] hover:shadow-innerGold shadow-none",
  summon:
    "bg-gradient-to-b from-emerald-500 via-emerald-700 to-emerald-950 text-white border border-emerald-400/50 shadow-[0_0_18px_rgba(52,211,153,0.25)]",
};

interface GoldButtonProps {
  children: ReactNode;
  variant?: Variant;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit";
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
}

export function GoldButton({
  children,
  variant = "gold",
  onClick,
  type = "button",
  disabled,
  icon,
  className = "",
}: GoldButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[base, variants[variant], className].filter(Boolean).join(" ")}
    >
      {icon}
      {children}
    </button>
  );
}
