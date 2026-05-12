/**
 * SRD 5.2 equipment: fs + regex over full Markdown — every <table> row → item row.
 * Tools (no table): regex on ## Tools … ## Adventuring Gear block.
 * Magic items: regex #### blocks after "## Magic Items A–Z".
 */

import { readFileSync } from 'fs';
import { slugify, uniqueSlug, normalizeAsciiMinus } from './text-utils.mjs';
import {
  parseCostToCp,
  cpToGp,
  suggestedCostGpFromRarity,
} from './pricing.mjs';

/** Global regex: find each HTML table in the file. */
export const TABLE_HTML_REGEX = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;

function cellText(html) {
  return normalizeAsciiMinus(
    html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

/**
 * @param {string} html
 * @returns {string[][]}
 */
export function parseTableRowsFromHtml(html) {
  const rows = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = trRegex.exec(html)) !== null) {
    const cells = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cm;
    while ((cm = cellRegex.exec(m[1])) !== null) {
      cells.push(cellText(cm[1]));
    }
    if (cells.length > 0) {
      rows.push(cells);
    }
  }
  return rows;
}

/** @param {string} md */
export function extractHtmlTables(md) {
  const out = [];
  const re = new RegExp(TABLE_HTML_REGEX.source, 'gi');
  let x;
  while ((x = re.exec(md)) !== null) {
    out.push(x[0]);
  }
  return out;
}

function moneyFromCell(costCell) {
  const cost_raw = String(costCell).trim();
  if (
    cost_raw === '' ||
    /^—$/.test(cost_raw) ||
    /varies/i.test(cost_raw) ||
    /^×/u.test(cost_raw)
  ) {
    return { cost_raw, cost_cp: null, cost_gp: null };
  }
  const cp = parseCostToCp(cost_raw);
  return { cost_raw, cost_cp: cp, cost_gp: cp == null ? null : cpToGp(cp) };
}

/** "2 GP per day", etc. */
function moneyFromCellLoose(raw) {
  const cost_raw = String(raw).trim();
  const direct = moneyFromCell(cost_raw);
  if (direct.cost_cp != null) {
    return direct;
  }
  const norm = cost_raw.replace(/,/g, '').toLowerCase();
  const m = norm.match(/([0-9]+(?:\.[0-9]+)?)\s*(cp|sp|ep|gp|pp)\b/);
  if (!m) {
    return { cost_raw, cost_cp: null, cost_gp: null };
  }
  const amount = Number.parseFloat(m[1]);
  const unit = m[2];
  const factor =
    unit === 'cp' ? 1 : unit === 'sp' ? 10 : unit === 'ep' ? 50 : unit === 'gp' ? 100 : 1000;
  const cp = Math.round(amount * factor);
  return { cost_raw, cost_cp: cp, cost_gp: cpToGp(cp) };
}

function looksLikeMoneyCell(raw) {
  const s = String(raw).trim();
  if (s === '' || s === '—' || /varies/i.test(s)) {
    return false;
  }
  return /\d/.test(s) && /(cp|sp|ep|gp|pp)/i.test(s);
}

function coinRowToReferenceGp(frac) {
  const s = String(frac).trim().replace(/\s/g, '');
  const map = {
    '1/100': 0.01,
    '1/10': 0.1,
    '1/2': 0.5,
    '1': 1,
    '10': 10,
  };
  if (map[s] != null) {
    return map[s];
  }
  const m = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  return m ? Number(m[1]) / Number(m[2]) : null;
}

function parseWeightLb(raw) {
  if (raw == null || raw === '' || /^—$/.test(raw) || /varies/i.test(raw)) {
    return null;
  }
  const s = String(raw)
    .replace(/½/g, '0.5')
    .replace(/¼/g, '0.25')
    .replace(/¾/g, '0.75')
    .replace(/(\d+)\s*\/\s*(\d+)\s*lb/gi, (_, a, b) => `${Number(a) / Number(b)} lb`);
  const m = s.match(/([0-9]+(?:\.[0-9]+)?)\s*lb/i);
  return m ? Number(m[1]) : null;
}

/**
 * Regex / column fingerprint for every Equipment.md table shape.
 * @param {string[]} headers
 */
