/**
 * Каталог структурированных локаций — не БД, кураторские шаблоны под биом + тему.
 */

import { pickDeterministicFrom } from './session-scene-themes.mjs';

/**
 * @typedef {{
 *   id: string,
 *   nameRu: string,
 *   typeRu: string,
 *   biomes: string[],
 *   themes: string[],
 *   danger_level: 1 | 2 | 3 | 4 | 5,
 *   sublocations: string[],
 *   narrative_hooks: string[],
 * }} DmLocationBlueprint
 */

/** @type {DmLocationBlueprint[]} */
const BLUEPRINTS = [
  {
    id: 'watchtower_ruin',
    nameRu: 'Заброшенная сторожевая башня',
    typeRu: 'руины, высота',
    biomes: ['forest', 'mountain', 'dungeon', 'generic'],
    themes: ['storm_magic', 'smuggling_operation', 'cursed_relics', 'undead_activity'],
    danger_level: 3,
    sublocations: ['Валун у подножия', 'Винтовая лестница без перил', 'Смотровая площадка с трещиной в полу'],
    narrative_hooks: [
      'На камне свежая царапина когтя — слишком высоко для зверя',
      'Сигнальный жаровня пахнет старым маслом, будто её только что гасили',
    ],
  },
  {
    id: 'flooded_crypt',
    nameRu: 'Затопленный подземный склеп',
    typeRu: 'склеп, вода',
    biomes: ['crypt', 'dungeon', 'swamp', 'cave'],
    themes: ['undead_activity', 'cursed_relics', 'plague_outbreak'],
    danger_level: 4,
    sublocations: ['Зал с колоннами по пояс в воде', 'Саркофаг на едва заметном дамбе', 'Ниша с обломанной цепью'],
    narrative_hooks: [
      'Вода пахнет не гнилью, а лекарством — чужая формула',
      'На стене — свежая отметка уровня, выше текущей воды',
    ],
  },
  {
    id: 'forest_shrine',
    nameRu: 'Проклятый лесной алтарь',
    typeRu: 'святилище',
    biomes: ['forest'],
    themes: ['cult_ritual', 'cursed_relics', 'storm_magic'],
    danger_level: 3,
    sublocations: ['Кольцо корней', 'Каменная чаша', 'Тропа, уходящая в болото'],
    narrative_hooks: [
      'Монеты в чаше ржавые, но одна блестит как новая',
      'Следы босых ступней — слишком ровные, чтобы быть паломниками',
    ],
  },
  {
    id: 'hidden_alchem_lab',
    nameRu: 'Скрытая алхимическая лаборатория',
    typeRu: 'лаборатория',
    biomes: ['laboratory', 'dungeon', 'city'],
    themes: ['abandoned_laboratory', 'plague_outbreak', 'noble_conspiracy'],
    danger_level: 4,
    sublocations: ['Реторты и шкаф с ядами', 'Журнал с вырванными страницами', 'Люк в вентиляцию'],
    narrative_hooks: [
      'Печать на банке не совпадает с гербом города',
      'Капли на столе ещё тёплые — кто-то ушёл недавно',
    ],
  },
  {
    id: 'ruined_estate',
    nameRu: 'Разрушенное поместье знати',
    typeRu: 'усадьба',
    biomes: ['city', 'forest', 'dungeon'],
    themes: ['noble_conspiracy', 'cursed_relics', 'undead_activity'],
    danger_level: 3,
    sublocations: ['Гостиная с обожжённым портретом', 'Кабинет с сейфом', 'Задний двор — заросший сад'],
    narrative_hooks: [
      'Письмо без подписи — но сургуч знаком',
      'Служебная дверь заперта изнутри',
    ],
  },
  {
    id: 'dwarf_seal_gate',
    nameRu: 'Запечатанный дварфийский тоннель',
    typeRu: 'тоннель',
    biomes: ['mountain', 'cave', 'dungeon'],
    themes: ['cursed_relics', 'smuggling_operation', 'undead_activity'],
    danger_level: 4,
    sublocations: ['Плита с рунами', 'Щель с холодным сквозняком', 'Обвал, оставивший узкий лаз'],
    narrative_hooks: [
      'Печать гильдии горняков сорвана — и снова прижата воском',
      'Слышен металлический стук из-за камня — ритмичный, как сигнал',
    ],
  },
  {
    id: 'corrupted_ford',
    nameRu: 'Испорченный брод через реку',
    typeRu: 'переправа',
    biomes: ['swamp', 'forest', 'coastal', 'generic'],
    themes: ['plague_outbreak', 'storm_magic', 'cult_ritual'],
    danger_level: 3,
    sublocations: ['Смытые колья у мели', 'Старый пост караула', 'Туманная завесь над водой'],
    narrative_hooks: [
      'Рыба плывёт брюхом вверх — только у переправы',
      'На столбе — знак, которого нет на картах гильдии',
    ],
  },
  {
    id: 'dock_warehouse',
    nameRu: 'Портовый склад с двойным дном',
    typeRu: 'город, склад',
    biomes: ['city', 'coastal'],
    themes: ['smuggling_operation', 'noble_conspiracy', 'plague_outbreak'],
    danger_level: 2,
    sublocations: ['Нижний ярус под настилом', 'Контора с весами', 'Задняя дверь в переулок'],
    narrative_hooks: [
      'Весы калиброваны «в пользу» одного груза',
      'Журнал грузов: одна страница вырвана аккуратно',
    ],
  },
];

/**
 * @param {{ narrativeBiome: string, themeId: string, seed: string }} p
 */
export function pickStructuredLocation(p) {
  const bio = String(p.narrativeBiome || 'generic');
  const tid = String(p.themeId || '');
  const pool = BLUEPRINTS.filter(
    (b) =>
      (b.biomes.includes(bio) || b.biomes.includes('generic')) &&
      (b.themes.includes(tid) || b.themes.length === 0),
  );
  const use = pool.length ? pool : BLUEPRINTS;
  const key = `${p.seed}|loc`;
  const bp = pickDeterministicFrom(
    use.map((x) => x.id),
    key,
  );
  const found = use.find((x) => x.id === bp) ?? use[0];
  return {
    id: found.id,
    name: found.nameRu,
    biome: bio,
    type: found.typeRu,
    danger_level: found.danger_level,
    sublocations: [...found.sublocations],
    narrative_hooks: [...found.narrative_hooks],
  };
}
