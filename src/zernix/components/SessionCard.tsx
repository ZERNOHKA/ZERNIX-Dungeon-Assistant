import type { SessionPreviewModel } from "../models";

type Props = {
  preview: SessionPreviewModel;
  className?: string;
};

/** Компактная карточка сводки сессии (данные только из генератора) */
export function SessionCard({ preview, className }: Props) {
  return (
    <div className={`zernix-premium-panel zernix-panel-pad ${className ?? ""}`}>
      <div className="zernix-panel-heading">{preview.title}</div>
      <p className="zernix-codex__prose" style={{ margin: 0 }}>
        {preview.excerpt}
      </p>
    </div>
  );
}
