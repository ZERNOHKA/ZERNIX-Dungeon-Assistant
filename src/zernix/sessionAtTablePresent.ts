import type { SessionBrief } from "../vite-env";
import {
  finalizeSessionMarkdownForUi,
  isJunkMetadataLine,
  isPromptLikeFragment,
  sanitizeSessionBrief,
} from "./sessionNarrativeCleanup";

export type SessionAtTablePresentation = {
  pitch: string;
  happenings: string[];
  sceneFlair: string[];
  danger: string[];
  rewards: string[];
  hook: string;
  essence: string;
  mainProblem: string;
  whatPlayersRemember: string;
};

function tidy(s: unknown): string {
  if (s == null) return "";
  let t = String(s).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  if (/^(undefined|null)$/i.test(t)) return "";
  t = t.replace(/\bundefined\b/gi, "").replace(/\bnull\b/gi, "").replace(/\s{2,}/g, " ").trim();
  return t;
}

function humanizeShouting(s: string): string {
  const t = tidy(s);
  if (!t) return "";
  const letters = t.replace(/[^a-zA-ZА-Яа-яЁё]/g, "");
  if (letters.length < 8) return t;
  const upper = [...letters].filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length;
  if (upper / letters.length > 0.55) {
    const x = t.toLowerCase();
    return x.charAt(0).toUpperCase() + x.slice(1);
  }
  return t;
}

function sentencesFrom(text: string, maxLen = 220): string[] {
  const t = humanizeShouting(text);
  if (!t) return [];
  const parts = t
    .split(/(?<=[.!?])\s+/)
    .map((x) => tidy(x))
    .filter((x) => x.length > 8 && !/^[,;:.\s]+$/u.test(x) && !isPromptLikeFragment(x) && !isJunkMetadataLine(x));
  return parts.map((x) => (x.length > maxLen ? `${x.slice(0, maxLen - 1)}…` : x));
}

function splitClauses(s: string): string[] {
  const t = humanizeShouting(s);
  if (!t) return [];
  return t
    .split(/[.;|]+/)
    .map((x) => tidy(x.replace(/^[-•*]\s*/, "")))
    .filter(
      (x) =>
        x.length > 10 &&
        x.length < 200 &&
        !isPromptLikeFragment(x) &&
        !isJunkMetadataLine(x),
    );
}

function normOverlapKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-zа-яёё0-9\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 44);
}

