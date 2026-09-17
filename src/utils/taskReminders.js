// Pure helpers for per-task custom reminders (multiple per task).
// Pulled out of AppContext/AddTaskScreen so the migration, due-sweep and
// validation logic are testable in plain Node without React or the
// native notification layer.

// Normalize one task for the reminders system: backfill a missing
// `reminders` array and convert the legacy single `customReminderTime`
// one-shot into the first entry of that list (so nothing the user
// scheduled before the upgrade is lost). Returns a NEW task object and
// is idempotent — running it on an already-migrated task changes
// nothing, which is why LOAD_STATE can safely call it on every load.
export function migrateTaskReminders(task) {
  const base = task || {};
  const reminders = Array.isArray(base.reminders) ? base.reminders.slice() : [];
  let customReminderTime = base.customReminderTime ?? null;
  if (customReminderTime) {
    const parsed = Date.parse(customReminderTime);
    // Only convert values that actually parse — anything malformed is
    // simply dropped rather than turning into a broken entry.
    if (!Number.isNaN(parsed)) {
      // The id is derived from the legacy value itself so the same
      // persisted state always migrates to the same reminder id.
      reminders.push({
        id: `rem_legacy_${parsed}`,
        title: 'Reminder',
        description: '',
        at: new Date(parsed).toISOString(),
        triggeredAt: null,
      });
      customReminderTime = null;
    }
  }
  return { ...base, customReminderTime, reminders };
}

// Stamp every reminder whose scheduled time has passed within ONE task's
// list. Returns a NEW array when anything was stamped (entries carry
// triggeredAt = the reminder's own `at` — the scheduled moment, which is
// also the time the UI displays), or the SAME reference when nothing is
// due so callers can skip re-render/dispatch work. Shared by the context
// sweep (via markDueReminders below) and AddTaskScreen's own tick so both
// stamp with identical semantics.
export function markDueReminderList(reminders, now) {
  let changed = false;
  const next = (reminders || []).map((r) => {
    if (r.triggeredAt) return r;
    const at = new Date(r.at);
    if (Number.isNaN(at.getTime()) || at > now) return r;
    changed = true;
    return { ...r, triggeredAt: r.at };
  });
  // The no-op return keeps the input reference (identity for React state)
  // but never hands back null — a missing list normalizes to an empty one.
  return changed ? next : (reminders || []);
}

// Stamp every reminder whose scheduled time has passed. Returns
// { tasks, updates } where updates is [{ taskId, reminderId, triggeredAt }].
// When nothing is due, the SAME tasks reference comes back with
// updates: [] so the caller can skip both the dispatch and notification
// work entirely.
export function markDueReminders(tasks, now) {
  const updates = [];
  const nextTasks = (tasks || []).map((task) => {
    if (!Array.isArray(task.reminders) || task.reminders.length === 0) return task;
    // markDueReminderList preserves order and length, so a positional
    // diff is enough to collect the update records for the reducer.
    const reminders = markDueReminderList(task.reminders, now);
    if (reminders === task.reminders) return task;
    task.reminders.forEach((r, i) => {
      if (!r.triggeredAt && reminders[i].triggeredAt) {
        updates.push({ taskId: task.id, reminderId: r.id, triggeredAt: reminders[i].triggeredAt });
      }
    });
    return { ...task, reminders };
  });
  if (updates.length === 0) return { tasks, updates };
  return { tasks: nextTasks, updates };
}

// Validate a reminder being created/edited from the editor modal.
// Returns null when the draft is saveable, else a human-readable error
// string the caller can toast. Mirrors the old custom-reminder rules:
// title required, must be strictly in the future, and cannot land after
// the task's expiry when one is set.
export function validateReminderDraft({ title, at, expiryDate }, now = new Date()) {
  if (!title || !String(title).trim()) return 'Please enter a reminder title.';
  const when = at instanceof Date ? at : new Date(at);
  if (!when || Number.isNaN(when.getTime())) return 'Pick a valid date and time for the reminder.';
  if (when <= now) return 'Reminder must be in the future.';
  if (expiryDate) {
    const exp = expiryDate instanceof Date ? expiryDate : new Date(expiryDate);
    if (!Number.isNaN(exp.getTime()) && when > exp) {
      return 'Reminder cannot be after the expiry date.';
    }
  }
  return null;
}

// Ascending by scheduled time — new array, input untouched.
export function sortReminders(reminders) {
  return [...(reminders || [])].sort((a, b) => new Date(a.at) - new Date(b.at));
}