/** Угроза встречи D&D 5.5 / DMG 2024; `deadly` — усиленный high (бюджет XP ×1.28 на бэкенде). */
export type EncounterThreat55 = "low" | "moderate" | "high" | "deadly";

/** Авто-сложность: уровни 11–20 → High, иначе Moderate (по умолчанию для 1–10). */
export function defaultThreatForPartyLevel(partyLevel: number): EncounterThreat55 {
  const lv = Math.min(20, Math.max(1, Math.floor(Number(partyLevel) || 1)));
  if (lv >= 11) return "high";
  return "moderate";
}