function overlaps(a: string, b: string): boolean {
  const na = normOverlapKey(a);
  const nb = normOverlapKey(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const probe = nb.slice(0, Math.min(26, nb.length));
  if (probe.length >= 12 && na.includes(probe)) return true;
  const probeA = na.slice(0, Math.min(26, na.length));
  return probeA.length >= 12 && nb.includes(probeA);
}

function pushUnique(bucket: string[], line: string, max: number, avoid: readonly string[]): boolean {
  const t = tidy(humanizeShouting(line));
  if (!t || t.length < 8) return false;
  if (isJunkMetadataLine(t) || isPromptLikeFragment(t)) return false;
  if (bucket.length >= max) return false;
  const pool = [...bucket, ...avoid];
  for (const p of pool) {
    if (overlaps(t, p)) return false;
  }
  bucket.push(t);
  return true;
}

function hashPick(seed: string, mod: number): number {
  if (mod <= 0) return 0;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % mod;
}

const ENV_SCENE_FLAVOR = [
  "Где-то в темноте капает вода — и каждый звук кажется шагом.",
  "Слышен далёкий гул: будто что-то большое дышит за стеной.",
  "Вспышка света на мгновение выхватывает чужие следы — потом снова тьма.",
  "Металл холоднее воздуха; прикосновение оставляет кожу мокрой от росы.",
  "Пыль висит в луче фонаря, как мелкая рыба в воде.",
  "Запах гнили и озона смешивается — здесь недавно шла магия или гроза.",
  "Эхо отвечает с задержкой, будто комната чуть шире, чем кажется.",
  "На стене — свежие царапины: кто-то цеплялся, пока его уводили вниз.",
  "Тишина «липкая» — разговор ниже шёпота слышит каждый.",
  "Старый колокол звонит один раз без языка — или язык уже не важен.",
  "По полу тянется тонкая струйка тёплой воды из-под заваленной двери.",
  "Служебный фонарь мигает сам по себе, будто передаёт код.",
] as const;

function isWeakDangerLine(s: string): boolean {
  const t = tidy(s);
  if (!t || isJunkMetadataLine(t) || isPromptLikeFragment(t)) return true;
  if (t.length < 14 && /^[a-z\s\-]+$/i.test(t)) return true;
  return false;
}

function buildPitch(br: SessionBrief, themeHint: string): string {
  const chunks: string[] = [];
  const avoid: string[] = [];
  if (themeHint) avoid.push(themeHint);
  const tl = tidy(br.themeLabel);
  if (tl) avoid.push(tl);

  for (const p of sentencesFrom(br.encounterPitch ?? "", 260).slice(0, 2)) {
    if (pushUnique(chunks, p, 4, avoid)) avoid.push(chunks[chunks.length - 1]!);
  }
  const locAtm = glueShort(br.location, br.atmosphere, 200);
  if (locAtm && pushUnique(chunks, locAtm, 4, avoid)) avoid.push(chunks[chunks.length - 1]!);

  const ws0 = sentencesFrom(br.worldSummary ?? "", 180)[0];
  if (ws0 && pushUnique(chunks, ws0, 4, avoid)) avoid.push(chunks[chunks.length - 1]!);

  let out = chunks.join(" ").replace(/\s+/g, " ").trim();
  if (!out) {
    out = clamp(
      [
        tl,
        glueShort(tidy(br.location), tidy(br.atmosphere), 200),
        tidy(br.encounterPitch),
        tidy(br.worldSummary),
        glueShort(tidy(br.hook), tidy(br.danger), 300),
      ]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
      520,
    );
  }
  if (!out) out = tl;
  if (!out) out = clamp(glueShort(tidy(br.danger), tidy(br.hook), 400), 520);
  return clamp(sentencesFrom(out, 340).slice(0, 3).join(" "), 520);
}

function glueShort(a: string, b: string, max: number): string {
  const ta = tidy(humanizeShouting(a));
  const tb = tidy(humanizeShouting(b));
  if (!ta) return clamp(tb, max);
  if (!tb) return clamp(ta, max);
  if (overlaps(ta, tb)) return clamp(ta, max);
  return clamp(`${ta} ${tb.charAt(0).toLowerCase()}${tb.slice(1)}`, max);
}

function clamp(s: string, max: number): string {
  const t = tidy(s);
  if (!t) return "";
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return `${sp > max * 0.38 ? cut.slice(0, sp) : cut}…`;
}

function buildPlotHappenings(br: SessionBrief, pitch: string): string[] {
  const happenings: string[] = [];
  const avoidH: string[] = [pitch];

  for (const s of sentencesFrom(br.encounterPitch ?? "", 150)) {
    if (pushUnique(happenings, s, 5, avoidH)) avoidH.push(happenings[happenings.length - 1]!);
  }
  for (const chunk of splitClauses(br.encounterPitch ?? "")) {
    if (pushUnique(happenings, chunk, 5, avoidH)) avoidH.push(happenings[happenings.length - 1]!);
  }
  for (const chunk of splitClauses(br.factionHintsLine ?? "")) {
    if (pushUnique(happenings, chunk, 5, avoidH)) avoidH.push(happenings[happenings.length - 1]!);
  }
  for (const chunk of splitClauses(br.locationZonesLine ?? "")) {
    if (pushUnique(happenings, chunk, 5, avoidH)) avoidH.push(happenings[happenings.length - 1]!);
  }
  for (const s of sentencesFrom(br.worldSummary ?? "", 140)) {
    if (pushUnique(happenings, s, 5, avoidH)) avoidH.push(happenings[happenings.length - 1]!);
  }
  if (happenings.length < 2) {
    const loc = clamp(tidy(br.location), 110);
    if (loc) pushUnique(happenings, loc, 5, avoidH);
  }
  return happenings.slice(0, 4);
}

function buildDangerLines(br: SessionBrief, pitch: string, happenings: string[]): string[] {
  const danger: string[] = [];
  const avoidD = [pitch, ...happenings];

  for (const e of br.enemies) {
    const line = clamp(humanizeShouting(e), 118);
    if (!isWeakDangerLine(line) && pushUnique(danger, line, 5, avoidD)) avoidD.push(danger[danger.length - 1]!);
  }
  for (const d of sentencesFrom(br.danger ?? "", 140)) {
    if (!isWeakDangerLine(d) && pushUnique(danger, d, 5, avoidD)) avoidD.push(danger[danger.length - 1]!);
  }
  if (danger.length < 2 && tidy(br.danger) && !isWeakDangerLine(br.danger)) {
    const one = clamp(tidy(br.danger), 130);
    if (pushUnique(danger, one, 5, avoidD)) avoidD.push(one);
  }
  return danger.slice(0, 4);
}

function buildSceneFlair(br: SessionBrief, pitch: string, happenings: string[]): string[] {
  const sceneFlair: string[] = [];
  const avoidF = [pitch, ...happenings];
  for (const c of splitClauses(br.atmosphere)) {
    if (pushUnique(sceneFlair, c, 5, avoidF)) avoidF.push(sceneFlair[sceneFlair.length - 1]!);
  }
  for (const s of sentencesFrom(br.atmosphere ?? "", 120)) {
    if (pushUnique(sceneFlair, s, 5, avoidF)) avoidF.push(sceneFlair[sceneFlair.length - 1]!);
  }
  if (sceneFlair.length < 2) {
    const hookBits = sentencesFrom(br.hook ?? "", 110)[0];
    if (hookBits && !overlaps(hookBits, pitch) && pushUnique(sceneFlair, hookBits, 5, avoidF)) avoidF.push(hookBits);
  }
  const seed = `${br.title}|${br.themeLabel}|${pitch}`;
  if (sceneFlair.length < 2) {
    const start = hashPick(seed, ENV_SCENE_FLAVOR.length);
    for (let i = 0; i < ENV_SCENE_FLAVOR.length && sceneFlair.length < 3; i += 1) {
      const line = ENV_SCENE_FLAVOR[(start + i) % ENV_SCENE_FLAVOR.length]!;
      pushUnique(sceneFlair, line, 5, avoidF);
    }
  }
  return sceneFlair.slice(0, 4);
}

function buildReadableEssence(br: SessionBrief, pitch: string, hook: string): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => {
    const t = tidy(s);
    if (!t || isPromptLikeFragment(t)) return;
    const k = normOverlapKey(t);
    if (seen.has(k)) return;
    seen.add(k);
    parts.push(t);
  };
  for (const s of sentencesFrom(br.encounterPitch ?? "", 220).slice(0, 2)) add(s);
  for (const s of sentencesFrom(br.worldSummary ?? "", 200).slice(0, 1)) add(s);
  if (parts.length < 2) for (const s of sentencesFrom(pitch, 240).slice(0, 2)) add(s);
  if (parts.length < 2 && hook) add(hook);
  let out = parts.join(" ").replace(/\s+/g, " ").trim();
  if (!out) out = pitch;
  return clamp(sentencesFrom(out, 360).slice(0, 3).join(" "), 440);
}

