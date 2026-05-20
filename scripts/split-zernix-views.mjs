/**
 * One-time splitter: ZernixViews.tsx → src/zernix/views/* + lib/prepText.ts
 * Run: node scripts/split-zernix-views.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "src", "zernix", "ZernixViews.tsx");
const lines = fs.readFileSync(src, "utf8").split(/\r?\n/);

function slice(start, end) {
  return lines.slice(start - 1, end).join("\n");
}

const libDir = path.join(root, "src", "zernix", "lib");
const viewsDir = path.join(root, "src", "zernix", "views");
fs.mkdirSync(libDir, { recursive: true });
fs.mkdirSync(viewsDir, { recursive: true });

// prepText.ts (lines 1078-1161, export functions)
const prepBody = slice(1078, 1161)
  .replace(/^function sanitizePrepText/, "export function sanitizePrepText")
  .replace(/^function prepNormKey/, "export function prepNormKey")
  .replace(/^function prepLinesOverlap/, "export function prepLinesOverlap")
  .replace(/^function compactSentence/, "export function compactSentence")
  .replace(/^function dedupePrepLines/, "export function dedupePrepLines");

fs.writeFileSync(
  path.join(libDir, "prepText.ts"),
  `/** Prep/session text cleanup for UI display. */\n\n${prepBody}\n`,
  "utf8",
);

fs.writeFileSync(
  path.join(libDir, "formatNoteTime.ts"),
  `/** Format note timestamp for journal lists. */\nexport function formatNoteTime(ts: number): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(ts));
}
`,
  "utf8",
);

const files = [
  {
    name: "home/HomeDashboard.tsx",
    body: slice(63, 273),
    header: `import {
  BookOpen,
  ChevronRight,
  Heart,
  Package,
  PlayCircle,
  Plus,
  ScrollText,
  Sparkles,
  UserCircle,
} from "lucide-react";

import { useZernixUserData } from "../../context/ZernixUserDataContext";
import type { ZernixViewId } from "../types";
import { useZernixGenerators } from "../ZernixGeneratorsContext";
import { QUICK_PRESETS, type QuickPresetId } from "../quickPresets";
import { formatNoteTime } from "../lib/formatNoteTime";

type HomeProps = {
  onNavigate: (v: ZernixViewId) => void;
  onOpenLootCard: (lootCardId: string) => void;
  onOpenNoteKey: (key: string) => void;
};

`,
  },
  {
    name: "loot/LootGeneratorView.tsx",
    body: slice(275, 683),
    header: `import {
  ClipboardCopy,
  Coins,
  Gem,
  Heart,
  Package,
  ScrollText,
  Sparkles,
  Wand2,
} from "lucide-react";

import { useZernixUserData } from "../../context/ZernixUserDataContext";
import { useAppContent } from "../../hooks/useAppContent";
import { lootCardIcon } from "../components/LootCard";
import { useZernixGenerators } from "../ZernixGeneratorsContext";
import { ZernixLootResultsSkeleton } from "../ZernixSkeletonBlocks";
import { useIdleGlow } from "../useIdleGlow";
import {
  formatLootCompact,
  formatLootDiscord,
  formatLootMarkdown,
  writeClipboard,
} from "../zernixCopyExport";

`,
  },
  {
    name: "npc/NpcCreatorView.tsx",
    body: `${slice(685, 689)}\n\n${slice(691, 1073)}`,
    header: `import { useEffect, useState } from "react";

import {
  BookOpen,
  ClipboardCopy,
  Compass,
  Eye,
  Gem,
  Heart,
  KeyRound,
  RefreshCw,
  ScrollText,
  ShieldOff,
  Sparkles,
  Target,
  UserCircle,
} from "lucide-react";

