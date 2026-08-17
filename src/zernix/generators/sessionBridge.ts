import { generateSessionAsync } from "../../services/mocks/database.mjs";
import type { GenerateLootResult, SessionBrief } from "../../vite-env";
import {
  biomeLabelRu,
  getBiome,
  pickFromBiome,
  sceneBeatsForBiome,
} from "../../lib/zernixLocationCatalog";
import type { SessionPreviewModel } from "../models";
import {
  finalizeSessionMarkdownForUi,
  sanitizeSessionBrief,
  sanitizeSessionParagraph,
} from "../sessionNarrativeCleanup";
import { pitchExcerpt, presentSessionAtTable } from "../sessionAtTablePresent";

export type SessionFormBridge = {
  partyLevel: number;
  playerCount: number;
  difficulty: string;
  packCount: number;
  chestCount: number;
  environmentText: string;
  environmentKey: string;
  onlyMagic: boolean;
};

function difficultyLabelRu(d: string): string {
  const k = String(d ?? "").trim().toLowerCase();
  if (k === "low" || k === "easy") return "низкая";
  if (k === "high" || k === "hard") return "высокая";
  if (k === "deadly") return "смертельная";
  return "средняя";
}

function excerptFromMarkdown(md: string, max = 320): string {
  const t = md.trim().replace(/\r/g, "");
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

/** Лёгкий и стабильный хеш для подмешивания энтропии в выбор заголовка. */
function fnv1a32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function sessionMarkdownToPreview(markdown: string): SessionPreviewModel {
  const raw = markdown.trim().replace(/\r/g, "");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const title = lines[0]?.trim() || "Подготовка сессии";
  const excerpt = excerptFromMarkdown(lines.slice(1).join("\n") || raw, 320);
  return {
    title,
    excerpt,
  };
}

function previewFromSessionBrief(b: SessionBrief): SessionPreviewModel {
  const p = presentSessionAtTable(b);
  const excerpt = pitchExcerpt(p, 300) || b.encounterPitch?.trim() || b.hook?.trim() || "Сводка сессии";
  return {
    title: b.title,
    excerpt,
  };
}

async function runMockSessionGeneration(form: SessionFormBridge): Promise<SessionBridgeResult> {
  await generateSessionAsync();

  // Энтропия: время + параметры формы → стабильное распределение по сценам,
  // но без коллизий «два запуска в одну секунду = один и тот же заголовок».
  const saltSeed =
    (Date.now() & 0xfffff) ^
    ((form.partyLevel & 0x1f) << 14) ^
    ((form.playerCount & 0x0f) << 9) ^
    (fnv1a32(`${form.environmentKey}|${form.difficulty}|${form.environmentText.length}`) >>> 0);
  const salt = saltSeed >>> 0;
  const biomeDef = getBiome(form.environmentKey);
  const biome = biomeLabelRu(form.environmentKey);
  const diffRu = difficultyLabelRu(form.difficulty);
  const sceneBeat = pickFromBiome(form.environmentKey, sceneBeatsForBiome(form.environmentKey), salt);
  const atmoLine = pickFromBiome(form.environmentKey, biomeDef.atmosphereLines, salt >>> 3);
  const enemyA = pickFromBiome(form.environmentKey, biomeDef.enemyLines, salt >>> 7);
  const enemyB = pickFromBiome(form.environmentKey, biomeDef.enemyLines, salt >>> 11);
  const rewardHint = pickFromBiome(form.environmentKey, biomeDef.rewardHints, salt >>> 13);
  const userCtx = sanitizeSessionParagraph(form.environmentText ?? "").trim();

  const titles = [
    "Затворница между двумя клятвами",
    "Ночная смена у кристаллических ворот",
    "Прах и пергамент под одной свечой",
    "Цена молчания на причале",
    "Подземный аукцион чужих имён",
    "Стук в дверь, которой нет на плане",
    "Свеча у саркофага догорает быстрее",
    "Караван без следов до и после",
    "Подпись на пергаменте чужой кровью",
    "Колокол, который никто не подвешивал",
    "Сделка, которую нельзя оплатить золотом",
    "Тень, отставшая от хозяина",
    "Чужие огни на дне знакомого колодца",
    "Печать, которая жжёт пальцы только одного",
    "Голос из соседней комнаты на знакомом языке",
    "Сон, повторившийся у разных людей подряд",
  ];
  const title = titles[salt % titles.length] ?? titles[0]!;

  const encounterPitch =
    userCtx.slice(0, 400) ||
    `${sceneBeat.charAt(0).toUpperCase()}${sceneBeat.slice(1)}. Группа ${form.playerCount} героев (${form.partyLevel} ур.) в ${biome}: старый порядок уже треснул, и каждый жест считывают как торг.`;

  const diffKey = String(form.difficulty ?? "").trim().toLowerCase();
  const dangerLine =
    diffKey === "high" || diffKey === "hard"
      ? "Серьёзный урон возможен уже на первой ошибке времени или шума."
      : diffKey === "deadly"
        ? "Смертельный риск: одна неверная сцена — и партия теряет персонажа или ключевую улику."
        : diffKey === "low" || diffKey === "easy"
          ? "Риск есть, но отступление кажется выполнимым до середины событий."
          : "Ошибки бьют по ресурсам: лечение и слоты уходят заметнее, чем казалось.";

  const rawBrief: SessionBrief = {
    title,
    themeLabel: "Давление времени и выбор",
    sceneTypeLabel: "Исследование",
    sceneTypeId: "exploration",
    biomeLabel: biome,
    encounterPitch,
    worldSummary: `${biome}: сложность ${diffRu}; пачек монстров в форме: ${form.packCount}; сундуков: ${form.chestCount}.`,
    factionHintsLine:
      userCtx.length > 80
        ? userCtx.slice(80, Math.min(userCtx.length, 320))
        : "Две силы торгуют доступом к одному проходу; третья торопит счётчик.",
    locationStructuredName: "",
    locationZonesLine: `${biome}: вестибюль → узел решений → резервный выход.`,
    location: `${biome}. Напряжение подсвечено светом, запахами и тем, что внезапно исчезло со столов.`,
    atmosphere:
      userCtx.length > 12
        ? `Контекст игроков: ${userCtx.slice(0, 280)}`
        : atmoLine || "Лицо сцены спокойное, но дорогое: малейший шум перекраивает ставки.",
    danger: dangerLine,
    enemies: [enemyA, enemyB].filter(Boolean),
    rewardLines: [
      form.onlyMagic
        ? rewardHint || "Магические следы сильнее мундейна: ценный ключ не от тех дверей, что хотелось."
        : rewardHint || "Смесь мундейна и магии: ценный ключ не от тех дверей, что хотелось.",
      form.packCount
        ? `${form.packCount} групп оставили чужую карту маршрута или дорогую гильдейскую печать.`
        : "Путь чист — значит цена запрятана в человеке или в обещании.",
      form.chestCount
        ? `${form.chestCount} контейнеров намекают запахом и температурой на разные ставки.`
        : "",
    ].filter(Boolean),
    hook:
      userCtx.slice(0, 220) ||
      "Слух ведёт к сделке, которую можно принять дважды и уплатить один раз — если повезёт.",
  };
  const sessionBrief = sanitizeSessionBrief(rawBrief);

  const md = [
    `# ${title}`,
    "",
    `Опора: **${biome}** · ур. ${form.partyLevel} · ${form.playerCount} игроков · сложность: ${diffRu}`,
    "",
    "## Конфликт и сцена",
    encounterPitch,
    "",
    "## Локация",
    sessionBrief.location,
    "",
    "## Атмосфера",
    sessionBrief.atmosphere,
    "",
    "## Угроза",
    sessionBrief.danger,
    "",
    "## Силы на поле",
    ...sessionBrief.enemies.map((e) => `- ${e}`),
    "",
    "## Награды и улики",
    ...sessionBrief.rewardLines.map((e) => `- ${e}`),
    "",
    "## Зацепка",
    sessionBrief.hook,
    "",
    "_Браузерный режим: mock-сценарий собран из полей формы._",
  ].join("\n");

  const markdown = finalizeSessionMarkdownForUi(md);
  return {
    ok: true,
    markdown,
    preview: previewFromSessionBrief(sessionBrief),
    sessionBrief,
  };
}

export type SessionBridgeResult =
  | {
      ok: true;
      markdown: string;
      preview: SessionPreviewModel;
      sessionBrief: SessionBrief | null;
    }
  | { ok: false; error: string };

/** Electron IPC или mock в браузере (`database.mjs` + форма ZERNIX). */
export async function runSessionGeneration(form: SessionFormBridge): Promise<SessionBridgeResult> {
  const ipc = typeof window !== "undefined" ? window.electronAPI : undefined;

  if (typeof ipc?.generateSessionPrep !== "function") {
    return await runMockSessionGeneration(form);
  }

  let res: GenerateLootResult;
  try {
    res = await ipc.generateSessionPrep({
      partyLevel: form.partyLevel,
      playerCount: form.playerCount,
      difficulty: form.difficulty,
      packCount: Math.max(0, Math.min(48, form.packCount)),
      chestCount: Math.max(0, Math.min(48, form.chestCount)),
      environmentText: form.environmentText,
      environmentKey: form.environmentKey,
      onlyMagic: form.onlyMagic,
      dungeonSession: null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
  if (!res.ok) {
    return { ok: false, error: res.error };
  }
  const markdown = finalizeSessionMarkdownForUi(res.markdown);
  const sessionBrief = res.sessionBrief ?? null;
  return {
    ok: true,
    markdown,
    preview: sessionBrief ? previewFromSessionBrief(sessionBrief) : sessionMarkdownToPreview(markdown),
    sessionBrief,
  };
}