function pickCinematicMemory(pitch: string, atmosphere: string, flair: string[], hook: string): string {
  const candidates = [...flair, ...sentencesFrom(atmosphere, 150), ...sentencesFrom(hook, 140), ...sentencesFrom(pitch, 150)].filter(
    (x) => x.length > 14 && !isPromptLikeFragment(x),
  );
  if (!candidates.length) return clamp(pitch, 160);
  const scored = candidates.map((c) => {
    let score = 0;
    if (/как |будто |словно |эхо|тень|вспых|молн|тьм|тишин|звук|шёпот|холод|дым|кров|рук|фонар|колокол|темнот/i.test(c)) score += 4;
    if (/[,;—]/u.test(c)) score += 1;
    if (c.length > 36 && c.length < 155) score += 2;
    return { c, score };
  });
  scored.sort((a, b) => b.score - a.score || b.c.length - a.c.length);
  return clamp(scored[0]!.c, 168);
}

export function pitchExcerpt(p: SessionAtTablePresentation, max = 280): string {
  const t = tidy(p.pitch);
  return clamp(t, max);
}

export function presentSessionAtTable(b: SessionBrief): SessionAtTablePresentation {
  const br = sanitizeSessionBrief(b);
  const themeHint = normOverlapKey(br.themeLabel);

  const pitch = buildPitch(br, themeHint);
  const happenings = buildPlotHappenings(br, pitch);
  const danger = buildDangerLines(br, pitch, happenings);
  const sceneFlair = buildSceneFlair(br, pitch, happenings);

  const hook = clamp(
    tidy(humanizeShouting(br.hook)) ||
      sentencesFrom(pitch, 120)[0] ||
      sentencesFrom(tidy(br.danger), 120)[0] ||
      clamp(tidy(br.themeLabel), 120),
    200,
  );

  const essence = buildReadableEssence(br, pitch, hook);
  const mainProblem = clamp(
    sentencesFrom(br.danger ?? "", 170)[0] ||
      sentencesFrom(br.worldSummary ?? "", 170)[0] ||
      sentencesFrom(pitch, 170)[0] ||
      hook,
    210,
  );
  const whatPlayersRemember = pickCinematicMemory(pitch, br.atmosphere, sceneFlair, hook);

  return {
    pitch,
    happenings,
    sceneFlair,
    danger,
    rewards: br.rewardLines.slice(0, 4),
    hook,
    essence,
    mainProblem,
    whatPlayersRemember,
  };
}

