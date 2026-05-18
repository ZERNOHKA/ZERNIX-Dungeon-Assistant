import { UserCircle } from "lucide-react";
import type { NpcPreviewState } from "../models";
import { npcJoinSegments, npcLineOrNull, npcSafeField } from "../npcUi";

type Props = {
  npc: NpcPreviewState;
  /** Компактная строка для списков */
  compact?: boolean;
};

export function NPCCard({ npc, compact }: Props) {
  const subtitle = npcJoinSegments([npc.race, npc.creatureClass]) || npcSafeField("");
  const blurb = npcLineOrNull(npc.visualTrait);

  if (compact) {
    return (
      <div className="zernix-premium-panel zernix-panel-pad">
        <div className="zernix-char-row" style={{ border: "none", padding: "8px 0" }}>
          <div className="zernix-char-portrait" aria-hidden>
            <UserCircle className="mx-auto mt-2 opacity-80" size={28} strokeWidth={1.1} />
          </div>
          <div>
            <div className="zernix-char-name">{npcSafeField(npc.name)}</div>
            <div className="zernix-char-sub">{subtitle}</div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="zernix-premium-panel zernix-panel-pad">
      <div className="zernix-panel-heading">Персонаж</div>
      <div className="zernix-char-name">{npcSafeField(npc.name)}</div>
      <div className="zernix-char-sub" style={{ marginTop: 6 }}>
        {subtitle}
      </div>
      {blurb ? (
        <p className="zernix-codex__prose" style={{ marginTop: 12 }}>
          {blurb}
        </p>
      ) : null}
    </div>
  );
}
