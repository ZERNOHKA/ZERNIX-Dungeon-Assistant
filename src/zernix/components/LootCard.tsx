import type { LucideIcon } from "lucide-react";
import { Heart, Hexagon, ScrollText, Sparkles, Sword } from "lucide-react";
import { useState, type MouseEvent } from "react";
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
  favorited?: boolean;
  onToggleFavorite?: () => void;
};

export function LootCard({ card, selected, onSelect, favorited, onToggleFavorite }: Props) {
  const Icon = lootCardIcon(card);
  const [favTick, setFavTick] = useState(false);

  function handleFav(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    onToggleFavorite?.();
    setFavTick(true);
    window.setTimeout(() => setFavTick(false), 420);
  }

  return (
    <div className={`zernix-loot-card-wrap ${selected ? "is-selected-wrap" : ""}`}>
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
          <p className="zernix-loot-card__desc">
            {card.description.length > 96 ? `${card.description.slice(0, 93)}…` : card.description}
          </p>
        </div>
      </button>
      {onToggleFavorite ? (
        <button
          type="button"
          className={`zernix-loot-card__fav ${favorited ? "is-on" : ""} ${favTick ? "is-tick" : ""}`}
          aria-label={favorited ? "Убрать из избранного" : "В избранное"}
          aria-pressed={favorited}
          onClick={handleFav}
        >
          <Heart
            size={18}
            strokeWidth={1.35}
            fill={favorited ? "currentColor" : "none"}
            aria-hidden
          />
        </button>
      ) : null}
    </div>
  );
}
