import { execSync } from "node:child_process";
import fs from "node:fs";

const lines = execSync('git -C "E:/ZERNIX Dungeon Assistant" show HEAD:src/ZernixTheme.css', {
  encoding: "utf8",
}).split(/\r?\n/);

function slice(start, end, label) {
  return { label, content: lines.slice(start - 1, end) };
}

/** Section-aligned blocks from committed monolith (3386 lines). */
const blocks = [
  slice(281, 520, "App shell grid + regions + premium panel"),
  slice(521, 833, "Sidebar, brand, navigation, topbar"),
  slice(1052, 1137, "Primary / secondary buttons"),
  slice(1138, 1271, "Page layouts + form grid start"),
  slice(1272, 1450, "Legacy loot/NPC/prep grids (archive UI fallback)"),
  slice(1638, 2008, "Right codex panel + footer bar"),
  slice(2116, 2598, "Table mode, legacy home blocks, UX pass"),
];

const out = [];
out.push("/*");
out.push(" * ZERNIX App Shell Styles");
out.push(" * Layout chrome: sidebar, nav, topbar, regions, codex shell, shared controls.");
out.push(" * Extracted from committed ZernixTheme.css (pre-decomposition baseline).");
out.push(" */");
out.push("");

for (const b of blocks) {
  out.push(`/* --- ${b.label} --- */`);
  out.push(...b.content);
  out.push("");
}

const dest = "E:/ZERNIX Dungeon Assistant/src/zernix/views/shell/AppShell.css";
fs.mkdirSync("E:/ZERNIX Dungeon Assistant/src/zernix/views/shell", { recursive: true });
fs.writeFileSync(dest, out.join("\n"), "utf8");

const text = out.join("\n");
console.log("lines:", text.split("\n").length);
console.log({
  sidebar: text.includes(".zernix-sidebar-inner"),
  nav: text.includes(".zernix-nav-btn"),
  codex: text.includes(".zernix-codex {"),
  footer: text.includes(".zernix-footer-bar"),
});
