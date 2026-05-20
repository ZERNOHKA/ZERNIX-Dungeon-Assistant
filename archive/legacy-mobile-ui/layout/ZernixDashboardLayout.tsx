import type { ReactNode } from "react";

/**
 * ZERNIX — игровой каркас (реф. ChatGPT Image 13.05.2026).
 *
 * Оборачивает приложение: фон #050505, типографика text-primary.
 * Графика задаётся CSS-переменными в `src/index.css` (:root):
 *   --zernix-logo-dragon: url("/logo_dragon.png");
 *   --zernix-d20-art: url("/d20_dice.png");
 * Фоновый арт за всем UI: --zernix-home-hero (слой .zernix-app-bg::after).
 */
export function ZernixDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="zernix-app-root relative min-h-[100dvh] bg-[#050505] text-[#e2e2e2] antialiased">{children}</div>
  );
}
