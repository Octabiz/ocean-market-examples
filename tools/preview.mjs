#!/usr/bin/env node
// Preview a landing page template or a store theme in your browser.
//   node tools/preview.mjs examples/landing-template-bright-clinic [--primary=#7C3AED] [--port=4300]
//   (or open http://localhost:4300/?primary=%237C3AED to try a colour without restarting)
//   node tools/preview.mjs examples/store-theme-harbor-linen
//   node tools/preview.mjs examples/booking-theme-clay-studio      (built-in booking pages in your tokens)
//   node tools/preview.mjs examples/booking-template-flow-yoga     (your own booking page + a mock booking SDK)
// Templates render every section with its default settings, exactly like the page builder;
// --primary shows how the template follows a business's own brand colour.
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { kindOf, readJson } from './lib/files.mjs';
import { renderTemplate, hexToHslTriple } from './lib/render.mjs';
import { serve } from './lib/serve.mjs';
import { bookingPreviewPage } from './lib/booking-preview.mjs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const bookingHost = join(dirname(fileURLToPath(import.meta.url)), 'booking-host');

const args = process.argv.slice(2);
const dir = resolve(args.find((a) => !a.startsWith('--')) ?? '');
const opt = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const port = Number(opt('port', 4300));
if (!existsSync(dir)) {
  console.error('Usage: node tools/preview.mjs <example-folder> [--primary=#hex] [--port=4300]');
  process.exit(1);
}
const kind = kindOf(dir);

function templatePage(url) {
  const m = readJson(join(dir, 'manifest.json'));
  // --primary on the command line, or ?primary=%237C3AED in the address bar.
  const primary = hexToHslTriple(url?.searchParams.get('primary') || opt('primary', '#0E7C66'));
  const css = [];
  const html = [];
  for (const s of m.sections) {
    const defaults = Object.fromEntries((s.settings ?? []).map((st) => [st.key, st.default ?? (st.type === 'list' ? [] : '')]));
    const read = (p) => (p && existsSync(join(dir, p)) ? readFileSync(join(dir, p), 'utf8') : '');
    css.push(read(s.styles));
    if (s.mobile_styles) css.push(`@media (max-width: 640px) {\n${read(s.mobile_styles)}\n}`);
    html.push(`<!-- section: ${s.key} (${s.name}) -->\n<div class="marketplace-block" data-block-type="${s.key}">${renderTemplate(read(s.template), defaults)}</div>`);
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${m.name} — preview</title>
<style>body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
.page{--primary:${primary};--primary-foreground:0 0% 100%;--background:0 0% 100%;--foreground:222 47% 11%}
${css.join('\n')}</style></head>
<body><div class="page">${html.join('\n')}</div></body></html>`;
}

function themePage() {
  const t = readJson(join(dir, 'theme.json'));
  const c = t.colors;
  const r = `${parseFloat(t.radius)}px`;
  const fonts = [...new Set([t.fonts.heading.family, t.fonts.body.family])].map((f) => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700`).join('&');
  // Simple product drawings in the theme's own colours, so the preview reads like a real store.
  const art = {
    shirt: `<path d="M38 22l14-8h16l14 8 12 16-14 8v42H40V46l-14-8z" fill="${c.accent}"/><path d="M52 14c2 8 14 8 16 0" fill="none" stroke="${c.on_accent}" stroke-width="3"/>`,
    tote: `<path d="M44 36c0-14 32-14 32 0" fill="none" stroke="${c.text}" stroke-width="4"/><rect x="30" y="36" width="60" height="50" rx="6" fill="${c.accent}"/><rect x="42" y="50" width="36" height="6" rx="3" fill="${c.on_accent}" opacity=".7"/>`,
    tray: `<ellipse cx="60" cy="66" rx="42" ry="14" fill="${c.text}" opacity=".85"/><ellipse cx="60" cy="60" rx="42" ry="14" fill="${c.accent}"/><circle cx="46" cy="54" r="7" fill="${c.on_accent}"/><circle cx="66" cy="52" r="5" fill="${c.border ?? c.surface}"/>`,
    throw: `<rect x="28" y="26" width="64" height="58" rx="8" fill="${c.accent}"/><path d="M28 42h64M28 58h64M28 74h64" stroke="${c.on_accent}" stroke-width="3" opacity=".6"/><path d="M34 84v8M44 84v8M54 84v8M64 84v8M74 84v8M84 84v8" stroke="${c.accent}" stroke-width="3"/>`,
  };
  const products = [['Linen shirt', '48.00', 'shirt'], ['Canvas tote', '22.00', 'tote'], ['Oak serving tray', '65.00', 'tray'], ['Wool throw', '120.00', 'throw']];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t.name ?? 'Theme'} — preview</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fonts}&display=swap">
