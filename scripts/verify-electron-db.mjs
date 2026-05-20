#!/usr/bin/env node
/**
 * Проверка: Electron-пайплайн лута/сессии читает monsters + items из SQLite,
 * а не из browser mock (src/services/mocks/database.mjs).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`OK: ${msg}`);
  return true;
}

function stripItemLabel(line) {
  const t = String(line ?? "").trim();
  const m = /^\*?\*?([^*]+?)\*?\*?\s*(?:—|$)/u.exec(t);
  return (m?.[1] ?? t).trim();
}

async function main() {
  const lootCorePath = path.join(root, "electron", "loot-core.mjs");
  const npcPath = path.join(root, "npc-engine.mjs");
  const toolsLoot = path.join(root, "tools", "dnd-loot-sqlite", "generate-loot.mjs");
  const mockPath = path.join(root, "src", "services", "mocks", "database.mjs");

  assert(fs.existsSync(lootCorePath), "electron/loot-core.mjs найден");
  assert(fs.existsSync(npcPath), "npc-engine.mjs найден");
  assert(fs.existsSync(toolsLoot), "tools/dnd-loot-sqlite/generate-loot.mjs найден");
  assert(!process.env.ZERNIX_FORCE_MOCK_LOOT, "ZERNIX_FORCE_MOCK_LOOT не задан");

  const { resolveLootSqlitePathForElectron, runGenerateLootMarkdown, runSessionPrepMarkdown } =
    await import(pathToFileUrl(lootCorePath));

  const dbPath = resolveLootSqlitePathForElectron();
  assert(fs.existsSync(dbPath), `SQLite: ${dbPath}`);

  const db = new Database(dbPath, { readonly: true });
  const itemCount = db.prepare("SELECT COUNT(*) AS c FROM items").get().c;
  const monsterCount = db.prepare("SELECT COUNT(*) AS c FROM monsters").get().c;
  db.close();

  assert(itemCount > 57, `items в SQLite: ${itemCount} (mock содержит 57)`);
  assert(monsterCount > 20, `monsters в SQLite: ${monsterCount}`);

  const mockText = fs.readFileSync(mockPath, "utf8");
  const mockItemMatches = [...mockText.matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1]);

  const loot = await runGenerateLootMarkdown({
    partyLevel: 7,
    playerCount: 4,
    difficulty: "moderate",
    environment: "coastal",
    contextTag: "wilderness",
    gold: 800,
    chestCount: 2,
    onlyMagic: false,
  });

  assert(Boolean(loot?.lootDigest), "lootDigest получен из loot-core (не mock)");
  const digestLines = [
    ...(loot.lootDigest.mundane ?? []).map((x) => x.displayLine),
    ...(loot.lootDigest.magic ?? []).map((x) => x.displayLine),
  ];
  const hasGold =
    String(loot.lootDigest.goldLine ?? "").trim().length > 0 ||
    /зм|gp|монет/i.test(String(loot.markdown ?? ""));
  assert(
    digestLines.length > 0 || hasGold,
    `лут из SQLite: предметов ${digestLines.length}, золото=${hasGold ? "да" : "нет"}`,
  );
  assert(
    String(loot.markdown ?? "").includes("SQLite SRD"),
    "markdown лута ссылается на SQLite SRD (не browser mock)",
  );

  const mockOnly = digestLines.filter((line) => {
    const label = stripItemLabel(line);
    return mockItemMatches.some((m) => label.includes(m));
  });
  assert(
    mockOnly.length < digestLines.length || digestLines.length === 0,
    `не все предметы из mock (${mockOnly.length}/${digestLines.length} совпали с mock-именами)`,
  );

  const session = await runSessionPrepMarkdown({
    partyLevel: 5,
    playerCount: 4,
    difficulty: "moderate",
    packCount: 2,
    chestCount: 1,
    environmentKey: "swamp",
    environmentText: "Болото у старой дороги, туман и следы когтей.",
    onlyMagic: false,
  });

  assert(Boolean(session?.markdown?.length), "session prep markdown из SQLite-пайплайна");
  const md = String(session.markdown ?? "");
  assert(
    /монстр|отряд|CR|опыт|xp|goblin|wolf|bandit|undead|beast|сложност|ур\.|пак|сундук|враг|угроз|патрул|сущ/i.test(md),
    "session prep содержит ссылки на монстров/отряды из движка",
  );

  console.log("\nverify-electron-db: завершено");
  if (process.exitCode) process.exit(process.exitCode);
}

function pathToFileUrl(p) {
  return new URL(`file:///${p.replace(/\\/g, "/")}`).href;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
