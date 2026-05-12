import type { MouseEventHandler, ReactNode } from "react";

interface DungeonCardProps {
  children?: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
  glow?: boolean;
}

export function DungeonCard({ children, className = "", onClick, glow }: DungeonCardProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      className={[
        "rounded-2xl bg-abyss-card/95 border border-gold/20 shadow-cardLift backdrop-blur-sm",
        glow ? "shadow-goldGlow" : "",
        onClick ? "cursor-pointer hover:border-gold/45 transition" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
