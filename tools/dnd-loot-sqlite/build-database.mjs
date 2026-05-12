#!/usr/bin/env node
/**
 * Former JSON build pipeline (BTMorton-style) was removed in favor of SRD 5.2 markdown.
 * This entry re-runs the markdown importer forward any CLI flags.
 *
 *   node build-database.mjs --out=./out.sqlite --docs=../../docs
 */

import { spawnSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const child = spawnSync(
  process.execPath,
  [resolve(__dirname, 'import-srd-docs.mjs'), ...process.argv.slice(2)],
  { stdio: 'inherit' },
);
process.exitCode = child.status ?? 1;
