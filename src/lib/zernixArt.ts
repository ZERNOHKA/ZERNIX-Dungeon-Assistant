/**
 * Единая точка подключения UI-арта (логотип, d20).
 * Кладите файлы только в src/assets/ — не дублируйте в public/.
 */
import d20DiceUrl from "../assets/publicd20_dice.png";
import logoDragonUrl from "../assets/logo-dragon.png";

export const ZERNIX_ART = {
  logoDragon: logoDragonUrl,
  d20Dice: d20DiceUrl,
} as const;
