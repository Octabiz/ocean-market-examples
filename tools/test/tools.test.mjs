// node --test tools/test/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { validate, contrast } from '../validate.mjs';
import { renderTemplate, hexToHslTriple } from '../lib/render.mjs';
import { createZip } from '../lib/zip.mjs';

const EX = new URL('../../examples/', import.meta.url).pathname;
const copy = (name) => {
  const dir = mkdtempSync(join(tmpdir(), 'om-'));
  cpSync(join(EX, name), dir, { recursive: true });
  return dir;
};
const failed = (r) => r.checks.filter((c) => c.status === 'fail').map((c) => c.label);

test('every example passes', () => {
  for (const name of ['embedded-top-customers', 'embedded-birthday-reminders', 'landing-template-bright-clinic', 'store-theme-harbor-linen']) {
    const r = validate(join(EX, name));
    assert.equal(r.ok, true, `${name}: ${failed(r).join(', ')}`);
  }
});

test('templates: url() in CSS, a script, and a stray {{ key }} are caught', () => {
  const dir = copy('landing-template-bright-clinic');
  writeFileSync(join(dir, 'sections/hero.css'), readFileSync(join(dir, 'sections/hero.css'), 'utf8') + '.x{background:url(a.png)}');
  writeFileSync(join(dir, 'sections/nav.html'), readFileSync(join(dir, 'sections/nav.html'), 'utf8') + '<script>alert(1)</script>{{ nope }}');
  const f = failed(validate(dir));
  assert.ok(f.includes('HTML and CSS pass the page safety filter'));
  assert.ok(f.includes('No scripts and no calls to outside services'));
  assert.ok(f.some((l) => l.includes('page sections found')));
  rmSync(dir, { recursive: true });
});

test('themes: low contrast and unknown fonts fail', () => {
  const dir = copy('store-theme-harbor-linen');
  const t = JSON.parse(readFileSync(join(dir, 'theme.json'), 'utf8'));
  t.colors.muted = '#B0B0B0';
  writeFileSync(join(dir, 'theme.json'), JSON.stringify(t));
  assert.deepEqual(failed(validate(dir)), ['Muted on surface']);
  t.fonts.body.family = 'Comic Sans';
  writeFileSync(join(dir, 'theme.json'), JSON.stringify(t));
  assert.deepEqual(failed(validate(dir)), ['Matches theme schema']);
  rmSync(dir, { recursive: true });
});

test('apps: inline script, CDN script, syntax error and missing index.html fail', () => {
  const dir = copy('embedded-top-customers');
  writeFileSync(join(dir, 'index.html'), '<script>alert(1)</script><script src="https://cdn.example.com/x.js"></script>');
  writeFileSync(join(dir, 'broken.js'), 'function (');
  const f = failed(validate(dir));
  assert.ok(f.includes('Malware and CSP scan'));
  assert.ok(f.includes('Lint & build'));
  rmSync(join(dir, 'index.html'));
  assert.ok(failed(validate(dir)).includes('index.html at the top of the package'));
  rmSync(dir, { recursive: true });
});

test('renderer: escaping, each, this and @number', () => {
  assert.equal(renderTemplate('<b>{{ a }}</b>', { a: '<x>' }), '<b>&lt;x&gt;</b>');
  assert.equal(renderTemplate('{{#each s}}{{ @number }}.{{ name }} {{ shop }};{{/each}}', { shop: 'S', s: [{ name: 'A' }, { name: 'B' }] }), '1.A S;2.B S;');
  assert.equal(renderTemplate('{{#each t}}[{{ this }}]{{/each}}', { t: ['x', 'y'] }), '[x][y]');
  assert.equal(hexToHslTriple('#0E7C66'), '168 80% 27%');
  assert.ok(contrast('#000000', '#FFFFFF') > 20);
});

test('zip: the archive lists and extracts (checked with unzip when available)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'om-zip-'));
  const zip = createZip([{ path: 'index.html', data: Buffer.from('<p>hi</p>'.repeat(50)) }, { path: 'a/b.txt', data: Buffer.from('x') }]);
  writeFileSync(join(dir, 't.zip'), zip);
  try {
    const out = execFileSync('unzip', ['-t', join(dir, 't.zip')]).toString();
    assert.match(out, /No errors detected/);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  rmSync(dir, { recursive: true });
});
