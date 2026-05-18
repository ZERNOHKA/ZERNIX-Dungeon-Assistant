import type { ResolvedNpcCard } from "../lib/npcSummon";
import type { ZernixWorldHints } from "../lib/zernixUserStorage";
import type { NpcPreviewState } from "./models";
import { narrativeFieldsFromResolvedNpc } from "./npcNarrativeCompose";
import { npcJoinSegments, sanitizeNpcPreviewState } from "./npcUi";

export function resolvedNpcToPreviewState(card: ResolvedNpcCard, world?: Partial<ZernixWorldHints>): NpcPreviewState {
  const letter = card.name.trim().charAt(0).toUpperCase() || "?";
  const roleJob =
    card.professionLabelRu?.trim() ||
    card.occupationRu.replace(/\s*\([^)]*\)\s*$/, "").trim() ||
    card.occupationRu.trim();
  const creatureClass = npcJoinSegments([card.roleLabelRu, roleJob]);

  const epithetRaw = card.epithet?.trim() ?? "";
  const epithetOk = epithetRaw.length > 0 && !/^(undefined|null)$/i.test(epithetRaw);
  const displayName = epithetOk ? `${card.name.trim()} «${epithetRaw}»` : card.name.trim();

  const narr = narrativeFieldsFromResolvedNpc(card, world ? { world } : undefined);

  const raw: NpcPreviewState = {
    name: displayName || "Без имени",
    race: card.raceRu?.trim() ?? "",
    creatureClass,
    portraitLetter: letter,
    visualTrait: narr.visualTrait,
    wantLine: narr.wantLine,
    avoidLine: narr.avoidLine,
    secretLine: narr.secretLine,
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
  };

  return sanitizeNpcPreviewState(raw);
}