<style>
:root{--bg:${c.background};--surface:${c.surface};--text:${c.text};--muted:${c.muted};--accent:${c.accent};--on-accent:${c.on_accent};--border:${c.border ?? c.surface};--radius:${r}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 "${t.fonts.body.family}",sans-serif;font-weight:${t.fonts.body.weight}}
h1,h2,h3{font-family:"${t.fonts.heading.family}",serif;font-weight:${t.fonts.heading.weight};margin:0}
.wrap{max-width:1080px;margin:0 auto;padding:0 20px}
header{border-bottom:1px solid var(--border)}header .wrap{display:flex;align-items:center;gap:24px;min-height:68px}
header nav{margin-left:auto;display:flex;gap:18px;color:var(--muted)}
.btn{display:inline-block;padding:12px 20px;border-radius:var(--radius);background:var(--accent);color:var(--on-accent);font-weight:600;border:0;font:inherit;cursor:pointer}
.btn.ghost{background:transparent;color:var(--accent);box-shadow:inset 0 0 0 2px var(--accent)}
.hero{padding-top:64px;padding-bottom:64px}.hero h1{font-size:44px;line-height:1.1;max-width:640px}.hero p{color:var(--muted);max-width:560px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:24px 0 56px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px}
.card .img{height:140px;border-radius:calc(var(--radius) - 4px);background:var(--bg);border:1px solid var(--border);margin-bottom:12px;display:flex;align-items:center;justify-content:center}.card .img svg{width:110px;height:110px}
.price{color:var(--muted)}.badge{display:inline-block;font-size:12px;padding:2px 10px;border-radius:999px;background:var(--accent);color:var(--on-accent)}
.book{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:56px;display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:end}
label{display:flex;flex-direction:column;gap:4px;font-size:14px;color:var(--muted)}
input,select{padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);color:var(--text);font:inherit}
.tokens{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:56px;font-size:13px}.tokens div{border:1px solid var(--border);border-radius:8px;overflow:hidden}.tokens i{display:block;height:48px}.tokens span{display:block;padding:6px 8px}
footer{border-top:1px solid var(--border);padding:24px 0;color:var(--muted)}
@media(max-width:720px){.grid{grid-template-columns:1fr 1fr}.book{grid-template-columns:1fr}.tokens{grid-template-columns:repeat(4,1fr)}header nav{display:none}.hero h1{font-size:32px}}
</style></head><body>
<header><div class="wrap"><h3>Seaside Home</h3><nav><span>Shop</span><span>Services</span><span>Contact</span></nav><a class="btn">Book now</a></div></header>
<section class="hero wrap"><span class="badge">New season</span><h1>Calm pieces for a slower home</h1><p>Body text uses the “muted” and “text” colours. Buttons use the accent with its on-accent text colour, and every corner follows the radius.</p><p><a class="btn">Shop the collection</a> <a class="btn ghost">Book a visit</a></p></section>
<section class="wrap"><h2>Best sellers</h2><div class="grid">${products.map(([n, p, a]) => `<div class="card"><div class="img"><svg viewBox="0 0 120 100" aria-hidden="true">${art[a]}</svg></div><h3>${n}</h3><div class="price">$${p}</div></div>`).join('')}</div></section>
<section class="wrap"><h2>Book a visit</h2><form class="book" onsubmit="return false"><label>Service<select><option>Home styling consult</option></select></label><label>Date<input type="date"></label><button class="btn">Check times</button></form></section>
<section class="wrap"><h2>Tokens</h2><div class="tokens">${Object.entries(c).map(([k, v]) => `<div><i style="background:${v}"></i><span><b>${k}</b><br>${v}</span></div>`).join('')}</div></section>
<footer><div class="wrap">Preview of “${t.name ?? 'theme'}” · heading ${t.fonts.heading.family} ${t.fonts.heading.weight} · body ${t.fonts.body.family} ${t.fonts.body.weight} · radius ${r}</div></footer>
</body></html>`;
}

serve({
  root: dir,
  port,
  routes: {
    '/': (url) =>
      kind === 'template' ? templatePage(url)
      : kind === 'theme' ? themePage()
      : kind === 'booking_theme' ? bookingPreviewPage(dir, url)
      : '<p>Use tools/dev-host.mjs for embedded apps.</p>',
    '/__booking/builtin.css': () => readFileSync(join(bookingHost, 'builtin.css')),
    '/__booking/octabiz-booking-mock.js': () => readFileSync(join(bookingHost, 'octabiz-booking-mock.js')),
  },
});
console.log(`Previewing ${kind} ${dir}\n→ http://localhost:${port}/   (Ctrl+C to stop)`);
