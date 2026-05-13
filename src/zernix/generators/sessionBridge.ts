import type { GenerateLootResult, SessionBrief } from "../../vite-env";
import type { SessionPreviewModel } from "../models";

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
  const excerpt =
    [b.encounterPitch, b.themeLabel, b.sceneTypeLabel, b.biomeLabel, b.location, b.atmosphere, b.hook]
      .filter(Boolean)
      .join(" · ")
      .trim() ||
    b.danger ||
    "Сводка сессии";
  return {
    title: b.title,
    excerpt: excerpt.length > 320 ? `${excerpt.slice(0, 319)}…` : excerpt,
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

/** IPC generateSessionPrep — логика остаётся в main process. */
export async function runSessionGeneration(form: SessionFormBridge): Promise<SessionBridgeResult> {
  if (typeof window === "undefined" || !window.electronAPI?.generateSessionPrep) {
    return {
      ok: false,
      error: "Генератор сессии доступен в сборке Electron с локальными движками.",
    };
  }
  let res: GenerateLootResult;
  try {
    res = await window.electronAPI.generateSessionPrep({
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
  const markdown = res.markdown;
  const sessionBrief = res.sessionBrief ?? null;
  return {
    ok: true,
    markdown,
    preview: sessionBrief ? previewFromSessionBrief(sessionBrief) : sessionMarkdownToPreview(markdown),
    sessionBrief,
  };
}
