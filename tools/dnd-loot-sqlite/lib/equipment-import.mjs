import { parseCostToCp } from './pricing.mjs';
import { slugify, uniqueSlug } from './text-utils.mjs';

/**
 * @param {string} name
 * @returns {boolean}
 */
function isCategoryHeaderRow(name) {
  const t = name.trim();
  if (t.startsWith('*') && t.endsWith('*') && t.length > 2) {
    return true;
  }
  return false;
}

/**
 * @param {Record<string, string[]>} table
 * @param {string} nameKey Usually `Name`, `Armor`, or `Item`
 * @returns {{ names: string[]; costs: string[]; weights: string[]; extraKeys: Record<string, string[]> }}
 */
function alignTableColumns(table, nameKey) {
  const names = table[nameKey] || table['Armor'] || table['Item'] || [];
  const costs = table['Cost'] || [];
  const weights = table['Weight'] || [];
  const extraKeys = {};
  for (const key of Object.keys(table)) {
    if (key === nameKey || key === 'Armor' || key === 'Item') {
      continue;
    }
    if (key === 'Cost' || key === 'Weight') {
      continue;
    }
    extraKeys[key] = table[key];
  }
  return { names, costs, weights, extraKeys };
}

/**
 * @param {string} name
 * @param {Record<string, string[]>} extraKeys
 * @param {number} index
 * @returns {Record<string, string>}
 */
function buildExtraFields(name, extraKeys, index) {
  const obj = { name };
  for (const [col, values] of Object.entries(extraKeys)) {
    if (values[index] != null) {
      obj[col] = values[index];
    }
  }
  return obj;
}

/**
 * @param {Array<Record<string, unknown>>} bucket
 * @param {string} category
 * @param {string|null} subcategory
 * @param {Record<string, string[]>} table
 * @param {string} nameColumn
 */
function ingestTable(bucket, category, subcategory, table, nameColumn) {
  const { names, costs, weights, extraKeys } = alignTableColumns(table, nameColumn);
  const n = names.length;
  for (let i = 0; i < n; i += 1) {
    const rawName = names[i];
    if (rawName == null || rawName === '') {
      continue;
    }
    if (isCategoryHeaderRow(rawName)) {
      continue;
    }
    const costRaw = costs[i] != null ? costs[i] : '';
    const weightRaw = weights[i] != null ? weights[i] : '';
    if (costRaw === '' || costRaw === '*' || /^×/u.test(costRaw.trim())) {
      continue;
    }
    const priceCp = parseCostToCp(costRaw);
    bucket.push({
      _category: category,
      _subcategory: subcategory,
      name: rawName.trim(),
      cost_raw: costRaw,
      price_cp: priceCp,
      weight_raw: weightRaw,
      extra: buildExtraFields(rawName.trim(), extraKeys, i),
    });
  }
}

/**
 * Traverses `Equipment` JSON and collects normalized rows before slug assignment.
 *
 * @param {Record<string, unknown>} equipmentRoot
 * @returns {Array<Record<string, unknown>>}
 */
