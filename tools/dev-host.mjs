#!/usr/bin/env node
// Run an embedded app locally inside a mock Octabiz, with sample data.
//   node tools/dev-host.mjs examples/embedded-top-customers [--port=4400]
// → Octabiz (mock) at http://localhost:4400 · your app at http://127.0.0.1:4401 (a different origin,
//   like the real thing) served with the same Content-Security-Policy Octabiz uses in production.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './lib/serve.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const appDir = resolve(args.find((a) => !a.startsWith('--')) ?? '');
if (!existsSync(join(appDir, 'index.html'))) {
  console.error('Usage: node tools/dev-host.mjs <embedded-app-folder>   (the folder must contain index.html)');
  process.exit(1);
}
const meta = existsSync(join(appDir, 'app.json')) ? JSON.parse(readFileSync(join(appDir, 'app.json'), 'utf8')) : { name: 'My app', scopes: [] };
const HOST_PORT = Number(args.find((a) => a.startsWith('--port='))?.split('=')[1] ?? 4400);
const APP_PORT = HOST_PORT + 1;
const sendsOut = (meta.sensitive_flags ?? []).includes('sends_data_outside');

// Same policy as production (supabase/functions/marketplace-app-host in the Octabiz repo).
const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https:",
  "font-src 'self' data:", `connect-src ${sendsOut ? 'https:' : "'none'"}`, "form-action 'none'", "base-uri 'none'",
  "object-src 'none'", 'frame-ancestors http://localhost:*',
].join('; ');

serve({ root: appDir, port: APP_PORT, host: '127.0.0.1', headers: { 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff' } });
serve({
  root: join(here, 'dev-host'),
  port: HOST_PORT,
  routes: {
    '/app.json': () => JSON.stringify({ ...meta, appUrl: `http://127.0.0.1:${APP_PORT}/` }),
  },
});
console.log(`${meta.name} — mock Octabiz running
→ http://localhost:${HOST_PORT}/   (your app is framed from http://127.0.0.1:${APP_PORT}/)
Edit files in ${appDir} and press Reload app. Ctrl+C to stop.`);
