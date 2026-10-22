// Preview pages for booking themes: the built-in Octabiz booking screens drawn with the theme's
// tokens, or the theme's own page (pages.<step>) rendered with sample data and the mock SDK.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readJson } from './files.mjs';
import { renderTemplate } from './render.mjs';
import { applySettings, cssVars, googleFontsHref, resolveTheme } from './booking-theme.mjs';
import { SAMPLE, GUEST_FIELDS, BUSINESS_FIELDS } from '../booking-host/sample-data.mjs';

/** The sample for the page being drawn: SAMPLE, with the example's preview.json on top. */
let S = SAMPLE;

export const PREVIEW_STEPS = [
  ['service', 'Service page'],
  ['service-day', 'Time picked'],
  ['details', 'Your details'],
  ['confirmed', 'Booked'],
  ['manage', 'Manage'],
  ['taken', 'Error: time just taken'],
];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ICON = {
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  left: '<path d="M15 18l-6-6 6-6"/>',
  right: '<path d="M9 18l6-6-6-6"/>',
};
const icon = (name, size = 18, w = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

/** A sample "booked" day: the next weekday after tomorrow. */
function sampleDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 2);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}
const fmt = (d, o) => new Intl.DateTimeFormat('en-US', o).format(d);
const time = (h) => `${h % 12 || 12}:00${h < 12 ? 'am' : 'pm'}`;

function leftPanel({ back = false, when = null, about = false }) {
  const s = S.service;
  return `<aside class="bkp-left">
  <div class="bkp-brand-row">${back ? `<button class="bkp-back" aria-label="Back">${icon('left', 18, 2.2)}</button>` : ''}<span class="bkp-logo">${esc(S.org.initial)}</span><span class="bkp-org-name">${esc(S.org.name)}</span></div>
  <div style="display:flex;flex-direction:column;gap:8px"><div class="bkp-host"><span class="bkp-avatar">${esc(s.host.name.split(' ').map((w) => w[0]).join('').slice(0, 2))}</span><span class="bkp-host-name">${esc(s.host.name)}</span></div><h1 class="bkp-title">${esc(s.name)}</h1></div>
  <div class="bkp-meta">
    <div class="bkp-meta-row">${icon('clock')}${s.durationMin} min</div>
    <div class="bkp-meta-row">${icon('pin')}<span>${esc(s.location.label)}</span></div>
    <div class="bkp-meta-row">${icon('tag')}${esc(s.priceText)}</div>
    ${when ? `<div class="bkp-when">${icon('cal')}<span><span class="bkp-when-label">${when[0]}</span>${esc(when[1])}</span></div><div class="bkp-meta-row">${icon('globe')}Your time zone</div>` : ''}
  </div>
  ${about ? `<div class="bkp-about"><p class="bkp-about-text">${esc(s.description)}</p>${s.highlights.map((h) => `<div class="bkp-cover">${icon('check', 16, 2.6)}<span>${esc(h)}</span></div>`).join('')}</div>` : ''}
  <p class="bkp-cutoff">${esc(s.cutoffText)}</p>
</aside>`;
}

