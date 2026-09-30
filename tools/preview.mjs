#!/usr/bin/env node
// Preview a landing page template or a store theme in your browser.
//   node tools/preview.mjs examples/landing-template-bright-clinic [--primary=#7C3AED] [--port=4300]
//   node tools/preview.mjs examples/store-theme-harbor-linen
// Templates render every section with its default settings, exactly like the page builder;
// --primary shows how the template follows a business's own brand colour.
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { kindOf, readJson } from './lib/files.mjs';
import { renderTemplate, hexToHslTriple } from './lib/render.mjs';
import { serve } from './lib/serve.mjs';

const args = process.argv.slice(2);
const dir = resolve(args.find((a) => !a.startsWith('--')) ?? '');
const opt = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const port = Number(opt('port', 4300));
if (!existsSync(dir)) {
  console.error('Usage: node tools/preview.mjs <example-folder> [--primary=#hex] [--port=4300]');
  process.exit(1);
}
const kind = kindOf(dir);

function templatePage() {
  const m = readJson(join(dir, 'manifest.json'));
  const primary = hexToHslTriple(opt('primary', '#0E7C66'));
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
  const products = [['Linen shirt', '48.00'], ['Canvas tote', '22.00'], ['Oak serving tray', '65.00'], ['Wool throw', '120.00']];
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
.card .img{height:140px;border-radius:calc(var(--radius) - 4px);background:var(--bg);border:1px solid var(--border);margin-bottom:12px}
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
<section class="wrap"><h2>Best sellers</h2><div class="grid">${products.map(([n, p]) => `<div class="card"><div class="img"></div><h3>${n}</h3><div class="price">$${p}</div></div>`).join('')}</div></section>
<section class="wrap"><h2>Book a visit</h2><form class="book" onsubmit="return false"><label>Service<select><option>Home styling consult</option></select></label><label>Date<input type="date"></label><button class="btn">Check times</button></form></section>
<section class="wrap"><h2>Tokens</h2><div class="tokens">${Object.entries(c).map(([k, v]) => `<div><i style="background:${v}"></i><span><b>${k}</b><br>${v}</span></div>`).join('')}</div></section>
<footer><div class="wrap">Preview of “${t.name ?? 'theme'}” · heading ${t.fonts.heading.family} ${t.fonts.heading.weight} · body ${t.fonts.body.family} ${t.fonts.body.weight} · radius ${r}</div></footer>
</body></html>`;
}

serve({ root: dir, port, routes: { '/': () => (kind === 'template' ? templatePage() : kind === 'theme' ? themePage() : '<p>Use tools/dev-host.mjs for embedded apps.</p>') } });
console.log(`Previewing ${kind} ${dir}\n→ http://localhost:${port}/   (Ctrl+C to stop)`);
