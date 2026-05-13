/**
 * Слой «мир сессии» — согласованность фракций, угроз и событий без отдельной БД.
 * Данные кураторские; скоринг использует теги, совместимые с `monsters.tags`.
 */

/**
 * @typedef {{
 *   regions: string[],
 *   biomes: string[],
 *   factions: string[],
 *   threats: string[],
 *   active_events: string[],
 * }} DmWorldState
 */

/** Доп. теги для скоринга «фракция / политика» поверх `theme.contentTags`. */
const SCORING_TAG_BOOST = Object.freeze({
  storm_magic: ['elemental', 'priest'],
  cult_ritual: ['cult', 'fiend', 'humanoid'],
  plague_outbreak: ['plague', 'ooze', 'humanoid'],
  undead_activity: ['undead', 'crypt', 'horror'],
  smuggling_operation: ['criminal', 'smuggling', 'humanoid'],
  cursed_relics: ['cult', 'undead', 'horror'],
  noble_conspiracy: ['noble', 'conspiracy', 'spy', 'humanoid'],
  abandoned_laboratory: ['laboratory', 'construct', 'ooze', 'aberration'],
});

/** Человекочитаемые фракции для UI / брифа. */
const FACTION_LABELS_RU = Object.freeze({
  storm_magic: ['Гильдия стихийных жрецов', 'Разорванный культ бури'],
  cult_ritual: ['Тайный культ', 'Стража, купленная молчанием'],
  plague_outbreak: ['Карантинный совет', 'Чёрные аптекари'],
  undead_activity: ['Древний дом мёртвых', 'Городские носители'],
  smuggling_operation: ['Доковый консорциум', 'Таможенная сеть'],
  cursed_relics: ['Хранители реликвий', 'Аукцион теней'],
  noble_conspiracy: ['Двор и герцогство', 'Тайная канцелярия'],
  abandoned_laboratory: ['Гильдия алхимиков', 'Университетский совет'],
});

/**
 * @param {{
 *   theme: { id: string, labelRu: string, contentTags: string[] },
 *   narrativeBiome: string,
 *   sceneTypeId: string,
 *   partyLevel: number,
 *   environmentText: string,
 *   nextTraceHint?: string,
 *   dungeonSession?: { floorDepth?: number, transitionMarkdown?: string | null, previousTraceForHeader?: string | null } | null,
 * }} p
 * @returns {DmWorldState}
 */
export function buildWorldState(p) {
  const tid = String(p.theme?.id || '');
  const bio = String(p.narrativeBiome || 'generic');
  const regions = [
    `${p.theme?.labelRu ?? 'Регион'} — ${bio}`,
    `Уровень партии ${Math.max(1, Math.floor(Number(p.partyLevel) || 1))}, ритм: ${String(p.sceneTypeId || '')}`,
  ];
  const factions = [...(FACTION_LABELS_RU[/** @type {keyof typeof FACTION_LABELS_RU} */ (tid)] || ['Местные силы', 'Сторонние наблюдатели'])];
  const threats = (Array.isArray(p.theme?.contentTags) ? p.theme.contentTags : []).map((t) => {
    const k = String(t).trim().toLowerCase();
    const map = {
      undead: 'нить нежити',
      crypt: 'склепная мгла',
      horror: 'ужас на пороге',
      cult: 'культовый след',
      fiend: 'нижние интересы',
      plague: 'заразная тишина',
      noble: 'дворцовые игры',
      laboratory: 'алхимический риск',
      conspiracy: 'тайные указы',
      smuggling: 'чёрный груз',
      criminal: 'подполье',
      ooze: 'жидкая угроза',
      construct: 'механический гнев',
      elemental: 'стихийный разлад',
      humanoid: 'человеческий фактор',
      beast: 'звериная угроза',
      fey: 'феерический след',
    };
    return map[/** @type {keyof typeof map} */ (k)] || k;
  });
  /** @type {string[]} */
  const active_events = [];
  const hint = String(p.environmentText ?? '').trim();
  if (hint.length > 8) active_events.push(`Сигнал из описания: ${hint.slice(0, 140)}${hint.length > 140 ? '…' : ''}`);
  const ds = p.dungeonSession;
  if (ds && typeof ds === 'object') {
    if (Number(ds.floorDepth) > 0) active_events.push(`Спуск на ярус ${ds.floorDepth}: давление и эхо усиливаются`);
    if (ds.transitionMarkdown) active_events.push(String(ds.transitionMarkdown).trim().slice(0, 160));
    if (ds.previousTraceForHeader) active_events.push(`Память цепочки: ${String(ds.previousTraceForHeader).slice(0, 120)}`);
  }
  const nt = String(p.nextTraceHint ?? '').trim();
  if (nt) active_events.push(`Нить сюжета: ${nt.slice(0, 160)}${nt.length > 160 ? '…' : ''}`);
  return {
    regions,
    biomes: [bio],
    factions,
    threats,
    active_events: active_events.filter(Boolean).slice(0, 5),
  };
}

/**
 * Теги для скоринга (пересечение с `monsters.tags`).
 *
 * @param {string} themeId
 * @param {string[]} contentTags
 */
export function worldScoringFactionTags(themeId, contentTags) {
  const base = Array.isArray(contentTags) ? contentTags.map((x) => String(x).trim().toLowerCase()).filter(Boolean) : [];
  const extra = SCORING_TAG_BOOST[/** @type {keyof typeof SCORING_TAG_BOOST} */ (themeId)] || [];
  const out = [];
  const seen = new Set();
  for (const t of [...base, ...extra]) {
    const k = String(t).toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out.slice(0, 14);
}

/**
 * @param {string} environmentText
 * @param {string} nextTraceHint
 * @param {unknown} dungeonSession
 */
export function buildContinuityBlob(environmentText, nextTraceHint, dungeonSession) {
  const parts = [String(environmentText ?? '').trim(), String(nextTraceHint ?? '').trim()];
  const ds = dungeonSession && typeof dungeonSession === 'object' ? dungeonSession : null;
  if (ds && /** @type {*} */ (ds).previousTraceForHeader) {
    parts.push(String(/** @type {*} */ (ds).previousTraceForHeader));
  }
  return parts.filter(Boolean).join(' · ').replace(/\s+/g, ' ').trim().slice(0, 520);
}
