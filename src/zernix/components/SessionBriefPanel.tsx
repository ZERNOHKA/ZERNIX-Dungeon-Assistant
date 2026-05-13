import type { SessionBrief } from "../../vite-env";

type Props = {
  brief: SessionBrief;
};

export function SessionBriefPanel({ brief }: Props) {
  return (
    <div className="zernix-session-brief">
      <section className="zernix-session-brief__block zernix-session-brief__block--theme">
        <div className="zernix-session-brief__label">Тема сцены</div>
        <p className="zernix-session-brief__body">{brief.themeLabel}</p>
      </section>
      {brief.sceneTypeLabel ? (
        <section className="zernix-session-brief__block">
          <div className="zernix-session-brief__label">Тип сцены</div>
          <p className="zernix-session-brief__body">{brief.sceneTypeLabel}</p>
        </section>
      ) : null}
      {brief.biomeLabel ? (
        <section className="zernix-session-brief__block">
          <div className="zernix-session-brief__label">Биом</div>
          <p className="zernix-session-brief__body">{brief.biomeLabel}</p>
        </section>
      ) : null}
      {brief.encounterPitch ? (
        <section className="zernix-session-brief__block zernix-session-brief__block--hook">
          <div className="zernix-session-brief__label">Сцена в одном предложении</div>
          <p className="zernix-session-brief__body">{brief.encounterPitch}</p>
        </section>
      ) : null}
      {brief.worldSummary ? (
        <section className="zernix-session-brief__block">
          <div className="zernix-session-brief__label">Контекст мира</div>
          <p className="zernix-session-brief__body">{brief.worldSummary}</p>
        </section>
      ) : null}
      {brief.locationStructuredName ? (
        <section className="zernix-session-brief__block">
          <div className="zernix-session-brief__label">Объект сцены</div>
          <p className="zernix-session-brief__body">{brief.locationStructuredName}</p>
        </section>
      ) : null}
      {brief.locationZonesLine ? (
        <section className="zernix-session-brief__block">
          <div className="zernix-session-brief__label">Зоны</div>
          <p className="zernix-session-brief__body">{brief.locationZonesLine}</p>
        </section>
      ) : null}
      {brief.factionHintsLine ? (
        <section className="zernix-session-brief__block">
          <div className="zernix-session-brief__label">Фракции</div>
          <p className="zernix-session-brief__body">{brief.factionHintsLine}</p>
        </section>
      ) : null}
      <section className="zernix-session-brief__block">
        <div className="zernix-session-brief__label">Локация</div>
        <p className="zernix-session-brief__body">{brief.location}</p>
      </section>
      <section className="zernix-session-brief__block">
        <div className="zernix-session-brief__label">Атмосфера</div>
        <p className="zernix-session-brief__body">{brief.atmosphere}</p>
      </section>
      <section className="zernix-session-brief__block">
        <div className="zernix-session-brief__label">Угроза</div>
        <p className="zernix-session-brief__body">{brief.danger}</p>
      </section>
      <section className="zernix-session-brief__block">
        <div className="zernix-session-brief__label">Враги</div>
        <ul className="zernix-session-brief__list">
          {brief.enemies.map((line, i) => (
            <li key={`${i}-${line}`}>{line}</li>
          ))}
        </ul>
      </section>
      <section className="zernix-session-brief__block">
        <div className="zernix-session-brief__label">Награда</div>
        <ul className="zernix-session-brief__list">
          {brief.rewardLines.map((line, i) => (
            <li key={`${i}-${line}`}>{line}</li>
          ))}
        </ul>
      </section>
      <section className="zernix-session-brief__block zernix-session-brief__block--hook">
        <div className="zernix-session-brief__label">Крючок</div>
        <p className="zernix-session-brief__body">{brief.hook}</p>
      </section>
    </div>
  );
}
