import { UserCircle } from "lucide-react";
import type { NpcPreviewState } from "../models";

type Props = {
  npc: NpcPreviewState;
  /** Компактная строка для списков */
  compact?: boolean;
};

export function NPCCard({ npc, compact }: Props) {
  if (compact) {
    return (
      <div className="zernix-premium-panel zernix-panel-pad">
        <div className="zernix-char-row" style={{ border: "none", padding: "8px 0" }}>
          <div className="zernix-char-portrait" aria-hidden>
            <UserCircle className="mx-auto mt-2 opacity-80" size={28} strokeWidth={1.1} />
          </div>
          <div>
            <div className="zernix-char-name">{npc.name}</div>
            <div className="zernix-char-sub">
              {npc.race} · {npc.creatureClass}
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="zernix-premium-panel zernix-panel-pad">
      <div className="zernix-panel-heading">Персонаж</div>
      <div className="zernix-char-name">{npc.name}</div>
      <div className="zernix-char-sub" style={{ marginTop: 6 }}>
        {npc.race} · {npc.creatureClass}
      </div>
      <p className="zernix-codex__prose" style={{ marginTop: 12 }}>
        {npc.visualTrait}
      </p>
    </div>
  );
}
