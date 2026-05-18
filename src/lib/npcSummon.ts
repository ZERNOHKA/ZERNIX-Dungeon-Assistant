import { generateNpcAsync } from "../database.mjs";
import type { AppContentJson, NpcPortrait, NpcTemplateEntry } from "../types/content";

/** Сводка цен из npc-engine (сумма явных зм/см в строках услуг). */
export interface NpcPricingRollup {
  totalZm: number;
  totalSm: number;
  totalCostZm?: number;
}

export interface ResolvedNpcCard {
  /** Имя (личное) */
  name: string;
  /** Прозвище: прилагательное + существительное */
  epithet: string;
  raceRu: string;
  genderRu: string;
  /** Подпись роли из UI (например «Наставник») */
  roleLabelRu: string;
  occupationRu: string;
  /** Родовая подпись профессии из движка (например «кузнец» / «кузнеца» контекстно). */
  professionLabelRu?: string;
  /** Категория: Ремесло / Интеллект / Услуги / Криминал */
  professionCategoryLabelRu?: string;
  /** Строка специализации («Кузнец: заточка клинков»). */
  specializationLine?: string;
  appearance: string;
  manner: string;
  motivation: string;
  secret: string;
  /** Вступительная реплика по мотивации */
  catchphrase: string;
  inventory: string;
  portrait: string;
  /** Короткие поля для стола — из npc-engine dmQuick */
  dmQuick?: {
    visual: string;
    wants: string;
    avoids: string;
    secret: string;
  };
  /** Полный Markdown из npc-engine (Electron). */
  markdownFull?: string;
  pricingRollup?: NpcPricingRollup;
  /** Отношение к партии (из движка). */
  dispositionLabelRu?: string;
  /** Социальная роль к героям — пояснение. */
  socialStakeLine?: string;
  /** Хобби, контрастирующее с профессией */
  hobbyEclectic?: string;
  /** Короткая строка «где найти сейчас» */
  whereToFindNow?: string;
  /** Крючок про ремесло / руки / отношение к сломанным вещам */
  craftsmanshipNarrativeHook?: string;
  /** Сцена первой встречи (профессия + роли) из npc-engine */
  encounterMeetingRu?: string;
  /** Ориентир ремонта (оружие), из calculateServicePrice */
  repairWeaponSummaryRu?: string;
  /** Ориентир ремонта (магический предмет) */
  repairMagicItemSummaryRu?: string;
}

export interface NpcSummonForm {
  race: string;
  occupationValue: string;
  role: string;
  genderId: string;
}

/** Подписи карточки NPC (UI и шаринг). */
export const NPC_CARD_LABEL_RU = {
  name: "Имя",
  race: "Раса",
  role: "Роль",
  occupation: "Занятие",
  appearance: "Облик",
  manner: "Манера",
  quote: "Цитата",
  motivation: "Мотивация",
  secret: "Тайна",
  inventory: "Имущество",
} as const;

/** Значение занятия из UI → id профессии в npc-engine.mjs */
const OCCUPATION_TO_ENGINE_PROFESSION_ID: Record<string, string> = {
  merchant: "merchant",
  scholar: "sage",
  craftsman: "blacksmith",
  guard: "mercenary",
  rogue: "fence",
};

function pickPortrait(portraits: NpcPortrait[], gender: string): NpcPortrait {
  if (!portraits.length) {
    return { id: "blank", image: "" };
  }
  const keyed = portraits.filter((pic) =>
    gender === "female" ? pic.id.startsWith("f") : gender === "male" ? pic.id.startsWith("m") : true,
  );
  const pool = keyed.length ? keyed : portraits;
  return pool[Math.floor(Math.random() * pool.length)] ?? portraits[0];
}

export function resolvedGenderPhysical(genderId: string): "female" | "male" {
  if (genderId === "female") return "female";
  if (genderId === "male") return "male";
  return Math.random() > 0.5 ? "female" : "male";
}