export function detectEquipmentTableSchema(headers) {
  const norm = headers.map((h) => h.replace(/\s+/g, ' ').trim().toLowerCase());
  const j = norm.join('|');

  if (norm.includes('coin') && j.includes('value')) {
    return 'coins';
  }
  if (norm.includes('damage') && norm.includes('mastery') && norm.includes('properties')) {
    return 'weapon';
  }
  if (
    (norm[0] === 'armor' || j.includes('armor class')) &&
    norm.includes('strength') &&
    norm.includes('stealth')
  ) {
    return 'armor';
  }
  if (
    norm.includes('type') &&
    norm.includes('amount') &&
    norm.includes('storage') &&
    norm.includes('weight') &&
    norm.includes('cost')
  ) {
    return 'ammunition';
  }
  if (norm.includes('focus') && norm.includes('weight') && norm.includes('cost') && norm.length === 3) {
    return 'arcane_focus';
  }
  if (norm.includes('symbol') && norm.includes('weight') && norm.includes('cost') && norm.length === 3) {
    return 'holy_symbol';
  }
  if (norm[0] === 'ship' && norm.includes('cost') && norm.includes('speed')) {
    return 'ship';
  }
  if (norm.includes('item') && j.includes('carrying capacity') && norm.includes('cost')) {
    return 'mount';
  }
  if (
    norm.length === 4 &&
    norm[0] === 'item' &&
    norm[1] === 'cost' &&
    norm[2] === 'item' &&
    norm[3] === 'cost'
  ) {
    return 'food_lodging';
  }
  if (norm.length === 2 && norm[0] === 'service' && norm[1] === 'cost') {
    return 'hireling';
  }
  if (norm.includes('spell level') && norm.includes('availability') && norm.includes('cost')) {
    return 'spellcasting_service';
  }
  if (norm.includes('spell level') && norm.includes('time') && norm.includes('cost')) {
    return 'spell_scroll_scribing';
  }
  if (norm.includes('item') && norm.includes('weight') && norm.includes('cost') && norm.length === 3) {
    return 'item_weight_cost';
  }
  return 'unknown';
}