export function extractEquipmentRows(equipmentRoot) {
  /** @type {Array<Record<string, unknown>>} */
  const bucket = [];
  const armorSection = /** @type {Record<string, unknown>|undefined} */ (
    equipmentRoot['Armor']
  );
  if (armorSection && typeof armorSection === 'object') {
    const armorList = /** @type {Record<string, unknown>|undefined} */ (
      armorSection['Armor List']
    );
    if (armorList && typeof armorList === 'object') {
      for (const [subsetName, node] of Object.entries(armorList)) {
        if (
          !node ||
          typeof node !== 'object' ||
          !('table' in /** @type {Record<string, unknown>} */ (node))
        ) {
          continue;
        }
        const table = /** @type {{ table: Record<string, string[]> }} */ (
          /** @type {Record<string, { table: Record<string, string[]> }>} */ (node)
        ).table;
        ingestTable(bucket, 'armor', subsetName, table, 'Armor');
      }
    }
  }

  const weaponsSection = /** @type {Record<string, unknown>|undefined} */ (
    equipmentRoot['Weapons']
  );
  if (weaponsSection && typeof weaponsSection === 'object') {
    const weaponsList = /** @type {Record<string, unknown>|undefined} */ (
      weaponsSection['Weapons List']
    );
    if (weaponsList && typeof weaponsList === 'object') {
      for (const [weaponGroup, node] of Object.entries(weaponsList)) {
        if (!node || typeof node !== 'object' || !('table' in node)) {
          continue;
        }
        ingestTable(
          bucket,
          'weapon',
          weaponGroup,
          /** @type {{ table: Record<string, string[]> }} */ (node).table,
          'Name',
        );
      }
    }
  }

  const adventuring = /** @type {Record<string, unknown>|undefined} */ (
    equipmentRoot['Adventuring Gear']
  );
  if (adventuring && typeof adventuring === 'object') {
    const gearTableNode = /** @type {Record<string, unknown>|undefined} */ (
      adventuring['Adventuring Gear']
    );
    if (gearTableNode && 'table' in gearTableNode) {
      ingestTable(
        bucket,
        'adventuring_gear',
        null,
        /** @type {{ table: Record<string, string[]> }} */ (gearTableNode).table,
        'Item',
      );
    }
  }

  const toolsSection = /** @type {Record<string, unknown>|undefined} */ (
    equipmentRoot['Tools']
  );
  if (toolsSection && typeof toolsSection === 'object') {
    const toolsInner = /** @type {Record<string, unknown>|undefined} */ (
      toolsSection['Tools']
    );
    if (toolsInner && typeof toolsInner === 'object' && 'content' in toolsInner) {
      const contentArr = /** @type {Array<unknown>} */ (toolsInner.content);
      const tableObj = contentArr.find(
        (e) => e && typeof e === 'object' && 'table' in /** @type {object} */ (e),
      );
      if (tableObj) {
        const toolTable = /** @type {{ table: Record<string, string[]> }} */ (
          /** @type {Record<string, unknown>} */ (tableObj)
        ).table;
        ingestTable(bucket, 'tool', null, toolTable, 'Item');
      }
    }
  }

  const mountsSection = /** @type {Record<string, unknown>|undefined} */ (
    equipmentRoot['Mounts and Vehicles']
  );
  if (mountsSection && typeof mountsSection === 'object') {
    for (const [blockName, blockVal] of Object.entries(mountsSection)) {
      if (!blockVal || typeof blockVal !== 'object' || !('table' in blockVal)) {
        continue;
      }
      if (blockName === 'Mounts and Other Animals') {
        ingestTable(
          bucket,
          'mount',
          blockName,
          /** @type {{ table: Record<string, string[]> }} */ (
            /** @type {Record<string, { table: Record<string, string[]> }>} */ (
              blockVal
            ).table
          ),
          'Item',
        );
      } else if (blockName === 'Tack, Harness, and Drawn Vehicles') {
        ingestTable(
          bucket,
          'vehicle_tack',
          blockName,
          /** @type {{ table: Record<string, string[]> }} */ (
            /** @type {Record<string, { table: Record<string, string[]> }>} */ (
              blockVal
            ).table
          ),
          'Item',
        );
      } else if (blockName === 'Waterborne Vehicles') {
        ingestTable(
          bucket,
          'water_vehicle',
          blockName,
          /** @type {{ table: Record<string, string[]> }} */ (
            /** @type {Record<string, { table: Record<string, string[]> }>} */ (
              blockVal
            ).table
          ),
          'Item',
        );
      }
    }
  }

  const tradeGoods = /** @type {Record<string, unknown>|undefined} */ (
    equipmentRoot['Trade Goods']
  );
  if (tradeGoods && typeof tradeGoods === 'object') {
    const tgInner = /** @type {Record<string, unknown>|undefined} */ (
      tradeGoods['Trade Goods']
    );
    if (tgInner && 'table' in tgInner) {
      const table = /** @type {{ table: Record<string, string[]> }} */ (
        tgInner
      ).table;
      const costs = table['Cost'] || [];
      const goodsCol = table['Goods'] || table['Good'] || [];
      for (let i = 0; i < costs.length; i += 1) {
        const costRaw = costs[i];
        const priceCp = parseCostToCp(costRaw);
        const label =
          goodsCol[i] != null ? String(goodsCol[i]) : `Trade good slot ${i + 1}`;
        bucket.push({
          _category: 'trade_good',
          _subcategory: null,
          name: label.trim(),
          cost_raw: costRaw,
          price_cp: priceCp,
          weight_raw: '',
          extra: { tier_index: String(i + 1), cost: costRaw },
        });
      }
    }
  }

  const usedSlugs = new Set();
  return bucket.map((row) => ({
    slug: uniqueSlug(slugify(/** @type {string} */ (row.name)), usedSlugs),
    name: row.name,
    category: row._category,
    subcategory: row._subcategory,
    cost_raw: row.cost_raw,
    price_cp: row.price_cp,
    weight_raw: row.weight_raw,
    extra_json: JSON.stringify(row.extra),
  }));
}