function calendar(dayPicked, booked) {
  const first = new Date(booked.getFullYear(), booked.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const dim = new Date(booked.getFullYear(), booked.getMonth() + 1, 0).getDate();
  const today = new Date();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span></span>');
  for (let n = 1; n <= dim; n++) {
    const d = new Date(booked.getFullYear(), booked.getMonth(), n);
    const off = Math.round((d - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 864e5);
    const open = off >= 1 && d.getDay() > 0 && d.getDay() < 6 && off % 11 !== 4;
    const sel = dayPicked && n === booked.getDate();
    cells.push(`<span class="bkp-day-cell"><button class="bkp-day" data-open="${open}" aria-pressed="${sel}">${n}${off === 0 ? '<span class="bkp-day-dot"></span>' : ''}</button></span>`);
  }
  return `<div class="bkp-cal">
  <div class="bkp-month-head"><button class="bkp-month-btn" aria-label="Previous month" disabled>${icon('left', 16, 2.4)}</button><span class="bkp-month-label">${fmt(booked, { month: 'long', year: 'numeric' })}</span><button class="bkp-month-btn" aria-label="Next month">${icon('right', 16, 2.4)}</button></div>
  <div class="bkp-grid">${['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((w) => `<span class="bkp-wd">${w}</span>`).join('')}${cells.join('')}</div>
  <div class="bkp-tz"><span class="bkp-tz-label">Time zone</span><div class="bkp-tz-field">${icon('globe', 16)}<select><option>Your time zone</option></select></div></div>
</div>`;
}

function builtinScreen(step) {
  const booked = sampleDay();
  const day = fmt(booked, { weekday: 'long', month: 'long', day: 'numeric' });
  const endMin = 600 + (S.service.durationMin || 60);
  const until = `${time(Math.floor(endMin / 60)).replace(':00', `:${String(endMin % 60).padStart(2, '0')}`)}`;
  const range = `10:00am – ${until}, ${day}, ${booked.getFullYear()}`;
  const page = (width, inner) => `<div class="bkp-page"><div class="bkp-card" style="max-width:${width}"><div class="bkp-card-inner">${inner}</div></div><p class="bkp-footer">Powered by <b>Octabiz</b></p></div>`;

  if (step === 'details') {
    return page('940px', `${leftPanel({ back: true, when: ['Your time', range] })}<section class="bkp-right"><div class="bkp-form">
  <h2 class="bkp-h2">Enter your details</h2>
  <div data-bk="fields"></div>
  <div style="display:flex;flex-direction:column;gap:10px;padding-top:6px"><button class="bkp-btn bkp-btn-cta bkp-btn-book" id="bkp-book">Book it</button><p class="bkp-fine">By booking, you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.</p></div>
</div></section>`);
  }
  if (step === 'confirmed') {
    return page('640px', `<section class="bkp-right"><div class="bkp-done">
  <span class="bkp-check">${icon('check', 30, 3)}</span>
  <h2 class="bkp-done-title">You’re booked, ${esc(S.guest.name.split(' ')[0])}</h2>
  <p class="bkp-done-sub">A calendar invite with the address is on its way to ${esc(S.guest.email)}.</p>
  <div class="bkp-summary"><div class="bkp-date-tile"><div class="bkp-date-tile-mon">${fmt(booked, { month: 'short' }).toUpperCase()}</div><div class="bkp-date-tile-num">${booked.getDate()}</div></div>
    <div style="min-width:0;flex:1"><div class="bkp-summary-title">${esc(S.service.name)} with ${esc(S.service.host.name)}</div><div style="font-size:14px;margin-top:2px">${day} · 10:00am – ${until}</div><div class="bkp-muted" style="font-size:13px;margin-top:2px">${esc(S.service.location.label)}</div></div></div>
  <div class="bkp-cal-adds"><span class="bkp-muted" style="font-size:13px;margin-right:4px">Add to calendar</span><a class="bkp-cal-add" href="#">Google</a><a class="bkp-cal-add" href="#">Outlook</a><button class="bkp-cal-add">Apple (.ics)</button></div>
  <p class="bkp-soft-box">${esc(S.confirmationMessage)}</p>
  <p class="bkp-muted" style="margin-top:10px;font-size:13.5px">Plans changed? <a href="#" style="color:var(--bk-primary);font-weight:600;text-decoration:none">Change or cancel</a></p>
</div></section>`);
  }
  if (step === 'manage') {
    return page('900px', `${leftPanel({ when: ['Booked for', range] })}<section class="bkp-right"><div class="bkp-stack" style="gap:16px;max-width:480px">
  <span class="bkp-muted" style="font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase">Your appointment</span>
  <h2 class="bkp-h2" style="font-size:24px;margin-top:-8px">${fmt(booked, { weekday: 'short', month: 'short', day: 'numeric' })} at 10:00am</h2>
  <p class="bkp-muted" style="font-size:14.5px;line-height:1.5">You can change or cancel online up to 1 day before. After that, call us at ${esc(S.org.phone)}.</p>
  <div style="display:flex;flex-direction:column;gap:10px"><button class="bkp-btn bkp-btn-cta">Change time</button><button class="bkp-btn bkp-btn-danger-outline">Cancel appointment</button></div>
</div></section>`);
  }
  const picked = step === 'service-day';
  const notice = step === 'taken' ? `<div class="bkp-notice">10:00am on ${fmt(booked, { weekday: 'short', month: 'short', day: 'numeric' })} was just booked by someone else. Pick another time.</div>` : '';
  const times = [9, 10, 11, 13, 14, 15, 16]
    .map((h) => (h === 10 ? `<div class="bkp-split"><span class="bkp-split-time">${time(h)}</span><button class="bkp-split-next">Next</button></div>` : `<button class="bkp-time">${time(h)}</button>`))
    .join('');
  return page(picked ? '1060px' : '820px', `${leftPanel({ about: true })}<section class="bkp-right"><div class="bkp-stack">
  <h2 class="bkp-h2">Select a date &amp; time</h2>${notice}
  <div class="bkp-picker">${calendar(picked, booked)}${picked ? `<div class="bkp-times"><span class="bkp-day-title">${day}</span><div class="bkp-time-list">${times}</div></div>` : ''}</div>
</div></section>`);
}

/** Where a step comes from: the theme's own page, or the built-in one. */
function pageKeyFor(step) {
  return step === 'service' || step === 'service-day' || step === 'taken' ? 'service' : step === 'confirmed' ? 'confirmed' : step;
}

const money = (n, currency) => new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: n % 1 ? 2 : 0 }).format(n);
const plural = (cap, n) => (n === 1 ? cap.unitLabel : cap.unitLabelPlural ?? `${cap.unitLabel}s`);

