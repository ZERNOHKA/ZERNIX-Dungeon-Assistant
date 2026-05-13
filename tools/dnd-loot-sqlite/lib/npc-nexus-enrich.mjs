/**
 * Обогащение NPC данными из SQLite после ядра generateNPC (секрет уже известен).
 * Вызывается из Electron main после generateNPC — клиентская сборка без БД не тянет этот модуль.
 */

import { SQL_ITEMS_LOCALIZED_FROM, SQL_ITEMS_LOCALIZED_SELECT } from './sql-items-localized.mjs';
import { pickRandomItemRowWeighted, pickWeightedRow, parseTagsField, readItemLootWeight } from './loot-nexus-weights.mjs';

const SMITHISH = /smith|locksmith|forge|кузнец|оружейник|клинок|доспех/i;

/** Эвристика: вторичные теги для весов lore_fragments по тексту секрета (JS). */
const SECRET_TAG_RULES = Object.freeze([
  { tags: ['criminal'], re: /вор|кража|бандит|похищ|закон|страж|тюрьм|поддел|контрабанд|kriminal/i },
  { tags: ['debt'], re: /долг|ростовщик|заклад|расписк|вексел/i },
  { tags: ['cult'], re: /культ|ритуал|жертв|демон|нечист|проклят/i },
  { tags: ['magic'], re: /маг|заклин|артефакт|проклят|иллюз|портал/i },
  { tags: ['noble'], re: /двор|титул|родослов|наслед|граф|герцог|корол/i },
  { tags: ['dungeon'], re: /подземель|катакомб|склеп|руин|лабиринт/i },
]);

/**
 * @param {string} secretText
 * @returns {string[]}
 */
export function inferSecondaryTagsFromSecret(secretText) {
  const s = String(secretText ?? '');
  if (!s.trim()) return [];
  /** @type {Set<string>} */
  const out = new Set();
  for (const rule of SECRET_TAG_RULES) {
    if (rule.re.test(s)) {
      for (const t of rule.tags) out.add(t);
    }
  }
  return [...out];
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} type trait | secret | goal
 * @param {string|null|undefined} contextTag
 * @param {string[]} secondaryTags
 * @param {() => number} rng
 * @returns {string|null}
 */
export function pickLoreFragmentLine(db, type, contextTag, secondaryTags, rng) {
  const rows = /** @type {Array<Record<string, unknown>>} */ (
    db.prepare(`SELECT id, type, text, weight, tags FROM lore_fragments WHERE type = ?`).all(type)
  );
  if (!rows.length) return null;
  const ctx = contextTag != null ? String(contextTag).trim().toLowerCase() : '';
  const sec = Array.isArray(secondaryTags)
    ? secondaryTags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
    : [];

  const picked = pickWeightedRow(
    rows,
    (row) => {
      let w = readItemLootWeight(row);
      const loreTags = parseTagsField(row);
      if (ctx && loreTags.includes(ctx)) {
        w = Math.round(w * 2.2);
      }
      for (const st of sec) {
        if (loreTags.includes(st)) {
          w = Math.round(w * 1.55);
        }
      }
      return w;
    },
    rng,
  );
  if (!picked) return null;
  const t = picked.text != null ? String(picked.text).trim() : '';
  return t.length > 0 ? t : null;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string|null|undefined} contextTag
 * @param {() => number} rng
 * @param {string[]} [secondaryTags]
 */
export function buildInstantMotivationBio(db, contextTag, rng, secondaryTags = []) {
  const sec = Array.isArray(secondaryTags) ? secondaryTags : [];
  const trait = pickLoreFragmentLine(db, 'trait', contextTag, sec, rng);
  const goal = pickLoreFragmentLine(db, 'goal', contextTag, sec, rng);
  if (!trait && !goal) return null;
  if (trait && goal) {
    return `**Черта:** ${trait}\n\n**Сейчас важно:** ${goal}`;
  }
  return trait ?? goal;
}

const BASE_EXCLUDE = `ifnull(i.is_magic,0) = 0 AND i.category NOT IN ('Currency', 'Services')`;

/**
 * Каскадный выбор профессионального снаряжения (ремесло). Для smith-ветки стремится не вернуть null при непустом каталоге.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string|null|undefined} professionId
 * @param {string|null|undefined} contextTag
 * @param {() => number} rng
 * @returns {Record<string, unknown>|null}
 */
