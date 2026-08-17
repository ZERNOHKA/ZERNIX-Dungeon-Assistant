import type { SessionBrief } from "../vite-env";

/** Служебные однострочники и «метки стола», не для игрока/ГМ в карточке. */
const JUNK_LINE_RE =
  /^(поддержка|support|minions?|minion|flank|flanking|initiative|combat|mystery|social|exploration|urban|forest|cave|dungeon|any)\b/i;

const PROMPT_FRAGMENT_RE =
  /сгенерируй|создай\s+связн|создайте\s+связн|связную\s+игровую\s+сцену|мягкий\s+акцент\s+мастера|не\s+копируй|не\s+повторяй|связным\s+текстом\s+для\s+мастера|не\s+как\s+json|без\s+пустых\s+блоков|сухой\s+дамп|паков\s+\d+|сундуков\s+\d+|цель\s+столкновения|опорный\s+конфликт|атмосферный\s+слой|поворот\s+или\s+осложнение|уровень\s+партии|игроков\s+\d+\.|для\s+D\s*&\s*D|D\s*&\s*D\s*5|5\.5|ритм\s*:/i;

const SERVICE_PREFIX_RE =
  /^(тема|тип\s+сцены|биом|сцена|мир|объект|зоны|фракции|локация|атмосфера|угроза|враги|награда|крючок|главная\s+угроза)\s*[:—\-]\s*/i;

function tidy(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/→/g, " — ")
    .trim();
}

function dedupeAdjacentWords(s: string): string {
  const w = s.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < w.length; i += 1) {
    const cur = w[i]!;
    const prev = out[out.length - 1];
    if (prev && prev.toLowerCase() === cur.toLowerCase()) continue;
    out.push(cur);
  }
  return out.join(" ");
}

/** Схлопывает «кольцо X кольцо X» и соседние повторы фразы из 2–4 слов. */
function collapseRepeatedChunks(s: string): string {
  let t = dedupeAdjacentWords(s);
  for (let pass = 0; pass < 3; pass += 1) {
    const next = t.replace(/\b([\p{L}\d][\p{L}\d\s]{1,40}?)\s+\1\b/giu, "$1");
    if (next === t) break;
    t = next;
  }
  return t;
}

function stripBiomeRhythmTokens(s: string): string {
  let t = s;
  t = t.replace(/\bритм\s*:\s*[a-zа-яё-]+/gi, "");
  t = t.replace(/\s[-—]\s*(cave|forest|dungeon|urban|any|combat|mystery|social|exploration)\b/gi, "");
  t = t.replace(/\b(cave|forest|dungeon|urban|any)\b/gi, "");
  t = t.replace(/\b(combat|mystery|social|exploration)\b/gi, "");
  return tidy(t.replace(/\s{2,}/g, " "));
}

function stripPromptLikeSentences(text: string): string {
  const t = humanizeShouting(text);
  if (!t) return "";
  const chunks = t.split(/(?<=[.!?])\s+/).map((x) => tidy(x));
  const kept = chunks.filter((c) => c.length > 0 && !isPromptLikeFragment(c));
  return kept.join(" ").replace(/\s+/g, " ").trim();
}

function humanizeShouting(s: string): string {
  const t = tidy(s);
  if (!t) return "";
  const letters = t.replace(/[^a-zA-ZА-Яа-яЁё]/g, "");
  if (letters.length < 10) return t;
  const upper = [...letters].filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length;
  if (upper / letters.length > 0.52) {
    const x = t.toLowerCase();
    return x.charAt(0).toUpperCase() + x.slice(1);
  }
  return t;
}

export function isPromptLikeFragment(s: string): boolean {
  const x = tidy(s);
  if (!x) return false;
  if (x.length >= 6 && /^сгенерируй/i.test(x)) return true;
  if (x.length >= 8 && /^создай(те)?\s+связн/i.test(x)) return true;
  if (x.length < 10) return false;
  if (PROMPT_FRAGMENT_RE.test(x)) return true;
  if (/^партия\s*:/i.test(x)) return true;
  if (/^стол\s*:/i.test(x)) return true;
  if (/^сложность\s*:/i.test(x) && /низк|средн|высок/i.test(x)) return true;
  if (/^биом\s*:/i.test(x)) return true;
  return false;
}

export function isJunkMetadataLine(s: string): boolean {
  const x = tidy(s);
  if (!x) return false;
  if (x.length <= 22 && JUNK_LINE_RE.test(x)) return true;
  if (/^поддержка\s*$/i.test(x)) return true;
  if (/^поддержка\s*[—\-:]\s*\w+$/i.test(x)) return true;
  if (/^главная\s+угроза\s*$/i.test(x)) return true;
  return false;
}

function stripLeadingInstructionBlocks(s: string): string {
  let t = tidy(s);
  for (let pass = 0; pass < 6; pass += 1) {
    const next = t
      .replace(/^(?:сгенерируй|создайте|создай)\s+[^\n]{0,520}?(\n|$)/i, "")
      .replace(/^[^\n]{0,320}?(?:для\s+D\s*&\s*D|D\s*&\s*D\s*5)[^\n]{0,120}?(\n|$)/i, "")
      .trim();
    if (next === t) break;
    t = next;
  }
  return t;
}

