import type { ZernixViewId } from "../zernix/types";

/**
 * Auto-discovered background images per section via Vite's import.meta.glob.
 *
 * Drop PNG/JPG/JPEG/WEBP files into:
 *   src/assets/backgrounds/<section>/<any-name>.png
 *
 * Vite collects them at build time, hashes their URLs, and bundles them.
 * If a section folder is empty, the returned list will be empty and the
 * background slot for that section is hidden (CSS var becomes `none`).
 */
const modules = import.meta.glob<string>(
  "../assets/backgrounds/**/*.{png,jpg,jpeg,webp,PNG,JPG,JPEG,WEBP}",
  { eager: true, query: "?url", import: "default" },
);

type Section = ZernixViewId;

const grouped: Partial<Record<Section, string[]>> = {};

for (const [path, url] of Object.entries(modules)) {
  const match = path.match(/backgrounds\/([^/]+)\//);
  if (!match) continue;
  const section = match[1] as Section;
  (grouped[section] ??= []).push(url);
}

for (const section of Object.keys(grouped) as Section[]) {
  grouped[section]?.sort((a, b) => a.localeCompare(b));
}

export function getSectionBackgrounds(view: Section): string[] {
  return grouped[view] ?? [];
}

export function hasSectionBackgrounds(view: Section): boolean {
  return (grouped[view]?.length ?? 0) > 0;
}
