import type { LucideIcon } from "lucide-react";

type Props = {
  name: string;
  subtitle?: string;
  badge?: string;
  body: string;
  Icon?: LucideIcon;
  metaLines?: { label: string; value: string }[];
};

/** Карточка записи кодекса (заклинание, состояние) */
export function SpellCard({ name, subtitle, badge, body, Icon: IconComp, metaLines }: Props) {
  return (
    <div className="zernix-codex__parchment">
      {badge ? <div className="zernix-codex__badge">{badge}</div> : null}
      <div className="zernix-detail-title-row" style={{ marginTop: badge ? 8 : 0 }}>
        {IconComp ? <IconComp className="zernix-detail-flame" strokeWidth={1.35} aria-hidden /> : null}
        <h2 className="zernix-codex__title" style={{ margin: 0 }}>
          {name}
        </h2>
      </div>
      {subtitle ? (
        <p className="zernix-codex__subtitle" style={{ marginTop: 8 }}>
          {subtitle}
        </p>
      ) : null}
      {metaLines && metaLines.length > 0 ? (
        <div className="zernix-stat-grid" style={{ marginTop: 14 }}>
          {metaLines.flatMap((row) => [
            <span key={`${row.label}-l`} className="zernix-stat-label">
              {row.label}
            </span>,
            <span key={`${row.label}-v`} className="zernix-stat-value">
              {row.value}
            </span>,
          ])}
        </div>
      ) : null}
      <p className="zernix-codex__prose" style={{ marginTop: 14 }}>
        {body}
      </p>
    </div>
  );
}
