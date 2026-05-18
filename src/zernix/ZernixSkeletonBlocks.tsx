/** Статичные скелетоны (без логики) — ощущение скорости, без скачков вёрстки. */

export function ZernixLootResultsSkeleton() {
  return (
    <div className="zernix-skel zernix-skel--loot" aria-busy="true" aria-label="Генерация добычи">
      <div className="zernix-skel__bar zernix-skel__bar--lg" />
      <div className="zernix-skel__grid2">
        <div className="zernix-skel__card">
          <div className="zernix-skel__bar zernix-skel__bar--md" />
          <div className="zernix-skel__bar" />
          <div className="zernix-skel__bar zernix-skel__bar--sm" />
        </div>
        <div className="zernix-skel__card">
          <div className="zernix-skel__bar zernix-skel__bar--md" />
          <div className="zernix-skel__bar" />
          <div className="zernix-skel__bar zernix-skel__bar--short" />
        </div>
      </div>
    </div>
  );
}

export function ZernixNpcCardSkeleton() {
  return (
    <div className="zernix-skel zernix-skel--npc" aria-busy="true" aria-label="Генерация NPC">
      <div className="zernix-skel__bar zernix-skel__bar--xl" />
      <div className="zernix-skel__bar zernix-skel__bar--sm" />
      <div className="zernix-skel__stack">
        <div className="zernix-skel__bar" />
        <div className="zernix-skel__bar" />
        <div className="zernix-skel__bar" />
        <div className="zernix-skel__bar zernix-skel__bar--short" />
      </div>
    </div>
  );
}

export function ZernixSessionSummarySkeleton() {
  return (
    <div className="zernix-skel zernix-skel--session" aria-busy="true" aria-label="Генерация сводки">
      <div className="zernix-skel__bar zernix-skel__bar--lg" />
      <div className="zernix-skel__stack">
        <div className="zernix-skel__bar" />
        <div className="zernix-skel__bar" />
        <div className="zernix-skel__bar" />
        <div className="zernix-skel__bar zernix-skel__bar--short" />
        <div className="zernix-skel__bar" />
      </div>
    </div>
  );
}
