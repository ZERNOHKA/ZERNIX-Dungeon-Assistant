/**
 * Бюджет опыта встречи — D&D 5.5 / DMG 2024: три уровня угрозы (Low / Moderate / High).
 * На персонажа × число игроков; без множителя за количество монстров в группе.
 *
 * Таблица: Dungeon Master's Guide (2024), Encounter Building.
 */

/** @type {ReadonlyArray<readonly [number, number, number]>} — [Low, Moderate, High] */
export const XP_55_THRESHOLDS_PER_CHARACTER_BY_LEVEL = Object.freeze([
  [50, 75, 100],
  [100, 150, 200],
  [150, 225, 400],
  [250, 375, 500],
  [500, 750, 1100],
  [600, 1000, 1400],
  [750, 1300, 1700],
  [1000, 1700, 2100],
  [1300, 2000, 2600],
  [1600, 2300, 3100],
  [1900, 2900, 4100],
  [2200, 3700, 4700],
  [2600, 4200, 5400],
  [2900, 4900, 6200],
  [3300, 5400, 7800],
  [3800, 6100, 9800],
  [4500, 7200, 11700],
  [5000, 8700, 14200],
  [5500, 10700, 17200],
  [6400, 13200, 22000],
]);

/** @typedef {'low'|'moderate'|'high'} EncounterThreat55 */

const THREAT_INDEX = /** @type {const} */ ({
  low: 0,
  moderate: 1,
  high: 2,
});

/**
 * Приводит любое значение сложности к угрозе 5.5 (включая старые easy/medium/hard/deadly).
 *
 * @param {string|undefined|null} raw
 * @returns {EncounterThreat55}
 */
export function normalizeEncounterThreat(raw) {
  const s = String(raw ?? 'moderate').toLowerCase().trim();
  if (s === 'low' || s === 'easy') return 'low';
  if (s === 'moderate' || s === 'medium') return 'moderate';
  if (s === 'high' || s === 'hard') return 'high';
  if (s === 'deadly') return 'high';
  return 'moderate';
}

/**
 * Авто-сложность по уровню группы (mirroring): 1–10 → Moderate по умолчанию, 11–20 → High.
 *
 * @param {number} partyLevel
 * @returns {EncounterThreat55}
 */
export function defaultThreatForPartyLevel(partyLevel) {
  const lv = Math.min(20, Math.max(1, Math.floor(Number(partyLevel) || 1)));
  if (lv >= 11) return 'high';
  return 'moderate';
}

/**
 * Суммарный XP бюджет встречи (сумма записанных XP монстров сравнивается с этим порогом).
 *
 * @param {number} partyLevel 1–20
 * @param {number} playerCount ≥1
 * @param {string|EncounterThreat55} difficulty угроза 5.5 или legacy easy/medium/hard/deadly
 */
export function totalEncounterXpBudget(partyLevel, playerCount, difficulty) {
  const lv = Number(partyLevel);
  const pc = Number(playerCount);
  const lvl = Number.isFinite(lv) ? Math.min(20, Math.max(1, Math.floor(lv))) : 1;
  const players = Number.isFinite(pc) ? Math.min(12, Math.max(1, Math.floor(pc))) : 4;
  const raw = String(typeof difficulty === 'string' ? difficulty : 'moderate').toLowerCase().trim();
  const deadly = raw === 'deadly';
  const threat = normalizeEncounterThreat(difficulty);
  const row = XP_55_THRESHOLDS_PER_CHARACTER_BY_LEVEL[lvl - 1] ?? XP_55_THRESHOLDS_PER_CHARACTER_BY_LEVEL[0];
  const idx = THREAT_INDEX[threat] ?? THREAT_INDEX.moderate;
  let budget = row[idx] * players;
  if (deadly) {
    budget = Math.round(budget * 1.28);
  }
  return budget;
}

/**
 * Короткая подпись угрозы на русском (для отчётов).
 *
 * @param {string} difficulty сырой или нормализованный код
 */
export function difficultyLabelRu(difficulty) {
  const raw = String(difficulty ?? '').toLowerCase().trim();
  if (raw === 'deadly') return 'Смертельная (Deadly)';
  if (raw === 'easy') return 'Лёгкая (Easy)';
  if (raw === 'medium') return 'Средняя (Medium)';
  if (raw === 'hard') return 'Тяжёлая (Hard)';
  const t = normalizeEncounterThreat(difficulty);
  switch (t) {
    case 'low':
      return 'Низкая угроза';
    case 'moderate':
      return 'Умеренная угроза';
    case 'high':
      return 'Высокая угроза';
    default:
      return String(difficulty);
  }
}