/** A sample service of a theme's own kind, set up with the kind's default settings. */
function kindService(kind, base) {
  const values = Object.fromEntries((kind.settings ?? []).map((st) => [st.id, st.default ?? '']));
  const mapped = (target) => {
    const st = (kind.settings ?? []).find((x) => x.maps === target);
    return st ? Number(values[st.id]) : undefined;
  };
  const capacity = { ...kind.capacity, total: mapped('capacity.total') ?? kind.capacity?.total ?? 1, maxPerBooking: mapped('capacity.maxPerBooking') ?? kind.capacity?.maxPerBooking ?? 1 };
  const time = { ...kind.time, minutes: mapped('time.minutes') ?? kind.time?.minutes };
  const currency = base.price.currency;
  const rate = Number(values[String(kind.pricing?.rate ?? '').replace(/^settings\./, '')]) || 0;
  const per = (kind.pricing?.per ?? []).filter((p) => p !== 'booking').map((p) => (p === 'unit' ? capacity.unitLabel : p));
  return {
    ...base,
    ...kind.example,
    id: `svc_${kind.id}`,
    durationMin: time.minutes ?? time.minMinutes ?? time.options?.[0] ?? base.durationMin,
    price: { amount: null, currency, upfront: !!kind.pricing?.upfront },
    priceText: `${money(rate, currency)}${per.length ? ` per ${per.join(', per ')}` : ''}`,
    kind: { id: kind.id, name: kind.name, icon: kind.icon, time, capacity, pricing: kind.pricing, settings: values },
  };
}