function mapEnginePayloadToResolvedCard(
  raw: Record<string, unknown>,
  markdown: string,
  npc: AppContentJson["npc"],
  form: NpcSummonForm,
): ResolvedNpcCard | null {
  const identity = raw.identity as Record<string, unknown> | undefined;
  const role = raw.role as Record<string, unknown> | undefined;
  const portrayal = raw.portrayal as Record<string, unknown> | undefined;
  const plot = raw.plot as Record<string, unknown> | undefined;
  const narrative = raw.narrative as Record<string, unknown> | undefined;
  if (!identity || !role || !portrayal || !plot || !narrative) return null;

  const genderResolved = resolvedGenderPhysical(form.genderId);
  const portrait = pickPortrait(npc.portraits, genderResolved).image;
  const roleLabelRu = npc.roles.find((r) => r.value === form.role)?.labelRu ?? form.role;

  const dispositionObj = portrayal.disposition as Record<string, unknown> | undefined;
  const socialStake = plot.socialStake as Record<string, unknown> | undefined;
  const pockets = plot.pockets as unknown;
  const rollup = role.pricingRollup as Record<string, unknown> | undefined;

  const pocketLines = Array.isArray(pockets) ? pockets.map((p) => String(p)).join("; ") : "";

  const totalZm = typeof rollup?.totalZm === "number" ? rollup.totalZm : 0;
  const totalSm = typeof rollup?.totalSm === "number" ? rollup.totalSm : 0;
  const totalCostZm = typeof rollup?.totalCostZm === "number" ? rollup.totalCostZm : totalZm;

  const tier = String(role.professionTier ?? "");
  const stakeLab = String(socialStake?.roleLabel ?? "");
  const professionLabelRu =
    role.professionLabelRu != null ? String(role.professionLabelRu) : undefined;
  const profLine = professionLabelRu ?? String(role.profession ?? "");
  const specializationLine =
    role.specialization != null ? String(role.specialization) : undefined;
  const hobbyEclectic =
    portrayal.hobbyEclectic != null ? String(portrayal.hobbyEclectic) : undefined;
  const whereToFindNow =
    portrayal.whereToFindNow != null ? String(portrayal.whereToFindNow) : undefined;
  const craftsmanshipNarrativeHook =
    portrayal.craftsmanshipNarrativeHook != null
      ? String(portrayal.craftsmanshipNarrativeHook)
      : undefined;
  const categoryLab =
    role.professionCategoryLabelRu != null ? String(role.professionCategoryLabelRu) : undefined;
  const repairPricing = role.repairPricing as Record<string, unknown> | undefined;
  const sampleWeapon = repairPricing?.sampleWeapon as Record<string, unknown> | undefined;
  const sampleMagic = repairPricing?.sampleMagicItem as Record<string, unknown> | undefined;

  const dmRaw = raw.dmQuick as Record<string, unknown> | undefined;
  const dmQuick =
    dmRaw && typeof dmRaw === "object"
      ? {
          visual: String(dmRaw.visual ?? ""),
          wants: String(dmRaw.wants ?? ""),
          avoids: String(dmRaw.avoids ?? ""),
          secret: String(dmRaw.secret ?? ""),
        }
      : undefined;

  return {
    name: String(identity.name ?? ""),
    epithet: [tier, stakeLab].filter(Boolean).join(" · "),
    raceRu: String(identity.race ?? ""),
    genderRu: String(identity.gender ?? ""),
    roleLabelRu,
    occupationRu: `${profLine} (${tier})`,
    appearance: String(portrayal.appearance ?? ""),
    manner: String(portrayal.manner ?? ""),
    motivation: String(narrative.backstoryParagraph ?? ""),
    secret: String(plot.secretOrHook ?? ""),
    catchphrase: String(portrayal.greetingFirstPhrase ?? ""),
    inventory: pocketLines,
    portrait,
    dmQuick,
    markdownFull: markdown,
    pricingRollup: {
      totalZm,
      totalSm,
      totalCostZm,
    },
    dispositionLabelRu: dispositionObj?.label != null ? String(dispositionObj.label) : undefined,
    socialStakeLine: socialStake?.explanation != null ? String(socialStake.explanation) : undefined,
    professionLabelRu,
    professionCategoryLabelRu: categoryLab,
    specializationLine,
    hobbyEclectic,
    whereToFindNow,
    craftsmanshipNarrativeHook,
    repairWeaponSummaryRu:
      sampleWeapon?.summaryRu != null ? String(sampleWeapon.summaryRu) : undefined,
    repairMagicItemSummaryRu:
      sampleMagic?.summaryRu != null ? String(sampleMagic.summaryRu) : undefined,
    encounterMeetingRu:
      narrative.encounterMeeting != null ? String(narrative.encounterMeeting) : undefined,
  };
}

function splitMotivationAndSecret(raw: string): { motivation: string; secret: string } {
  const t = String(raw).replace(/\s+/g, " ").trim();
  if (!t) return { motivation: "Ищет понятную выгоду без лишней огласки.", secret: "Скрывает слабое место, которое дорого могут купить." };
  const m = /\b(Тайна|Секрет)\s*:\s*/i.exec(t);
  const idx = m?.index ?? -1;
  if (idx >= 0) {
    const motivation = t.slice(0, idx).replace(/[.;,:]+$/g, "").trim();
    const secret = t.slice(idx).replace(/^[^:]+:\s*/i, "").trim();
    return {
      motivation: motivation || secret,
      secret: secret || motivation,
    };
  }
  return { motivation: t, secret: "Прячет вторую сделку, о которой не говорит при свидетелях." };
}

