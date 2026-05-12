/**
 * NPC generator: только данные из SQLite (`npc_core`).
 */

/**
 * @param {import('better-sqlite3').Database} db
 * @param {object} [opts]
 * @param {string|null} [opts.roleLabel]
 * @param {() => number} [opts.random]
 * @returns {{
 *   npc_core_id: number|null,
 *   role_label: string|null,
 *   visual_trait: string,
 *   mannerism: string,
 *   secret_goal: string,
 *   appearance_profile: {
 *     clothing_palette: string,
 *     striking_physical_detail: string,
 *     behavior_speech_or_tic: string,
 *   },
 * }}
 */
export function generateNpcProfile(db, opts = {}) {
  void opts.random;
  const role = opts.roleLabel != null ? String(opts.roleLabel).trim() : '';

  /** @type {Record<string, unknown>|undefined} */
  let row;
  if (role.length > 0) {
    row = db
      .prepare(
        `SELECT * FROM npc_core
       WHERE role_label IS NOT NULL AND (
         instr(lower(role_label), lower(?)) > 0
         OR instr(lower(?), lower(role_label)) > 0
       )
       ORDER BY RANDOM() LIMIT 1`,
      )
      .get(role, role);
  }
  if (!row) {
    row = db.prepare(`SELECT * FROM npc_core ORDER BY RANDOM() LIMIT 1`).get();
  }

  const visual = row && typeof row.visual_trait === 'string' ? row.visual_trait.trim() : '';
  const manner = row && typeof row.mannerism === 'string' ? row.mannerism.trim() : '';
  const secret =
    row && typeof row.secret_goal === 'string' ? row.secret_goal.trim() : '';
  const notes = row && typeof row.notes === 'string' ? row.notes.trim() : '';

  const semi = visual.indexOf(';');
  let palette = notes;
  let striking = visual;
  if (semi >= 0) {
    palette = visual.slice(0, semi).trim();
    striking = visual.slice(semi + 1).trim() || visual;
  } else if (!palette && visual.length > 0) {
    palette = visual.split(/[.!?]/)[0]?.trim() ?? '';
  }

  return {
    npc_core_id: row && typeof row.id === 'number' ? row.id : null,
    role_label:
      row && typeof row.role_label === 'string' ? String(row.role_label) : role || null,
    visual_trait: visual,
    mannerism: manner,
    secret_goal: secret,
    appearance_profile: {
      clothing_palette: palette,
      striking_physical_detail: striking,
      behavior_speech_or_tic: manner,
    },
  };
}
