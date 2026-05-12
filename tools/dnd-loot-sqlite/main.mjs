#!/usr/bin/env node
/**
 * Точка входа: интерактивная консоль для генерации лута по локации.
 *
 * Локальный запуск:
 *   node main.mjs
 *
 * ---------------------------------------------------------------------------
 * Сборка в один EXE (Windows) с помощью `pkg`:
 *
 *   npm install
 *   npm run pkg:win
 *
 * Скрипт сначала собирает `dist/cli.cjs` (esbuild), затем упаковывает в EXE через `pkg`
 * (нативный модуль better-sqlite3 подхватывается автоматически).
 *
 * Положите рядом с `dnd_generator.exe` файл базы `dnd-loot.sqlite` (рабочая
 * папка при запуске EXE — та же, где лежит exe и sqlite).
 *
 * Примечание: `better-sqlite3` содержит нативные модули. Если `pkg` выдаст
 * ошибку загрузки `.node`, потребуется доп. настройка ассетов или другой
 * упаковщик (например `nexe`, `caxa`). Базовая команда выше — ориентир.
 * ---------------------------------------------------------------------------
 */

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { join, resolve } from 'node:path';
import { generateLoot, setLootDatabasePath } from './generate-loot.mjs';

/** Имя файла БД рядом с рабочей директорией процесса (рядом с EXE при запуске из этой папки). */
const DATABASE_FILE_NAME = 'dnd-loot.sqlite';

/** Сколько независимых взвешенных выборок делать за один раз. */
const LOOT_PICKS_PER_RUN = 5;

/** @type {ReadonlyArray<{ key: string, label: string, resolveAs: string }>} */
const LOCATION_MENU = [
  { key: '1', label: 'Лес', resolveAs: 'Лес' },
  { key: '2', label: 'Подземелье', resolveAs: 'Подземелье' },
  { key: '3', label: 'Город', resolveAs: 'Город' },
];

/**
 * @param {Record<string, unknown>} item
 * @returns {string[]}
 */
function formatLootItemForConsole(item) {
  const kind = typeof item.kind === 'string' ? item.kind : '';
  const name = typeof item.name === 'string' ? item.name : '—';

  /** @type {string[]} */
  const lines = [];

  if (kind === 'statblock') {
    lines.push(`  [Существо] ${name}`);
    if (item.armorClass != null) {
      lines.push(`    Класс брони: ${item.armorClass}`);
    }
    if (item.hitPoints != null) {
      lines.push(`    Хиты: ${item.hitPoints}`);
    }
    if (item.speed != null) {
      lines.push(`    Скорость: ${item.speed}`);
    }
    if (item.challengeRating != null) {
      lines.push(`    Оценка опасности: ${item.challengeRating}`);
    }
    if (
      typeof item.abilitySummary === 'string' &&
      item.abilitySummary.length > 0
    ) {
      lines.push(`    Характеристики: ${item.abilitySummary}`);
    }
    return lines;
  }

  if (kind === 'lore' || kind === 'info') {
    lines.push(`  [${kind === 'lore' ? 'Заметка' : 'Справка'}] ${name}`);
    const text = typeof item.content === 'string' ? item.content : '';
    for (const paragraph of text.split('\n')) {
      if (paragraph.length > 0) {
        lines.push(`    ${paragraph}`);
      }
    }
    return lines;
  }

  if (kind === 'table') {
    lines.push(`  [Таблица] ${name}`);
    const tableText = typeof item.tableText === 'string' ? item.tableText : '';
    for (const row of tableText.split('\n')) {
      lines.push(`    ${row.replace(/\t/g, '  |  ')}`);
    }
    return lines;
  }

  if (kind === 'equipment') {
    lines.push(`  [Снаряжение] ${name}`);
    if (typeof item.category === 'string' && item.category.length > 0) {
      lines.push(`    Категория: ${item.category}`);
    }
    if (item.subcategory != null && String(item.subcategory).length > 0) {
      lines.push(`    Подкатегория: ${item.subcategory}`);
    }
    if (item.typeLine != null && String(item.typeLine).length > 0) {
      lines.push(`    ${item.typeLine}`);
    }
    if (item.masteryProperty != null && String(item.masteryProperty).length > 0) {
      lines.push(`    Mastery: ${item.masteryProperty}`);
    }
    if (item.costGp != null && Number.isFinite(Number(item.costGp))) {
      lines.push(`    Оценка стоимости: ${item.costGp} GP`);
    }
    if (item.cost != null && String(item.cost).length > 0) {
      lines.push(`    Цена: ${item.cost}`);
    }
    if (item.weight != null && String(item.weight).length > 0) {
      lines.push(`    Вес: ${item.weight}`);
    }
    if (
      item.consumableUseAction != null &&
      String(item.consumableUseAction).length > 0
    ) {
      lines.push(`    Использование: ${item.consumableUseAction}`);
    }
    return lines;
  }

  if (kind === 'magic_item') {
    lines.push(`  [Магический предмет] ${name}`);
    if (item.typeLine != null && String(item.typeLine).length > 0) {
      lines.push(`    ${item.typeLine}`);
    }
    if (item.rarity != null && String(item.rarity).length > 0) {
      lines.push(`    Редкость: ${item.rarity}`);
    }
    if (item.costGp != null && Number.isFinite(Number(item.costGp))) {
      lines.push(`    Оценка стоимости (SRD): ${item.costGp} GP`);
    }
    if (item.masteryProperty != null && String(item.masteryProperty).length > 0) {
      lines.push(`    Mastery: ${item.masteryProperty}`);
    }
    if (item.requiresAttunement === true) {
      lines.push(`    Требуется настройка: да`);
    }
    if (
      item.consumableUseAction != null &&
      String(item.consumableUseAction).length > 0
    ) {
      lines.push(`    Использование: ${item.consumableUseAction}`);
    }
    const description =
      typeof item.description === 'string' ? item.description : '';
    if (description.length > 0) {
      lines.push(`    Описание:`);
      for (const paragraph of description.split('\n')) {
        if (paragraph.length > 0) {
          lines.push(`      ${paragraph}`);
        }
      }
    }
    return lines;
  }

  lines.push(`  [Неизвестный тип] ${name}`);
  return lines;
}

