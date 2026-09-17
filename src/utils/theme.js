import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Palettes ───────────────────────────────────────────────────────────────
// Dark + Cream share the same conceptual role for every token, so a screen
// that reads from useTheme() works identically in both modes.

const darkPalette = {
  bg: '#0D0D0F',
  surface: '#16161A',
  surfaceAlt: '#1E1E24',
  border: '#2A2A34',
  borderLight: '#333340',
  outline: '#7C6FFF',

  text: '#F0EFF5',
  textSub: '#A9A8B3',
  textMuted: '#5E5D6E',

  accent: '#7C6FFF',
  accentLight: '#A89DFF',
  accentDim: '#2A2456',
  outlineAccent: '#7C6FFF75',

  success: '#3DDC84',
  successDim: '#1A3D2B',
  warning: '#FFB547',
  warningDim: '#3D2D10',
  danger: '#FF5C5C',
  dangerDim: '#3D1515',
  info: '#5BC4FF',
  infoDim: '#0F2D3D',

  shadow: '#000000',
  scrim: '#000000AA',

  // Content painted ON accent-colored surfaces (buttons, pills). White for
  // every colored accent; the provider flips it to near-black in the
  // monochrome (white accent) mode, where the accent bg is white itself.
  onAccent: '#FFFFFF',

  // Categorical palette — used by hobbies + categories.
  cat: ['#7C6FFF', '#3DDC84', '#FFB547', '#FF5C5C', '#5BC4FF', '#FF82B4', '#A8E063', '#FF9A5C'],
};

const creamPalette = {
  bg: '#F6EFE4',
  surface: '#FFF8EE',
  surfaceAlt: '#F3EBDD',
  border: '#DCCEBF',
  borderLight: '#CFC0AE',
  outline: '#9B7B5D',

  text: '#2D241C',
  textSub: '#5A4A3A',
  textMuted: '#7E6C59',

  accent: '#9B7B5D',
  accentLight: '#BFA080',
  accentDim: '#EDE0D0',
  outlineAccent: '#9B7B5D55',

  success: '#3D8E5C',
  successDim: '#D4F0E2',
  warning: '#D4860A',
  warningDim: '#F5E6CC',
  danger: '#CC3333',
  dangerDim: '#F5D5D5',
  info: '#2288BB',
  infoDim: '#D0EAF5',

  shadow: '#3A2A1A',
  scrim: '#3A2A1AAA',

  // Same role as the dark token — content on accent surfaces.
  onAccent: '#FFFFFF',

  cat: ['#9B7B5D', '#3D8E5C', '#D4860A', '#CC3333', '#2288BB', '#CC6699', '#6AAA20', '#D4733A'],
};

// ─── Monochrome (the white accent, dark theme only) ─────────────────────────
// Picking white in dark mode drains ALL color from the app. Two layers:
//   1. Token level — the whole COLORS palette renders grayscale, so
//      everything driven by useTheme() goes gray.
//   2. Data level — stored hobby/category colors bypass the theme, so
//      screens wrap their DISPLAY uses with the mono() helper from
//      useTheme(); it's an identity function outside the mode. Data itself
//      is never rewritten, so switching back to a colored accent restores
//      every stored color exactly.
// The pure color math lives in ./colors.js (no React Native imports) so the
// plain-Node test suite can exercise it; re-exported here for convenience.
export { desaturateHex, monochromePalette } from './colors';
import { desaturateHex, monochromePalette } from './colors';

// ─── Shared non-color tokens (never change between themes) ──────────────────

