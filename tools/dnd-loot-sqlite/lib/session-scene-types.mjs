/**
 * Тип сцены (ритм сессии) — влияет на пул и акценты генерации.
 * @typedef {'combat'|'social'|'exploration'|'mystery'|'horror'|'chase'} SceneTypeId
 */

/** @type {Readonly<Record<SceneTypeId, string>>} */
export const SCENE_TYPE_LABEL_RU = Object.freeze({
  combat: 'Бой',
  social: 'Социальная сцена',
  exploration: 'Исследование',
  mystery: 'Тайна',
  horror: 'Ужас',
  chase: 'Погоня',
});

/** @type {SceneTypeId[]} */
const ALL_TYPES = ['combat', 'social', 'exploration', 'mystery', 'horror', 'chase'];

/** @type {Readonly<Record<string, Partial<Record<SceneTypeId, number>>>>} */
const THEME_SCENE_WEIGHTS = Object.freeze({
  storm_magic: { combat: 0.38, horror: 0.22, mystery: 0.18, exploration: 0.12, chase: 0.1 },
  cult_ritual: { mystery: 0.35, horror: 0.3, combat: 0.2, social: 0.1, exploration: 0.05 },
  plague_outbreak: { horror: 0.35, mystery: 0.28, exploration: 0.2, combat: 0.12, social: 0.05 },
  undead_activity: { horror: 0.38, combat: 0.32, mystery: 0.18, exploration: 0.12 },
  smuggling_operation: { chase: 0.28, social: 0.26, mystery: 0.22, combat: 0.14, exploration: 0.1 },
  cursed_relics: { mystery: 0.34, horror: 0.3, combat: 0.22, social: 0.08, exploration: 0.06 },
  noble_conspiracy: { social: 0.42, mystery: 0.35, combat: 0.13, exploration: 0.1 },
  abandoned_laboratory: { mystery: 0.32, horror: 0.28, combat: 0.26, exploration: 0.14 },
});

const DEFAULT_WEIGHTS = Object.freeze({
  combat: 0.35,
  exploration: 0.2,
  mystery: 0.2,
  horror: 0.12,
  social: 0.08,
  chase: 0.05,
});

/**
 * @param {string} themeId
 * @param {() => number} rng
 * @returns {SceneTypeId}
 */
export function pickSceneTypeForTheme(themeId, rng) {
  const w = /** @type {Record<string, number>} */ ({
    ...DEFAULT_WEIGHTS,
    ...(THEME_SCENE_WEIGHTS[themeId] || {}),
  });
  let total = 0;
  for (const t of ALL_TYPES) {
    total += Math.max(0, Number(w[t]) || 0);
  }
  if (total <= 0) return 'combat';
  let r = rng() * total;
  for (const t of ALL_TYPES) {
    const wt = Math.max(0, Number(w[t]) || 0);
    if (r < wt) return t;
    r -= wt;
  }
  return ALL_TYPES[ALL_TYPES.length - 1] ?? 'combat';
}

function fnv1aSeed(str) {
  let h = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Тот же вес темы → тип сцены, но выбор детерминирован по тексту сессии (без RNG).
 *
 * @param {string} themeId
 * @param {string} seed
 * @returns {SceneTypeId}
 */
export function pickSceneTypeDeterministic(themeId, seed) {
  const w = /** @type {Record<string, number>} */ ({
    ...DEFAULT_WEIGHTS,
    ...(THEME_SCENE_WEIGHTS[themeId] || {}),
  });
  let total = 0;
  for (const t of ALL_TYPES) {
    total += Math.max(0, Number(w[t]) || 0);
  }
  if (total <= 0) return 'combat';
  const r = ((fnv1aSeed(`${themeId}|${seed}`) % 1_000_000) / 1_000_000) * total;
  let acc = 0;
  for (const t of ALL_TYPES) {
    const wt = Math.max(0, Number(w[t]) || 0);
    acc += wt;
    if (r < acc) return t;
  }
  return ALL_TYPES[ALL_TYPES.length - 1] ?? 'combat';
}

/**
 * @param {SceneTypeId} id
 */
export function sceneTypeLabelRu(id) {
  return SCENE_TYPE_LABEL_RU[id] ?? 'Сцена';
}
