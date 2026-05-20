import type { MouseEventHandler, ReactNode } from "react";
import { OrnateFrame } from "./ui/OrnateFrame";

interface DungeonCardProps {
  children?: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
  glow?: boolean;
}

export function DungeonCard({ children, className = "", onClick, glow }: DungeonCardProps) {
  return (
    <OrnateFrame
      radialGlow={glow}
      contentClassName={className}
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? "button" : undefined}
      className={
        onClick ? "cursor-pointer transition hover:brightness-[1.04] active:scale-[0.995]" : ""
      }
    >
      {children}
    </OrnateFrame>
  );
}