/** What a business fills in when it adds a service of this kind (Bookings → Services → New service). */
function setupScreen(kind, service) {
  const cur = service.price.currency;
  const k = service.kind;
  const t = kind.time ?? {};
  const timeWords = t.mode === 'range' ? `Customers pick ${t.minMinutes / 60}–${t.maxMinutes / 60} hours, in ${t.stepMinutes} minute steps.`
    : t.mode === 'choice' ? `Customers pick ${t.options.map((m) => `${m} min`).join(', ')}.`
    : `Every booking is ${k.time.minutes ?? service.durationMin} minutes.`;
  const capWords = k.capacity.mode === 'units' ? `Up to ${k.capacity.maxPerBooking} ${plural(k.capacity, 2)} per booking, from ${k.capacity.total} you have.`
    : k.capacity.mode === 'seats' ? `Up to ${k.capacity.total} people share a time.` : 'One booking per time.';
  const fieldsHtml = (kind.settings ?? []).map((st) => {
    const v = st.default ?? '';
    const input = st.type === 'select' ? `<select class="bkp-input">${(st.options ?? []).map((o) => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`
      : st.type === 'checkbox' ? `<input type="checkbox"${v ? ' checked' : ''}>`
      : st.type === 'money' ? `<span style="display:flex;align-items:center;gap:8px"><span class="bkp-muted">${esc(cur)}</span><input class="bkp-input" inputmode="decimal" value="${esc(v)}"></span>`
      : `<input class="bkp-input"${st.type === 'number' ? ' inputmode="numeric"' : ''} value="${esc(v)}">`;
    return `<label class="bkp-field">${esc(st.label)}${input}</label>`;
  }).join('');
  return `<div class="bkp-page"><div class="bkp-card" style="max-width:620px"><div class="bkp-card-inner"><section class="bkp-right"><div class="bkp-stack" style="gap:18px">
  <span class="bkp-muted" style="font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase">New service · ${esc(kind.name)}</span>
  <h2 class="bkp-h2" style="margin-top:-8px">${esc(service.name)}</h2>
  <p class="bkp-muted" style="margin:0;line-height:1.5">${esc(kind.description ?? '')}</p>
  <div class="bkp-form" style="gap:14px">${fieldsHtml}</div>
  <div class="bkp-soft-box" style="display:flex;flex-direction:column;gap:6px"><span>${esc(timeWords)}</span><span>${esc(capWords)}</span><span>Price: ${esc(service.priceText)}.</span></div>
  <button class="bkp-btn bkp-btn-cta">Save service</button>
</div></section></div></div><p class="bkp-footer">What a business fills in when it adds a service of this kind in Octabiz</p></div>`;
}

