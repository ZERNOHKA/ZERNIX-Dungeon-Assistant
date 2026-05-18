import type { NpcPreviewState } from "./models";

const BAD_LITERAL = /^(undefined|null)$/i;

function normWhitespace(s: string): string {
  return s.replace(/\u00a0/g, " ").trim();
}

/** Для подписей и подзаголовков: пусто / «undefined» → запасной текст. */
export function npcSafeField(value: string | undefined | null): string {
  if (value == null) return "Не указано";
  const t = normWhitespace(String(value));
  if (!t || BAD_LITERAL.test(t)) return "Не указано";
  return t;
}

/** Для блоков «показать или скрыть»: нет содержимого → null. */
export function npcLineOrNull(value: string | undefined | null): string | null {
  if (value == null) return null;
  const t = normWhitespace(String(value));
  if (!t || BAD_LITERAL.test(t)) return null;
  return t;
}

/** Склеивает части подзаголовка без лишних « · ». */
export function npcJoinSegments(parts: (string | undefined | null)[]): string {
  const bits = parts
    .map((p) => (p == null ? "" : normWhitespace(String(p))))
    .filter((p) => p.length > 0 && !BAD_LITERAL.test(p));
  return bits.join(" · ");
}

/** Имя для избранного: без эпитета в кавычках «…». */
export function npcCanonicalName(npc: NpcPreviewState): string {
  const raw = normWhitespace(String(npc.name ?? ""));
  const stripped = raw.replace(/\s*«[^»]*»\s*$/u, "").replace(/^«[^»]*»\s*/u, "").trim();
  const base = stripped || raw;
  return base || "без имени";
}

/** Единый ключ избранного: npc:<каноническое имя> */
export function npcFavoriteRefKey(npc: NpcPreviewState): string {
  return `npc:${npcCanonicalName(npc)}`;
}

function cleanStr(s: unknown): string {
  if (s == null) return "";
  let t = normWhitespace(String(s));
  if (BAD_LITERAL.test(t)) t = "";
  t = t
    .replace(/\bundefined\b/gi, "")
    .replace(/\bnull\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return t;
}

function clampStat(n: number): number {
  if (!Number.isFinite(n)) return 10;
  return Math.min(30, Math.max(1, Math.round(n)));
}

const NPC_AT_TABLE_FALLBACK = {
  visualTrait: [
    "Шрам у виска, руки в перчатках даже в тепле.",
    "Смотрит мимо собеседника — на двери и выходы.",
    "Короткие фразы; пауза перед «да» или «нет».",
  ],
  wantLine: [
    "Закрыть сделку без огласки.",
    "Вернуть потерянное или выторговать имя.",
    "Уехать отсюда — слишком много чужих глаз.",
  ],
  avoidLine: [
    "Стража и любые «по записи» обещания.",
    "Публичный допрос и показ силы.",
    "Разговоры о долгах без контекста.",
  ],
  secretLine: [
    "Работает на тех, кого называет в шёпоте.",
    "Держит письмо, которое нельзя показать свету.",
    "Когда-то подставил того, кого считал другом.",
  ],
} as const;

function pickFallback<T extends readonly string[]>(arr: T, name: string, salt: number): string {
  let h = 2166136261 >>> 0;
  const s = `${name}\x1e${salt}`;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return arr[h % arr.length]!;
}

function clipTable(s: string, max: number): string {
  const t = normWhitespace(s);
  if (!t) return t;
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Четыре стол-блока всегда непустые и короткие (3–5 с чтения). */
export function ensureNpcAtTableFields(n: NpcPreviewState): NpcPreviewState {
  const fill = (v: string, arr: readonly string[], salt: number) => {
    const t = cleanStr(v);
    return t || pickFallback(arr, n.name, salt);
  };
  let cc = clipTable(cleanStr(n.creatureClass), 88);
  if (!cc) cc = clipTable(npcJoinSegments([cleanStr(n.race), "Гость сцены"]), 88);
  if (!cc) cc = "Персонаж";
  return {
    ...n,
    creatureClass: cc,
    visualTrait: clipTable(fill(n.visualTrait, NPC_AT_TABLE_FALLBACK.visualTrait, 11), 160),
    wantLine: clipTable(fill(n.wantLine, NPC_AT_TABLE_FALLBACK.wantLine, 23), 140),
    avoidLine: clipTable(fill(n.avoidLine, NPC_AT_TABLE_FALLBACK.avoidLine, 37), 140),
    secretLine: clipTable(fill(n.secretLine, NPC_AT_TABLE_FALLBACK.secretLine, 59), 180),
  };
}

/** После IPC/редактора: без «undefined», пустые строки, нормальный портрет. */
export function sanitizeNpcPreviewState(n: NpcPreviewState): NpcPreviewState {
  let name = cleanStr(n.name);
  if (!name) name = "Без имени";
  let portraitLetter = cleanStr(n.portraitLetter).slice(0, 2).toUpperCase();
  if (!portraitLetter) portraitLetter = (name.charAt(0) || "?").toUpperCase();

  const base: NpcPreviewState = {
    name,
    race: cleanStr(n.race),
    creatureClass: cleanStr(n.creatureClass),
    portraitLetter,
    visualTrait: cleanStr(n.visualTrait),
    wantLine: cleanStr(n.wantLine),
    avoidLine: cleanStr(n.avoidLine),
    secretLine: cleanStr(n.secretLine),
    str: clampStat(n.str),
    dex: clampStat(n.dex),
    con: clampStat(n.con),
    int: clampStat(n.int),
    wis: clampStat(n.wis),
    cha: clampStat(n.cha),
  };
  return ensureNpcAtTableFields(base);
}
