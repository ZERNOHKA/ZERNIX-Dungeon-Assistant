export function notifyTelegramOrFallback(payload: string, labelRu: string) {
  const tg = window.Telegram?.WebApp;
  if (tg?.sendData) {
    try {
      tg.sendData(payload);
      return true;
    } catch {
      /* fallback */
    }
  }
  if (navigator.share) {
    void navigator.share({ title: labelRu, text: payload }).catch(() => {});
    return true;
  }
  try {
    void navigator.clipboard.writeText(payload);
  } catch {
    /* noop */
  }
  return false;
}
