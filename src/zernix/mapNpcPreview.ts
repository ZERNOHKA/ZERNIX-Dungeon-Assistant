import type { ResolvedNpcCard } from "../lib/npcSummon";
import type { NpcPreviewState } from "./models";

function clampUi(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function resolvedNpcToPreviewState(card: ResolvedNpcCard): NpcPreviewState {
  const letter = card.name.trim().charAt(0).toUpperCase() || "?";
  const dq = card.dmQuick;
  const roleJob =
    card.professionLabelRu?.trim() ||
    card.occupationRu.replace(/\s*\([^)]*\)\s*$/, "").trim() ||
    card.occupationRu;

  return {
    name: card.epithet ? `${card.name} «${card.epithet}»` : card.name,
    race: card.raceRu,
    creatureClass: `${card.roleLabelRu} · ${roleJob}`,
    portraitLetter: letter,
    visualTrait: dq?.visual ?? clampUi(card.appearance, 90),
    wantLine:
      dq?.wants ??
      (card.socialStakeLine ? clampUi(card.socialStakeLine, 130) : clampUi(card.motivation, 100)),
    avoidLine: dq?.avoids ?? clampUi(card.manner, 110),
    secretLine: dq?.secret ?? clampUi(card.secret, 150),
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
  };
}
