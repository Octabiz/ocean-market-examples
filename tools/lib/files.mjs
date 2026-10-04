// Shared helpers: find an example's kind and list the files that belong in its package.
import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Files that never go into a package (docs and README screenshots stay in the repo). */
const SKIP = /(^|\/)(README\.md|\.DS_Store|node_modules|dist|\.git|screenshots)(\/|$)/;

export function listFiles(dir) {
  const out = [];
  (function walk(d) {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      const rel = relative(dir, full).replace(/\\/g, '/');
      if (SKIP.test(rel)) continue;
      if (statSync(full).isDirectory()) walk(full);
      else out.push(rel);
    }
  })(dir);
  return out.sort();
}

/** A theme.json for the booking pages (tokens/extends) rather than a store theme (colors). */
export function isBookingThemeJson(json) {
  if (!json || typeof json !== 'object') return false;
  if (json.type === 'store_theme' || json.colors) return false;
  return String(json.$schema ?? '').includes('booking-theme') || 'tokens' in json || 'extends' in json;
}

/** 'template' | 'theme' | 'booking_theme' | 'app' — decided by the files the folder contains. */
export function kindOf(dir) {
  if (existsSync(join(dir, 'manifest.json'))) return 'template';
  if (existsSync(join(dir, 'theme.json'))) {
    try {
      if (isBookingThemeJson(JSON.parse(readFileSync(join(dir, 'theme.json'), 'utf8')))) return 'booking_theme';
    } catch {
      // Invalid JSON: report it as a store theme; validate.mjs explains the parse error.
    }
    return 'theme';
  }
  if (existsSync(join(dir, 'index.html')) || existsSync(join(dir, 'app.json'))) return 'app';
  throw new Error(`${dir}: no manifest.json (template), theme.json (theme) or index.html (embedded app).`);
}

export function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function slugOf(dir) {
  return dir.replace(/\/+$/, '').split('/').pop();
}
