import type { SessionBrief } from "../../vite-env";
import { presentSessionAtTable, type SessionAtTablePresentation } from "../sessionAtTablePresent";

type Props = {
  brief: SessionBrief;
};

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="zernix-scene-card__bullets">
      {items.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

export function SessionSceneAtTableCard({ presentation: p }: { presentation: SessionAtTablePresentation }) {
  return (
    <div className="zernix-scene-card">
      <section className="zernix-scene-card__section zernix-scene-card__section--pitch">
        <p className="zernix-scene-card__pitch">{p.pitch}</p>
      </section>

      {p.happenings.length > 0 ? (
        <section className="zernix-scene-card__section">
          <h3 className="zernix-scene-card__h">Что происходит</h3>
          <BulletList items={p.happenings} />
        </section>
      ) : null}

      {p.sceneFlair.length > 0 ? (
        <section className="zernix-scene-card__section">
          <h3 className="zernix-scene-card__h">Фишка сцены</h3>
          <BulletList items={p.sceneFlair} />
        </section>
      ) : null}

      {p.danger.length > 0 ? (
        <section className="zernix-scene-card__section">
          <h3 className="zernix-scene-card__h">Опасность</h3>
          <BulletList items={p.danger} />
        </section>
      ) : null}

      {p.rewards.length > 0 ? (
        <section className="zernix-scene-card__section">
          <h3 className="zernix-scene-card__h">Награда</h3>
          <BulletList items={p.rewards} />
        </section>
      ) : null}

      {p.hook ? (
        <section className="zernix-scene-card__section zernix-scene-card__section--hook">
          <h3 className="zernix-scene-card__h">Крючок</h3>
          <p className="zernix-scene-card__hook">{p.hook}</p>
        </section>
      ) : null}

      <section className="zernix-scene-card__section zernix-scene-card__section--summary">
        <h3 className="zernix-scene-card__h zernix-scene-card__h--sub">Суть сцены</h3>
        <p className="zernix-scene-card__summary-prose">{p.essence}</p>
        <h3 className="zernix-scene-card__h zernix-scene-card__h--sub">Главная проблема</h3>
        <p className="zernix-scene-card__summary-prose">{p.mainProblem}</p>
        <h3 className="zernix-scene-card__h zernix-scene-card__h--sub">Что запомнят игроки</h3>
        <p className="zernix-scene-card__summary-prose">{p.whatPlayersRemember}</p>
      </section>
    </div>
  );
}

/** Полная панель (каталог) — оставлена для отладки; в продуктовом UI не используется. */
export function SessionBriefPanel({ brief }: Props) {
  return <SessionSceneAtTableCard presentation={presentSessionAtTable(brief)} />;
}

/** Карточка «за столом»: только compose + dedupe, без служебных блоков. */
export function SessionBriefAtTable({ brief }: { brief: SessionBrief }) {
  return <SessionSceneAtTableCard presentation={presentSessionAtTable(brief)} />;
}