export function pickProfessionalGearRow(db, professionId, contextTag, rng) {
  const pid = professionId != null ? String(professionId) : '';
  if (!SMITHISH.test(pid)) {
    return null;
  }

  const strict = `SELECT ${SQL_ITEMS_LOCALIZED_SELECT} FROM ${SQL_ITEMS_LOCALIZED_FROM}
    WHERE ${BASE_EXCLUDE}
    AND (
      lower(ifnull(i.tags,'')) LIKE '%tool%'
      OR lower(ifnull(i.tags,'')) LIKE '%heavy%'
      OR lower(ifnull(i.category,'')) LIKE '%tool%'
      OR lower(ifnull(i.name,'')) LIKE '%hammer%'
      OR lower(ifnull(i.name,'')) LIKE '%tongs%'
    )`;

  let row = pickRandomItemRowWeighted(db, strict, [], contextTag, rng, 360);
  if (row) return row;

  const tools = `SELECT ${SQL_ITEMS_LOCALIZED_SELECT} FROM ${SQL_ITEMS_LOCALIZED_FROM}
    WHERE ${BASE_EXCLUDE}
    AND (
      lower(ifnull(i.category,'')) LIKE '%tool%'
      OR lower(ifnull(i.subcategory,'')) LIKE '%tool%'
    )`;
  row = pickRandomItemRowWeighted(db, tools, [], contextTag, rng, 420);
  if (row) return row;

  const mundane = `SELECT ${SQL_ITEMS_LOCALIZED_SELECT} FROM ${SQL_ITEMS_LOCALIZED_FROM}
    WHERE ${BASE_EXCLUDE}
    AND i.category NOT IN ('Vehicle', 'Mount')`;
  row = pickRandomItemRowWeighted(db, mundane, [], contextTag, rng, 500);
  if (row) return row;

  return (
    /** @type {Record<string, unknown>|null} */ (
      db
        .prepare(
          `SELECT ${SQL_ITEMS_LOCALIZED_SELECT} FROM ${SQL_ITEMS_LOCALIZED_FROM}
          WHERE ${BASE_EXCLUDE} ORDER BY RANDOM() LIMIT 1`,
        )
        .get()
    ) ?? null
  );
}

/**
 * Склеивание: lore + профессиональный лут после генерации ядра (секрет уже в `data`).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {Record<string, unknown>} data — результат generateNPC().data
 * @param {object} [opts] — contextTag / professionId из исходного payload
 * @param {() => number} [rng]
 * @returns {Record<string, unknown>}
 */
export function mergeNpcWithNexusDb(db, data, opts = {}, rng = Math.random) {
  const p = typeof opts === 'object' && opts !== null ? opts : {};
  const contextTag =
    p.contextTag != null && String(p.contextTag).trim()
      ? String(p.contextTag).trim().toLowerCase()
      : undefined;

  const secret = String(
    /** @type {{ plot?: { secretOrHook?: string } }} */ (data).plot?.secretOrHook ?? '',
  );
  const secondary = inferSecondaryTagsFromSecret(secret);

  const motivation = buildInstantMotivationBio(db, contextTag, rng, secondary);
  const professionId =
    p.professionId != null
      ? String(p.professionId)
      : String(/** @type {{ role?: { professionId?: string } }} */ (data).role?.professionId ?? '');

  const profRow = pickProfessionalGearRow(db, professionId || undefined, contextTag, rng);

  const narrative = {
    .../** @type {object} */ (/** @type {Record<string, unknown>} */ (data).narrative ?? {}),
  };
  if (motivation) {
    narrative.instantMotivationRu = motivation;
  }

  const role = {
    .../** @type {object} */ (/** @type {Record<string, unknown>} */ (data).role ?? {}),
  };
  if (profRow) {
    const ru =
      profRow.name_ru != null && String(profRow.name_ru).trim()
        ? String(profRow.name_ru).trim()
        : String(profRow.name ?? '').trim();
    if (ru) {
      role.professionalCarryRu = `**${ru}** — реквизит профессии (каскад: теги tool/heavy → категория Tool → бытовой немагический предмет).`;
    }
  }

  return {
    ...data,
    narrative,
    role,
  };
}

/**
 * Обогащение результата `generateNPC().data` данными NEXUS (lore_fragments, профессиональный лут).
 * Обёртка над `mergeNpcWithNexusDb` для серверного pipeline.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {Record<string, unknown>} npcData — `generateNPC().data`
 * @param {object} [opts] — `contextTag`, `professionId` и др. из тела запроса
 * @param {() => number} [rng]
 * @returns {Record<string, unknown>}
 */
export function enrichNpcPayloadFromDatabase(db, npcData, opts = {}, rng = Math.random) {
  const d = typeof npcData === 'object' && npcData !== null ? npcData : {};
  const o = typeof opts === 'object' && opts !== null ? opts : {};
  return mergeNpcWithNexusDb(db, d, o, rng);
}
