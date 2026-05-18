import type { LootCardModel, NpcPreviewState } from "./models";
import type { SessionAtTablePresentation } from "./sessionAtTablePresent";

function t(s: unknown): string {
  if (s == null) return "";
  const x = String(s).trim();
  return /^(undefined|null)$/i.test(x) ? "" : x;
}

export async function writeClipboard(text: string): Promise<boolean> {
  const body = text.trim();
  if (!body) return false;
  try {
    if (globalThis.navigator?.clipboard?.writeText) {
      await globalThis.navigator.clipboard.writeText(body);
      return true;
    }
  } catch {
    /* ignore */
  }
  try {
    const el = document.createElement("textarea");
    el.value = body;
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export function formatNpcMarkdown(npc: NpcPreviewState): string {
  const lines: string[] = ["## NPC", ""];
  lines.push(`**Имя:** ${t(npc.name)}`);
  lines.push(`**Роль:** ${t(npc.creatureClass)}`);
  if (t(npc.race)) lines.push(`**Происхождение:** ${t(npc.race)}`);
  lines.push("", "### Внешность", t(npc.visualTrait), "", "### Хочет", t(npc.wantLine), "", "### Не хочет", t(npc.avoidLine), "", "### Секрет", t(npc.secretLine));
  return lines.join("\n");
}

export function formatNpcCompact(npc: NpcPreviewState): string {
  const head = `${t(npc.name)} — ${t(npc.creatureClass)}${t(npc.race) ? ` (${t(npc.race)})` : ""}`;
  return [head, `Образ: ${t(npc.visualTrait)}`, `Хочет: ${t(npc.wantLine)}`, `Не хочет: ${t(npc.avoidLine)}`, `Секрет: ${t(npc.secretLine)}`].join(
    " | ",
  );
}

export function formatNpcDiscord(npc: NpcPreviewState): string {
  const bits = [
    `**${t(npc.name)}** · ${t(npc.creatureClass)}`,
    t(npc.race) ? `_${t(npc.race)}_` : "",
    `Образ: ${t(npc.visualTrait)}`,
    `Хочет: ${t(npc.wantLine)}`,
    `Не хочет: ${t(npc.avoidLine)}`,
    `Секрет: ${t(npc.secretLine)}`,
  ].filter(Boolean);
  return bits.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function formatLootMarkdown(markdown: string, narrativeBlock: string | null): string {
  const md = markdown.trim();
  const nar = narrativeBlock?.trim();
  if (!md && !nar) return "";
  if (!nar) return md;
  if (!md) return `### Нарратив\n${nar}`;
  return `${md}\n\n### Нарратив\n${nar}`;
}

export function formatLootCompact(card: LootCardModel | null, markdown: string): string {
  if (card) {
    return `${card.title} (${card.rarityLabel}, ${card.kindLabel}) — ${t(card.description) || t(card.displayLine)}`.slice(0, 1800);
  }
  const m = markdown.replace(/\s+/g, " ").trim();
  return m.slice(0, 1800);
}

export function formatLootDiscord(markdown: string, narrativeBlock: string | null): string {
  const s = formatLootMarkdown(markdown, narrativeBlock).replace(/\n{3,}/g, "\n\n").trim();
  return s;
}

function bulletsMd(label: string, items: string[]): string[] {
  if (!items.length) return [];
  return ["", `## ${label}`, "", ...items.map((x) => `- ${x}`)];
}

export function formatSessionPresentationMarkdown(title: string, p: SessionAtTablePresentation): string {
  const lines: string[] = [`## ${t(title) || "Сессия"}`, "", p.pitch];
  lines.push(...bulletsMd("Что происходит", p.happenings));
  lines.push(...bulletsMd("Фишка сцены", p.sceneFlair));
  lines.push(...bulletsMd("Опасность", p.danger));
  lines.push(...bulletsMd("Награда", p.rewards));
  lines.push("", "## Крючок", "", p.hook, "", "## Суть сцены", "", p.essence, "", "## Главная проблема", "", p.mainProblem, "", "## Что запомнят игроки", "", p.whatPlayersRemember);
  return lines.join("\n").trim();
}

export function formatSessionPresentationCompact(title: string, p: SessionAtTablePresentation): string {
  const bits = [
    t(title),
    p.pitch,
    p.happenings.join(" · "),
    p.sceneFlair.join(" · "),
    p.danger.join(" · "),
    p.rewards.join(" · "),
    p.hook,
    p.essence,
    p.mainProblem,
    p.whatPlayersRemember,
  ];
  return bits.filter(Boolean).join(" — ").slice(0, 2200);
}

export function formatSessionPresentationDiscord(title: string, p: SessionAtTablePresentation): string {
  const parts: string[] = [];
  if (t(title)) parts.push(`**${t(title)}**`, "");
  parts.push(p.pitch, "");
  if (p.happenings.length) parts.push("**Что происходит**", ...p.happenings.map((x) => `• ${x}`), "");
  if (p.sceneFlair.length) parts.push("**Фишка**", ...p.sceneFlair.map((x) => `• ${x}`), "");
  if (p.danger.length) parts.push("**Опасность**", ...p.danger.map((x) => `• ${x}`), "");
  if (p.rewards.length) parts.push("**Награда**", ...p.rewards.map((x) => `• ${x}`), "");
  parts.push("**Крючок**", p.hook, "", "**Суть**", p.essence, "**Проблема**", p.mainProblem, "**Запомнят**", p.whatPlayersRemember);
  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function formatSessionMarkdown(
  title: string,
  excerpt: string,
  body: string,
  presentation?: SessionAtTablePresentation | null,
): string {
  if (presentation) return formatSessionPresentationMarkdown(title, presentation);
  const lines = [`## ${t(title) || "Сессия"}`];
  if (t(excerpt)) lines.push("", t(excerpt), "");
  else lines.push("");
  lines.push(t(body));
  return lines.join("\n").trim();
}

export function formatSessionCompact(
  title: string,
  excerpt: string,
  body: string,
  presentation?: SessionAtTablePresentation | null,
): string {
  if (presentation) return formatSessionPresentationCompact(title, presentation);
  const b = t(body).replace(/\s+/g, " ");
  return [t(title), t(excerpt), b].filter(Boolean).join(" — ").slice(0, 2200);
}

export function formatSessionDiscord(
  title: string,
  excerpt: string,
  body: string,
  presentation?: SessionAtTablePresentation | null,
): string {
  if (presentation) return formatSessionPresentationDiscord(title, presentation);
  const parts: string[] = [];
  if (t(title)) parts.push(`**${t(title)}**`);
  if (t(excerpt)) parts.push(t(excerpt));
  if (t(body)) parts.push(t(body));
  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
