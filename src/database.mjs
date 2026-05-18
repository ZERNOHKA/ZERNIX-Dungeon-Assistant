/**
 * ZERNIX — mock “database” for browser/Vite when Electron loot-core IPC is unavailable.
 * Zero SQLite / external DB: plain JS arrays + async pick (simulates network latency).
 */

const GENERATION_LATENCY_MS = 500;

async function mockDelayMs(ms = GENERATION_LATENCY_MS) {
  await new Promise((r) => setTimeout(r, ms));
}

/** @type {readonly { name: string; description: string }[]} */
export const LOOT_DATASET = Object.freeze([
  {
    name: "Gildroot Band",
    description:
      "A torc of braided roots turned to brittle gold where it touches skin. Warm to the touch after bloodshed; whispers gardening advice in Druidic.",
  },
  {
    name: "Scroll: Ashward",
    description:
      "Arcane parchment that smolders without burning. When read aloud, grants fire resistance until the ash falls — then imposes disadvantage on stealth for an hour.",
  },
  {
    name: "Ironclad Coin (Cursed)",
    description:
      "A heavy platinum piece that always lands edge-up. Anyone who pockets it wakes convinced they misplaced something vital.",
  },
  {
    name: "Fangglass Dagger",
    description:
      "Obsidian shard hafted in stingray leather. Grants +1 magic bonus only while the wielder openly tells one truth aloud each dawn.",
  },
  {
    name: "Charm of Listening Steps",
    description:
      "A silver snail shell on twine. Three times per day, wearer may hear echoes of footsteps up to ten minutes past in a 30-foot hallway.",
  },
  {
    name: "Blessed Trail Rations",
    description:
      "Seven wax-sealed packets; each restores 1 HD and conveys a fleeting sense of hearth-smoke — even underground.",
  },
  {
    name: "Echo Map Fragment",
    description:
      "Torn parchment that redraws corridors as if seen from fifteen feet overhead. Incomplete; blanks shift when stared at.",
  },
  {
    name: "Potion of Courteous Serpents",
    description:
      "Thick green tonic. Drinkers find snakes politely knock before biting (still bite). Lasts eight hours.",
  },
]);

/**
 * Simulated async loot roll (browser MVP / academic build).
 * @returns {Promise<{ name: string; description: string }>}
 */
export async function generateLootAsync() {
  await mockDelayMs();
  const i = Math.floor(Math.random() * LOOT_DATASET.length);
  const row = LOOT_DATASET[i];
  return { name: row.name, description: row.description };
}

/** Заглушка задержки для NPC в браузере (до подстановки шаблона из app-content.json). */
export async function generateNpcAsync() {
  await mockDelayMs();
}

/** Заглушка задержки для сессии в браузере (перед сборкой текста из формы). */
export async function generateSessionAsync() {
  await mockDelayMs();
}
