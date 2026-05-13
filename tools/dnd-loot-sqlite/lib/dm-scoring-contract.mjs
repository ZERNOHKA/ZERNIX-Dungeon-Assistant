/**
 * Единый контракт входа в narrative scoring: биом, тема-теги, фракции, непрерывность.
 * Не использует normalizeName — только структурные строки/теги.
 */

import { inferNarrativeBiome, listBiomePreferredTagsForScoring } from './location-context.mjs';
import { worldScoringFactionTags } from './dm-world-model.mjs';

/**
 * @typedef {import('./location-context.mjs').NarrativeBiomeId} NarrativeBiomeId
 */

/**
 * @param {{
 *   biome?: NarrativeBiomeId|string,
 *   themeTags?: string[],
 *   keywordFragments?: string[],
 *   factionTags?: string[],
 *   continuityText?: string,
 *   themeId?: string,
 *   continuityFallback?: string,
 * }} raw
 */
export function normalizeScoringContext(raw) {
  const biomeRaw = raw.biome != null ? String(raw.biome).trim().toLowerCase() : '';
  /** @type {NarrativeBiomeId} */
  const biome =
    biomeRaw &&
    biomeRaw !== 'any' &&
    [
      'cave',
      'forest',
      'city',
      'dungeon',
      'swamp',
      'laboratory',
      'coastal',
      'mountain',
      'arctic',
      'crypt',
      'generic',
    ].includes(biomeRaw)
      ? /** @type {NarrativeBiomeId} */ (biomeRaw)
      : 'generic';

  let themeTags = Array.isArray(raw.themeTags)
    ? raw.themeTags.map((x) => String(x).trim().toLowerCase()).filter((s) => s.length > 0)
    : [];
  if (!themeTags.length) {
    themeTags = listBiomePreferredTagsForScoring(biome);
  }

  const themeId = String(raw.themeId ?? '')
    .trim()
    .toLowerCase();

  let factionTags = Array.isArray(raw.factionTags)
    ? raw.factionTags.map((x) => String(x).trim().toLowerCase()).filter((s) => s.length > 0)
    : [];
  if (!factionTags.length && themeId) {
    factionTags = worldScoringFactionTags(themeId, themeTags);
  }
  if (!factionTags.length) {
    factionTags = listBiomePreferredTagsForScoring(biome).slice(0, 8);
  }

  const primary = String(raw.continuityText ?? '').replace(/\s+/g, ' ').trim();
  const fallback = String(raw.continuityFallback ?? '').replace(/\s+/g, ' ').trim().slice(0, 520);
  const continuityText = primary || fallback;

  const keywordFragments = Array.isArray(raw.keywordFragments)
    ? raw.keywordFragments.map((x) => String(x).trim().toLowerCase()).filter((s) => s.length >= 2)
    : [];

  let continuityOut = continuityText;
  if (continuityOut.length < 12) {
    const pad = [`биом:${biome}`, themeId ? `тема:${themeId}` : ''].filter(Boolean).join(' · ');
    continuityOut = [continuityOut, pad].filter(Boolean).join(' · ').trim().slice(0, 520);
  }

  return { themeTags, biome, keywordFragments, factionTags, continuityText: continuityOut };
}

/**
 * Небьющиеся проверки контракта (включается `DM_ENGINE_DEBUG=1`).
 *
 * @param {{ themeTags: string[], biome: string, keywordFragments: string[], factionTags: string[], continuityText: string }} n
 * @param {string} label
 */
export function warnScoringContractInvariants(n, label = 'score') {
  try {
    if (typeof process === 'undefined' || String(process.env?.DM_ENGINE_DEBUG || '') !== '1') return;
    if (!Array.isArray(n.themeTags) || n.themeTags.length === 0) {
      console.warn(`[dm-engine:${label}] themeTags empty after normalize`);
    }
    if (!Array.isArray(n.factionTags) || n.factionTags.length === 0) {
      console.warn(`[dm-engine:${label}] factionTags empty after normalize`);
    }
    if (!String(n.continuityText ?? '').trim()) {
      console.warn(`[dm-engine:${label}] continuityText empty after normalize`);
    }
    if (!String(n.biome ?? '').trim()) {
      console.warn(`[dm-engine:${label}] biome missing`);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Минимальный контракт для путей без полной темы сессии (loot-only, legacy encounter+loot).
 *
 * @param {{
 *   environment: string,
 *   themeId?: string,
 *   thematicTags?: string[],
 *   keywordFragments?: string[],
 *   nextEncounterHint?: string,
 *   environmentExtraText?: string,
 *   factionTags?: string[],
 *   continuityText?: string,
 * }} opts
 */
export function buildMinimalEncounterContract(opts) {
  const environment = String(opts.environment ?? 'any').toLowerCase();
  const themeId = String(opts.themeId ?? '')
    .trim()
    .toLowerCase();
  const narrativeBiome = inferNarrativeBiome(environment, themeId);
  const thematicIn = Array.isArray(opts.thematicTags)
    ? opts.thematicTags.map((x) => String(x).trim().toLowerCase()).filter((s) => s.length > 0)
    : [];
  const thematicTags = thematicIn.length
    ? thematicIn
    : listBiomePreferredTagsForScoring(narrativeBiome).slice(0, 6);
  const kw = Array.isArray(opts.keywordFragments)
    ? opts.keywordFragments.map((x) => String(x).trim()).filter((s) => s.length > 0)
    : [];
  const continuityFallback = [String(opts.nextEncounterHint ?? ''), String(opts.environmentExtraText ?? '')]
    .join(' ')
    .trim();
  const baseFaction = Array.isArray(opts.factionTags)
    ? opts.factionTags.map((x) => String(x).trim().toLowerCase()).filter((s) => s.length > 0)
    : [];
  const baseContinuity = String(opts.continuityText ?? '').trim();

  const scoreCtx = normalizeScoringContext({
    biome: narrativeBiome,
    themeTags: thematicTags,
    keywordFragments: kw,
    factionTags: baseFaction.length ? baseFaction : undefined,
    continuityText: baseContinuity || undefined,
    continuityFallback,
    themeId,
  });
  warnScoringContractInvariants(scoreCtx, 'buildMinimalEncounterContract');

  return {
    narrativeBiome,
    themeId,
    thematicTags,
    keywordFragments: kw,
    factionTags: scoreCtx.factionTags,
    continuityText: scoreCtx.continuityText,
    scoreCtx,
  };
}