/**
 * @param {string} locationLabel
 * @param {Array<Record<string, unknown>>} items
 */
function printLootReport(locationLabel, items) {
  console.log('');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  Локация: ${locationLabel}`);
  console.log(`  Сгенерировано записей: ${items.length}`);
  console.log('══════════════════════════════════════════════════════════════');

  if (items.length === 0) {
    console.log('  (Пусто: для этой локации нет строк в карте лута или пул отфильтрован.)');
    console.log('');
    return;
  }

  items.forEach((item, index) => {
    console.log('');
    console.log(`── Запись ${index + 1} ─────────────────────────────────────────`);
    for (const line of formatLootItemForConsole(item)) {
      console.log(line);
    }
  });
  console.log('');
}

function printMenu() {
  console.log('');
  console.log('Выберите локацию:');
  for (const entry of LOCATION_MENU) {
    console.log(`  ${entry.key}. ${entry.label}`);
  }
  console.log('  0. Выход');
  console.log('');
}

async function runInteractiveLoop() {
  const databasePath = resolve(join(process.cwd(), DATABASE_FILE_NAME));
  setLootDatabasePath(databasePath);

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     Генератор лута D&D (SQLite)                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`База данных: ${databasePath}`);
  console.log('(Ожидается файл рядом с программой: dnd-loot.sqlite)');
  console.log('');

  const readlineInterface = readline.createInterface({ input, output });

  try {
    while (true) {
      printMenu();
      const answer = (await readlineInterface.question('Ваш выбор: ')).trim();

      if (answer === '0') {
        console.log('');
        console.log('До встречи!');
        break;
      }

      const chosen = LOCATION_MENU.find((entry) => entry.key === answer);
      if (!chosen) {
        console.log('');
        console.log('Неверный выбор. Укажите 1, 2, 3 или 0.');
        continue;
      }

      try {
        const loot = generateLoot(chosen.resolveAs, LOOT_PICKS_PER_RUN);
        printLootReport(chosen.label, loot);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log('');
        console.log('Ошибка при генерации:');
        console.log(`  ${message}`);
        console.log('');
      }
    }
  } finally {
    readlineInterface.close();
  }
}

runInteractiveLoop().catch((error) => {
  console.error(
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