/** Полная зачистка свободного текста перед сборкой карточки. */
export function sanitizeSessionParagraph(s: string): string {
  let t = tidy(s);
  if (!t) return "";
  t = stripLeadingInstructionBlocks(t);
  t = t.replace(SERVICE_PREFIX_RE, "");
  t = stripPromptLikeSentences(t);
  t = stripBiomeRhythmTokens(t);
  t = collapseRepeatedChunks(t);
  t = tidy(t.replace(/[,;]\s*([,;])/g, "$1"));
  return humanizeShouting(t);
}

function shallowBrief(b: SessionBrief): SessionBrief {
  return {
    ...b,
    enemies: [...(b.enemies || [])],
    rewardLines: [...(b.rewardLines || [])],
  };
}

function normRewardKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-zа-яёё0-9]/gi, "")
    .slice(0, 72);
}

/** Золото + 2–3 предмета + по возможности одна сюжетная строка. */
export function pickMeaningfulRewardLines(lines: readonly string[]): string[] {
  const cleaned = lines.map((x) => sanitizeSessionParagraph(x.replace(/^[-•*]\s*/, ""))).filter(Boolean);
  const goldish: string[] = [];
  const clueish: string[] = [];
  const rest: string[] = [];
  for (const line of cleaned) {
    const low = line.toLowerCase();
    if (/золот|монет|gp|эм\.?\s*з|серебр|медн/i.test(low)) goldish.push(line);
    else if (/улик|письм|карта|ключ|печать|клейм|знак|тайн/i.test(low)) clueish.push(line);
    else rest.push(line);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (x: string) => {
    const k = normRewardKey(x);
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(x.length > 120 ? `${x.slice(0, 118)}…` : x);
  };
  for (const g of goldish) push(g);
  for (const c of clueish.slice(0, 1)) push(c);
  for (const r of rest) {
    if (out.length >= 5) break;
    push(r);
  }
  for (const c of clueish) {
    if (out.length >= 5) break;
    push(c);
  }
  return out.slice(0, 5);
}

export function sanitizeSessionBrief(raw: SessionBrief): SessionBrief {
  const b = shallowBrief(raw);
  b.title = sanitizeSessionParagraph(b.title);
  b.themeLabel = sanitizeSessionParagraph(b.themeLabel);
  b.sceneTypeLabel = b.sceneTypeLabel ? sanitizeSessionParagraph(b.sceneTypeLabel) : undefined;
  b.biomeLabel = b.biomeLabel ? sanitizeSessionParagraph(b.biomeLabel) : undefined;
  b.encounterPitch = b.encounterPitch ? sanitizeSessionParagraph(b.encounterPitch) : undefined;
  b.worldSummary = b.worldSummary ? sanitizeSessionParagraph(b.worldSummary) : undefined;
  b.factionHintsLine = b.factionHintsLine ? sanitizeSessionParagraph(b.factionHintsLine) : undefined;
  b.locationStructuredName = b.locationStructuredName ? sanitizeSessionParagraph(b.locationStructuredName) : undefined;
  b.locationZonesLine = b.locationZonesLine ? sanitizeSessionParagraph(b.locationZonesLine) : undefined;
  b.location = sanitizeSessionParagraph(b.location);
  b.atmosphere = sanitizeSessionParagraph(b.atmosphere);
  b.danger = sanitizeSessionParagraph(b.danger);
  b.hook = sanitizeSessionParagraph(b.hook);
  b.enemies = b.enemies.map((e) => sanitizeSessionParagraph(e)).filter((x) => x.length > 2 && !isJunkMetadataLine(x));
  b.rewardLines = pickMeaningfulRewardLines(b.rewardLines);
  return b;
}

export function sanitizeSessionMarkdownBody(md: string): string {
  const raw = tidy(md.replace(/\r\n?/g, "\n"));
  if (!raw) return "";
  const lines = raw.split("\n");
  const out: string[] = [];
  const sectionHead = /^(ТЕМА|ТИП СЦЕНЫ|БИОМ|СЦЕНА|МИР|ОБЪЕКТ|ЗОНЫ|ФРАКЦИИ|ЛОКАЦИЯ|АТМОСФЕРА|УГРОЗА|ВРАГИ|НАГРАДА|КРЮЧОК)$/;
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      out.push("");
      continue;
    }
    if (sectionHead.test(t)) {
      out.push(t);
      continue;
    }
    if (isJunkMetadataLine(t)) continue;
    const c = sanitizeSessionParagraph(t);
    if (!c) continue;
    out.push(c);
  }
  return tidy(out.join("\n").replace(/\n{3,}/g, "\n\n"));
}

/** Markdown после IPC: убрать служебные протечки и старый блок контекста стола. */
export function finalizeSessionMarkdownForUi(md: string): string {
  return sanitizeSessionMarkdownBody(md)
    .replace(/\r\n?/g, "\n")
    .replace(/\n{2,}\[Контекст стола\][ \t]*\n[^\n]+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