export function bookingPreviewPage(dir, url) {
  const manifest = readJson(join(dir, 'theme.json'));
  const extra = existsSync(join(dir, 'preview.json')) ? readJson(join(dir, 'preview.json')) : {};
  const settings = Object.fromEntries([...url.searchParams].filter(([k]) => (manifest.settings ?? []).some((s) => s.id === k)));
  const theme = resolveTheme(applySettings(manifest, settings));
  const vars = Object.entries(cssVars(theme)).map(([k, v]) => `${k}:${v}`).join(';');

  const kinds = manifest.serviceKinds ?? [];
  const kind = kinds.find((k) => k.id === url.searchParams.get('kind')) ?? kinds[0] ?? null;
  const baseService = { ...SAMPLE.service, ...extra.service };
  const service = kind ? kindService(kind, baseService) : baseService;
  S = { ...SAMPLE, ...extra, org: { ...SAMPLE.org, ...extra.org }, guest: { ...SAMPLE.guest, ...extra.guest }, service };
  const themeFields = (manifest.fields ?? []).filter((f) => !f.appliesTo || (kind && f.appliesTo.includes(kind.id)));
  const fields = [...GUEST_FIELDS, ...(extra.businessFields ?? BUSINESS_FIELDS), ...themeFields];

  const bookPage = kind?.page ?? manifest.pages?.book;
  const steps = bookPage
    ? [['book', 'Book page'], ['taken', 'Error: time just taken'], ...(service.price.upfront ? [['payment', 'Error: card declined']] : []), ['confirmed', 'Booked'], ['manage', 'Manage'], ...(kind ? [['setup', 'Business setup']] : [])]
    : PREVIEW_STEPS;
  const step = url.searchParams.get('step') ?? steps[0][0];
  const own = bookPage && ['book', 'taken', 'payment'].includes(step) ? bookPage : manifest.pages?.[pageKeyFor(step)];
  const keep = new URLSearchParams(url.searchParams);
  const link = (s) => {
    keep.set('step', s);
    if (s === 'taken' || s === 'payment') keep.set('error', s);
    else keep.delete('error');
    return `?${keep}`;
  };

  const data = { ...S, fields, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  // The page data and the mock SDK, as Octabiz puts them on every booking page.
  const sdk = `<script>window.__octabizBookingPage=${JSON.stringify(data).replace(/</g, '\\u003c')}</script><script src="/__booking/octabiz-booking-mock.js" defer></script>`;
  let body;
  if (step === 'setup' && kind) {
    body = `<link rel="stylesheet" href="/__booking/builtin.css">${setupScreen(kind, service)}`;
  } else if (own && existsSync(join(dir, own))) {
    // Level 2: the theme's template with sample page data. It loads its own CSS/JS from the package.
    body = `${sdk}${renderTemplate(readFileSync(join(dir, own), 'utf8'), data).replace(/<script src="booking\//g, '<script defer src="booking/')}`;
  } else {
    body = `${sdk}<link rel="stylesheet" href="/__booking/builtin.css">${builtinScreen(step)}`;
  }

  const bar = steps.map(([s, label]) => `<a href="${link(s)}" class="${s === step ? 'on' : ''}${s === 'taken' || s === 'payment' ? ' err' : ''}">${label}</a>`).join('');
  const controls = (manifest.settings ?? [])
    .map((s) => {
      const v = settings[s.id] ?? s.default ?? '';
      if (s.type === 'select') return `<label>${esc(s.label)} <select name="${esc(s.id)}">${(s.options ?? []).map((o) => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
      if (s.type === 'color') return `<label>${esc(s.label)} <input type="color" name="${esc(s.id)}" value="${esc(/^#[0-9a-f]{6}$/i.test(v) ? v : '#4f6bed')}"></label>`;
      return `<label>${esc(s.label)} <input name="${esc(s.id)}" value="${esc(v)}" size="12"></label>`;
    })
    .join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(manifest.name)} — booking theme preview</title>
<link rel="stylesheet" href="${googleFontsHref(theme.fonts)}">
<style>
body{margin:0}
.bk-preview-bar{position:sticky;top:0;z-index:5;background:#151b2b;color:#fff;font:12px/1 system-ui,sans-serif;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;padding:10px 16px}
.bk-preview-bar[hidden]{display:none}
.bk-preview-bar b{letter-spacing:.08em;text-transform:uppercase;color:#a9b2c6;margin-right:4px}
.bk-preview-bar a{color:#d9def0;text-decoration:none;border:1px solid #3a4560;border-radius:999px;padding:6px 10px;font-weight:600}
.bk-preview-bar a.on{background:#fff;color:#151b2b;border-color:#fff}.bk-preview-bar a.err{border-color:#7a3a4a;color:#f3b7c4}
.bk-preview-bar form{margin-left:auto;display:flex;flex-wrap:wrap;gap:10px;align-items:center}.bk-preview-bar label{display:flex;gap:6px;align-items:center;color:#d9def0}
.bk-preview-bar select,.bk-preview-bar input{font:inherit}
</style></head>
<body><nav class="bk-preview-bar"${url.searchParams.get('bar') === '0' ? ' hidden' : ''}><b>${esc(manifest.name)}</b>${bar}${controls ? `<form method="get"><input type="hidden" name="step" value="${esc(step)}">${controls}<button>Apply</button></form>` : ''}</nav>
<div class="bkp-root" style="${esc(vars)}">${body}</div></body></html>`;
}
