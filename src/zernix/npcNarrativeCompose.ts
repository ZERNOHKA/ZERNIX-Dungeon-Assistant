import type { ZernixWorldHints } from "../lib/zernixUserStorage";
import type { ResolvedNpcCard } from "../lib/npcSummon";
import type { NpcPreviewState } from "./models";

const MAX_VISUAL = 160;
const MAX_WANT = 140;
const MAX_AVOID = 140;
const MAX_SECRET = 180;

function tidy(s: unknown): string {
  if (s == null) return "";
  let t = String(s).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  if (/^(undefined|null)$/i.test(t)) return "";
  return t;
}

/** Убирает битые подстроки и «пустые» пунктуационные хвосты. */
function stripBroken(s: string): string {
  let t = tidy(s);
  if (!t) return "";
  t = t
    .replace(/\bundefined\b/gi, "")
    .replace(/\bnull\b/gi, "")
    .replace(/\s*[,;:]\s*([,;:.\s]|$)/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*—\s*—+/g, " — ")
    .replace(/^\s*[–—\-]\s*$/g, "")
    .trim();
  t = t.replace(/^[,;:.\s–—-]+/, "").replace(/[,;:.\s–—-]+$/, "").trim();
  return t;
}

function clampSoft(s: string, max: number): string {
  const t = stripBroken(s);
  if (!t) return "";
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  const use = sp > max * 0.35 ? cut.slice(0, sp) : cut;
  return `${use}…`;
}

