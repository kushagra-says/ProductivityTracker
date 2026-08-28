// Backup envelope build / validate — pure logic, no React or native
// imports, so the same code path can be exercised by a Node test suite.
//
// The app persists everything as one JSON state blob (AsyncStorage
// `@pt_state`) plus an accent-per-theme map (`@pt_accent_per_theme`).
// The backup file mirrors that: a small versioned envelope around the
// exact state, so export = stringify(state) and import reuses the
// reducer's LOAD_STATE migration/sanitization path.

export const BACKUP_FORMAT = 'productivity-tracker-backup';
export const BACKUP_VERSION = 1;
export const BACKUP_FILE_PREFIX = 'productivity-tracker-backup';

export function backupFileName(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  // Timestamped to the minute so two exports on the same day never
  // collide in the Downloads folder (SAF has no reliable overwrite).
  return `${BACKUP_FILE_PREFIX}-${y}-${m}-${d}-${hh}${mm}.json`;
}

// Envelope for the current app state. `accentByTheme` is the
// { dark, cream } accent map from ThemeProvider (optional).
export function buildBackup(state, accentByTheme = null, exportedAt = new Date().toISOString()) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    data: {
      tasks: state.tasks || [],
      categories: state.categories || [],
      hobbies: state.hobbies || [],
      streak: typeof state.streak === 'number' ? state.streak : 0,
      lastActiveDate: state.lastActiveDate ?? null,
      settings: state.settings || {},
      ...(accentByTheme ? { accentByTheme } : {}),
    },
  };
}

// Validate + normalize a parsed backup file. Returns
//   { ok: true, data, accentByTheme, counts }
// or { ok: false, error } — never throws on user input.
export function parseBackup(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Not a valid backup file.' };
  }
  if (parsed.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'This file is not a ProductivityTracker backup.' };
  }
  if (typeof parsed.version !== 'number' || parsed.version > BACKUP_VERSION) {
    return {
      ok: false,
      error: `Backup version ${parsed.version} is newer than this app supports (${BACKUP_VERSION}). Update the app first.`,
    };
  }
  const d = parsed.data;
  if (!d || typeof d !== 'object') {
    return { ok: false, error: 'Backup has no data payload.' };
  }
  if (!Array.isArray(d.tasks) || !Array.isArray(d.hobbies) || !Array.isArray(d.categories)) {
    return { ok: false, error: 'Backup data is malformed (tasks/hobbies/categories missing).' };
  }

  const { accentByTheme, ...rest } = d;
  return {
    ok: true,
    data: rest, // dispatched through LOAD_STATE, which backfills/migrates
    accentByTheme:
      accentByTheme && typeof accentByTheme === 'object'
        ? { dark: accentByTheme.dark ?? null, cream: accentByTheme.cream ?? null }
        : null,
    counts: {
      tasks: d.tasks.length,
      hobbies: d.hobbies.length,
      categories: d.categories.length,
    },
  };
}