import { useZernixUserData } from "../../context/ZernixUserDataContext";
import { useAppContent } from "../../hooks/useAppContent";
import { useZernixGenerators } from "../ZernixGeneratorsContext";
import type { NpcPreviewState } from "../models";
import type { NarrativeRerollSlot } from "../npcNarrativeCompose";
import { npcFavoriteRefKey, npcJoinSegments, sanitizeNpcPreviewState } from "../npcUi";
import { ZernixNpcCardSkeleton } from "../ZernixSkeletonBlocks";
import { useIdleGlow } from "../useIdleGlow";
import {
  formatNpcCompact,
  formatNpcDiscord,
  formatNpcMarkdown,
  writeClipboard,
} from "../zernixCopyExport";

`,
  },
  {
    name: "prep/SessionPrepView.tsx",
    body: slice(1163, 1719),
    header: `import { useMemo, useState } from "react";

import {
  AlertTriangle,
  Anchor,
  Castle,
  ClipboardCopy,
  Coins,
  Compass,
  Crown,
  Feather,
  Gem,
  MapPin,
  Pin,
  ScrollText,
  Skull,
  Sparkles,
  Swords,
  Users,
  Zap,
} from "lucide-react";

import { useZernixUserData } from "../../context/ZernixUserDataContext";
import { useZernixGenerators } from "../ZernixGeneratorsContext";
import {
  compactSentence,
  dedupePrepLines,
  prepLinesOverlap,
  sanitizePrepText,
} from "../lib/prepText";
import { presentSessionAtTable, presentSessionFromLogMarkdown } from "../sessionAtTablePresent";
import { ZernixSessionSummarySkeleton } from "../ZernixSkeletonBlocks";
import { useIdleGlow } from "../useIdleGlow";
import {
  formatSessionCompact,
  formatSessionDiscord,
  formatSessionMarkdown,
  writeClipboard,
} from "../zernixCopyExport";

`,
  },
  {
    name: "conditions/ConditionsEncyclopediaView.tsx",
    body: `${slice(1721, 1724)}\n\n${slice(1726, 1730)}\n\n${slice(1732, 1754)}`,
    header: `import { Shield, Skull, Sparkles, Wind } from "lucide-react";

`,
  },
  {
    name: "history/HistoryView.tsx",
    body: slice(1756, 1792),
    header: `import { useZernixUserData } from "../../context/ZernixUserDataContext";
import { formatNoteTime } from "../lib/formatNoteTime";

`,
  },
  {
    name: "favorites/FavoritesView.tsx",
    body: slice(1794, 1855),
    header: `import { UserCircle } from "lucide-react";

import { useZernixUserData } from "../../context/ZernixUserDataContext";
import type { ZernixViewId } from "../types";

`,
  },
  {
    name: "settings/SettingsView.tsx",
    body: slice(1857, 2004),
    header: `import { useZernixUserData } from "../../context/ZernixUserDataContext";

`,
  },
];

for (const f of files) {
  const dir = path.join(viewsDir, path.dirname(f.name));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(viewsDir, f.name), `${f.header}${f.body}\n`, "utf8");
}

const index = `/** Barrel: all main ZERNIX desk views. */
export { HomeDashboard } from "./home/HomeDashboard";
export { LootGeneratorView } from "./loot/LootGeneratorView";
export { NpcCreatorView } from "./npc/NpcCreatorView";
export { SessionPrepView } from "./prep/SessionPrepView";
export { ConditionsEncyclopediaView } from "./conditions/ConditionsEncyclopediaView";
export { HistoryView } from "./history/HistoryView";
export { FavoritesView } from "./favorites/FavoritesView";
export { SettingsView } from "./settings/SettingsView";
`;

fs.writeFileSync(path.join(viewsDir, "index.ts"), index, "utf8");

// Backward-compat re-export from old path
fs.writeFileSync(
  path.join(root, "src", "zernix", "ZernixViews.tsx"),
  `/** @deprecated Import from "./views" — kept for backward compatibility. */
export {
  HomeDashboard,
  LootGeneratorView,
  NpcCreatorView,
  SessionPrepView,
  ConditionsEncyclopediaView,
  HistoryView,
  FavoritesView,
  SettingsView,
} from "./views";
`,
  "utf8",
);

console.log("Split complete:", files.length, "views + prepText.ts");
