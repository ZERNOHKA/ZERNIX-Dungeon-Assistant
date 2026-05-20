import type { ZernixWorldHints } from "../lib/zernixUserStorage";
import { allSceneBeatsFlat, sceneBeatsForBiome } from "../lib/zernixLocationCatalog";
import type { SessionFormBridge } from "./generators/sessionBridge";

function tidy(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashSeed(parts: Array<string | number>): number {
  const s = parts.map(String).join("\x1e");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function biomeRu(key: string): string {
  const k = String(key ?? "").toLowerCase();
  if (k === "urban") return "город и его тени (улочки, власть, толпа)";
  if (k === "forest") return "лес и дикие тропы";
  if (k === "cave") return "пещеры и подземные залы";
  if (k === "dungeon") return "подземелье: сырость, теснота, чужие следы";
  if (k === "coastal") return "побережье: солёный воздух, причалы, прилив и контрабанда";
  if (k === "mountain") return "горы и перевалы: разреженный воздух, осыпи, ветра";
  if (k === "arctic") return "север: метель, обмороз, замерзшие следы и хрупкая тишина";
  if (k === "swamp") return "болота: туман, гниль, тропы между кочками и чужие огоньки";
  if (k === "ruins") return "руины: треснувшая кладка, чужие отметки и пыль на ступенях";
  if (k === "any") return "локация не зафиксирована — опирайся на таблицы биома и типа сцены, дай якорь в первом абзаце";
  return "нейтральная или смешанная локация — выбери якорь по таблицам";
}

function difficultyRu(d: string): string {
  const x = String(d ?? "").toLowerCase();
  if (x === "low" || x === "easy") return "низкая — стол держит запас, ошибка не убивает сразу";
  if (x === "high" || x === "hard") return "высокая — цена ошибки заметна с первых раундов";
  if (x === "deadly") return "смертельная — ставка на ход, любая лишняя проверка может стать последней";
  return "средняя — и давление, и воздух для манёвра";
}

const TENSION = [
  "таймер невидим, но игроки чувствуют сжатие пространства",
  "один ложный шаг открывает второй фронт",
  "свидетель слишком любопытен — его нужно убрать или купить",
  "ключевая улика лежит у того, кто уже недоволен партией",
  "враги хотят не смерти, а подписи, молчания или отступления",
] as const;

const OBJECTIVES = [
  "вынести людей живыми",
  "забрать предмет до того, как его освятят",
  "разрушить узел сделки без открытой резни",
  "понять, кто дергает нити — и чем это пахнет для города",
  "сорвать ритуал или перехватить его энергию",
  "вывести на чистую воду того, кто подставляет других",
  "успеть до рассвета, пока улики не «исчезли сами»",
  "спасти невинного без открытой войны с властью",
] as const;

const ATMOSPHERE = [
  "воздух сырой, как старый плащ",
  "свет редкий — тени двигаются быстрее людей",
  "слышен далёкий бой или колокол — город на взводе",
  "пахнет озоном и железом — недавняя магия",
  "тишина «неправильная», будто кто-то затаился за углом",
  "холод ползёт по костям даже у костра",
  "шёпот толпы: слухи уже побежали вперёд фактов",
  "туман держит запах гнили и духов",
] as const;

const TWISTS = [
  "правда оказывается хуже слухов",
  "союзник и враг меняются ролями на полпути",
  "улика ведёт туда, где никто не хотел смотреть",
  "цена помощи — морально неудобный выбор",
  "таймер невидим, но игроки чувствуют сжатие",
] as const;

/** Одно естественное предложение из worldHints; без служебных тегов. */
function weaveWorldHints(w: ZernixWorldHints, salt: number): string {
  const loc = tidy(w.currentLocation);
  const fac = tidy(w.activeFaction);
  const thr = tidy(w.currentThreat);
  const npc = tidy(w.lastNpcName);
  const hk = tidy(w.lastHookLine);
  const hkShort = hk.length > 110 ? `${hk.slice(0, 108)}…` : hk;

  const pool: string[] = [];
  if (npc) {
    pool.push(`В тоннелях снова всплывает имя «${npc}».`);
    pool.push(`Следы ведут к знакомому NPC — «${npc}».`);
    pool.push(`Кто-то шепчет «${npc}» так, будто это пароль.`);
  }
  if (hk && hkShort) {
    pool.push(`В разговорах снова крутится отголосок: «${hkShort}».`);
    pool.push(`Одна фраза с прошлой сессии не отпускает: «${hkShort}».`);
  }
  if (thr) {
    pool.push(`На заднем плане не отпускает: ${thr}.`);
    pool.push(`Угроза кампании давит на сцену: ${thr}.`);
  }
  if (fac) {
    pool.push(`Воздух густеет от «${fac}» — этого достаточно, чтобы сцена накалилась.`);
    pool.push(`Две стороны помнят о «${fac}» — и герои попадают между.`);
  }
  if (loc) {
    pool.push(`Место помнит ${loc} — пусть это даст фактуру, а не справку.`);
    pool.push(`Эхо ${loc} слышится в деталях: запах, звук, привычка местных.`);
  }

  if (!pool.length) return "";
  return ` ${pool[salt % pool.length]}`;
}

/**
 * Текст для `environmentText` в IPC: при пустом поле мастера — полноценная авто-задумка;
 * при заполненном — база + мягкий акцент (не единственный источник сцены).
 */
export function composeSessionEnvironmentText(
  form: SessionFormBridge,
  world: ZernixWorldHints,
  entropyMs: number,
): string {
  const user = tidy(form.environmentText);
  const h = hashSeed([
    entropyMs,
    form.partyLevel,
    form.playerCount,
    form.environmentKey,
    form.difficulty,
    form.packCount,
    form.chestCount,
    user,
  ]);
  const beatPool = [...sceneBeatsForBiome(form.environmentKey), ...allSceneBeatsFlat()];
  const beat = beatPool[h % beatPool.length]!;
  const tension = TENSION[(h >>> 5) % TENSION.length]!;
  const objective = OBJECTIVES[(h >>> 11) % OBJECTIVES.length]!;
  const atmo = ATMOSPHERE[(h >>> 17) % ATMOSPHERE.length]!;
  const twist = TWISTS[(h >>> 23) % TWISTS.length]!;
  const biome = biomeRu(form.environmentKey);
  const diff = difficultyRu(form.difficulty);

  const autoCore = [
    `Сгенерируй связную игровую сцену для D&D 5.5 без пустых блоков.`,
    `Партия: уровень ${form.partyLevel}, игроков ${form.playerCount}. Сложность: ${diff}. Биом: ${biome}.`,
    `Стол: паков ${form.packCount}, сундуков ${form.chestCount} — вплети в экономику угрозы/награды, без перечисления таблиц.`,
    `Опорный конфликт / событие: ${beat}.`,
    `Атмосферный слой: ${atmo}.`,
    `Напряжение: ${tension}.`,
    `Поворот или осложнение: ${twist}.`,
    `Цель столкновения (для героев): ${objective}.`,
    `Дай тему, конфликт, атмосферу, событие, крючок, угрозу, врагов и награду; напиши связным текстом для мастера, не как JSON и не как сухой дамп полей; не повторяй одну и ту же фразу в каждом блоке.`,
  ].join("\n");

  const worldWoven = weaveWorldHints(world, h >>> 29);

  if (user) {
    return `${autoCore}${worldWoven}\n\nМягкий акцент мастера (не копируй дословно в каждый блок, используй как слой): ${user}`.trim();
  }

  return `${autoCore}${worldWoven}`.trim();
}
