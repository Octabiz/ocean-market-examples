#!/usr/bin/env node
// Run the same checks Ocean Market runs when you upload, before you upload.
//   node tools/validate.mjs examples/embedded-top-customers [more folders…]
// Handles embedded apps, landing page templates, store themes and booking themes.
// Mirrors the platform rules (see docs/). The platform's result is the one that counts.
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { kindOf, listFiles, readJson } from './lib/files.mjs';
import { applySettings, CONTRAST_PAIRS, CORNER_SET_NAMES, contrastRatio, isGradient, PAGE_KEYS, parseColor, PRESET_NAMES, resolveTheme, TOKEN_KEYS } from './lib/booking-theme.mjs';

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

// ---------------------------------------------------------------- booking themes
const BK_TOP = ['$schema', 'name', 'version', 'extends', 'accent', 'tokens', 'fonts', 'corners', 'dark', 'pages', 'settings', 'fields', 'serviceKinds'];
const FONT_NAME = /^[A-Za-z0-9][A-Za-z0-9 -]{0,59}$/;
/** Page data each custom page can print (octabiz.ai/developers/docs/booking-themes). */
const PAGE_DATA = {
  hub: ['org', 'services'],
  service: ['org', 'service', 'timezone', 'error'],
  details: ['org', 'service', 'hold', 'questions', 'fields', 'timezone'],
  book: ['org', 'service', 'fields', 'timezone', 'error'],
  confirmed: ['org', 'service', 'appointment', 'confirmationMessage'],
  manage: ['org', 'service', 'appointment', 'canChange', 'cutoffText'],
  change: ['org', 'service', 'appointment', 'canChange', 'timezone'],
  cancel: ['org', 'service', 'appointment', 'canChange', 'cancellationMessage', 'refundText'],
};
/** What review needs on each custom page (§7.3 of the booking themes spec). */
const REQUIRED = {
  timezone: [/data-bk=["']timezone["']/, 'a time zone picker (<select data-bk="timezone">)'],
  cutoff: [/\{\{\s*(service\.)?cutoffText\s*\}\}/, 'the change/cancel cutoff ({{ service.cutoffText }})'],
  terms: [/data-bk=["']terms["']/, 'the Terms and Privacy line (data-bk="terms")'],
  powered: [/data-bk=["']powered-by["']/, '"Powered by Octabiz" (data-bk="powered-by")'],
  payment: [/data-bk=["']payment["']/, 'the payment frame (data-bk="payment")'],
  form: [/data-bk=["']fields["']/, 'the details form (data-bk="fields")'],
};
const NEEDS = { hub: ['powered'], book: ['timezone', 'cutoff', 'payment', 'form', 'terms', 'powered'], service: ['timezone', 'cutoff', 'powered'], details: ['cutoff', 'terms', 'powered'], confirmed: ['powered'], manage: ['cutoff', 'powered'], change: ['timezone', 'powered'], cancel: ['powered'] };

// Somewhere to type, other than choices: a text-like <input>, a <textarea> or editable content.
const TEXT_ENTRY_HTML = /<textarea\b|\bcontenteditable\b|<input\b(?![^>]*\btype\s*=\s*["']?(?:radio|checkbox|range|button|hidden)\b)[^>]*>/i;
const TEXT_ENTRY_JS = /createElement\(\s*["'](?:input|textarea)["']|\bcontentEditable\b|addEventListener\(\s*["'](?:keydown|keyup|keypress|beforeinput|paste)["']/;

const FIELD_TYPES = ['text', 'textarea', 'email', 'phone', 'url', 'number', 'select', 'multiselect', 'checkbox', 'date'];
const FIELD_KEYS = ['id', 'type', 'label', 'help', 'required', 'placeholder', 'options', 'display', 'min', 'max', 'step', 'unit', 'maxLength', 'dates', 'sensitive', 'appliesTo'];
const RESERVED_FIELDS = ['name', 'email', 'phone', 'notes', 'guests', 'address'];

/** fields: questions a theme adds to the booking form (docs/booking-themes.md → Custom fields). */
function fieldErrors(t) {
  const errs = [];
  const list = t.fields ?? [];
  if (!Array.isArray(list)) return ['fields must be a list'];
  if (list.length > 20) errs.push('fields: up to 20');
  const kindIds = (t.serviceKinds ?? []).map((k) => k.id);
  const seen = new Set();
  for (const f of list) {
    const at = `fields.${f.id ?? '?'}`;
    for (const k of Object.keys(f)) if (!FIELD_KEYS.includes(k)) errs.push(`${at}: unknown key "${k}"`);
    if (!/^[a-z][a-z0-9_]{0,31}$/.test(f.id ?? '')) errs.push(`${at}: id must be a-z, 0-9 and _, up to 32 characters`);
    else if (RESERVED_FIELDS.includes(f.id)) errs.push(`${at}: "${f.id}" is a built-in field, pick another id`);
    else if (seen.has(f.id)) errs.push(`${at}: id used twice`);
    seen.add(f.id);
    if (!FIELD_TYPES.includes(f.type)) errs.push(`${at}: type must be one of ${FIELD_TYPES.join(', ')}`);
    if (!f.label || f.label.length > 80) errs.push(`${at}: label is required, up to 80 characters`);
    if (f.help && f.help.length > 160) errs.push(`${at}: help is up to 160 characters`);
    if (['select', 'multiselect'].includes(f.type)) {
      if (!Array.isArray(f.options) || !f.options.length || f.options.length > 30) errs.push(`${at}: options needs 1–30 choices`);
      else if (f.options.some((o) => typeof o !== 'string' || !o || o.length > 60)) errs.push(`${at}: each option is text up to 60 characters`);
    } else if (f.options) errs.push(`${at}: options only go on select and multiselect`);
    if (f.display && !(['select', 'multiselect'].includes(f.type) && ['chips', 'list'].includes(f.display))) errs.push(`${at}: display is chips or list, on select and multiselect`);
    if (f.type === 'number' && f.min != null && f.max != null && f.min > f.max) errs.push(`${at}: min is above max`);
    if (f.maxLength != null && !(f.maxLength > 0 && f.maxLength <= (f.type === 'textarea' ? 2000 : 200))) errs.push(`${at}: maxLength is up to ${f.type === 'textarea' ? 2000 : 200}`);
    if (f.dates && !(f.type === 'date' && ['past', 'future'].includes(f.dates))) errs.push(`${at}: dates is past or future, on date fields`);
    for (const k of f.appliesTo ?? []) if (!kindIds.includes(k)) errs.push(`${at}: appliesTo "${k}" isn't one of your serviceKinds`);
  }
  return errs;
}

const KIND_KEYS = ['id', 'name', 'description', 'icon', 'time', 'capacity', 'pricing', 'settings', 'page', 'example'];
const SETTING_TYPES = ['number', 'money', 'select', 'text', 'checkbox'];
const SETTING_MAPS = ['capacity.total', 'capacity.maxPerBooking', 'time.minutes'];

/** serviceKinds: new kinds of booking built from the engine's blocks (docs → New service kinds). */
function kindErrors(t) {
  const errs = [];
  const list = t.serviceKinds ?? [];
  if (!Array.isArray(list)) return ['serviceKinds must be a list'];
  if (list.length > 5) errs.push('serviceKinds: up to 5');
  const fields = new Map((t.fields ?? []).map((f) => [f.id, f]));
  for (const k of list) {
    const at = `serviceKinds.${k.id ?? '?'}`;
    for (const key of Object.keys(k)) if (!KIND_KEYS.includes(key)) errs.push(`${at}: unknown key "${key}"`);
    if (!/^[a-z][a-z0-9_]{0,31}$/.test(k.id ?? '')) errs.push(`${at}: id must be a-z, 0-9 and _`);
    if (!k.name) errs.push(`${at}: name is required`);
    if (k.icon && !/^[a-z0-9-]+$/.test(k.icon)) errs.push(`${at}: icon is a Lucide icon name`);
    const settings = new Map((k.settings ?? []).map((st) => [st.id, st]));
    for (const st of k.settings ?? []) {
      if (!/^[a-z][a-z0-9_]{0,31}$/.test(st.id ?? '')) errs.push(`${at}.settings: id must be a-z, 0-9 and _`);
      if (!SETTING_TYPES.includes(st.type)) errs.push(`${at}.settings.${st.id}: type must be ${SETTING_TYPES.join(', ')}`);
      if (!st.label) errs.push(`${at}.settings.${st.id}: add a label, businesses see it`);
      if (st.maps && !SETTING_MAPS.includes(st.maps)) errs.push(`${at}.settings.${st.id}: maps must be ${SETTING_MAPS.join(', ')}`);
    }
    const mapsTo = (m) => (k.settings ?? []).some((st) => st.maps === m);
    const time = k.time ?? {};
    if (time.mode === 'fixed') { if (!mapsTo('time.minutes') && !(time.minutes > 0)) errs.push(`${at}.time: fixed needs minutes, or a setting that maps to time.minutes`); }
    else if (time.mode === 'choice') { if (!Array.isArray(time.options) || !time.options.length || time.options.some((m) => !(m >= 5 && m <= 1440))) errs.push(`${at}.time: choice needs options in minutes (5–1440)`); }
    else if (time.mode === 'range') {
      const { minMinutes: lo, maxMinutes: hi, stepMinutes: step } = time;
      if (!(lo >= 5 && hi <= 1440 && lo < hi && step >= 5 && (hi - lo) % step === 0)) errs.push(`${at}.time: range needs minMinutes < maxMinutes (up to 1440) and a stepMinutes that divides the gap`);
    } else errs.push(`${at}.time.mode must be fixed, choice or range`);
    const cap = k.capacity ?? {};
    if (!['one', 'seats', 'units'].includes(cap.mode)) errs.push(`${at}.capacity.mode must be one, seats or units`);
    else if (cap.mode !== 'one') {
      if (!mapsTo('capacity.total') && !(cap.total > 0)) errs.push(`${at}.capacity: ${cap.mode} needs a total, or a setting that maps to capacity.total`);
      if (cap.mode === 'units' && !cap.unitLabel) errs.push(`${at}.capacity: units needs a unitLabel (for example "kayak")`);
    }
    const pr = k.pricing ?? {};
    const ref = (r) => typeof r === 'string' && r.startsWith('settings.') && settings.get(r.slice(9))?.type === 'money';
    if (!Array.isArray(pr.per) || !pr.per.length || pr.per.some((p) => !['booking', 'person', 'unit', 'hour'].includes(p))) errs.push(`${at}.pricing.per: any of booking, person, unit, hour`);
    if (pr.per?.includes('unit') && cap.mode !== 'units') errs.push(`${at}.pricing: per unit needs capacity.mode units`);
    if (pr.per?.includes('hour') && time.mode === 'fixed') errs.push(`${at}.pricing: per hour needs a choice or range of times`);
    if (!ref(pr.rate)) errs.push(`${at}.pricing.rate must be settings.<id> of a money setting`);
    for (const a of pr.addOns ?? []) {
      const f = fields.get(a.field);
      if (!f || !['number', 'checkbox'].includes(f.type)) errs.push(`${at}.pricing.addOns: "${a.field}" must be a number or checkbox field`);
      else if (f.appliesTo && !f.appliesTo.includes(k.id)) errs.push(`${at}.pricing.addOns: "${a.field}" doesn't apply to this kind`);
      if (!ref(a.each)) errs.push(`${at}.pricing.addOns.${a.field}: each must be settings.<id> of a money setting`);
      if (!a.label) errs.push(`${at}.pricing.addOns.${a.field}: add a label, customers see it`);
    }
    if (!k.page) errs.push(`${at}: page is required (booking/<name>.html)`);
    else if (!/^booking\/[a-z0-9_-]+\.html$/i.test(k.page)) errs.push(`${at}.page must be booking/<name>.html`);
  }
  return errs;
}

function validateBookingTheme(dir) {
  const checks = [];
  let t;
  try {
    t = readJson(join(dir, 'theme.json'));
  } catch (e) {
    return [fail('theme.json matches the booking theme schema', e.message)];
  }
  const errs = [];
  for (const k of Object.keys(t)) if (!BK_TOP.includes(k)) errs.push(`unknown key "${k}"`);
  if (!t.name) errs.push('name is required');
  if (!SEMVER.test(t.version ?? '')) errs.push('version must look like 1.0.0');
  if (t.extends !== undefined && !PRESET_NAMES.includes(t.extends)) errs.push(`extends must be one of ${PRESET_NAMES.join(', ')}`);
  for (const [k, v] of Object.entries(t.tokens ?? {})) {
    if (!TOKEN_KEYS.includes(k)) errs.push(`tokens.${k} isn't a token`);
    else if (k !== 'shadow' && !(k === 'page' && isGradient(v)) && !parseColor(v)) errs.push(`tokens.${k}: "${v}" isn't a colour we can read (hex, rgb, hsl or oklch)`);
  }
  if (typeof t.corners === 'string' && !CORNER_SET_NAMES.includes(t.corners)) errs.push(`corners must be ${CORNER_SET_NAMES.join(', ')} or an object`);
  if (t.corners && typeof t.corners === 'object') {
    for (const [k, v] of Object.entries(t.corners)) if (!(parseFloat(v) >= 0 && parseFloat(v) <= 999)) errs.push(`corners.${k} must be 0–999px`);
  }
  for (const f of ['heading', 'body']) if (t.fonts?.[f] !== undefined && !FONT_NAME.test(t.fonts[f])) errs.push(`fonts.${f} must be a font family name`);
  for (const [k, v] of Object.entries(t.pages ?? {})) {
    if (!PAGE_KEYS.includes(k)) errs.push(`pages.${k} isn't a page you can override`);
    else if (!/^booking\/[a-z0-9_-]+\.html$/i.test(v)) errs.push(`pages.${k} must be booking/<name>.html`);
  }
  for (const st of t.settings ?? []) {
    if (!/^(accent|corners|fonts\.(heading|body)|tokens\.[A-Za-z]+)$/.test(st.maps ?? '')) errs.push(`settings.${st.id}: maps must be accent, corners, fonts.heading, fonts.body or tokens.<key>`);
    if (!st.label) errs.push(`settings.${st.id}: add a label — businesses see it when they install`);
  }
  errs.push(...fieldErrors(t), ...kindErrors(t));
  checks.push(errs.length ? fail('theme.json matches the booking theme schema', errs.slice(0, 6).join('; ')) : pass('theme.json matches the booking theme schema', `version ${t.version}`));
  if (errs.length) return checks;

  // An accent setting can't win over primary/soft written out in tokens (later keys win).
  const shadowed = (t.settings ?? []).filter((st) => st.maps === 'accent' && ['primary', 'soft'].some((k) => t.tokens?.[k] !== undefined));
  if (shadowed.length) checks.push(warn('Settings change what they say', `"${shadowed[0].label}" maps to accent, but tokens.primary/soft are set too, so it has no effect. Drop them from tokens, or map the setting to tokens.primary.`));

  if (t.pages?.book && (t.pages.service || t.pages.details)) checks.push(warn('Pages Octabiz will use', 'pages.book replaces service and details, so those two pages are never shown. Remove them.'));
  const notYet = (t.serviceKinds ?? []).filter((k) => k.capacity?.mode !== 'units' || k.pricing?.upfront);
  if (notYet.length) checks.push(warn('Octabiz can book these kinds', `${notYet.map((k) => k.id).join(', ')}: Octabiz books units kinds paid at the visit for now; seats, one and pay-when-booking kinds come later.`));

  const resolved = resolveTheme(applySettings(t));
  for (const [label, fg, bg, min] of CONTRAST_PAIRS) {
    const a = parseColor(resolved.tokens[fg]);
    const b = parseColor(resolved.tokens[bg]);
    if (!a || !b) continue;
    const ratio = contrastRatio(a, b);
    checks.push(ratio >= min ? pass(label, `${ratio.toFixed(1)}:1`) : fail(label, `${ratio.toFixed(1)}:1 — needs ${min}:1 or more`));
  }

  const unlicensed = (t.fonts?.files ?? []).filter((f) => !f.license);
  checks.push(unlicensed.length ? fail('Fonts are licensed', `add "license" to ${unlicensed.map((f) => f.family).join(', ')}, or use a Google Fonts family`) : pass('Fonts are licensed', `${t.fonts?.heading ?? 'preset'} · ${t.fonts?.body ?? 'preset'}`));

  const files = listFiles(dir);
  const pages = [...Object.entries(t.pages ?? {}), ...(t.serviceKinds ?? []).filter((k) => k.page).map((k) => ['book', k.page])];
  if (!pages.length) {
    checks.push(pass('Uses the built-in pages (tokens only)'));
    return checks;
  }

  const pageIssues = [];
  for (const [key, file] of pages) {
    if (!files.includes(file)) { pageIssues.push(`${file} is missing`); continue; }
    const html = readFileSync(join(dir, file), 'utf8');
    for (const need of NEEDS[key]) if (!REQUIRED[need][0].test(html)) pageIssues.push(`${file}: needs ${REQUIRED[need][1]}`);
    const roots = new Set(PAGE_DATA[key]);
    const outer = html.replace(/\{\{#each\s+([\w.]+)\s*\}\}[\s\S]*?\{\{\/each\}\}/g, (_m, k) => {
      if (!roots.has(k.split('.')[0])) pageIssues.push(`${file}: {{#each ${k}}} isn't data this page gets`);
      return '';
    });
    for (const m of outer.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) if (!roots.has(m[1].split('.')[0])) pageIssues.push(`${file}: {{ ${m[1]} }} isn't data this page gets`);
  }
  checks.push(pageIssues.length ? fail('Custom pages have what review needs', pageIssues.slice(0, 5).join('; ')) : pass('Custom pages have what review needs', pages.map(([k, f]) => (k === 'book' ? f.replace('booking/', '') : k)).join(', ')));

  const safety = [];
  for (const p of files) {
    if (!/\.(html?|css|js|json|svg|png|jpe?g|webp|woff2?|txt)$/i.test(p)) { safety.push(`${p}: file type isn't allowed`); continue; }
    if (!/\.(html?|css|js|svg)$/i.test(p)) continue;
    const text = readFileSync(join(dir, p), 'utf8');
    if (/\.html?$/i.test(p)) {
      if (/<script(?![^>]*\bsrc=)[^>]*>\s*\S/i.test(text)) safety.push(`${p}: inline <script> (put code in a .js file in the package)`);
      for (const m of text.matchAll(/<script[^>]*\bsrc=["']([^"']+)/gi)) if (!files.includes(m[1])) safety.push(`${p}: loads ${m[1]} (only scripts in your package are allowed)`);
      if (/\son[a-z]+\s*=/i.test(text)) safety.push(`${p}: on…= event attribute (use addEventListener)`);
      if (/<\s*(iframe|object|embed|base|form)\b/i.test(text)) safety.push(`${p}: <iframe>, <object>, <embed>, <base> and <form> aren't allowed`);
      for (const m of text.matchAll(/\b(?:src|href)\s*=\s*["']((?:https?:)?\/\/[^"']+)/gi)) safety.push(`${p}: loads ${m[1]} from another site`);
      if (/<meta[^>]+http-equiv\s*=\s*["']?refresh/i.test(text)) safety.push(`${p}: <meta http-equiv="refresh"> moves the page`);
      // Customers type only into Octabiz's own details form (data-bk="fields").
      if (TEXT_ENTRY_HTML.test(text)) safety.push(`${p}: asks the customer to type something outside data-bk="fields"`);
    }
    if (/\.js$/i.test(p)) {
      if (/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/.test(text)) safety.push(`${p}: makes its own network requests (use window.octabizBooking)`);
      if (/\beval\s*\(|new\s+Function\s*\(|document\.cookie|localStorage|(top|parent)\.location/.test(text)) safety.push(`${p}: uses eval, cookies, storage or moves the page`);
      if (/\blocation\s*(=|\.href\s*=|\.(assign|replace)\s*\()|\bwindow\.open\s*\(|document\.write/.test(text)) safety.push(`${p}: moves or rewrites its own page (use navigate())`);
      if (TEXT_ENTRY_JS.test(text)) safety.push(`${p}: makes its own text inputs or listens to typing (customers type only in data-bk="fields")`);
      try { new vm.Script(text, { filename: p }); } catch (e) { safety.push(`${p}: ${e.message}`); }
    }
    if (/\.css$/i.test(p) && /@import|url\s*\(\s*["']?(https?:)?\/\//i.test(text)) safety.push(`${p}: loads CSS or images from another site`);
  }
  checks.push(safety.length ? fail('No outside calls, inline scripts or event attributes', safety.slice(0, 5).join('; ')) : pass('No outside calls, inline scripts or event attributes'));

  const radius = [];
  for (const p of files.filter((f) => f.endsWith('.css'))) {
    for (const m of readFileSync(join(dir, p), 'utf8').matchAll(/border-radius\s*:\s*([^;}]+)/gi)) {
      if (!/var\(--bk-r/.test(m[1]) && !/^\s*0(px)?\s*$/.test(m[1])) radius.push(`${p}: border-radius ${m[1].trim()}`);
    }
  }
  checks.push(radius.length ? warn('Corners follow the corner tokens', `${radius.slice(0, 3).join('; ')} ignores the business's corner choice`) : pass('Corners follow the corner tokens'));

  const size = files.reduce((n, p) => n + statSync(join(dir, p)).size, 0);
  checks.push(size <= 5 * 1024 * 1024 ? pass('Package size', `${(size / 1024).toFixed(1)} KB`) : fail('Package size', 'over 5 MB'));
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
  const checks = kind === 'template' ? validateTemplate(dir)
    : kind === 'theme' ? validateTheme(dir)
    : kind === 'booking_theme' ? validateBookingTheme(dir)
    : validateApp(dir);
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