function hashSeed(parts: Array<string | number>): number {
  const s = parts.map(String).join("\x1e");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function pick<T>(arr: readonly T[], seed: number, salt: number): T {
  if (!arr.length) return undefined as T;
  return arr[(seed + salt) % arr.length]!;
}

function isGarbage(s: string): boolean {
  const t = tidy(s);
  if (!t || t.length < 6) return true;
  if (/\bundefined\b|\bnull\b/i.test(t)) return true;
  return false;
}

function oneSentence(text: string, max: number): string {
  const t = tidy(text);
  if (!t || isGarbage(t)) return "";
  const m = t.match(/^.{8,320}?[.!?](?=\s|$)/);
  const one = m ? m[0]!.trim() : t;
  return clampSoft(one, max);
}

function nthSentence(text: string, n: number, max: number): string {
  const t = tidy(text);
  if (!t) return "";
  const parts = t
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter((x) => x && !isGarbage(x));
  if (parts.length < n) return "";
  return clampSoft(parts[n - 1]!, max);
}

/** Склеивает без дублирования начала/хвоста по смыслу. */
function glueUnique(a: string, b: string, sep: string, max: number): string {
  const ta = stripBroken(a);
  const tb = stripBroken(b);
  if (!ta) return clampSoft(tb, max);
  if (!tb) return clampSoft(ta, max);
  const la = ta.toLowerCase();
  const lb = tb.toLowerCase();
  const probe = tb.length > 28 ? tb.slice(0, 28).toLowerCase() : lb;
  if (la.includes(probe) || probe.length >= 12 && la.endsWith(probe.slice(0, 12))) return clampSoft(ta, max);
  const probeA = ta.length > 28 ? ta.slice(0, 28).toLowerCase() : la;
  if (lb.includes(probeA) || probeA.length >= 12 && lb.endsWith(probeA.slice(0, 12))) return clampSoft(tb, max);
  return clampSoft(`${ta}${sep}${tb}`, max);
}

function prefixAvoidClause(body: string, seed: number): string {
  const t = stripBroken(body);
  if (!t) return "";
  if (/^(избегает|боится|не выносит|скрывается|на дух не|держится подальше)/i.test(t.slice(0, 28))) return t;
  const prefs = ["Избегает", "Боится", "Не выносит", "Старается обходить"] as const;
  const p = pick(prefs, seed, 3);
  const rest = t.charAt(0).toLowerCase() + t.slice(1);
  return `${p} ${rest}`.replace(/\s+/g, " ").trim();
}

function dedupeBlocks(primary: string, secondary: string, maxJoin: number): string {
  const p = stripBroken(primary);
  const s = stripBroken(secondary);
  if (!p) return s;
  if (!s) return p;
  const pl = p.toLowerCase();
  const sl = s.toLowerCase();
  const n = 22;
  const head = sl.slice(0, Math.min(n, sl.length));
  if (head.length >= 10 && pl.includes(head)) return p;
  const tail = pl.slice(-Math.min(40, pl.length));
  if (tail.length >= 10 && sl.includes(tail.slice(0, 18))) return p;
  return glueUnique(p, s, " ", maxJoin);
}

export type NarrativeRerollSlot = "visual" | "want" | "avoid" | "secret";

export type NarrativeComposeOptions = {
  rerollSlot?: NarrativeRerollSlot;
  entropyMs?: number;
  world?: Partial<ZernixWorldHints>;
};

function worldEchoWant(world: Partial<ZernixWorldHints> | undefined, mix: number): string {
  if (!world) return "";
  if (mix % 100 > 16) return "";
  const lastNpc = tidy(world.lastNpcName);
  const threat = tidy(world.currentThreat);
  const fac = tidy(world.activeFaction);
  const loc = tidy(world.currentLocation);
  const k = mix % 4;
  if (k === 0 && lastNpc) return ` Упоминание «${clampSoft(lastNpc, 32)}».`;
  if (k === 1 && threat) return ` Фон: ${clampSoft(threat, 36)}.`;
  if (k === 2 && fac) return ` Слухи: ${clampSoft(fac, 34)}.`;
  if (k === 3 && loc) return ` Место: ${clampSoft(loc, 32)}.`;
  return "";
}

function worldEchoSecret(world: Partial<ZernixWorldHints> | undefined, mix: number): string {
  if (!world) return "";
  if (mix % 100 > 14) return "";
  const hk = tidy(world.lastHookLine);
  const threat = tidy(world.currentThreat);
  const j = mix % 3;
  if (j === 0 && hk) return ` Намёк: ${clampSoft(hk, 48)}.`;
  if (j === 1 && threat) return ` Связь с ${clampSoft(threat, 40)}.`;
  return "";
}

export function narrativeFieldsFromResolvedNpc(
  card: ResolvedNpcCard,
  opts?: NarrativeComposeOptions,
): Pick<NpcPreviewState, "visualTrait" | "wantLine" | "avoidLine" | "secretLine"> {
  const dq = card.dmQuick;
  const base = hashSeed([
    card.name,
    card.raceRu,
    card.occupationRu,
    tidy(card.motivation).slice(0, 64),
    tidy(card.secret).slice(0, 48),
  ]);
  const ent = Number(opts?.entropyMs ?? 0) || 0;
  const rs = opts?.rerollSlot;
  const mixKey = hashSeed([base, rs ?? "all", String(ent), "v2"]);

  const vSeed = rs === "visual" ? hashSeed([base, "rv", ent, "b"]) : base;
  const wSeed = rs === "want" ? hashSeed([base, "rw", ent, "b"]) : base;
  const aSeed = rs === "avoid" ? hashSeed([base, "ra", ent, "b"]) : base;
  const sSeed = rs === "secret" ? hashSeed([base, "rs", ent, "b"]) : base;
  const world = opts?.world;

  const vDm = tidy(dq?.visual);
  const wDm = tidy(dq?.wants);
  const aDm = tidy(dq?.avoids);
  const sDm = tidy(dq?.secret);

  const appearance = tidy(card.appearance);
  const manner = tidy(card.manner);
  const motivation = tidy(card.motivation);
  const secretPlot = tidy(card.secret);
  const stake = tidy(card.socialStakeLine);
  const hobby = tidy(card.hobbyEclectic);
  const where = tidy(card.whereToFindNow);
  const craft = tidy(card.craftsmanshipNarrativeHook);
  const meet = tidy(card.encounterMeetingRu);
  const disp = tidy(card.dispositionLabelRu);
  const catchph = tidy(card.catchphrase);
  const spec = tidy(card.specializationLine);

  const visCore =
    glueUnique(vDm, appearance, " ", 130) ||
    oneSentence(appearance, 130) ||
    oneSentence(manner, 120) ||
    "";
  const pool = [hobby, where, craft, catchph].map(tidy).filter((x) => x && !isGarbage(x));
  const motion = pool.length ? pick(pool as readonly string[], (vSeed ^ (ent | 0)) >>> 0, 1) : "";
  let visualTrait = visCore;
  if (motion) {
    const bit = oneSentence(motion, 72);
    if (bit && !visCore.toLowerCase().includes(bit.slice(0, 14).toLowerCase())) {
      visualTrait = glueUnique(visCore, bit, " ", MAX_VISUAL);
    }
  }
  if (!visualTrait) {
    const m1 = oneSentence(manner, 100);
    visualTrait = m1 || "Запоминается жестом и тем, куда смотрит в тишине.";
  } else if (!motion && manner) {
    const m2 = nthSentence(manner, 2, 56);
    if (m2 && !visualTrait.toLowerCase().includes(m2.slice(0, 12).toLowerCase())) {
      visualTrait = glueUnique(visualTrait, m2, " ", MAX_VISUAL);
    }
  }
  visualTrait = clampSoft(visualTrait, MAX_VISUAL);

  let wantLine = glueUnique(glueUnique(wDm, oneSentence(motivation, 100), " ", 110), stake, " ", MAX_WANT);
  wantLine = stripBroken(wantLine);
  if (!wantLine) wantLine = oneSentence(stake, 100) || "Нужен ясный исход без огласки.";
  wantLine = clampSoft(wantLine, MAX_WANT);
  const echoW = worldEchoWant(world, hashSeed([String(wSeed), "wEcho", String(ent)]));
  if (echoW) wantLine = clampSoft(glueUnique(wantLine, echoW.trim(), " ", MAX_WANT + 28), MAX_WANT);

  const mannerBit = oneSentence(manner, 95);
  const fearCore = glueUnique(aDm, mannerBit, " ", 115) || mannerBit || oneSentence(catchph, 90);
  let avoidLine = stripBroken(fearCore) ? prefixAvoidClause(fearCore, aSeed + ent) : "";
  if (disp && avoidLine && !avoidLine.toLowerCase().includes(disp.slice(0, 12).toLowerCase())) {
    const dbit = clampSoft(`Партия: ${disp}.`, 48);
    avoidLine = glueUnique(avoidLine, dbit, " ", MAX_AVOID + 20);
  } else if (disp && !avoidLine) {
    avoidLine = clampSoft(`Настроен к партии: ${disp}.`, MAX_AVOID);
  }
  avoidLine = clampSoft(avoidLine || "Держит дистанцию, пока не поймёт, кто вы.", MAX_AVOID);

  const secretCore = glueUnique(sDm, oneSentence(secretPlot, 130), " ", 150) || oneSentence(secretPlot, 150);
  const midBits = [oneSentence(spec, 70), oneSentence(meet, 80)].filter(Boolean);
  const midPick = midBits.length ? pick(midBits as readonly string[], sSeed + ent, 2) : "";
  let secretLine = secretCore
    ? clampSoft(dedupeBlocks(secretCore, midPick, MAX_SECRET), MAX_SECRET)
    : clampSoft(oneSentence(secretPlot, 150) || oneSentence(meet, 120) || "Тайна, которую можно вытащить давлением или сделкой.", MAX_SECRET);
  const echoS = worldEchoSecret(world, hashSeed([String(sSeed), "sEcho", String(ent), String(mixKey)]));
  if (echoS) secretLine = clampSoft(glueUnique(secretLine, echoS.trim(), " ", MAX_SECRET + 36), MAX_SECRET);
  secretLine = clampSoft(secretLine, MAX_SECRET);

  return {
    visualTrait: stripBroken(visualTrait),
    wantLine: stripBroken(wantLine),
    avoidLine: stripBroken(avoidLine),
    secretLine: stripBroken(secretLine),
  };
}
