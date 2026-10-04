// Booking themes: the same presets, corner sets, colour maths and merge rules Octabiz uses for
// the public booking pages (octabiz.ai/developers/docs/booking-themes). No dependencies.

export const PRESET_NAMES = ['octabiz', 'clean', 'studio', 'night'];
export const CORNER_SET_NAMES = ['square', 'soft', 'round', 'circle'];
export const TOKEN_KEYS = ['page', 'surface', 'ink', 'muted', 'line', 'primary', 'onPrimary', 'soft', 'cta', 'onCta', 'shadow'];
export const PAGE_KEYS = ['hub', 'service', 'details', 'confirmed', 'manage', 'change', 'cancel'];

export const CORNER_SETS = {
  square: { card: '0px', control: '0px', button: '0px', day: '0px', area: '0px' },
  soft: { card: '14px', control: '10px', button: '10px', day: '10px', area: '10px' },
  round: { card: '28px', control: '14px', button: '999px', day: '999px', area: '14px' },
  circle: { card: '40px', control: '999px', button: '999px', day: '999px', area: '24px' },
};

export const PRESETS = {
  octabiz: {
    tokens: {
      page: 'radial-gradient(900px 500px at 0% 0%,hsl(228 90% 94%),transparent 70%),radial-gradient(800px 500px at 100% 0%,hsl(262 80% 95%),transparent 70%),linear-gradient(160deg,hsl(214 44% 97%),hsl(220 22% 94%))',
      surface: '#ffffff', ink: 'hsl(222 25% 14%)', muted: 'hsl(220 9% 42%)', line: 'hsl(220 14% 91%)',
      primary: 'hsl(228 73% 56%)', onPrimary: '#ffffff', soft: 'hsl(228 90% 96%)', cta: 'hsl(222 25% 14%)', onCta: '#ffffff',
      shadow: '0 40px 80px -48px hsl(228 60% 30% / .45)',
    },
    fonts: { heading: 'Sora', body: 'Inter' },
    corners: { card: '28px', control: '12px', button: '999px', day: '999px', area: '14px' },
  },
  clean: {
    tokens: {
      page: '#f3f5f8', surface: '#ffffff', ink: '#1a1a1a', muted: '#5f6670', line: '#e3e6ea',
      primary: '#0b65e6', onPrimary: '#ffffff', soft: '#e8f0fd', cta: '#0b65e6', onCta: '#ffffff', shadow: '0 1px 8px rgba(0,0,0,.08)',
    },
    fonts: { heading: 'Inter', body: 'Inter' },
    corners: { card: '10px', control: '8px', button: '999px', day: '999px', area: '8px' },
  },
  studio: {
    tokens: {
      page: '#ede6db', surface: '#fbf8f3', ink: '#1f1b16', muted: '#5f564c', line: '#e2d8ca',
      primary: '#9a3f1c', onPrimary: '#fbf8f3', soft: '#f1e4d8', cta: '#1f1b16', onCta: '#fbf8f3', shadow: '0 30px 60px -44px rgba(60,40,20,.5)',
    },
    fonts: { heading: 'Newsreader', body: 'IBM Plex Sans' },
    corners: { card: '6px', control: '4px', button: '4px', day: '4px', area: '4px' },
  },
  night: {
    tokens: {
      page: 'radial-gradient(900px 600px at 10% -10%,hsl(228 70% 22%),transparent 60%),radial-gradient(700px 500px at 100% 0%,hsl(262 60% 20%),transparent 60%),hsl(226 45% 8%)',
      surface: 'hsl(226 35% 12%)', ink: 'hsl(220 30% 96%)', muted: 'hsl(220 20% 72%)', line: 'hsl(226 25% 22%)',
      primary: 'hsl(228 100% 76%)', onPrimary: 'hsl(226 45% 10%)', soft: 'hsl(228 50% 20%)', cta: '#ffffff', onCta: 'hsl(226 45% 10%)',
      shadow: '0 40px 80px -40px rgba(0,0,0,.7)',
    },
    fonts: { heading: 'Sora', body: 'Inter' },
    corners: { card: '28px', control: '12px', button: '999px', day: '999px', area: '14px' },
  },
};

