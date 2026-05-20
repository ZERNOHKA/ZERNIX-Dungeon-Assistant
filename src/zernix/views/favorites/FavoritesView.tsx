import { UserCircle } from "lucide-react";

import { useZernixUserData } from "../../../context/ZernixUserDataContext";
import type { ZernixViewId } from "../../types";

export function FavoritesView({
  onNavigate,
  onOpenLootCard,
}: {
  onNavigate: (v: ZernixViewId) => void;
  onOpenLootCard: (lootCardId: string) => void;
}) {
  const { favorites, removeFavorite } = useZernixUserData();

  return (
    <div className="zernix-page">
      <div className="zernix-premium-panel zernix-panel-pad">
        <div className="zernix-panel-heading">Список</div>
        {favorites.length === 0 ? (
          <p className="zernix-codex__prose zernix-empty-hint" style={{ margin: 0 }}>
            Здесь окажется то, что вы отметите сердечком во время игры — лут, NPC или сводка сессии.
          </p>
        ) : (
          <div className="zernix-fav-grid">
            {favorites.map((f) => (
              <div key={f.id} className="zernix-fav-row">
                <button
                  type="button"
                  className="zernix-fav-chip zernix-fav-chip--grow"
                  onClick={() => {
                    if (f.kind === "loot" && f.refKey.startsWith("loot:")) {
                      onOpenLootCard(f.refKey.slice(5));
                      return;
                    }
                    if (f.kind === "npc") {
                      onNavigate("npc");
                      return;
                    }
                    if (f.kind === "session") {
                      onNavigate("prep");
                      return;
                    }
                    onNavigate("home");
                  }}
                >
                  <UserCircle className="zernix-fav-chip__icon" strokeWidth={1.15} aria-hidden />
                  <span className="zernix-fav-chip__text">
                    <span className="zernix-fav-chip__title">{f.title}</span>
                    {f.subtitle ? <span className="zernix-fav-chip__sub">{f.subtitle}</span> : null}
                  </span>
                </button>
                <button
                  type="button"
                  className="zernix-fav-remove"
                  aria-label="Удалить из избранного"
                  onClick={() => removeFavorite(f.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