function lastMarkdownHeadingBefore(md, tableIndex) {
  const head = md.slice(0, tableIndex);
  const all = [...head.matchAll(/\n(#{1,3})\s+([^\n]+)/g)];
  if (all.length === 0) {
    return '';
  }
  return String(all[all.length - 1][2]).trim();
}

/** Last **Caption** line immediately before `<table`. */
function boldCaptionBeforeTable(md, tableIndex) {
  const back = md.slice(Math.max(0, tableIndex - 400), tableIndex);
  const ms = [...back.matchAll(/\*\*([^*]+)\*\*\s*$/gm)];
  if (ms.length === 0) {
    return '';
  }
  return ms[ms.length - 1][1].trim();
}

function assignSlug(row, usedSlugs) {
  row.slug = uniqueSlug(slugify(String(row.name)), usedSlugs);
}

function pushMundane(items, usedSlugs, rec) {
  assignSlug(rec, usedSlugs);
  items.push(rec);
}

/**
 * @param {string} schema
 * @param {string[][]} grid
 * @param {{ heading: string, caption: string, items: Array<Record<string, unknown>>, usedSlugs: Set<string> }} ctx
 */
function consumeEquipmentTable(schema, grid, ctx) {
  const { heading, caption, items, usedSlugs } = ctx;
  if (grid.length < 2) {
    return;
  }
  const headers = grid[0];
  /** @type {string|null} */
    let subcategory = null;
    let tackSaddlePending = false;
  const captionLower = `${caption} ${heading}`.toLowerCase();
  const isTackTable =
    /tack|harness|drawn vehicle|stabling|feed per/i.test(captionLower) ||
    /tack|harness/i.test(heading.toLowerCase());

  const emitGearThree = (name, weightRaw, costCell, category, sub, extra) => {
    if (!name || name === '—') {
      return;
    }
    const m = moneyFromCell(costCell);
    pushMundane(items, usedSlugs, {
      name,
      category,
      subcategory: sub,
      source_section: `Equipment → ${heading || category}`,
      cost_raw: m.cost_raw,
      cost_cp: m.cost_cp,
      cost_gp: m.cost_gp,
      weight_raw: weightRaw || null,
      weight_lb: weightRaw ? parseWeightLb(weightRaw) : null,
      rarity: null,
      is_magic: 0,
      attunement: 0,
      mastery_property: null,
      type_line: null,
      consumable_use_action: null,
      description_md: null,
      extra_json: JSON.stringify(extra || {}),
    });
  };

  for (let r = 1; r < grid.length; r += 1) {
    const row = grid[r];
    const first = row[0] ?? '';
    if (row.every((c) => c === '')) {
      continue;
    }

    if (schema === 'weapon' || schema === 'armor') {
      if (row.length === 1) {
        const t = row[0].trim();
        if (/simple|martial|armor|don|doff|minute|shield|heavy|medium|light/i.test(t)) {
          subcategory = t;
        }
        continue;
      }
      if (
        row.length === headers.length &&
        /simple|martial|light armor|medium armor|heavy armor/i.test(first) &&
        !/^[0-9]/.test(first)
      ) {
        subcategory = row.join(' ').replace(/\s+/g, ' ').trim();
        continue;
      }
    }

    switch (schema) {
      case 'coins': {
        const gp = coinRowToReferenceGp(row[1] ?? '');
        pushMundane(items, usedSlugs, {
          name: first,
          category: 'Currency',
          subcategory: 'Coin Values',
          source_section: 'Equipment → Coins',
          cost_raw: row[1] ?? null,
          cost_cp: gp != null ? Math.round(gp * 100) : null,
          cost_gp: gp,
          weight_raw: null,
          weight_lb: null,
          rarity: null,
          is_magic: 0,
          attunement: 0,
          mastery_property: null,
          type_line: 'Value expressed in GP equivalents',
          consumable_use_action: null,
          description_md: null,
          extra_json: JSON.stringify({ coin_reference: true }),
        });
        break;
      }
      case 'weapon': {
        if (!first || first === '—') {
          break;
        }
        const damage = row[1] ?? '';
        const properties = row[2] ?? '';
        const mastery = row[3] ?? '';
        const weightRaw = row[4] ?? '';
        const m = moneyFromCell(row[5] ?? '');
        pushMundane(items, usedSlugs, {
          name: first,
          category: 'Weapon',
          subcategory,
          source_section: 'Equipment → Weapons',
          cost_raw: m.cost_raw,
          cost_cp: m.cost_cp,
          cost_gp: m.cost_gp,
          weight_raw: weightRaw,
          weight_lb: parseWeightLb(weightRaw),
          rarity: null,
          is_magic: 0,
          attunement: 0,
          mastery_property: mastery === '—' ? null : mastery,
          type_line: `${damage}; ${properties}`,
          consumable_use_action: null,
          description_md: null,
          extra_json: JSON.stringify({ damage, properties, srd52_weapon: true }),
        });
        break;
      }
      case 'armor': {
        if (!first) {
          break;
        }
        const ac = row[1] ?? '';
        const strReq = row[2] ?? '';
        const stealth = row[3] ?? '';
        const weightRaw = row[4] ?? '';
        const m = moneyFromCell(row[5] ?? '');
        pushMundane(items, usedSlugs, {
          name: first,
          category: 'Armor',
          subcategory,
          source_section: 'Equipment → Armor',
          cost_raw: m.cost_raw,
          cost_cp: m.cost_cp,
          cost_gp: m.cost_gp,
          weight_raw: weightRaw,
          weight_lb: parseWeightLb(weightRaw),
          rarity: null,
          is_magic: 0,
          attunement: 0,
          mastery_property: null,
          type_line: `AC ${ac}; Str ${strReq}; Stealth ${stealth}`,
          consumable_use_action: null,
          description_md: null,
          extra_json: JSON.stringify({
            ac_rule: ac,
            strength_requirement: strReq,
            stealth,
          }),
        });
        break;
      }
      case 'ammunition': {
        const amount = row[1] ?? '';
        const storage = row[2] ?? '';
        const weightRaw = row[3] ?? '';
        const m = moneyFromCell(row[4] ?? '');
        pushMundane(items, usedSlugs, {
          name: `${first} (${amount})`,
          category: 'Ammunition',
          subcategory: storage,
          source_section: 'Equipment → Ammunition',
          cost_raw: m.cost_raw,
          cost_cp: m.cost_cp,
          cost_gp: m.cost_gp,
          weight_raw: weightRaw,
          weight_lb: parseWeightLb(weightRaw),
          rarity: null,
          is_magic: 0,
          attunement: 0,
          mastery_property: null,
          type_line: `${amount} in ${storage}`,
          consumable_use_action: null,
          description_md: null,
          extra_json: JSON.stringify({ amount, storage }),
        });
        break;
      }
      case 'arcane_focus':
        emitGearThree(first, row[1] ?? '', row[2] ?? '', 'Adventuring Gear', 'Arcane Focus', {
          srd_table: 'Arcane Focuses',
        });
        break;
      case 'holy_symbol':
        emitGearThree(first, row[1] ?? '', row[2] ?? '', 'Adventuring Gear', 'Holy Symbol', {
          srd_table: 'Holy Symbols',
        });
        break;
      case 'mount': {
        const m = moneyFromCell(row[2] ?? '');
        pushMundane(items, usedSlugs, {
          name: first,
          category: 'Mount',
          subcategory: null,
          source_section: 'Equipment → Mounts and Vehicles',
          cost_raw: m.cost_raw,
          cost_cp: m.cost_cp,
          cost_gp: m.cost_gp,
          weight_raw: null,
          weight_lb: null,
          rarity: null,
          is_magic: 0,
          attunement: 0,
          mastery_property: null,
          type_line: row[1] ? `Carrying ${row[1]}` : null,
          consumable_use_action: null,
          description_md: null,
          extra_json: JSON.stringify({ mount: true }),
        });
        break;
      }
      case 'ship': {
        const costCell = row[row.length - 1] ?? '';
        const m = moneyFromCell(costCell);
        const typeLine = row
          .slice(1, -1)
          .map((c, i) => `${headers[i + 1] || ''}: ${c}`)
          .join('; ');
        pushMundane(items, usedSlugs, {
          name: first,
          category: 'Vehicle',
          subcategory: 'Waterborne / Airborne',
          source_section: 'Equipment → Large Vehicles',
          cost_raw: m.cost_raw,
          cost_cp: m.cost_cp,
          cost_gp: m.cost_gp,
          weight_raw: null,
          weight_lb: null,
          rarity: null,
          is_magic: 0,
          attunement: 0,
          mastery_property: null,
          type_line: typeLine,
          consumable_use_action: null,
          description_md: null,
          extra_json: JSON.stringify({ ship_stats: true }),
        });
        break;
      }
      case 'food_lodging': {
        if (!looksLikeMoneyCell(row[1] ?? '') && !looksLikeMoneyCell(row[3] ?? '')) {
          break;
        }
        const emitSide = (nm, costC) => {
          if (!nm || !looksLikeMoneyCell(costC ?? '')) {
            return;
          }
          const m = moneyFromCellLoose(costC ?? '');
          pushMundane(items, usedSlugs, {
            name: nm,
            category: 'Food, Drink, and Lodging',
            subcategory: caption || 'Food, Drink, and Lodging',
            source_section: 'Equipment → Food, Drink, and Lodging',
            cost_raw: m.cost_raw,
            cost_cp: m.cost_cp,
            cost_gp: m.cost_gp,
            weight_raw: null,
            weight_lb: null,
            rarity: null,
            is_magic: 0,
            attunement: 0,
            mastery_property: null,
            type_line: null,
            consumable_use_action: null,
            description_md: null,
            extra_json: JSON.stringify({ food_lodging_split: true }),
          });
        };
        emitSide(row[0], row[1]);
        emitSide(row[2], row[3]);
        break;
      }
      case 'hireling': {
        const m = moneyFromCellLoose(row[1] ?? '');
        pushMundane(items, usedSlugs, {
          name: first,
          category: 'Services',
          subcategory: 'Hirelings',
          source_section: 'Equipment → Hirelings',
          cost_raw: m.cost_raw,
          cost_cp: m.cost_cp,
          cost_gp: m.cost_gp,
          weight_raw: null,
          weight_lb: null,
          rarity: null,
          is_magic: 0,
          attunement: 0,
          mastery_property: null,
          type_line: row[1] ?? null,
          consumable_use_action: null,
          description_md: null,
          extra_json: JSON.stringify({ hireling: true }),
        });
        break;
      }
      case 'spellcasting_service': {
        const m = moneyFromCellLoose(row[2] ?? '');
        pushMundane(items, usedSlugs, {
          name: `Spellcasting service — ${first}`,
          category: 'Services',
          subcategory: 'Spellcasting Services',
          source_section: 'Equipment → Spellcasting Services',
          cost_raw: m.cost_raw,
          cost_cp: m.cost_cp,
          cost_gp: m.cost_gp,
          weight_raw: null,
          weight_lb: null,
          rarity: null,
          is_magic: 0,
          attunement: 0,
          mastery_property: null,
          type_line: `Availability: ${row[1] ?? ''}`,
          consumable_use_action: null,
          description_md: null,
          extra_json: JSON.stringify({ spell_level: first }),
        });
        break;
      }
      case 'spell_scroll_scribing': {
        const m = moneyFromCell(row[2] ?? '');
        pushMundane(items, usedSlugs, {
          name: `Scribe Spell Scroll — ${first}`,
          category: 'Crafting',
          subcategory: 'Spell Scroll Costs',
          source_section: 'Equipment → Scribing Spell Scrolls',
          cost_raw: m.cost_raw,
          cost_cp: m.cost_cp,
          cost_gp: m.cost_gp,
          weight_raw: null,
          weight_lb: null,
          rarity: null,
          is_magic: 0,
          attunement: 0,
          mastery_property: null,
          type_line: `Time: ${row[1] ?? ''}`,
          consumable_use_action: null,
          description_md: null,
          extra_json: JSON.stringify({ spell_level: first }),
        });
        break;
      }
      case 'item_weight_cost': {
        if (!first) {
          break;
        }
        if (isTackTable) {
          const w = row[1] ?? '';
          const costC = row[2] ?? '';
          const costEmpty = !costC || costC === '—' || costC.trim() === '';
          const wEmpty = !w || w === '—' || w.trim() === '';

          if (/^saddle$/i.test(first.trim()) && wEmpty && costEmpty) {
            tackSaddlePending = true;
            break;
          }
          let dispName = first;
          if (tackSaddlePending && /^(exotic|military|riding)$/i.test(first.trim())) {
            dispName = `Saddle (${first.trim()})`;
            if (/^riding$/i.test(first.trim())) {
              tackSaddlePending = false;
            }
          }
          emitGearThree(dispName, w, costC, 'Vehicle', caption || 'Tack & Vehicles', {
            tack_table: true,
          });
        } else {
          emitGearThree(first, row[1] ?? '', row[2] ?? '', 'Adventuring Gear', subcategory, {
            adventuring_gear_table: true,
          });
        }
        break;
      }
      case 'unknown':
      default: {
        if (headers.length === 2) {
          const h0 = headers[0].toLowerCase();
          const h1 = headers[1].toLowerCase();
          if ((/item|name|tool|weapon/.test(h0) || h0 === 'coin') && /cost/.test(h1)) {
            const m = moneyFromCellLoose(row[1] ?? '');
            if (first) {
              pushMundane(items, usedSlugs, {
                name: first,
                category: 'Equipment (misc table)',
                subcategory: caption || heading || 'unknown table',
                source_section: `Equipment → ${heading || 'misc'}`,
                cost_raw: m.cost_raw,
                cost_cp: m.cost_cp,
                cost_gp: m.cost_gp,
                weight_raw: null,
                weight_lb: null,
                rarity: null,
                is_magic: 0,
                attunement: 0,
                mastery_property: null,
                type_line: null,
                consumable_use_action: null,
                description_md: null,
                extra_json: JSON.stringify({ unknown_two_col: true }),
              });
            }
          }
        }
        break;
      }
    }
  }
}

/**
 * `^\*\*Tool Name (50 GP)\*\*$` lines only (not **Ability:** …).
 */
function parseToolsBlockByRegex(md, items, usedSlugs) {
  const toolsH = md.search(/^## Tools\s*$/m);
  const advH = md.search(/^## Adventuring Gear\s*$/m);
  if (toolsH === -1 || advH === -1 || advH <= toolsH) {
    return;
  }
  const chunk = md.slice(toolsH, advH);
  const toolHeader = /^\*\*([^*\n]+?)\s*\(([^)]*)\)\*\*\s*$/gm;
  let tm;
  while ((tm = toolHeader.exec(chunk)) !== null) {
    const name = tm[1].trim();
    const costParen = tm[2].trim();
    if (/^(Ability|Utilize|Craft|Variants|Weight)\b/i.test(name)) {
      continue;
    }
    const m = /varies/i.test(costParen)
      ? { cost_raw: costParen, cost_cp: null, cost_gp: null }
      : moneyFromCellLoose(costParen.match(/(gp|sp|cp|ep|pp)/i) ? costParen : `${costParen} GP`);
    pushMundane(items, usedSlugs, {
      name,
      category: 'Tool',
      subcategory: 'Tools',
      source_section: 'Equipment → Tools',
      cost_raw: m.cost_raw,
      cost_cp: m.cost_cp,
      cost_gp: m.cost_gp,
      weight_raw: null,
      weight_lb: null,
      rarity: null,
      is_magic: 0,
      attunement: 0,
      mastery_property: null,
      type_line: null,
      consumable_use_action: null,
      description_md: null,
      extra_json: JSON.stringify({ tools_md_heading: true }),
    });
  }
}

/**
 * Walk entire `equipment.md`: every table via TABLE_HTML_REGEX, then Tools block.
 * @param {string} equipmentMd
 */
export function parseEquipmentMarkdown(equipmentMd) {
  /** @type {Array<Record<string, unknown>>} */
  const items = [];
  const usedSlugs = new Set();
  const re = new RegExp(TABLE_HTML_REGEX.source, 'gi');
  let tm;
  while ((tm = re.exec(equipmentMd)) !== null) {
    const fullTable = tm[0];
    const idx = tm.index;
    const grid = parseTableRowsFromHtml(fullTable);
    if (grid.length < 2) {
      continue;
    }
    const headers = grid[0];
    const schema = detectEquipmentTableSchema(headers);
    consumeEquipmentTable(schema, grid, {
      heading: lastMarkdownHeadingBefore(equipmentMd, idx),
      caption: boldCaptionBeforeTable(equipmentMd, idx),
      items,
      usedSlugs,
    });
  }
  parseToolsBlockByRegex(equipmentMd, items, usedSlugs);
  return items;
}

/** @param {string} absolutePath */
export function parseEquipmentFile(absolutePath) {
  return parseEquipmentMarkdown(readFileSync(absolutePath, 'utf8'));
}

/* ========= Magic items (regex #### blocks) ========= */

export function parseMagicItemHeader(italicLine) {
  const inner = italicLine.replace(/^_+|_+$/g, '').trim();
  const attunement = /requires attunement/i.test(inner) ? 1 : 0;
  /** @type {string|null} */
  let rarity = null;
  const order = ['Very Rare', 'Legendary', 'Uncommon', 'Common', 'Rare', 'Artifact'];
  for (const token of order) {
    if (inner.includes(token)) {
      rarity = token === 'Artifact' ? 'Artifact' : token;
      break;
    }
  }
  return { type_line: inner, rarity, attunement };
}

function isPotionType(typeLine) {
  return /^potion\b/i.test(typeLine.trim());
}

function isScrollType(typeLine) {
  return /^scroll\b/i.test(typeLine.trim());
}

export function parseMagicItemsMarkdown(magicMd) {
  const marker = '## Magic Items A–Z';
  const idx = magicMd.indexOf(marker);
  if (idx === -1) {
    throw new Error('magic-items.md: missing "## Magic Items A–Z" section');
  }
  const body = magicMd.slice(idx);
  const usedSlugs = new Set();
  /** @type {Array<Record<string, unknown>>} */
  const items = [];
  const blockRe = /\n#### ([^\n]+)\n([\s\S]*?)(?=\n#### |\n## |$)/g;
  let m;
  while ((m = blockRe.exec(body)) !== null) {
    const name = m[1].trim();
    const chunk = m[2].trim();
    if (!chunk) {
      continue;
    }
    const lines = chunk.split('\n');
    const firstLine = lines[0] ?? '';
    if (!firstLine.startsWith('_')) {
      continue;
    }
    const { type_line, rarity, attunement } = parseMagicItemHeader(firstLine);
    const description_md = lines.slice(1).join('\n').trim();
    const potion = isPotionType(type_line);
    const scroll = isScrollType(type_line);
    const consumable =
      potion ||
      scroll ||
      /consumable|once (it hits|used)|loses (its|the) magic|vanishes|expended/i.test(
        description_md.slice(0, 600),
      );
    let cost_gp = suggestedCostGpFromRarity(type_line, {
      consumable,
      spellScroll: scroll,
    });
    const cost_cp = cost_gp == null ? null : Math.round(cost_gp * 100);
    const categoryMatch = type_line.match(/^([^,(]+)/);
    const category = categoryMatch
      ? categoryMatch[1].trim().replace(/\s+$/, '')
      : 'Magic Item';
    const rec = {
      name,
      category: `Magic: ${category}`,
      subcategory: rarity,
      source_section: 'Magic Items A–Z',
      cost_raw: cost_gp == null ? null : `${cost_gp} GP (SRD rarity table)`,
      cost_cp,
      cost_gp,
      weight_raw: null,
      weight_lb: null,
      rarity,
      is_magic: 1,
      attunement,
      mastery_property: null,
      type_line,
      consumable_use_action: potion ? 'Bonus Action' : null,
      description_md,
      extra_json: JSON.stringify({
        srd52_magic: true,
        consumable_note: consumable,
        potion_2024_rules:
          potion === true
            ? { activation: 'Bonus Action', citation: 'SRD 5.2 Magic Items → Potions' }
            : null,
      }),
    };
    if (/weapon\b/i.test(type_line) && /\+[123]\b/.test(type_line)) {
      const mast = type_line.match(
        /\b(Heavy|Versatile|Two-Handed|Light|Finesse|Reach|Thrown|Ammunition)\b/,
      );
      rec.mastery_property = mast ? `Use base weapon Mastery (${mast[1]} property)` : null;
      rec.extra_json = JSON.stringify({
        ...JSON.parse(rec.extra_json),
        mastery_note:
          'Magic weapon uses the nonmagical weapon’s Weapon Mastery property from Equipment.',
      });
    }
    assignSlug(rec, usedSlugs);
    items.push(rec);
  }
  return items;
}

export function parseMagicItemsFile(absolutePath) {
  return parseMagicItemsMarkdown(readFileSync(absolutePath, 'utf8'));
}

/* ========= Spells ========= */

function parseSpellSummary(summary) {
  const inner = summary.replace(/^_+|_+$/g, '').trim();
  if (/cantrip/i.test(inner)) {
    const schoolMatch = inner.match(/^([A-Za-z]+)\s+Cantrip/i);
    const classMatch = inner.match(/\(([^)]+)\)\s*$/);
    return {
      level_label: 'Cantrip',
      level_num: 0,
      school: schoolMatch ? schoolMatch[1] : null,
      classes_line: classMatch ? classMatch[1] : null,
    };
  }
  const lm = inner.match(/Level\s+([0-9]+)\s+([^([]+)(?:\(|$)/i);
  if (lm) {
    const level = Number(lm[1]);
    const school = lm[2].trim().split(/\s+/)[0];
    const classMatch = inner.match(/\(([^)]+)\)\s*$/);
    return {
      level_label: `Level ${level}`,
      level_num: level,
      school,
      classes_line: classMatch ? classMatch[1] : null,
    };
  }
  return {
    level_label: null,
    level_num: null,
    school: null,
    classes_line: null,
  };
}

export function parseSpellsMarkdown(spellsMd) {
  const marker = '## Spell Descriptions';
  const idx = spellsMd.indexOf(marker);
  if (idx === -1) {
    throw new Error('spells.md: missing "## Spell Descriptions"');
  }
  const body = spellsMd.slice(idx);
  const usedSlugs = new Set();
  /** @type {Array<Record<string, unknown>>} */
  const spells = [];
  const blockRe = /\n#### ([^\n]+)\n([\s\S]*?)(?=\n#### |\n## |$)/g;
  let m;
  while ((m = blockRe.exec(body)) !== null) {
    const name = m[1].trim();
    const chunk = m[2].trim();
    const lines = chunk.split('\n');
    const summaryLine = (lines.find((l) => l.startsWith('_')) ?? '').trim();
    const meta = parseSpellSummary(summaryLine);
    /** @type {Record<string, string>} */
    const hdr = {};
    /** @type {string[]} */
    const desc = [];
    let mode = 'header';
    for (const line of lines) {
      if (line.startsWith('_')) {
        continue;
      }
      if (/^\*\*[A-Za-z ]+:\*\*/.test(line)) {
        mode = 'header';
        const hm = line.match(/^\*\*([^*:]+):\*\*\s*(.*)$/);
        if (hm) {
          hdr[hm[1].trim().toLowerCase().replace(/\s+/g, '_')] = hm[2].trim();
        }
      } else if (mode === 'header' && line === '') {
        mode = 'body';
      } else if (mode === 'body') {
        desc.push(line);
      }
    }
    const rec = {
      name,
      level_label: meta.level_label,
      level_num: meta.level_num,
      summary_line: summaryLine.replace(/^_+|_+$/g, '').trim(),
      casting_time: hdr.casting_time ?? null,
      range_text: hdr.range ?? null,
      components: hdr.components ?? null,
      duration: hdr.duration ?? null,
      description_md: desc.join('\n').trim(),
      school: meta.school,
      classes_line: meta.classes_line,
    };
    rec.slug = uniqueSlug(slugify(name), usedSlugs);
    spells.push(rec);
  }
  return spells;
}

/* ========= Monsters ========= */

function extractTypeLine(body) {
  const m = body.match(/^\s*_([^_\n][^_]*)_\s*/m);
  return m ? m[1].trim() : null;
}

function extractAc(body) {
  const m = normalizeAsciiMinus(body).match(/\*\*AC\*\*\s*([^\n<]+)/);
  return m ? m[1].trim() : null;
}

function extractHp(body) {
  const m = body.match(/\*\*HP\*\*\s*([^\n<]+)/);
  return m ? m[1].trim() : null;
}

function extractSpeed(body) {
  const m = body.match(/\*\*Speed\*\*\s*([^\n<]+)/);
  return m ? m[1].trim() : null;
}

function extractCrXp(body) {
  const norm = normalizeAsciiMinus(body);
  const crM = norm.match(/\*\*CR\*\*\s*([0-9]+(?:\/[0-9]+)?)/);
  const xpM = norm.match(/XP\s*([0-9,]+)/);
  const cr = crM ? crM[1] : null;
  let crNum = null;
  if (cr) {
    if (cr.includes('/')) {
      const [a, b] = cr.split('/').map(Number);
      crNum = a / b;
    } else {
      crNum = Number(cr);
    }
  }
  const xp = xpM ? Number(xpM[1].replace(/,/g, '')) : null;
  return { cr, crNum: crNum != null && Number.isFinite(crNum) ? crNum : null, xp };
}

export function parseMonstersMarkdown(monstersMd) {
  const usedSlugs = new Set();
  /** @type {Array<Record<string, unknown>>} */
  const list = [];
  const h2split = monstersMd.split(/\n(?=## [^#\s])/);
  for (const h2block of h2split) {
    const h2m = h2block.match(/^## ([^\n]+)/);
    const group = h2m ? h2m[1].trim() : '';
    const parts = h2block.split(/\n(?=### )/);
    for (const part of parts) {
      const h3m = part.match(/^### ([^\n]+)\n([\s\S]+)/);
      if (!h3m) {
        continue;
      }
      const name = h3m[1].trim();
      const body = h3m[2];
      if (!body.includes('**AC**') || !body.includes('**CR**')) {
        continue;
      }
      const type_line = extractTypeLine(body);
      const { cr, crNum, xp } = extractCrXp(body);
      const rec = {
        name,
        section_group: group,
        type_line,
        armor_class: extractAc(body),
        hit_points: extractHp(body),
        speed: extractSpeed(body),
        challenge_rating: cr,
        cr_numeric: crNum,
        xp: xp != null && Number.isFinite(xp) ? xp : null,
        raw_statblock_md: body.trim(),
      };
      rec.slug = uniqueSlug(slugify(name), usedSlugs);
      list.push(rec);
    }
  }
  return list;
}

export function defaultEncounterTierRows() {
  return [
    {
      tier: 1,
      cr_min: 0,
      cr_max: 4,
      label: 'Tier 1 (local heroes)',
      rarity_weights_json: JSON.stringify({
        Common: 52,
        Uncommon: 32,
        Rare: 10,
        'Very Rare': 4,
        Legendary: 2,
      }),
    },
    {
      tier: 2,
      cr_min: 5,
      cr_max: 10,
      label: 'Tier 2 (continental)',
      rarity_weights_json: JSON.stringify({
        Common: 35,
        Uncommon: 38,
        Rare: 16,
        'Very Rare': 8,
        Legendary: 3,
      }),
    },
    {
      tier: 3,
      cr_min: 11,
      cr_max: 16,
      label: 'Tier 3 (world-shaking)',
      rarity_weights_json: JSON.stringify({
        Common: 22,
        Uncommon: 28,
        Rare: 28,
        'Very Rare': 16,
        Legendary: 6,
      }),
    },
    {
      tier: 4,
      cr_min: 17,
      cr_max: 999,
      label: 'Tier 4 (mythic)',
      rarity_weights_json: JSON.stringify({
        Common: 12,
        Uncommon: 20,
        Rare: 28,
        'Very Rare': 28,
        Legendary: 12,
      }),
    },
  ];
}

export function defaultNpcCoreRows() {
  return [
    {
      slug: 'npc-merchant',
      role_label: 'Merchant',
      visual_trait:
        'Amber linen sash over charcoal wool; one earlobe elongated by a heavy brass plug.',
      mannerism: 'Ends statements with a soft click of the tongue; counts coins without looking.',
      secret_goal: 'Hoard enough to buy a deed in a city that outlawed their people.',
    },
    {
      slug: 'npc-guard',
      role_label: 'Guard',
      visual_trait:
        'Oil-black gambeson with sun-bleached crimson trim; a split badge mended with silver wire.',
      mannerism: 'Clears throat twice before any order; stands one handspan farther from nobility.',
      secret_goal: 'Prove a sibling innocent of a theft they were assigned to investigate.',
    },
    {
      slug: 'npc-cleric',
      role_label: 'Cleric',
      visual_trait:
        'Layered vestments in bone-white and copper thread; a soot smear never fully washes off the right wrist.',
      mannerism: 'Quotes scripture under breath when anxious; avoids stepping on cracks in stone.',
      secret_goal: 'Consecrate a shrine built on falsely sanctified ground.',
    },
    {
      slug: 'npc-mage',
      role_label: 'Sage',
      visual_trait:
        'Deep teal robe faded to seafoam at the hems; rings of different alloys on every finger except the thumbs.',
      mannerism: 'Interrupts self mid-sentence to annotate margins; taps quill twice after each name.',
      secret_goal: 'Trade a true name for a safely redacted copy of a doomed prophecy.',
    },
    {
      slug: 'npc-ranger',
      role_label: 'Scout',
      visual_trait:
        'Forest-green leather mottled with ash-gray patches; a single bear claw pierces the left collar.',
      mannerism: 'Marks trees with three shallow cuts; refuses to walk downwind of strangers.',
      secret_goal: 'Lead refugees through a pass without revealing an old blood oath to the bandits there.',
    },
    {
      slug: 'npc-thief',
      role_label: 'Rogue',
      visual_trait: 'Murky purple cloak lined with thread-of-gold map-runes visible only in rain.',
      mannerism: 'Laughs a beat too late; watches exits more than faces.',
      secret_goal: 'Return a stolen relic before the curse chain reaches their crew.',
    },
    {
      slug: 'npc-noble',
      role_label: 'Noble',
      visual_trait:
        'Ivory silk under a high-collared ebon coat; a faint perfume of cedar and iron.',
      mannerism: 'Addresses people by house epithets; never eats visible on public balconies.',
      secret_goal: 'Marry influence without losing leverage on a sibling who knows too much.',
    },
    {
      slug: 'npc-artisan',
      role_label: 'Artisan',
      visual_trait:
        'Apron the color of fired brick; copper dust in the hairline and chalk on the knees.',
      mannerism: 'Sizes up joints and seams of any object handed over; hums thirds when concentrating.',
      secret_goal: 'Forge a proof that bypasses a guild patent held by their former master.',
    },
  ];
}
