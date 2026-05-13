/**
 * Единый серверный/IPC pipeline: базовый движок → (при наличии SQLite) NEXUS-миграции + merge.
 * Используется Express API и Electron IPC, чтобы не дублировать логику в main.cjs.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  openLootDatabase,
  setLootDatabasePath,
  applyZernixNexusMigrationsAsync,
} from "../tools/dnd-loot-sqlite/generate-loot.mjs";
import { enrichNpcPayloadFromDatabase } from "../tools/dnd-loot-sqlite/lib/npc-nexus-enrich.mjs";
import { runGenerateLootMarkdown, resolveLootSqlitePathForElectron } from "./loot-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Тот же путь, что и у генератора лута (`DND_LOOT_DB` / packaged / dev). */
export function resolveNexusSqlitePath() {
  return resolveLootSqlitePathForElectron();
}

/**
 * NPC: generateNPC (ядро) → при наличии БД: applyZernixNexusMigrationsAsync + enrichNpcPayloadFromDatabase + formatNPCMarkdown.
 * `contextTag`, `bossMode`, `professionId` и прочее пробрасываются через opts (копия тела запроса).
 *
 * @param {Record<string, unknown>} [payload]
 * @returns {Promise<{ ok: true, data: object, markdown: string, nexusEnriched: boolean } | { ok: false, error: string }>}
 */
export async function runGenerateNpcServerPipeline(payload) {
  const opts = typeof payload === "object" && payload !== null ? { ...payload } : {};
  const npcHref = pathToFileURL(path.join(__dirname, "..", "npc-engine.mjs")).href;
  const mod = await import(npcHref);
  const result = mod.generateNPC(opts);
  let data = result.data;
  let markdown = result.markdown;

  const dbPath = resolveNexusSqlitePath();
  if (!fs.existsSync(dbPath)) {
    return { ok: true, data, markdown, nexusEnriched: false };
  }

  setLootDatabasePath(dbPath);
  const db = openLootDatabase(dbPath);
  try {
    await applyZernixNexusMigrationsAsync(db);
    data = enrichNpcPayloadFromDatabase(db, data, opts, Math.random);
    markdown = mod.formatNPCMarkdown(data);
    return { ok: true, data, markdown, nexusEnriched: true };
  } finally {
    db.close();
  }
}

/**
 * Лут: runGenerateLootMarkdown (contextTag из тела запроса) + applyZernixNexusMigrationsAsync после open в loot-core.
 *
 * @param {Record<string, unknown>} [payload]
 */
export async function runGenerateLootServerPipeline(payload) {
  const p = typeof payload === "object" && payload !== null ? payload : {};
  return runGenerateLootMarkdown(p);
}
