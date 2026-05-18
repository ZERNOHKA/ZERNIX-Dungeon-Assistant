/**
 * Память подземелья (ZERNIX NEXUS) — состояние цепочки комнат.
 * Логика извлечения тегов из «следа» дублирует правила старого loot-generator-55
 * (если меняете эвристики — сверяйте с серверной версией вне репозитория).
 */

export interface DungeonRunState {
  floorDepth: number;
  persistentTags: string[];
  /** Бонус к бюджету XP только от глубины (каждые 2 уровня +10%). */
  difficultyBias: number;
  /** Разовый бонус от разведки прошлой комнаты (+15%), вливается в payload и сбрасывается после ответа. */
  pendingScoutAlarmBias: number;
  /** След с последней успешной генерации (для «Продолжить путь» и заголовка отчёта). */
  traceFromLastRoom: string | null;
  transitionMarkdown: string | null;
}

/** Дублирует правила `extractTagsFromTrace` (как в legacy loot-generator-55). */
export function extractTagsFromTraceClient(traceText: string | null | undefined): string[] {
  const t = String(traceText ?? "").toLowerCase();
  const tags = new Set<string>();
  if (/гнилостн|разложен|труп|decay|putref|rotting|corpse|shamble|necrot/i.test(t)) {
    tags.add("undead");
  }
  if (/оккультн|ритуал|кров|blood symbol|occult|sigil|pentagram|cult|жертв/i.test(t)) {
    tags.add("cultist");
    tags.add("fiend");
  }
  if (/чешуя|коготь|дракон|dragon|scale|claw furrow|reptilian|wyrm/i.test(t)) {
    tags.add("dragon");
    tags.add("monstrosity");
  }
  if (/золото|монет|бандит|gold coin|purse|brigand|thug|orders addressed|разбой/i.test(t)) {
    tags.add("humanoid");
    tags.add("bandit");
  }
  if (/механическ|скрежет|gears|clockwork|construct|automaton|golem/i.test(t)) {
    tags.add("construct");
  }
  return [...tags];
}

export function createInitialDungeonRun(): DungeonRunState {
  return {
    floorDepth: 0,
    persistentTags: [],
    difficultyBias: 0,
    pendingScoutAlarmBias: 0,
    traceFromLastRoom: null,
    transitionMarkdown: null,
  };
}

/**
 * Перед «следующей комнатой»: увеличить глубину, влить теги из следа, эскалация XP (+10% за каждые 2 уровня глубины).
 */
export function advanceDungeonRun(prev: DungeonRunState): DungeonRunState {
  const tr = prev.traceFromLastRoom;
  const added = tr ? extractTagsFromTraceClient(tr) : [];
  const merged = [...new Set([...prev.persistentTags, ...added])];
  const newDepth = prev.floorDepth + 1;
  const bias = Math.floor(newDepth / 2) * 0.1;
  const transitionMarkdown = tr
    ? `Вы прошли по следу: «${tr}» и углубились (Уровень ${newDepth}).`
    : `Вы углубились (Уровень ${newDepth}).`;
  return {
    floorDepth: newDepth,
    persistentTags: merged,
    difficultyBias: bias,
    pendingScoutAlarmBias: prev.pendingScoutAlarmBias,
    traceFromLastRoom: tr,
    transitionMarkdown,
  };
}

/** Payload для IPC / `formatSessionPrepMarkdownReport`. */
export function dungeonRunToSessionPayload(run: DungeonRunState) {
  const scout = Math.max(0, Number(run.pendingScoutAlarmBias) || 0);
  const depthBias = Math.max(0, Number(run.difficultyBias) || 0);
  return {
    floorDepth: run.floorDepth,
    persistentTags: run.persistentTags,
    difficultyBias: depthBias + scout,
    previousTraceForHeader: run.traceFromLastRoom,
    transitionMarkdown: run.transitionMarkdown,
  };
}
