/**
 * Финальная валидация встречи перед нарративом: биом, когерентность темы/фракций, средний скоринг.
 */

import { narrativeMonsterScore } from './narrative-monster-score.mjs';
import { narrativeBiomeHardMismatch } from './location-context.mjs';
import { monsterThemeTagScore, parseMonsterTagsRow } from './monster-tag-utils.mjs';

const SOFT_SCENE_TYPES = new Set(['social', 'mystery']);

/**
 * @param {{
 *   roster: Array<{ row: Record<string, unknown>, count: number }>,
 *   narrativeBiome: import('./location-context.mjs').NarrativeBiomeId,
 *   thematicTags: string[],
 *   scoreCtx: { themeTags: string[], biome: string, keywordFragments: string[], factionTags: string[], continuityText: string },
 *   sceneType?: string,
 *   hazardLabelRu?: string,
 * }} args
 */
export function validateEncounterPipeline(args) {
  const roster = Array.isArray(args.roster) ? args.roster : [];
  const narrativeBiome = args.narrativeBiome;
  const thematicTags = Array.isArray(args.thematicTags) ? args.thematicTags : [];
  const score = args.scoreCtx && typeof args.scoreCtx === 'object' ? args.scoreCtx : {};
  const ctxForMonsterScore = {
    ...score,
    biome: narrativeBiome,
    themeId: String(score.themeId ?? '')
      .trim()
      .toLowerCase(),
    continuityFallback: String(score.continuityFallback ?? ''),
  };
  const factionTags = Array.isArray(score.factionTags) ? score.factionTags : [];
  const sceneType = String(args.sceneType ?? '')
    .trim()
    .toLowerCase();
  const hazardRu = String(args.hazardLabelRu ?? '').trim();
  let hazardSceneCompat = true;
  if (SOFT_SCENE_TYPES.has(sceneType) && hazardRu) {
    hazardSceneCompat = /^лёгк/i.test(hazardRu);
  }

  if (!roster.length) {
    return {
      ok: true,
      avgScore: 0,
      totalWeight: 0,
      biomeViolations: 0,
      factionMismatchCount: 0,
      themeCoherenceWeak: false,
      hazardSceneCompat: true,
    };
  }

  let weightedScore = 0;
  let totalW = 0;
  let biomeViolations = 0;
  let factionMismatchCount = 0;

  for (const e of roster) {
    const w = Math.max(1, Math.floor(Number(e.count) || 0));
    totalW += w;
    weightedScore += narrativeMonsterScore(e.row, ctxForMonsterScore) * w;
    if (narrativeBiomeHardMismatch(narrativeBiome, e.row)) biomeViolations += w;
    const rowTags = new Set(parseMonsterTagsRow(e.row));
    let fHit = 0;
    for (const f of factionTags) {
      if (rowTags.has(String(f).toLowerCase())) fHit += 1;
    }
    if (factionTags.length >= 2 && fHit === 0) factionMismatchCount += w;
  }

  const avgScore = totalW ? weightedScore / totalW : 0;
  const themeCoherenceWeak =
    thematicTags.length > 0 &&
    roster.every(({ row }) => monsterThemeTagScore(row, thematicTags) < 1);

  const factionRatio = totalW ? factionMismatchCount / totalW : 0;
  const ok =
    biomeViolations === 0 &&
    avgScore >= 6 &&
    !themeCoherenceWeak &&
    factionRatio <= 0.72 &&
    hazardSceneCompat;

  return {
    ok,
    avgScore,
    totalWeight: totalW,
    biomeViolations,
    factionMismatchCount,
    themeCoherenceWeak,
    hazardSceneCompat,
  };
}

/**
 * Социальная/детективная сцена — смягчить кинематографичную опасность, не меняя логику отряда.
 *
 * @param {string} sceneType
 * @param {string} hazardRu
 */
export function softenHazardForSceneType(sceneType, hazardRu) {
  const st = String(sceneType ?? '')
    .trim()
    .toLowerCase();
  const t = String(hazardRu ?? '').trim();
  if (!t || !SOFT_SCENE_TYPES.has(st)) return t;
  if (/^лёгк/i.test(t)) return t;
  return `лёгкий фон: ${t}`.slice(0, 220);
}
