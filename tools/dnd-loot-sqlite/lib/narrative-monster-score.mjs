import {
  monsterBiomePreferredTagHits,
  monsterHasForbiddenBiomeTag,
  narrativeBiomeHardMismatch,
} from './location-context.mjs';
import { monsterThemeTagScore, parseMonsterTagsRow } from './monster-tag-utils.mjs';
import { normalizeScoringContext } from './dm-scoring-contract.mjs';

/**
 * @typedef {import('./location-context.mjs').NarrativeBiomeId} NarrativeBiomeId
 */

/**
 * @param {Record<string, unknown>} row
 * @param {string[]} factionTags
 */
function factionCoherenceHits(row, factionTags) {
  if (!factionTags?.length) return 0;
  const rowTags = new Set(parseMonsterTagsRow(row));
  let n = 0;
  for (const f of factionTags) {
    const k = String(f).trim().toLowerCase();
    if (k && rowTags.has(k)) n += 1;
  }
  return Math.min(3, n);
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} continuityText
 */
function narrativeContinuityHits(row, continuityText) {
  const ct = String(continuityText ?? '').toLowerCase();
  if (ct.length < 4) return 0;
  const blob = `${String(row.name ?? '')} ${String(row.type_line ?? '')} ${String(row.raw_statblock_md ?? '').slice(0, 900)}`.toLowerCase();
  const tokens = ct
    .split(/[^a-zа-яё0-9]+/i)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4)
    .slice(0, 24);
  let n = 0;
  for (const t of tokens) {
    if (blob.includes(t)) n += 1;
  }
  return Math.min(3, n);
}

/**
 * DM engine: biome_match*4 + theme_match*4 + faction_coherence*3 + narrative_continuity*3
 * + keyword_fit*2 + randomness_penalty (штраф за «пустые» теги).
 *
 * @param {Record<string, unknown>} row
 * @param {{
 *   themeTags: string[],
 *   biome: NarrativeBiomeId,
 *   keywordFragments: string[],
 *   factionTags?: string[],
 *   continuityText?: string,
 *   themeId?: string,
 *   continuityFallback?: string,
 * }} ctx
 */
export function narrativeMonsterScore(row, ctx) {
  const c = normalizeScoringContext({
    biome: ctx.biome,
    themeTags: ctx.themeTags,
    keywordFragments: ctx.keywordFragments,
    factionTags: ctx.factionTags,
    continuityText: ctx.continuityText,
    themeId: ctx.themeId,
    continuityFallback: ctx.continuityFallback,
  });
  const themeTags = c.themeTags;
  const themeMatch = Math.min(3, monsterThemeTagScore(row, themeTags));
  const biomeHit = Math.min(3, monsterBiomePreferredTagHits(row, c.biome));
  const blob = `${String(row.name ?? '')} ${String(row.type_line ?? '')} ${String(row.raw_statblock_md ?? '').slice(0, 900)}`.toLowerCase();
  let narrativeFit = 0;
  for (const fr of c.keywordFragments || []) {
    const k = String(fr).trim().toLowerCase();
    if (k.length >= 3 && blob.includes(k)) narrativeFit += 1;
  }
  narrativeFit = Math.min(3, narrativeFit);
  const factionHit = factionCoherenceHits(row, c.factionTags || []);
  const continuityHit = narrativeContinuityHits(row, String(c.continuityText || ''));
  const tagCount = parseMonsterTagsRow(row).length;
  const randomnessPenalty = tagCount === 0 ? -4 : tagCount === 1 ? -2 : 0;
  return (
    biomeHit * 4 +
    themeMatch * 4 +
    factionHit * 3 +
    continuityHit * 3 +
    narrativeFit * 2 +
    randomnessPenalty
  );
}

/**
 * Стабильный выбор лучшего: максимум score, затем slug/id.
 *
 * @param {Array<Record<string, unknown>>} subset
 * @param {{
 *   themeTags: string[],
 *   biome: NarrativeBiomeId,
 *   keywordFragments: string[],
 *   factionTags?: string[],
 *   continuityText?: string,
 * }} ctx
 * @returns {Record<string, unknown>|undefined}
 */
export function pickBestMonsterByNarrativeScore(subset, ctx) {
  if (!subset.length) return undefined;
  let best = subset[0];
  let bestS = narrativeMonsterScore(best, ctx);
  const key = (r) => (r.slug != null ? String(r.slug) : `id:${r.id}`);
  for (let i = 1; i < subset.length; i += 1) {
    const row = subset[i];
    const s = narrativeMonsterScore(row, ctx);
    if (s > bestS || (s === bestS && key(row) < key(best))) {
      best = row;
      bestS = s;
    }
  }
  return best;
}

/**
 * Убрать жёсткие несостыковки биома, если пул остаётся достаточным.
 *
 * @param {Array<Record<string, unknown>>} pool
 * @param {NarrativeBiomeId} biome
 * @param {number} [minSize]
 */
export function filterPoolByNarrativeBiome(pool, biome, minSize = 8) {
  const noHard = pool.filter((r) => !narrativeBiomeHardMismatch(biome, r));
  const p1 = noHard.length >= minSize ? noHard : pool;
  const noTag = p1.filter((r) => !monsterHasForbiddenBiomeTag(r, biome));
  return noTag.length >= minSize ? noTag : p1;
}

/**
 * Сортировка пула по убыванию score (детерминированный порядок обхода).
 *
 * @param {Array<Record<string, unknown>>} pool
 * @param {{
 *   themeTags: string[],
 *   biome: NarrativeBiomeId,
 *   keywordFragments: string[],
 *   factionTags?: string[],
 *   continuityText?: string,
 * }} ctx
 */
export function sortPoolByNarrativeScore(pool, ctx) {
  const key = (r) => (r.slug != null ? String(r.slug) : `id:${r.id}`);
  return [...pool].sort((a, b) => {
    const da = narrativeMonsterScore(a, ctx);
    const db = narrativeMonsterScore(b, ctx);
    if (db !== da) return db - da;
    return key(a).localeCompare(key(b));
  });
}