// ------------------------------------------------------------------ colour maths
const clamp01 = (n) => Math.min(1, Math.max(0, n));
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c) => clamp01(c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function oklabToRgb(L, A, B) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return {
    r: fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}
function rgbToOklab({ r, g, b }) {
  const [lr, lg, lb] = [r, g, b].map(toLinear);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

/** hex, rgb(), hsl(), oklch() and the color-mix(in oklab, a N%, b) the accent shortcut writes. */
export function parseColor(input) {
  if (typeof input !== 'string') return null;
  const v = input.trim().toLowerCase();
  const mix = /^color-mix\(\s*in\s+oklab\s*,\s*(.+?)\s+(\d+(?:\.\d+)?)%\s*,\s*(.+)\)$/.exec(v);
  if (mix) {
    const a = parseColor(mix[1]);
    const b = parseColor(mix[3]);
    if (!a || !b) return null;
    const w = parseFloat(mix[2]) / 100;
    const [l1, a1, b1] = rgbToOklab(a);
    const [l2, a2, b2] = rgbToOklab(b);
    return oklabToRgb(l1 * w + l2 * (1 - w), a1 * w + a2 * (1 - w), b1 * w + b2 * (1 - w));
  }
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255 };
  }
  const fn = /^(rgba?|hsla?|oklch)\((.*)\)$/.exec(v);
  if (!fn) return null;
  const p = fn[2].split('/')[0].replace(/,/g, ' ').trim().split(/\s+/);
  if (p.length < 3 || p.slice(0, 3).some((x) => Number.isNaN(parseFloat(x)))) return null;
  const n = p.map((x) => parseFloat(x));
  if (fn[1].startsWith('rgb')) return { r: clamp01(n[0] / 255), g: clamp01(n[1] / 255), b: clamp01(n[2] / 255) };
  if (fn[1].startsWith('hsl')) {
    const [h, s, l] = [((n[0] % 360) + 360) % 360, clamp01(n[1] / 100), clamp01(n[2] / 100)];
    const k = (x) => (x + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (x) => l - a * Math.max(-1, Math.min(k(x) - 3, Math.min(9 - k(x), 1)));
    return { r: f(0), g: f(8), b: f(4) };
  }
  const L = p[0].endsWith('%') ? n[0] / 100 : n[0];
  const H = (n[2] * Math.PI) / 180;
  return oklabToRgb(L, n[1] * Math.cos(H), n[1] * Math.sin(H));
}

export function contrastRatio(a, b) {
  const lum = ({ r, g, b: bl }) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(bl);
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const isGradient = (v) => /(linear|radial|conic)-gradient\(/i.test(v);
const safeCss = (v) => typeof v === 'string' && v.length <= 600 && !/[;{}<>\\]|url\s*\(|@import/i.test(v);

// ------------------------------------------------------------------ resolution
/** Applies a theme's `settings` defaults (or chosen values) onto the manifest. */
export function applySettings(manifest, values = {}) {
  const next = { ...manifest, tokens: { ...manifest.tokens }, fonts: { ...manifest.fonts } };
  for (const s of manifest.settings ?? []) {
    const v = values[s.id] ?? s.default;
    if (v === undefined || v === '') continue;
    if (s.maps === 'accent') next.accent = v;
    else if (s.maps === 'corners') next.corners = v;
    else if (s.maps === 'fonts.heading' || s.maps === 'fonts.body') next.fonts[s.maps.slice(6)] = v;
    else if (s.maps.startsWith('tokens.')) next.tokens[s.maps.slice(7)] = v;
  }
  return next;
}

/** Octabiz base preset → this theme (its `extends` picks the base). Later wins, key by key. */
export function resolveTheme(manifest) {
  const base = PRESETS[manifest.extends] ?? PRESETS.octabiz;
  const tokens = { ...base.tokens };
  const explicit = manifest.tokens ?? {};
  if (safeCss(explicit.surface) && parseColor(explicit.surface)) tokens.surface = explicit.surface;
  if (manifest.accent && parseColor(manifest.accent)) {
    const white = parseColor('#ffffff');
    tokens.primary = manifest.accent;
    tokens.onPrimary = contrastRatio(parseColor(manifest.accent), white) < 4.5 ? '#0e1014' : '#ffffff';
    tokens.soft = `color-mix(in oklab, ${manifest.accent} 11%, ${tokens.surface})`;
  }
  for (const k of TOKEN_KEYS) {
    const v = explicit[k];
    if (!safeCss(v)) continue;
    if (k === 'shadow' || (k === 'page' && isGradient(v)) || parseColor(v)) tokens[k] = v;
  }
  let corners = { ...base.corners };
  if (typeof manifest.corners === 'string' && CORNER_SETS[manifest.corners]) corners = { ...CORNER_SETS[manifest.corners] };
  else if (manifest.corners && typeof manifest.corners === 'object') {
    for (const k of Object.keys(corners)) {
      const n = parseFloat(manifest.corners[k]);
      if (Number.isFinite(n) && n >= 0 && n <= 999) corners[k] = `${n}px`;
    }
  }
  const fonts = { heading: manifest.fonts?.heading ?? base.fonts.heading, body: manifest.fonts?.body ?? base.fonts.body };
  return { tokens, corners, fonts };
}

const serif = (f) => /serif|news|playfair|lora|fraunces|garamond/i.test(f) && !/sans/i.test(f);

/** Every token as the --bk-* CSS variable the booking pages read. */
export function cssVars({ tokens: t, corners: c, fonts: f }) {
  const stack = (x) => `'${x}', ${serif(x) ? 'Georgia, serif' : 'system-ui, sans-serif'}`;
  return {
    '--bk-page': t.page, '--bk-surface': t.surface, '--bk-ink': t.ink, '--bk-muted': t.muted, '--bk-line': t.line,
    '--bk-primary': t.primary, '--bk-on-primary': t.onPrimary, '--bk-soft': t.soft, '--bk-cta': t.cta, '--bk-on-cta': t.onCta,
    '--bk-shadow': t.shadow, '--bk-head': stack(f.heading), '--bk-body': stack(f.body),
    '--bk-r': c.card, '--bk-r-sm': c.control, '--bk-r-btn': c.button, '--bk-r-day': c.day, '--bk-r-area': c.area,
  };
}

/** The contrast pairs Octabiz requires before a theme can be saved or submitted. */
export const CONTRAST_PAIRS = [
  ['Text on the accent (selected day, Next)', 'onPrimary', 'primary', 4.5],
  ['Text on the main button', 'onCta', 'cta', 4.5],
  ['Main text on the card', 'ink', 'surface', 4.5],
  ['Secondary text on the card', 'muted', 'surface', 4.5],
  ['Open-day numbers on their fill', 'primary', 'soft', 3],
];

export function googleFontsHref(fonts) {
  const fams = [...new Set([fonts.heading, fonts.body])].map((f) => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700`);
  return `https://fonts.googleapis.com/css2?${fams.join('&')}&display=swap`;
}
