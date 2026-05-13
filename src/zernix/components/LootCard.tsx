import type { LucideIcon } from "lucide-react";
import { Hexagon, ScrollText, Sparkles, Sword } from "lucide-react";
import type { LootCardModel } from "../models";

export function lootCardIcon(card: LootCardModel): LucideIcon {
  const t = `${card.title} ${card.displayLine}`.toLowerCase();
  if (/зелье|potion|флакон|настой/i.test(t)) return Sparkles;
  if (/свиток|scroll/i.test(t)) return ScrollText;
  if (/кольцо|ring|перстень/i.test(t)) return Hexagon;
  if (/оруж|weapon|меч|топор|клинок|лук/i.test(t)) return Sword;
  if (card.source === "magic") return Sparkles;
  return Sword;
}

type Props = {
  card: LootCardModel;
  selected: boolean;
  onSelect: () => void;
};

export function LootCard({ card, selected, onSelect }: Props) {
  const Icon = lootCardIcon(card);
  return (
    <button
      type="button"
      className={`zernix-loot-card ${selected ? "is-selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div className="zernix-loot-card__icon">
        <Icon strokeWidth={1.15} aria-hidden />
      </div>
      <div className="zernix-loot-card__body">
        <div className="zernix-loot-card__title">{card.title}</div>
        <div className="zernix-loot-card__meta">
          {card.rarityLabel} · {card.kindLabel}
        </div>
        <p className="zernix-loot-card__desc">{card.description}</p>
      </div>
    </button>
  );
}
