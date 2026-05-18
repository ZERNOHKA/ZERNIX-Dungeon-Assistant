import { generateSessionAsync } from "../../database.mjs";
import type { GenerateLootResult, SessionBrief } from "../../vite-env";
import type { SessionPreviewModel } from "../models";
import { finalizeSessionMarkdownForUi } from "../sessionNarrativeCleanup";
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

function biomeLabelRu(environmentKey: string): string {
  const map: Record<string, string> = {
    dungeon: "Подземелье",
    forest: "Лес",
    cave: "Пещера",
    urban: "Город",
    any: "Смешанный биом",
  };
  return map[environmentKey] ?? map.any;
}

function difficultyLabelRu(d: string): string {
  if (d === "low") return "низкая";
  if (d === "high") return "высокая";
  return "средняя";
}

function excerptFromMarkdown(md: string, max = 320): string {
  const t = md.trim().replace(/\r/g, "");
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
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

  const salt = Math.floor(Date.now() / 1000) >>> 0;
  const biome = biomeLabelRu(form.environmentKey);
  const diffRu = difficultyLabelRu(form.difficulty);
  const userCtx = form.environmentText.trim();

  const titles = [
    "Затворница между двумя клятвами",
    "Ночная смена у кристаллических ворот",
    "Прах и пергамент под одной свечой",
    "Цена молчания на причале",
    "Подземный аукцион чужих имён",
  ];
  const title = titles[salt % titles.length] ?? titles[0]!;

  const encounterPitch =
    userCtx.slice(0, 400) ||
    `Группа ${form.playerCount} героев (${form.partyLevel} ур.) вторгается в ${biome}: старый порядок уже треснул, и каждый жест считывают как торг.`;

  const sessionBrief: SessionBrief = {
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
        : "Лицо сцены спокойное, но дорогое: малейший шум перекраивает ставки.",
    danger:
      form.difficulty === "high"
        ? "Серьёзный урон возможен уже на первой ошибке времени или шума."
        : form.difficulty === "low"
          ? "Риск есть, но отступление кажется выполнимым до середины событий."
          : "Ошибки бьют по ресурсам: лечение и слоты уходят заметнее, чем казалось.",
    enemies: [
      "Патруль с экономией сил («мы не враги, пока платят железом или информацией»).",
      "Охрана простого аппарата: сигнал, ловушка, второй вход.",
    ],
    rewardLines: [
      form.onlyMagic
        ? "Магические следы сильнее мундейна: ценный ключ не от тех дверей, что хотелось."
        : "Смесь мундейна и магии: ценный ключ не от тех дверей, что хотелось.",
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