function pickNpcTemplate(npc: AppContentJson["npc"], form: NpcSummonForm): NpcTemplateEntry | null {
  const templates = npc.templates;
  if (!templates?.length) return null;

  let pool = templates.filter((x) => x.raceKey === form.race);
  if (!pool.length) pool = [...templates];

  if (form.genderId === "female") {
    const sub = pool.filter((x) => /жен/i.test(x.genderRu));
    if (sub.length) pool = sub;
  } else if (form.genderId === "male") {
    const sub = pool.filter((x) => /муж/i.test(x.genderRu));
    if (sub.length) pool = sub;
  }

  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

function templateToResolvedCard(
  template: NpcTemplateEntry,
  npc: AppContentJson["npc"],
  form: NpcSummonForm,
): ResolvedNpcCard {
  const raceRu = npc.races.find((r) => r.value === form.race)?.labelRu ?? template.raceKey;
  const roleLabelRu =
    npc.roles.find((r) => r.value === form.role)?.labelRu ??
    npc.roles.find((r) => r.value === template.roleKey)?.labelRu ??
    "Союзник";
  const occupationRu =
    npc.occupations.find((o) => o.value === form.occupationValue)?.labelRu ?? template.occupationRu;

  const { motivation, secret } = splitMotivationAndSecret(template.motivation);

  const mannerSeed =
    "Держится уверенно, отмечает детали среды и заранее прикидывает две линии отступления.";

  const portraitPic = pickPortrait(npc.portraits, resolvedGenderPhysical(form.genderId));
  const portrait = portraitPic.image ?? "";

  const markdownFull = [
    `# ${template.name}`,
    `- **Раса:** ${raceRu} · ${template.genderRu}`,
    `- **Роль:** ${roleLabelRu} · **Занятие:** ${occupationRu}`,
    "",
    "## Облик",
    template.appearance,
    "",
    "## Мотивация",
    motivation,
    "",
    "## Тайна",
    secret,
    "",
    "## Имущество",
    template.inventory,
    "",
    "_Браузерный режим: шаблон из app-content.json._",
  ].join("\n");

  return {
    name: template.name,
    epithet: "",
    raceRu,
    genderRu: template.genderRu,
    roleLabelRu,
    occupationRu,
    appearance: template.appearance,
    manner: mannerSeed,
    motivation,
    secret,
    catchphrase: "Сначала границы, потом доверие — и только потом имена.",
    inventory: template.inventory,
    portrait,
    dmQuick: {
      visual: template.appearance.replace(/\s+/g, " ").trim().slice(0, 200),
      wants: motivation.slice(0, 200),
      avoids: mannerSeed.slice(0, 160),
      secret: secret.slice(0, 200),
    },
    markdownFull,
    pricingRollup: { totalZm: 0, totalSm: 0 },
    encounterMeetingRu: `Первая встреча: ${occupationRu} как ${roleLabelRu.toLowerCase()} — торг, намёки, проверка намерений.`,
  };
}

/**
 * Electron / IPC (npc-engine) или браузер: шаблоны из контента (`npc.templates`) + задержка из `database.mjs`.
 */
export async function resolveNpcCard(
  npc: AppContentJson["npc"],
  form: NpcSummonForm,
): Promise<ResolvedNpcCard | null> {
  if (!npc.races?.length) return null;

  const ipc = typeof window !== "undefined" ? window.electronAPI : undefined;

  if (typeof ipc?.generateNpc !== "function") {
    await generateNpcAsync();
    const tmpl = pickNpcTemplate(npc, form);
    if (!tmpl) return null;
    return templateToResolvedCard(tmpl, npc, form);
  }

  const genderResolved = resolvedGenderPhysical(form.genderId);
  const professionId = OCCUPATION_TO_ENGINE_PROFESSION_ID[form.occupationValue] ?? "merchant";
  const partyRoleLabelRu = npc.roles.find((r) => r.value === form.role)?.labelRu ?? form.role;

  try {
    const res = await ipc.generateNpc({
      raceId: form.race,
      genderId: genderResolved,
      professionId,
      partyRoleLabelRu,
    });
    if (res.ok && res.data && typeof res.markdown === "string") {
      const card = mapEnginePayloadToResolvedCard(
        res.data as Record<string, unknown>,
        res.markdown,
        npc,
        form,
      );
      if (card) return card;
    } else if (!res.ok) {
      console.warn("[ZERNIX] generateNpc IPC:", res.error);
    }
  } catch (e) {
    console.warn("[ZERNIX] generateNpc IPC exception:", e);
  }

  return null;
}
