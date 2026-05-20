/** Метаданные и отряд активной игровой сессии (localStorage, без сервера). */

export type PlaySessionMember = {
  id: string;
  name: string;
  subtitle: string;
  level: number;
  hpCurrent: number;
  hpMax: number;
};

export type PlaySessionMeta = {
  title: string;
  partyLevel: number;
  playerCount: number;
  difficulty: string;
  environmentKey: string;
  updatedAt: number;
};

const DIFFICULTY_TAG: Record<string, string> = {
  low: "Низкая сложность",
  easy: "Низкая сложность",
  moderate: "Средняя сложность",
  medium: "Средняя сложность",
  high: "Высокая сложность",
  hard: "Высокая сложность",
  deadly: "Смертельная сложность",
};

const ENV_TAG: Record<string, string> = {
  any: "Смешанный биом",
  coastal: "Побережье",
  cave: "Пещера",
  forest: "Лес",
  mountain: "Горы",
  dungeon: "Подземелье",
  urban: "Город",
  arctic: "Север",
  swamp: "Болото",
  ruins: "Руины",
};

export function difficultyTagRu(difficulty: string): string {
  const key = difficulty.trim().toLowerCase();
  return DIFFICULTY_TAG[key] ?? "Средняя сложность";
}

export function environmentTagRu(environmentKey: string): string {
  const key = environmentKey.trim().toLowerCase();
  return ENV_TAG[key] ?? ENV_TAG.any;
}

export function buildSessionTags(meta: PlaySessionMeta): string[] {
  const count = Math.max(1, Math.min(8, Math.round(meta.playerCount)));
  const playerWord =
    count === 1 ? "1 игрок" : count >= 2 && count <= 4 ? `${count} игрока` : `${count} игроков`;
  return [
    `Уровень ${Math.max(1, Math.min(20, Math.round(meta.partyLevel)))}`,
    difficultyTagRu(meta.difficulty),
    playerWord,
  ];
}

export function defaultHpMaxForLevel(level: number): number {
  const lv = Math.max(1, Math.min(20, Math.round(level)));
  return 8 + lv * 6;
}

export function createDefaultParty(playerCount: number, partyLevel: number): PlaySessionMember[] {
  const count = Math.max(1, Math.min(8, Math.round(playerCount)));
  const hpMax = defaultHpMaxForLevel(partyLevel);
  const lv = Math.max(1, Math.min(20, Math.round(partyLevel)));
  return Array.from({ length: count }, (_, i) => ({
    id: `pc-${i + 1}`,
    name: `Игрок ${i + 1}`,
    subtitle: `Герой · ${lv} ур.`,
    level: lv,
    hpCurrent: hpMax,
    hpMax,
  }));
}

export function formatSessionDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}ч ${m.toString().padStart(2, "0")}м`;
  if (m > 0) return `${m}м ${s.toString().padStart(2, "0")}с`;
  return `${s}с`;
}

/** Относительное время для ленты («только что», «3 мин назад»). */
export function formatRelTimeRu(at: number, now: number): string {
  const delta = Math.max(0, now - at);
  const sec = Math.floor(delta / 1000);
  if (sec < 12) return "только что";
  if (sec < 60) return `${sec} с назад`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч назад`;
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(at));
}
