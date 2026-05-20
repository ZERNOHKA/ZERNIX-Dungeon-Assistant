/** Prep/session text cleanup for UI display. */

export function sanitizePrepText(input: string | null | undefined): string {
  if (!input) return "";
  let s = String(input);
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`[^`\n]+`/g, " ");
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  s = s.replace(/__([^_\n]+)__/g, "$1");
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  s = s.replace(/^\s*#{1,6}\s+/gm, "");
  s = s.replace(/^\s*[-*_]{3,}\s*$/gm, "");
  s = s.replace(/^\s*\d+[.)]\s+/gm, "");
  s = s.replace(/^\s*[•·*\-+>]+\s*/gm, "");
  const leakPatterns: RegExp[] = [
    /сгенерируй[^.!?\n]*[.!?]?/giu,
    /напиш[иите]+[^.!?\n]*\bсцен[^.!?\n]*[.!?]?/giu,
    /созда[йте]+\s+связн[^.!?\n]*[.!?]?/giu,
    /без\s+пустых\s+блоков[^.!?\n]*[.!?]?/giu,
    /в\s+форме\s+(json|таблиц|разделов|markdown|md)[^.!?\n]*[.!?]?/giu,
    /\bв\s+форме\s+[a-zа-я]+[\s,.;:][^.!?\n]*[.!?]?/giu,
    /\b(биом|environment|env)\s*[:=]\s*[^\s,.;\n]+/giu,
    /\bпак(и|ов|у|а|ам|ах)\s+монстров\b[^.!?\n]*[.!?]?/giu,
    /\bтаблиц(а|ы|у|ой|е|ах)\s*d?\d+\b[^.!?\n]*[.!?]?/giu,
    /\b(prompt|template|instruction|debug)\b[^.!?\n]*[.!?]?/giu,
    /\bundefined\b/giu,
    /\bnull\b/giu,
  ];
  for (const p of leakPatterns) s = s.replace(p, " ");
  s = s.replace(/^\s*[A-ZА-ЯЁ_]{2,}\s*[:=]\s*$/gm, "");
  s = s.replace(/([.!?…])\s*\1+/g, "$1");
  s = s.replace(/([,;:])\s*\1+/g, "$1");
  s = s.replace(/^[ \t]*\n/gm, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.replace(/[ \t]{2,}/g, " ");
  return s.trim();
}

export function prepNormKey(s: string): string {
  return sanitizePrepText(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function prepLinesOverlap(a: string, b: string): boolean {
  const ka = prepNormKey(a);
  const kb = prepNormKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (ka.length > 14 && kb.length > 14 && (ka.includes(kb) || kb.includes(ka))) return true;
  const wordsA = new Set(ka.split(" ").filter((w) => w.length > 3));
  const wordsB = kb.split(" ").filter((w) => w.length > 3);
  if (wordsA.size < 2 || wordsB.length < 2) return false;
  let match = 0;
  for (const w of wordsB) if (wordsA.has(w)) match += 1;
  return match / wordsB.length >= 0.72;
}

export function compactSentence(s: string, max = 220): string {
  const cleaned = sanitizePrepText(s).replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (cleaned.length <= max) return cleaned;
  const slice = cleaned.slice(0, max);
  const lastStop = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("!"), slice.lastIndexOf("?"), slice.lastIndexOf("…"));
  if (lastStop > max * 0.45) return slice.slice(0, lastStop + 1).trim();
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trim() + "…";
}

export function dedupePrepLines(lines: string[], context: string[] = [], limit = 6, maxLen = 200): string[] {
  const out: string[] = [];
  const seenKeys = context.map((c) => prepNormKey(c)).filter(Boolean);
  for (const raw of lines) {
    const line = compactSentence(raw, maxLen);
    if (!line || line.length < 4) continue;
    const key = prepNormKey(line);
    if (!key) continue;
    if (seenKeys.some((k) => k === key || prepLinesOverlap(line, k))) continue;
    seenKeys.push(key);
    out.push(line);
    if (out.length >= limit) break;
  }
  return out;
}
