import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
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

  cat: ['#9B7B5D', '#3D8E5C', '#D4860A', '#CC3333', '#2288BB', '#CC6699', '#6AAA20', '#D4733A'],
};

// ─── Shared non-color tokens (never change between themes) ──────────────────

export const FONTS = {
  heading:    { fontWeight: '800', letterSpacing: -0.5 },
  subheading: { fontWeight: '700', letterSpacing: -0.3 },
  body:       { fontWeight: '400' },
  label:      { fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', fontSize: 11 },
  mono:       { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '600' },
};

export const RADIUS = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 };

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
  purple: { accent: '#7C6FFF', accentLight: '#A89DFF', accentDim: '#2A2456', outlineAccent: '#7C6FFF75' },
  teal:   { accent: '#3FC8C0', accentLight: '#7FE3DD', accentDim: '#163F3D', outlineAccent: '#3FC8C075' },
  rose:   { accent: '#E5638E', accentLight: '#F09DB7', accentDim: '#4A1F30', outlineAccent: '#E5638E75' },
  amber:  { accent: '#F2A03D', accentLight: '#FFC074', accentDim: '#4A2F0E', outlineAccent: '#F2A03D75' },
};

// Cream-palette accent overrides — same role, tuned for warm backgrounds.
export const ACCENTS_CREAM = {
  purple: { accent: '#9B7B5D', accentLight: '#BFA080', accentDim: '#EDE0D0', outlineAccent: '#9B7B5D55' },
  teal:   { accent: '#2F8A86', accentLight: '#5BB1AC', accentDim: '#D6EAE8', outlineAccent: '#2F8A8655' },
  rose:   { accent: '#B0405E', accentLight: '#D27893', accentDim: '#F0D5DD', outlineAccent: '#B0405E55' },
  amber:  { accent: '#C97A1F', accentLight: '#E5A256', accentDim: '#F5E2C8', outlineAccent: '#C97A1F55' },
};

const ACCENT_STORAGE_KEY = '@pt_accent';
export const ACCENT_KEYS = Object.keys(ACCENTS);

// Export the dark palette as the canonical default so non-hook callers
// (e.g. AppContext default categories) can read categorical colors without
// having to thread useTheme() through.
export const defaultCategoryColors = darkPalette.cat;

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState('dark');
  const [accent, setAccent] = useState('purple');

  // Hydrate accent from storage on mount.
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(ACCENT_STORAGE_KEY);
        if (saved && ACCENT_KEYS.includes(saved)) setAccent(saved);
      } catch (e) {
        // Silent — defaults to purple.
      }
    })();
  }, []);

  const toggleThemeMode = useCallback(() => {
    setMode((prev) => (prev === 'dark' ? 'cream' : 'dark'));
  }, []);

  const setAccentChoice = useCallback((key) => {
    if (!ACCENT_KEYS.includes(key)) return;
    setAccent(key);
    AsyncStorage.setItem(ACCENT_STORAGE_KEY, key).catch(() => {});
  }, []);

  const basePalette = mode === 'dark' ? darkPalette : creamPalette;
  const accentOverride =
    (mode === 'dark' ? ACCENTS : ACCENTS_CREAM)[accent] || ACCENTS.purple;
  const COLORS = { ...basePalette, ...accentOverride };

  return (
    <ThemeContext.Provider
      value={{ COLORS, mode, accent, toggleThemeMode, setAccentChoice }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx; // { COLORS, mode, accent, toggleThemeMode, setAccentChoice }
}
