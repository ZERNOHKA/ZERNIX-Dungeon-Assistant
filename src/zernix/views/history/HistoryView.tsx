import { useZernixUserData } from "../../../context/ZernixUserDataContext";
import { formatNoteTime } from "../../lib/formatNoteTime";

export function HistoryView({ onOpenNoteKey }: { onOpenNoteKey: (key: string) => void }) {
  const { recentNotes } = useZernixUserData();
  const rows = recentNotes(32);

  return (
    <div className="zernix-page">
      <div className="zernix-premium-panel zernix-panel-pad">
        <div className="zernix-panel-heading">Журнал заметок</div>
        {rows.length === 0 ? (
          <p className="zernix-codex__prose zernix-empty-hint" style={{ margin: 0 }}>
            Пока тихо — как только сохраните заметку в кодексе или в форме NPC/подготовки, она появится в журнале.
          </p>
        ) : (
          <div className="zernix-timeline">
            {rows.map((n) => (
              <button
                key={n.key}
                type="button"
                className="zernix-timeline__item zernix-timeline__item--btn"
                onClick={() => onOpenNoteKey(n.key)}
              >
                <span className="zernix-timeline__dot" />
                <div style={{ textAlign: "left" }}>
                  <div className="zernix-timeline__title">
                    {n.titleLabel}
                    {n.preview ? ` — ${n.preview}` : ""}
                  </div>
                  <div className="zernix-timeline__meta">{formatNoteTime(n.updatedAt)}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
