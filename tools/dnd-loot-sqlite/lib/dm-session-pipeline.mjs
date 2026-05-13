/**
 * Единый конвейер «DM engine»: мир → локация → теги скоринга → сюжетный лут.
 */

import { buildWorldState, worldScoringFactionTags, buildContinuityBlob } from './dm-world-model.mjs';
import { pickStructuredLocation } from './dm-location-catalog.mjs';
import { pickDeterministicFrom } from './session-scene-themes.mjs';
import { dedupeLinesByNarrativeFingerprint } from './dm-loot-narrative-dedupe.mjs';

/**
 * @param {ReturnType<typeof pickStructuredLocation>} loc
 */
function freezeDmLocation(loc) {
  return Object.freeze({
    id: loc.id,
    name: loc.name,
    biome: loc.biome,
    type: loc.type,
    danger_level: loc.danger_level,
    sublocations: Object.freeze([...(loc.sublocations || [])]),
    narrative_hooks: Object.freeze([...(loc.narrative_hooks || [])]),
  });
}

/**
 * @param {{
 *   theme: import('./session-scene-themes.mjs').SceneTheme,
 *   narrativeBiome: string,
 *   sceneTypeId: string,
 *   partyLevel: number,
 *   environmentText: string,
 *   nextTraceHint: string,
 *   dungeonSession: object | null | undefined,
 *   seedCore: string,
 * }} args
 */
export function buildDmSessionBundle(args) {
  const worldState = buildWorldState({
    theme: args.theme,
    narrativeBiome: args.narrativeBiome,
    sceneTypeId: args.sceneTypeId,
    partyLevel: args.partyLevel,
    environmentText: args.environmentText,
    nextTraceHint: args.nextTraceHint,
    dungeonSession: args.dungeonSession ?? null,
  });

  const location = freezeDmLocation(
    pickStructuredLocation({
      narrativeBiome: args.narrativeBiome,
      themeId: args.theme.id,
      seed: args.seedCore,
    }),
  );

  const factionTags = worldScoringFactionTags(args.theme.id, args.theme.contentTags);
  const continuityText = buildContinuityBlob(args.environmentText, args.nextTraceHint, args.dungeonSession);

  const lootNarrativeLines = buildStoryLootLines(worldState, location, args.theme, args.seedCore);

  return {
    worldState,
    location,
    factionTags,
    continuityText,
    lootNarrativeLines,
  };
}

/**
 * @param {import('./dm-world-model.mjs').DmWorldState} world
 * @param {ReturnType<typeof pickStructuredLocation>} loc
 * @param {import('./session-scene-themes.mjs').SceneTheme} theme
 * @param {string} seedCore
 */
function buildStoryLootLines(world, loc, theme, seedCore) {
  /** @type {string[]} */
  const lines = [];
  const h1 = pickDeterministicFrom(loc.narrative_hooks, `${seedCore}|lh1`);
  const h2 = pickDeterministicFrom(loc.narrative_hooks, `${seedCore}|lh2`);
  if (h1 && h1 !== h2) lines.push(`улика: ${h1}`);
  if (h2) lines.push(`сюжет: ${h2}`);
  const fac = pickDeterministicFrom(world.factions, `${seedCore}|fac`);
  if (fac) lines.push(`фракция: ${fac} — чужой след в деле`);
  const ev = pickDeterministicFrom(world.active_events, `${seedCore}|ev`);
  if (ev) lines.push(`событие: ${ev}`);
  const th = pickDeterministicFrom(world.threats, `${seedCore}|th`);
  if (th && String(th).trim().length > 5) lines.push(`накал: ${th}`);
  const hints = Array.isArray(theme.narrativeLootHints) ? theme.narrativeLootHints.filter(Boolean) : [];
  const hint = pickDeterministicFrom(hints, `${seedCore}|thint`);
  if (hint) {
    const hintL = hint.toLowerCase();
    const dup = [h1, h2].some((x) => x && hintL.length > 10 && String(x).toLowerCase().includes(hintL.slice(0, 12)));
    if (!dup) lines.push(`находка: ${hint}`);
  }
  const seen = new Set();
  const out = [];
  for (const ln of lines) {
    const k = ln.toLowerCase().slice(0, 48);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(ln);
  }
  return dedupeLinesByNarrativeFingerprint(out).slice(0, 6);
}
