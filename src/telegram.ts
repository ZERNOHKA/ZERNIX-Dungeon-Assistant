interface TelegramWebAppThemeParams {
  bg_color?: string;
  secondary_bg_color?: string;
}

interface TelegramWebApp {
  ready(): void;
  expand(): void;
  enableClosingConfirmation?(): void;
  themeParams?: TelegramWebAppThemeParams;
  viewportStableHeight?: number;
  BackButton?: { show(): void; hide(): void };
  sendData?(data: string): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function initTelegramWebApp(): void {
  const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    if (tg.themeParams?.bg_color) {
      document.documentElement.style.setProperty("--tg-bg", tg.themeParams.bg_color);
    }
    if (tg.themeParams?.secondary_bg_color) {
      document.documentElement.style.setProperty(
        "--tg-secondary-bg",
        tg.themeParams.secondary_bg_color
      );
    }
  } catch {
    /* noop outside Telegram */
  }
}
