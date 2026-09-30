#!/usr/bin/env node
// Run the same checks Ocean Market runs when you upload, before you upload.
//   node tools/validate.mjs examples/embedded-top-customers [more folders…]
// Mirrors the platform rules (see docs/). The platform's result is the one that counts.
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { kindOf, listFiles, readJson } from './lib/files.mjs';

const pass = (label, detail) => ({ status: 'pass', label, detail });
const warn = (label, detail) => ({ status: 'warn', label, detail });
const fail = (label, detail) => ({ status: 'fail', label, detail });
const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
const OCTABIZ_HOSTS = ['octabiz.ai', 'octabiz.site', 'octabiz.com'];
const hostOk = (url) => {
  const m = /^(?:https?:)?\/\/([^/:?#]+)/i.exec(url);
  return !m || OCTABIZ_HOSTS.some((d) => m[1].toLowerCase() === d || m[1].toLowerCase().endsWith(`.${d}`));
};

// ---------------------------------------------------------------- templates
function validateTemplate(dir) {
  const checks = [];
  const files = listFiles(dir);
  const text = (p) => readFileSync(join(dir, p), 'utf8');
  let manifest;
  try {
    manifest = readJson(join(dir, 'manifest.json'));
  } catch (e) {
    return [fail('manifest.json is valid', e.message)];
  }
  const errs = [];
  if (manifest.type !== 'landing_template') errs.push('type must be "landing_template"');
  if (!manifest.name) errs.push('name is required');
  if (!SEMVER.test(manifest.version ?? '')) errs.push('version must look like 1.0.0');
  if (!Array.isArray(manifest.sections) || manifest.sections.length === 0) errs.push('sections must be a non-empty list');
  checks.push(errs.length ? fail('manifest.json is valid', errs.join('; ')) : pass('manifest.json is valid', `version ${manifest.version}`));
  if (errs.length) return checks;

  const TYPES = ['text', 'image', 'colour', 'list', 'link'];
  const secErr = [];
  const keys = new Set();
  for (const s of manifest.sections) {
    if (!/^[a-z0-9_-]{1,40}$/i.test(s.key ?? '')) secErr.push(`section key "${s.key}" must be 1–40 letters, digits, _ or -`);
    const typeKey = String(s.key).toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (keys.has(typeKey)) secErr.push(`section key "${s.key}" collides with another section`);
    keys.add(typeKey);
    if (!s.name) secErr.push(`section "${s.key}" needs a name`);
    for (const f of [s.template, s.styles, s.mobile_styles].filter(Boolean)) if (!files.includes(f)) secErr.push(`${f} is missing`);
    for (const st of s.settings ?? []) {
      if (!TYPES.includes(st.type)) secErr.push(`${s.key}.${st.key}: type must be one of ${TYPES.join(', ')}`);
      if (st.default !== undefined && (st.type === 'list') !== Array.isArray(st.default)) secErr.push(`${s.key}.${st.key}: default must be ${st.type === 'list' ? 'a list' : 'text'}`);
      if (!st.label) secErr.push(`${s.key}.${st.key}: add a label — businesses see it in the page builder`);
    }
    // Every {{ key }} in the HTML should be a setting (or an item field inside {{#each}}).
    if (files.includes(s.template)) {
      const html = text(s.template);
      const settings = new Set((s.settings ?? []).map((x) => x.key));
      const outer = html.replace(/\{\{#each\s+([\w.]+)\s*\}\}[\s\S]*?\{\{\/each\}\}/g, (_m, k) => {
        if (!settings.has(k.split('.')[0])) secErr.push(`${s.template}: {{#each ${k}}} has no matching list setting`);
        return '';
      });
      for (const m of outer.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) {
        if (!settings.has(m[1].split('.')[0])) secErr.push(`${s.template}: {{ ${m[1]} }} has no matching setting`);
      }
    }
  }
  checks.push(secErr.length ? fail(`${manifest.sections.length} page sections found`, secErr.slice(0, 6).join('; ')) : pass(`${manifest.sections.length} page sections found`));

  const scriptIssues = [];
  for (const p of files) {
    if (/\.(m?js|cjs|ts|tsx|jsx|wasm|php|py|sh)$/i.test(p)) { scriptIssues.push(`${p}: code files aren't allowed in a template`); continue; }
    if (!/\.(html?|svg|css|json)$/i.test(p)) continue;
    const t = text(p);
    if (/\.(html?|svg)$/i.test(p)) {
      if (/<\s*script\b/i.test(t)) scriptIssues.push(`${p}: has a <script> tag`);
      if (/<\s*(iframe|object|embed|base)\b/i.test(t)) scriptIssues.push(`${p}: embeds another page`);
      if (/\son[a-z]+\s*=/i.test(t)) scriptIssues.push(`${p}: has an on…= event attribute (or text that looks like one)`);
      for (const m of t.matchAll(/\b(src|srcset|poster|data|action|formaction|xlink:href)\s*=\s*["']?\s*((?:https?:)?\/\/[^"'\s>]+)/gi)) if (!hostOk(m[2])) scriptIssues.push(`${p}: loads ${m[2]}`);
    }
    if (/javascript\s*:/i.test(t)) scriptIssues.push(`${p}: javascript: URL`);
  }
  checks.push(scriptIssues.length ? fail('No scripts and no calls to outside services', scriptIssues.slice(0, 4).join('; ')) : pass('No scripts and no calls to outside services'));

  const big = files.filter((p) => /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(p) && statSync(join(dir, p)).size > 500 * 1024);
  checks.push(big.length ? fail('Images optimised', `${big.join(', ')} — each image must be 500 KB or less`) : pass('Images optimised'));

  const noMobile = manifest.sections.filter((s) => !(s.mobile_styles && files.includes(s.mobile_styles)) && !/@media[^{]*\((?:max|min)-width/i.test((s.styles && files.includes(s.styles) ? text(s.styles) : '') + (files.includes(s.template) ? text(s.template) : '')));
  checks.push(noMobile.length ? fail('Mobile layout included for every section', noMobile.map((s) => s.key).join(', ')) : pass('Mobile layout included for every section'));

  const cssIssues = [];
  for (const p of files.filter((f) => f.endsWith('.css'))) {
    const t = text(p);
    if (/url\s*\(/i.test(t)) cssIssues.push(`${p}: url() is removed by the safety filter — use an image setting + <img>`);
    if (/@import|@charset|expression\s*\(|behavior\s*:|-moz-binding/i.test(t)) cssIssues.push(`${p}: uses a blocked CSS feature`);
  }
  for (const s of manifest.sections) {
    if (!files.includes(s.template)) continue;
    const t = text(s.template);
    if (/<\s*style\b/i.test(t)) cssIssues.push(`${s.template}: put CSS in the section's styles file, not a <style> tag`);
    if (/\bsrc\s*=\s*["']\.\//i.test(t)) cssIssues.push(`${s.template}: write src="images/x.svg", not ./images/…`);
  }
  checks.push(cssIssues.length ? fail('HTML and CSS pass the page safety filter', cssIssues.slice(0, 4).join('; ')) : pass('HTML and CSS pass the page safety filter'));
  return checks;
}

// ---------------------------------------------------------------- themes
const FONTS = ['Inter', 'Sora', 'Manrope', 'DM Sans', 'Lora', 'Playfair Display', 'Poppins', 'Work Sans', 'Source Serif 4', 'Nunito Sans'];
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
function luminance(hex) {
  const h = hex.slice(1).length === 3 ? hex.slice(1).split('').map((c) => c + c).join('') : hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
function validateTheme(dir) {
  const checks = [];
  let t;
  try {
    t = readJson(join(dir, 'theme.json'));
  } catch (e) {
    return [fail('Matches theme schema', e.message)];
  }
  const errs = [];
  if (t.type && t.type !== 'store_theme') errs.push('type must be "store_theme"');
  for (const k of ['background', 'surface', 'text', 'muted', 'accent', 'on_accent']) if (!HEX.test(t.colors?.[k] ?? '')) errs.push(`colors.${k} must be a hex colour like #1F5F6B`);
  for (const [k, v] of Object.entries(t.colors ?? {})) if (typeof v === 'string' && !HEX.test(v)) errs.push(`colors.${k} must be hex`);
  for (const f of ['heading', 'body']) {
    if (!FONTS.includes(t.fonts?.[f]?.family)) errs.push(`fonts.${f}.family must be one of: ${FONTS.join(', ')}`);
    const w = t.fonts?.[f]?.weight;
    if (!(Number.isInteger(w) && w >= 100 && w <= 900 && w % 100 === 0)) errs.push(`fonts.${f}.weight must be 100–900 in steps of 100`);
  }
  const r = typeof t.radius === 'number' ? t.radius : Number(/^(\d+(?:\.\d+)?)(px)?$/.exec(String(t.radius ?? ''))?.[1]);
  if (!(r >= 0 && r <= 48)) errs.push('radius must be 0–48 (px)');
  if (t.version && !SEMVER.test(t.version)) errs.push('version must look like 1.0.0');
  checks.push(errs.length ? fail('Matches theme schema', errs.join('; ')) : pass('Matches theme schema'));
  if (errs.length) return checks;
  const c = t.colors;
  const pairs = [['Text on background', c.text, c.background], ['Text on surface', c.text, c.surface], ['On-accent on accent', c.on_accent, c.accent], ['Muted on surface', c.muted, c.surface]];
  for (const [label, fg, bg] of pairs) {
    const ratio = contrast(fg, bg);
    checks.push(ratio >= 4.5 ? pass(label, `${ratio.toFixed(1)}:1`) : fail(label, `${ratio.toFixed(1)}:1 — needs 4.5:1 or more`));
  }
  return checks;
}

// ---------------------------------------------------------------- embedded apps
const MALWARE = [
  [/coinhive|cryptonight|coin-hive|stratum\+tcp|minero\.cc|webminerpool/i, 'crypto-miner code', 'fail'],
  [/eval\s*\(\s*(atob|unescape|decodeURIComponent)\s*\(/i, 'runs decoded (hidden) code with eval', 'fail'],
  [/new\s+Function\s*\(\s*(atob|unescape)\s*\(/i, 'builds a function from decoded code', 'fail'],
  [/\b(window\.)?(top|parent)\.location(\.href)?\s*=/i, 'tries to navigate the Octabiz page', 'fail'],
  [/\beval\s*\(/, 'uses eval()', 'warn'],
  [/new\s+Function\s*\(/, 'uses new Function()', 'warn'],
  [/document\.cookie/, 'reads or writes cookies', 'warn'],
  [/<script[^>]+src\s*=\s*["']?https?:\/\//i, 'loads a script from another site (blocked by the CSP)', 'fail'],
  [/<script(?![^>]*\bsrc=)[^>]*>\s*\S/i, 'inline <script> (blocked by the CSP — use a .js file)', 'fail'],
  [/\son[a-z]+\s*=\s*["']/i, 'inline event handler (blocked by the CSP — use addEventListener)', 'fail'],
  [/\b(fetch|XMLHttpRequest|WebSocket|EventSource)\b/, 'makes network requests (blocked unless the app declares sends_data_outside)', 'warn'],
];
const ALLOWED = /\.(html?|css|m?js|json|map|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|txt|md|webmanifest)$/i;
function validateApp(dir) {
  const checks = [];
  const files = listFiles(dir);
  let meta;
  try {
    meta = readJson(join(dir, 'app.json'));
    const errs = [];
    if (!meta.name) errs.push('name');
    if (!SEMVER.test(meta.version ?? '')) errs.push('version like 1.0.0');
    if (!Array.isArray(meta.scopes)) errs.push('scopes list');
    checks.push(errs.length ? fail('app.json is complete', `needs ${errs.join(', ')}`) : pass('app.json is complete', `v${meta.version} · ${meta.scopes.join(', ')}`));
  } catch (e) {
    checks.push(fail('app.json is complete', e.message));
  }
  checks.push(files.includes('index.html') ? pass('index.html at the top of the package') : fail('index.html at the top of the package', 'Octabiz serves index.html as the app'));

  const hits = [];
  for (const p of files) {
    if (!ALLOWED.test(p)) { hits.push(['fail', `${p}: file type isn't allowed`]); continue; }
    if (!/\.(html?|css|m?js|json|svg|txt|md)$/i.test(p)) continue;
    const t = readFileSync(join(dir, p), 'utf8');
    for (const [re, why, level] of MALWARE) {
      const m = re.exec(t);
      if (!m) continue;
      if (level === 'warn' && why.startsWith('makes network') && meta?.sensitive_flags?.includes('sends_data_outside')) continue;
      hits.push([level, `${p}:${t.slice(0, m.index).split('\n').length} ${why}`]);
    }
  }
  const fails = hits.filter((h) => h[0] === 'fail');
  checks.push(fails.length ? fail('Malware and CSP scan', fails.map((h) => h[1]).slice(0, 4).join('; '))
    : hits.length ? warn('Malware and CSP scan', hits.map((h) => h[1]).slice(0, 4).join('; '))
    : pass('Malware and CSP scan', `${files.length} files, nothing suspicious`));

  const lint = [];
  for (const p of files) {
    if (/\.m?js$/i.test(p)) {
      try { new vm.Script(readFileSync(join(dir, p), 'utf8'), { filename: p }); } catch (e) { lint.push(`${p}: ${e.message}`); }
    } else if (p.endsWith('.json')) {
      try { JSON.parse(readFileSync(join(dir, p), 'utf8')); } catch { lint.push(`${p}: not valid JSON`); }
    }
  }
  checks.push(lint.length ? fail('Lint & build', lint.slice(0, 3).join('; ')) : pass('Lint & build', 'every script parses'));
  const size = files.reduce((s, p) => s + statSync(join(dir, p)).size, 0);
  checks.push(size <= 25 * 1024 * 1024 ? pass('Package size', `${(size / 1024).toFixed(1)} KB`) : fail('Package size', 'over 25 MB'));
  return checks;
}

export function validate(dir) {
  const kind = kindOf(dir);
  const checks = kind === 'template' ? validateTemplate(dir) : kind === 'theme' ? validateTheme(dir) : validateApp(dir);
  return { kind, checks, ok: checks.every((c) => c.status !== 'fail') };
}

// CLI
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dirs = process.argv.slice(2);
  if (!dirs.length) {
    console.error('Usage: node tools/validate.mjs <example-folder> [more folders…]');
    process.exit(1);
  }
  let ok = true;
  for (const dir of dirs) {
    const r = validate(dir);
    console.log(`\n${dir}  (${r.kind})`);
    for (const c of r.checks) console.log(`  ${c.status === 'pass' ? '✓' : c.status === 'warn' ? '!' : '✗'} ${c.label}${c.detail ? ` — ${c.detail}` : ''}`);
    ok = ok && r.ok;
  }
  console.log(ok ? '\nAll packages passed.' : '\nSome checks failed.');
  process.exit(ok ? 0 : 1);
}