export const FONTS = {
  heading:    { fontWeight: '800', letterSpacing: -0.5 },
  subheading: { fontWeight: '700', letterSpacing: -0.3 },
  body:       { fontWeight: '400' },
  label:      { fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', fontSize: 11 },
  mono:       { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '600' },
};

export const RADIUS = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 };

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const SHADOW = {
  accent: {
    shadowColor: '#7C6FFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
};

// ─── Accent presets ────────────────────────────────────────────────────────
// Each preset overrides the four accent tokens in both palettes.
// Default is `purple` so existing users see no change.

export const ACCENTS = {
  purple:  { accent: '#7C6FFF', accentLight: '#A89DFF', accentDim: '#2A2456', outlineAccent: '#7C6FFF75' },
  teal:    { accent: '#3FC8C0', accentLight: '#7FE3DD', accentDim: '#163F3D', outlineAccent: '#3FC8C075' },
  rose:    { accent: '#E5638E', accentLight: '#F09DB7', accentDim: '#4A1F30', outlineAccent: '#E5638E75' },
  amber:   { accent: '#F2A03D', accentLight: '#FFC074', accentDim: '#4A2F0E', outlineAccent: '#F2A03D75' },
  blue:    { accent: '#4E9CFF', accentLight: '#8FBEFF', accentDim: '#152F52', outlineAccent: '#4E9CFF75' },
  coral:   { accent: '#FF7A59', accentLight: '#FFA98F', accentDim: '#4C2115', outlineAccent: '#FF7A5975' },
  lime:    { accent: '#A8D63F', accentLight: '#C9EC8B', accentDim: '#2E3A12', outlineAccent: '#A8D63F75' },
  fuchsia: { accent: '#D65DE8', accentLight: '#E9A0F2', accentDim: '#3F1447', outlineAccent: '#D65DE875' },
  mint:    { accent: '#34D399', accentLight: '#7BE8BC', accentDim: '#14432F', outlineAccent: '#34D39975' },
  brown:   { accent: '#B5824F', accentLight: '#D4A878', accentDim: '#3A2812', outlineAccent: '#B5824F75' },
  // Dark-only special accent: picking white turns the WHOLE app black &
  // white (every theme token renders grayscale; stored hobby/category
  // colors render gray at display time via mono()). Never shown in cream.
  white:   { accent: '#FFFFFF', accentLight: '#F2F2F2', accentDim: '#2A2A30', outlineAccent: '#FFFFFF75' },
};

// Cream-palette accent overrides — same role, tuned for warm backgrounds.
// The dark 'brown' entry above stays tuned lighter than the cream one
// (#B5824F vs #7A4E2D) for legacy/back-compat reads; the dark GRID no longer
// offers brown (white took its slot), but persisted dark='brown' is
// migrated to 'white' on load so nobody loses their choice.
//
// Note: the cream 'purple' MUST read as purple on a warm beige bg. The
// previous #9B7B5D was brown, which made the picker lie about what the
// user had selected. #7B5BC9 is a deep amethyst that holds its hue on
// cream while staying soft enough not to vibrate against the warm bg.
export const ACCENTS_CREAM = {
  purple:  { accent: '#7B5BC9', accentLight: '#A98DE0', accentDim: '#E5DDF2', outlineAccent: '#7B5BC955' },
  teal:    { accent: '#2F8A86', accentLight: '#5BB1AC', accentDim: '#D6EAE8', outlineAccent: '#2F8A8655' },
  rose:    { accent: '#B0405E', accentLight: '#D27893', accentDim: '#F0D5DD', outlineAccent: '#B0405E55' },
  amber:   { accent: '#C97A1F', accentLight: '#E5A256', accentDim: '#F5E2C8', outlineAccent: '#C97A1F55' },
  blue:    { accent: '#2B6FC4', accentLight: '#6FA0DC', accentDim: '#DAE7F6', outlineAccent: '#2B6FC455' },
  coral:   { accent: '#C2573B', accentLight: '#DC8A72', accentDim: '#F4DDD5', outlineAccent: '#C2573B55' },
  lime:    { accent: '#6E9422', accentLight: '#9DC15E', accentDim: '#E7EFDA', outlineAccent: '#6E942255' },
  fuchsia: { accent: '#A645B8', accentLight: '#CB87D9', accentDim: '#F0DCF4', outlineAccent: '#A645B855' },
  mint:    { accent: '#1E9E6E', accentLight: '#57BE96', accentDim: '#D8EDE2', outlineAccent: '#1E9E6E55' },
  brown:   { accent: '#7A4E2D', accentLight: '#A37352', accentDim: '#EFE0D2', outlineAccent: '#7A4E2D55' },
};

// Visible accent keys per theme. Dark shows white in place of brown — the
// dark grid is: purple teal rose amber blue coral lime fuchsia mint white.
// The entry stays in ACCENTS (above) because the dark picker reads its
// swatch from there. Cream keeps brown; it has no white.
// The picker reads from these lists at render time.
export const ACCENT_KEYS_DARK = Object.keys(ACCENTS).filter((k) => k !== 'brown');
export const ACCENT_KEYS_CREAM = Object.keys(ACCENTS_CREAM);
// Back-compat alias — code that doesn't care which theme can still use this.
export const ACCENT_KEYS = ACCENT_KEYS_DARK;

// Picker display names. 'white' is branded as "Paper" in the UI; every
// other key just capitalizes. Storage keeps the 'white' key — only the
// label changes.
export const ACCENT_LABELS = { white: 'Paper' };

// Per-theme accent storage. The accent choice is remembered independently
// for each theme, so a user can pick "rose" in dark and "brown" in cream
// and both stick when the user toggles between them. We store a single
// JSON object rather than two separate keys so we can read/write both
// preferences atomically and migrate cleanly from the legacy single key.
const ACCENT_STORAGE_KEY = '@pt_accent_per_theme';
// Exported so the backup exporter can include the accent map without
// duplicating the key string. Read-only from outside this module.
export { ACCENT_STORAGE_KEY };
const LEGACY_ACCENT_STORAGE_KEY = '@pt_accent';

const DEFAULT_ACCENTS = { dark: 'purple', cream: 'purple' };

// Export the dark palette as the canonical default so non-hook callers
// (e.g. AppContext default categories) can read categorical colors without
// having to thread useTheme() through.
export const defaultCategoryColors = darkPalette.cat;

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState('dark');
  // One accent key per theme. The active accent (exposed as `accent` on
  // the context) is always `accentByMode[mode]`, so toggling the theme
  // automatically restores the user's last-saved choice for that theme.
  const [accentByMode, setAccentByMode] = useState(DEFAULT_ACCENTS);

  // Hydrate accent preferences on mount. We first try the new per-theme
  // map; if that's missing we fall back to the legacy single key and seed
  // BOTH modes with it so the user doesn't lose their setting on upgrade.
  // The legacy key is then removed so we don't read it again next launch.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ACCENT_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            const next = { ...DEFAULT_ACCENTS };
            // Dark's brown slot became white — carry a stored brown choice
            // over so the migration doesn't reset anyone to purple.
            const darkKey = parsed.dark === 'brown' ? 'white' : parsed.dark;
            if (typeof darkKey === 'string' && ACCENT_KEYS_DARK.includes(darkKey)) {
              next.dark = darkKey;
            }
            if (typeof parsed.cream === 'string' && ACCENT_KEYS_CREAM.includes(parsed.cream)) {
              next.cream = parsed.cream;
            }
            setAccentByMode(next);
            return;
          }
        }

        const legacy = await AsyncStorage.getItem(LEGACY_ACCENT_STORAGE_KEY);
        if (legacy) {
          const darkKey = legacy === 'brown' ? 'white' : legacy;
          if (ACCENT_KEYS_DARK.includes(darkKey) || ACCENT_KEYS_CREAM.includes(legacy)) {
            setAccentByMode({
              dark: ACCENT_KEYS_DARK.includes(darkKey) ? darkKey : DEFAULT_ACCENTS.dark,
              cream: ACCENT_KEYS_CREAM.includes(legacy) ? legacy : DEFAULT_ACCENTS.cream,
            });
          }
        }
        // Best-effort cleanup of the legacy key.
        AsyncStorage.removeItem(LEGACY_ACCENT_STORAGE_KEY).catch(() => {});
      } catch (e) {
        // Silent — defaults to purple for both themes.
      }
    })();
  }, []);

  const toggleThemeMode = useCallback(() => {
    setMode((prev) => (prev === 'dark' ? 'cream' : 'dark'));
  }, []);

  const setAccentChoice = useCallback(
    (key) => {
      // Only accept keys that are visible in the CURRENT theme — both
      // grids now expose the same ten accents, so any key is valid for
      // either mode.
      const valid = mode === 'dark' ? ACCENT_KEYS_DARK : ACCENT_KEYS_CREAM;
      if (!valid.includes(key)) return;
      setAccentByMode((prev) => {
        const next = { ...prev, [mode]: key };
        AsyncStorage.setItem(ACCENT_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [mode],
  );

  // Restore an accent-per-theme map from a backup import. Validates each
  // side against its own theme's key set (ten keys each: dark without
  // brown, cream without white) and applies live — unlike setAccentChoice,
  // which only writes the active theme.
  const applyAccentMap = useCallback((map) => {
    if (!map || typeof map !== 'object') return;
    let touched = false;
    setAccentByMode((prev) => {
      const next = { ...prev };
      // Same brown → white migration as hydration: restoring a backup made
      // while dark still offered brown keeps the user's intent.
      const darkKey = map.dark === 'brown' ? 'white' : map.dark;
      if (typeof darkKey === 'string' && ACCENT_KEYS_DARK.includes(darkKey)) {
        next.dark = darkKey;
        touched = true;
      }
      if (typeof map.cream === 'string' && ACCENT_KEYS_CREAM.includes(map.cream)) {
        next.cream = map.cream;
        touched = true;
      }
      if (touched) {
        AsyncStorage.setItem(ACCENT_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      }
      return touched ? next : prev;
    });
  }, []);

  const basePalette = mode === 'dark' ? darkPalette : creamPalette;
  const accent = accentByMode[mode];
  const accentOverride =
    (mode === 'dark' ? ACCENTS : ACCENTS_CREAM)[accent] || ACCENTS.purple;
  // The white accent is dark-only and is the one true black & white mode.
  const monochrome = mode === 'dark' && accent === 'white';
  // Memoized: a new COLORS object every provider render would re-render
  // EVERY useTheme() consumer (i.e. every screen) even when the palette
  // did not change.
  const COLORS = useMemo(
    () => {
      const merged = { ...basePalette, ...accentOverride };
      if (!monochrome) return merged;
      const gray = monochromePalette(merged);
      // Content painted ON accent surfaces (button labels, add icons,
      // AM/PM pills, refresh spinner) must flip to dark — the accent bg is
      // white in this mode, so '#FFFFFF' content would be invisible.
      gray.onAccent = '#0D0D0F';
      return gray;
    },
    [basePalette, accentOverride, monochrome],
  );

  // Grayscale wrapper for STORED data colors (hobby.color, category.color),
  // which bypass the theme tokens: identity outside the white accent, gray
  // inside it. Wrap DISPLAY uses only — never write its output back into
  // state, or the real color would be lost when the accent changes.
  const mono = useCallback(
    (color) => (monochrome ? desaturateHex(color) : color),
    [monochrome],
  );

  // The visible accent keys for the picker. Dark shows white in brown's
  // old slot; cream keeps brown and has no white.
  const visibleAccentKeys = mode === 'dark' ? ACCENT_KEYS_DARK : ACCENT_KEYS_CREAM;

  const themeValue = useMemo(
    () => ({
      COLORS,
      mode,
      accent,
      monochrome,
      mono,
      visibleAccentKeys,
      toggleThemeMode,
      setAccentChoice,
      applyAccentMap,
    }),
    [COLORS, mode, accent, monochrome, mono, visibleAccentKeys, toggleThemeMode, setAccentChoice, applyAccentMap],
  );

  return (
    <ThemeContext.Provider value={themeValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx; // { COLORS, mode, accent, monochrome, mono, toggleThemeMode, setAccentChoice }
}
