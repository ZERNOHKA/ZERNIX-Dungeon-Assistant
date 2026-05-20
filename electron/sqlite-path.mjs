/**
 * Путь к dnd-loot.sqlite без импорта `electron` (main + тесты Node).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function resolveDndLootSqlitePath() {
  if (process.env.DND_LOOT_DB && String(process.env.DND_LOOT_DB).trim().length > 0) {
    return path.resolve(process.env.DND_LOOT_DB);
  }
  if (process.resourcesPath) {
    const packaged = path.join(process.resourcesPath, "dnd-loot.sqlite");
    if (fs.existsSync(packaged)) {
      return packaged;
    }
  }
  return path.join(__dirname, "..", "tools", "dnd-loot-sqlite", "dnd-loot.sqlite");
}