const SECTION_KEYS = new Set([
  "ТЕМА",
  "ТИП СЦЕНЫ",
  "БИОМ",
  "СЦЕНА",
  "МИР",
  "ОБЪЕКТ",
  "ЗОНЫ",
  "ФРАКЦИИ",
  "ЛОКАЦИЯ",
  "АТМОСФЕРА",
  "УГРОЗА",
  "ВРАГИ",
  "НАГРАДА",
  "КРЮЧОК",
]);

/** Если есть только markdown-лог — вытащить блоки без смены генератора. */
export function presentSessionFromLogMarkdown(markdown: string): SessionAtTablePresentation | null {
  const raw = finalizeSessionMarkdownForUi(markdown);
  if (!raw) return null;
  const lines = raw.split("\n").map((l) => l.trim());
  const map: Record<string, string[]> = {};
  let key: string | null = null;
  let title = "Сессия";
  const ln0 = lines[0];
  if (ln0 && !SECTION_KEYS.has(ln0)) title = humanizeShouting(ln0);

  for (const line of lines) {
    if (SECTION_KEYS.has(line)) {
      key = line;
      map[key] = [];
      continue;
    }
    if (key && line) map[key]!.push(line);
  }
  const fake: SessionBrief = {
    title,
    themeLabel: map["ТЕМА"]?.join(" ") || "",
    sceneTypeLabel: map["ТИП СЦЕНЫ"]?.join(" "),
    biomeLabel: map["БИОМ"]?.join(" "),
    encounterPitch: map["СЦЕНА"]?.join(" "),
    worldSummary: map["МИР"]?.join(" "),
    locationStructuredName: map["ОБЪЕКТ"]?.join(" "),
    locationZonesLine: map["ЗОНЫ"]?.join(" "),
    factionHintsLine: map["ФРАКЦИИ"]?.join(" "),
    location: map["ЛОКАЦИЯ"]?.join(" ") || "",
    atmosphere: map["АТМОСФЕРА"]?.join(" ") || "",
    danger: map["УГРОЗА"]?.join(" ") || "",
    enemies: map["ВРАГИ"] || [],
    rewardLines: map["НАГРАДА"] || [],
    hook: map["КРЮЧОК"]?.join(" ") || "",
  };
  if (!fake.location && !fake.encounterPitch && !fake.themeLabel) return null;
  return presentSessionAtTable(fake);
}
