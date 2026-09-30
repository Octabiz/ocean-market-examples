// The same tiny template language Ocean Market uses: {{ key }} (HTML-escaped) and one
// repeat block, {{#each list}}…{{/each}} with item fields, {{ this }} and {{ @number }}.
// (The platform also runs the result through an HTML sanitizer; see docs/landing-templates.md.)
function escapeHtml(value) {
  return (value == null ? '' : String(value))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function lookup(scope, path) {
  return path.split('.').reduce((acc, k) => (acc && typeof acc === 'object' && k in acc ? acc[k] : undefined), scope);
}
const substitute = (tpl, scope) => tpl.replace(/\{\{\s*([\w.@]+)\s*\}\}/g, (_m, p) => escapeHtml(lookup(scope, p)));

export function renderTemplate(template, config) {
  const expanded = template.replace(/\{\{#each\s+([\w.]+)\s*\}\}([\s\S]*?)\{\{\/each\}\}/g, (_m, path, body) => {
    const list = lookup(config, path);
    if (!Array.isArray(list)) return '';
    return list.slice(0, 100).map((item, i) => {
      const own = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
      return substitute(body, { ...config, ...own, this: item, '@index': i, '@number': i + 1 });
    }).join('');
  });
  return substitute(expanded, config);
}

/** "#0E7C66" → "164 80% 27%" (the HSL triple format the page builder's --primary uses). */
export function hexToHslTriple(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0, sat = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue *= 60;
  }
  return `${Math.round(hue)} ${Math.round(sat * 100)}% ${Math.round(l * 100)}%`;
}
