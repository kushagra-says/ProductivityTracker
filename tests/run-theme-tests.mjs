// Pre-commit tests for the monochrome (white accent, dark theme) mode's
// pure color math in src/utils/colors.js. theme.js itself imports React
// Native and cannot load in plain Node — the provider wiring (accent key
// lists, brown → white migration, mono() identity) is covered by manual
// device checks in tests.md.
//
// Usage: node tests/run-theme-tests.mjs
// Exit code: 0 = all pass, 1 = at least one fail.

import { desaturateHex, monochromePalette } from '../src/utils/colors.js';

let pass = 0, fail = 0, partial = 0;
const results = [];

function record(id, status, reason) {
  results.push({ id, status, reason });
  if (status === 'PASS') pass++;
  else if (status === 'PARTIAL') partial++;
  else fail++;
}

function expect(id, actual, expected, reason) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  record(id, ok ? 'PASS' : 'FAIL',
    ok ? reason : `${reason} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

// ─── TH-01 — Grayscale output uses Rec.601 luma ──────────────────────────
{
  // 0.299*255 + 0.587*92 + 0.114*92 = 140.7 → 141 = 0x8d
  expect('TH-01', desaturateHex('#FF5C5C'), '#8d8d8d',
    'red-ish danger hex desaturates to its luma gray');
  // 0.299*61 + 0.587*220 + 0.114*132 = 162.4 → 162 = 0xa2
  expect('TH-01b', desaturateHex('#3DDC84'), '#a2a2a2',
    'green success hex desaturates to its luma');
}

// ─── TH-02 — Alpha nibbles survive ───────────────────────────────────────
{
  expect('TH-02', desaturateHex('#7C6FFF75'), '#83838375',
    '8-digit hex keeps its alpha (accent outline variants)');
  expect('TH-02b', desaturateHex('#000000AA'), '#000000AA',
    'scrim alpha byte survives a black (already-gray) color — verbatim');
  // The + 'nn' concatenations produce lowercase hex sometimes — accepted.
  expect('TH-02c', desaturateHex('#ff5c5c22'), '#8d8d8d22',
    'lowercase 8-digit hex also works');
}

// ─── TH-03 — #RGB shorthand expands ──────────────────────────────────────
{
  expect('TH-03', desaturateHex('#F00'), '#4c4c4c',
    '3-digit hex expands before desaturating (0.299*255 → 76 = 0x4c)');
}

// ─── TH-04 — Unparseable input returns unchanged ─────────────────────────
{
  expect('TH-04', desaturateHex('transparent'), 'transparent',
    'named color passes through');
  expect('TH-04b', desaturateHex('rgba(1,2,3,0.5)'), 'rgba(1,2,3,0.5)',
    'rgba() passes through');
  expect('TH-04c', desaturateHex('#12345'), '#12345',
    'wrong-length hex passes through');
  expect('TH-04d', desaturateHex('#ZZZZZZ'), '#ZZZZZZ',
    'non-hex digits pass through');
  expect('TH-04e', desaturateHex(5), 5,
    'non-string input passes through');
}

// ─── TH-05 — Already-gray colors are fixed points ────────────────────────
{
  expect('TH-05', desaturateHex('#808080'), '#808080',
    'mid-gray unchanged (weights sum to 1)');
  expect('TH-05b', desaturateHex('#0D0D0F'), '#0d0d0d',
    'near-black dark bg stays near-black (b 0x0f rounds to the 0x0d luma)');
  expect('TH-05c', desaturateHex('#FFFFFF'), '#ffffff',
    'white unchanged');
  expect('TH-05d', desaturateHex('#000000'), '#000000',
    'black unchanged');
}

// ─── TH-06 — monochromePalette: strings + arrays gray, cat untouched ─────
{
  const palette = {
    accent: '#FF5C5C',
    accentLight: '#FF8C8C',
    scrim: '#000000AA',
    cat: ['#FF0000', '#00FF00', '#0000FF'],
    count: 5,
  };
  const out = monochromePalette(palette);
  expect('TH-06', out.accent, '#8d8d8d', 'string tokens desaturate');
  expect('TH-06b', out.scrim, '#000000AA', 'alpha-carrying tokens desaturate keeping alpha');
  expect('TH-06c', out.count, 5, 'non-string values pass through');
  expect('TH-06d', out.cat === palette.cat, true,
    'the cat array keeps its reference AND colors (pickers stay colored)');
  expect('TH-06e', out.cat, ['#FF0000', '#00FF00', '#0000FF'],
    'cat values are byte-identical to the input');
  expect('TH-06f', palette.accent, '#FF5C5C',
    'the input palette is not mutated');
}

// ─── TH-07 — A full dark palette comes out fully gray ────────────────────
// Simulates what the provider builds for the white accent:
// { ...darkPalette, ...ACCENTS.white } — every token gray except cat.
{
  // Stand-in for the merged palette (darkPalette values are the defaults).
  const merged = {
    bg: '#0D0D0F', surface: '#16161A', border: '#2A2A34',
    text: '#F0EFF5', accent: '#FFFFFF', accentDim: '#2A2A30',
    success: '#3DDC84', danger: '#FF5C5C', warning: '#FFB547', info: '#5BC4FF',
    cat: ['#7C6FFF', '#3DDC84'],
  };
  const out = monochromePalette(merged);
  // r==g==b byte pairs → the token is a gray.
  const isGray = (hex) => {
    const h = hex.slice(1);
    return h.slice(0, 2) === h.slice(2, 4) && h.slice(2, 4) === h.slice(4, 6);
  };
  const allGray = ['bg', 'surface', 'border', 'text', 'accent', 'accentDim',
    'success', 'danger', 'warning', 'info']
    .every((k) => isGray(out[k]));
  expect('TH-07', allGray, true,
    'every non-cat token desaturates to r=g=b');
  expect('TH-07b', out.cat, ['#7C6FFF', '#3DDC84'],
    'cat colors stay saturated for the pickers');
}

// ─── Report ──────────────────────────────────────────────────────────────
console.log('=== THEME (MONOCHROME) TEST REPORT ===');
for (const r of results) {
  console.log(`[${r.id}] ${r.status} — ${r.reason}`);
}
console.log(`\nTotals: ${pass} pass / ${fail} fail / ${partial} partial`);
process.exit(fail === 0 ? 0 : 1);