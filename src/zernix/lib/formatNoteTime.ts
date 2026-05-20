/** Format note timestamp for journal lists. */
export function formatNoteTime(ts: number): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(ts));
}
