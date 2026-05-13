import type { KeyboardEvent, MouseEventHandler, ReactNode } from "react";

interface OrnateFrameProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Дополнительное золотое свечение вокруг первой карточки быстрого старта */
  radialGlow?: boolean;
  onClick?: MouseEventHandler<HTMLDivElement>;
  tabIndex?: number;
  role?: "button";
}

export function OrnateFrame({
  children,
  className = "",
  contentClassName = "",
  radialGlow,
  onClick,
  tabIndex,
  role,
}: OrnateFrameProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (role !== "button" || !onClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(e as unknown as Parameters<MouseEventHandler<HTMLDivElement>>[0]);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {radialGlow ? (
        <div
          className="pointer-events-none absolute -inset-[4px] rounded-none opacity-[0.72]"
          style={{
            background:
              "radial-gradient(ellipse 78% 58% at 50% 38%, rgba(212, 175, 55, 0.22), transparent 66%)",
            filter: "blur(20px)",
          }}
          aria-hidden
        />
      ) : null}
      <div
        className={`zernix-ornate-card ${radialGlow ? "zernix-ornate-card--accent" : ""}`}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        tabIndex={tabIndex}
        role={role}
      >
        <div className="zernix-ornate-card__rim" aria-hidden />
        <div className={`zernix-ornate-card__body ${contentClassName}`}>{children}</div>
      </div>
    </div>
  );
}
