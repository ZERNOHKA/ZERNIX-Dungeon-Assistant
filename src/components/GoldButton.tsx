import type { MouseEventHandler, ReactNode } from "react";

type Variant = "gold" | "outline" | "summon";

const base =
  "w-full rounded-xl px-5 py-3.5 font-sans font-medium tracking-wide transition active:scale-[0.985] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2";

const variants: Record<Variant, string> = {
  gold:
    "bg-[linear-gradient(165deg,#e6d07a,#d4af37_45%,#5c4818)] text-[#15151a] shadow-goldGlow border border-gold/70",
  outline:
    "border border-gold text-gold bg-transparent hover:bg-gold/10 hover:shadow-innerGold shadow-none",
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
