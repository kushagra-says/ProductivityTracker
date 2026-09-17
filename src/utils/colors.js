// Pure color helpers for the monochrome (white accent, dark theme) mode.
// Split out of theme.js so plain-Node tests can exercise them — theme.js
// imports React Native, which the test harness cannot load.

// Luma-weighted grayscale for one hex color (Rec.601 weights — matches how
// the eye reads brightness on screens). Accepts #RGB, #RRGGBB and #RRGGBBAA;
// alpha nibbles survive untouched so translucent variants ("#7C6FFF75" and
// the COLORS.x + 'nn' concatenations everywhere) keep their opacity.
// Anything unparseable ('transparent', rgba(), non-strings) returns as-is.
export function desaturateHex(color) {
  if (typeof color !== 'string') return color;
  let hex = color.trim();
  if (!hex.startsWith('#')) return color;
  hex = hex.slice(1);
  let a = '';
  if (hex.length === 3) hex = hex.split('').map((ch) => ch + ch).join('');
  else if (hex.length === 8) { a = hex.slice(6); hex = hex.slice(0, 6); }
  else if (hex.length !== 6) return color;
  if (!/^[0-9a-fA-F]{6}$/.test(hex) || !/^[0-9a-fA-F]*$/.test(a)) return color;
  const l = Math.round(0.299 * parseInt(hex.slice(0, 2), 16)
    + 0.587 * parseInt(hex.slice(2, 4), 16)
    + 0.114 * parseInt(hex.slice(4, 6), 16));
  const g = l.toString(16).padStart(2, '0');
  return `#${g}${g}${g}${a}`;
}

// Grayscale every color value in a palette: strings in place, arrays
// element-wise. `cat` is deliberately EXCLUDED — it feeds the hobby/category
// color pickers, and a gray pick would be saved into the data permanently;
// every other surface renders stored colors through the theme's mono()
// helper instead.
export function monochromePalette(palette) {
  const out = {};
  for (const key of Object.keys(palette)) {
    const v = palette[key];
    if (key === 'cat') { out[key] = v; continue; }
    if (Array.isArray(v)) out[key] = v.map((c) => desaturateHex(c));
    else if (typeof v === 'string') out[key] = desaturateHex(v);
    else out[key] = v;
  }
  return out;
}