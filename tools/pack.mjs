#!/usr/bin/env node
// Build the file you upload in the Ocean Market developer portal.
//   node tools/pack.mjs examples/landing-template-bright-clinic
// Templates and embedded apps → dist/<name>-<version>.zip · themes → dist/<name>-<version>.theme.json
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createZip } from './lib/zip.mjs';
import { kindOf, listFiles, readJson, slugOf } from './lib/files.mjs';
import { validate } from './validate.mjs';

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
  console.error('Usage: node tools/pack.mjs <example-folder> [more folders…]');
  process.exit(1);
}
const dist = resolve('dist');
mkdirSync(dist, { recursive: true });
let failed = false;
for (const dir of dirs) {
  const report = validate(dir);
  if (!report.ok) {
    console.error(`✗ ${dir}: fix the failed checks first (node tools/validate.mjs ${dir}).`);
    failed = true;
    continue;
  }
  const kind = kindOf(dir);
  const version = kind === 'template' ? readJson(join(dir, 'manifest.json')).version
    : kind === 'theme' ? readJson(join(dir, 'theme.json')).version ?? '1.0.0'
    : (readJson(join(dir, 'app.json')).version);
  const name = slugOf(dir);
  if (kind === 'theme') {
    const out = join(dist, `${name}-${version}.theme.json`);
    copyFileSync(join(dir, 'theme.json'), out);
    console.log(`✓ ${out}`);
    continue;
  }
  const files = listFiles(dir);
  const zip = createZip(files.map((p) => ({ path: p, data: readFileSync(join(dir, p)) })));
  const out = join(dist, `${name}-${version}.zip`);
  writeFileSync(out, zip);
  console.log(`✓ ${out}  (${files.length} files, ${(zip.length / 1024).toFixed(1)} KB)`);
}
process.exit(failed ? 1 : 0);
