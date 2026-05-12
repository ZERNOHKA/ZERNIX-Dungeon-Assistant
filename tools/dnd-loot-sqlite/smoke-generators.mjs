#!/usr/bin/env node
/**
 * Смоук-тест генераторов без Electron: гибридный лут, «только лут» (как Loot Picker),
 * полный отчёт «Подготовка сессии».
 *
 * Запуск из этой папки:
 *   npm run smoke
 *   node smoke-generators.mjs
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatEncounterAndLootMarkdownReport,
  formatHybridLootMarkdownReport,
  formatSessionPrepMarkdownReport,
  openLootDatabase,
} from './generate-loot.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dir, 'dnd-loot.sqlite');

/** Детерминированный RNG (0..1) для стабильных смоук-прогонов в CI. */
function rngFactory(seed) {
  let s = Math.floor(seed) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * @param {string} title
 * @param {string} md
 * @param {number} [maxLines]
 */
function printBlock(title, md, maxLines = 72) {
  const lines = md.split('\n');
  const head = lines.slice(0, maxLines).join('\n');
  const tail = lines.length > maxLines ? `\n… (+${lines.length - maxLines} строк)` : '';
  console.log(`\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}\n`);
  console.log(head + tail);
}

function main() {
  const db = openLootDatabase(dbPath);
  const rng = rngFactory(20260511);

  try {
    printBlock(
      '1) Гибридный лут (экран «Генератор лута» — бюджет gp + CR)',
      formatHybridLootMarkdownReport(db, 500, 7, ['weapon', 'armor'], rng),
      48,
    );

    printBlock(
      '2) Только лут / обыска (lootOnly): dungeon, 2 сундука, уровень 7, 4 игрока',
      formatEncounterAndLootMarkdownReport(db, {
        lootOnly: true,
        partyLevel: 7,
        playerCount: 4,
        difficulty: 'moderate',
        environment: 'dungeon',
        chestCount: 2,
        categories: ['weapon', 'armor', 'gear'],
        onlyMagic: false,
        rng,
      }),
      90,
    );

    const sessionOut = formatSessionPrepMarkdownReport(db, {
      partyLevel: 7,
      playerCount: 4,
      difficulty: 'moderate',
      packCount: 2,
      chestCount: 2,
      environmentKey: 'dungeon',
      environmentText: 'склеп, руины',
      onlyMagic: false,
      rng,
      dungeonSession: {
        floorDepth: 1,
        persistentTags: ['undead'],
        difficultyBias: 0.1,
        previousTraceForHeader: 'Следы гнилостного разложения ведут вглубь…',
        transitionMarkdown: 'Вы прошли по следу и углубились.',
      },
    });
    printBlock(
      '3) Подготовка сессии: 2 отряда, 2 сундука, dungeon, текст «склеп»',
      typeof sessionOut === 'object' && sessionOut.markdown ? sessionOut.markdown : String(sessionOut),
      120,
    );

    console.log(`\n${'='.repeat(72)}\nOK — ошибок при генерации нет.\n${'='.repeat(72)}\n`);
  } finally {
    db.close();
  }
}

main();
