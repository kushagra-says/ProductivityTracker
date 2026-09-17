import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useTheme, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
import PrimaryButton from '../components/PrimaryButton';
import InlineTimePicker from '../components/InlineTimePicker';
import MonthGridCalendar from '../components/MonthGridCalendar';
import ConfirmDialog from '../components/ConfirmDialog';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';
import { DurationWheelPicker, DurationWheelLabels } from '../components/WheelPicker';
import { format, addMinutes } from 'date-fns';
import { relTime } from '../utils/relTime';
import {
  markDueReminderList,
  migrateTaskReminders,
  sortReminders,
  validateReminderDraft,
} from '../utils/taskReminders';
import {
  BEFORE_EXPIRY_PRESETS,
  activeChipLabel,
  isCustomStepperVisible,
  minutesToParts,
  partsToMinutes,
  partsWithinMax,
  maxBeforeExpiryMinutes,
  formatDuration,
} from '../utils/beforeExpiry';

const genId = () => `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// Default value seeded into the custom stepper the first time the user
// picks "Custom…". Pure number of minutes.
const DEFAULT_CUSTOM_BEFORE_EXPIRY = 45;

/**
 * Reads the first non-empty HH:mm portion of a Date so we can render a
 * short summary next to the date stepper.
 */
function describeDateTime(d) {
  if (!d) return null;
  return {
    date: d,
    formatted: format(d, 'EEE, MMM d, yyyy'),
    time: format(d, 'h:mm a'),
  };
}

/**
 * "Set the time portion of this date" — same primitive as on the date
 * card. We use the existing InlineTimePicker so the look matches.
 */
function TimeField({ label, value, onChange, COLORS }) {
  return (
    <View>
      <Text style={[styles.subLabel, { color: COLORS.textMuted }]}>{label}</Text>
      <InlineTimePicker
        value={value}
        onChange={onChange}
        accent={COLORS.accent}
        onAccent={COLORS.onAccent}
        surface={COLORS.surface}
        surfaceAlt={COLORS.surfaceAlt}
        border={COLORS.border}
        text={COLORS.text}
        textMuted={COLORS.textMuted}
      />
    </View>
  );
}

/**
 * Date+time card — used for the expiry card.
 * Renders the inline month-grid calendar on top, then the time wheels
 * below. Accepts an optional `maxDate` so callers can cap the picker.
 */
function DateTimeCard({ label, icon, iconColor, value, onChange, onClear, COLORS, dismissTime = false, maxDate = null }) {
  const desc = describeDateTime(value);

  // Tap on the header (when unset) seeds a default so the picker
  // appears. When set, the header is just a label — the picker below
  // is the actual touch target, so we don't trap touches in a parent
  // TouchableOpacity.
  const seedDefault = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 60 - (d.getMinutes() % 5 === 0 ? 0 : 5 - (d.getMinutes() % 5)));
    d.setSeconds(0, 0);
    onChange(d);
  };

  return (
    <View style={[styles.card, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => { if (!value) seedDefault(); }}
        style={styles.cardHeader}
      >
        <View style={[styles.cardIconWrap, { backgroundColor: (iconColor || COLORS.accent) + '22' }]}>
          <Ionicons name={icon} size={18} color={iconColor || COLORS.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: COLORS.text }]}>{label}</Text>
          <Text style={[styles.cardSub, { color: COLORS.textMuted }]}>
            {desc ? `${desc.formatted} • ${desc.time}` : 'Not set — tap to add'}
          </Text>
        </View>
        {value && onClear && (
          <TouchableOpacity
            onPress={(e) => { e?.stopPropagation?.(); onClear(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {value && (
        <>
          <View style={styles.dateWrap}>
            <MonthGridCalendar
              value={value}
              onChange={onChange}
              minDate={new Date()}
              maxDate={maxDate}
              accent={COLORS.accent}
              onAccent={COLORS.onAccent}
              surface={COLORS.surface}
              surfaceAlt={COLORS.surfaceAlt}
              border={COLORS.border}
              text={COLORS.text}
              textMuted={COLORS.textMuted}
            />
          </View>
          {!dismissTime && (
            <View style={{ marginTop: 10 }}>
              <TimeField label="TIME" value={value} onChange={onChange} COLORS={COLORS} />
            </View>
          )}
        </>
      )}
    </View>
  );
}

export default function AddTaskScreen() {
  const { state, addTask, updateTask } = useApp();
  const { COLORS, mono } = useTheme();
  const toast = useToast();
  const navigation = useNavigation();
  const route = useRoute();

  const editingTask = route.params?.task || null;
  const isEditing = !!editingTask;

  const PRIORITY_LEVELS = [
    { label: 'Low',    color: COLORS.success },
    { label: 'Medium', color: COLORS.warning },
    { label: 'High',   color: COLORS.danger },
  ];

  const [title,      setTitle]      = useState(editingTask?.title || '');
  const [notes,      setNotes]      = useState(editingTask?.notes || '');
  const [categoryId, setCategoryId] = useState(editingTask?.categoryId || state.categories[0]?.id || null);
  const [priority,   setPriority]   = useState(editingTask?.priority || 'Medium');
  const [expiryDate, setExpiryDate] = useState(editingTask?.expiryDate ? new Date(editingTask.expiryDate) : null);

  // Custom reminders — MULTIPLE per task. Each entry carries its own
  // title/description/fire-at time and is scheduled as its own one-shot
  // notification. Entries whose time has already passed (triggeredAt
  // stamped by the context sweep) render read-only and can no longer be
  // edited. Normalizing through migrateTaskReminders covers the edge
  // where a legacy task (single customReminderTime) reaches this screen
  // without having gone through the context's LOAD_STATE migration.
  const [reminders, setReminders] = useState(() =>
    sortReminders(migrateTaskReminders(editingTask || {}).reminders),
  );

  // Reminder editor modal state. `editingReminder` is the entry being
  // edited, or null when adding a fresh one. `rDate` is the full
  // fire-at datetime picked via the inline month-grid calendar + time
  // wheel; when an expiry is set the calendar caps at the expiry so a
  // reminder can't fire after the task expires.
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  const [rTitle, setRTitle] = useState('');
  const [rDesc, setRDesc] = useState('');
  const [rDate, setRDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  });

  const openReminderEditor = (reminder) => {
    // Triggered reminders are historical — structurally uneditable. The
    // pencil button is not rendered for them, this guards any other path.
    if (reminder?.triggeredAt) return;
    setEditingReminder(reminder || null);
    setRTitle(reminder?.title || '');
    setRDesc(reminder?.description || '');
    if (reminder) {
      setRDate(new Date(reminder.at));
    } else {
      // Seed to the top of the next hour — same default the old
      // custom-reminder card used.
      const d = new Date();
      d.setHours(d.getHours() + 1, 0, 0, 0);
      setRDate(d);
    }
    setEditorVisible(true);
  };

  const closeReminderEditor = () => setEditorVisible(false);

  const handleSaveReminder = () => {
    const error = validateReminderDraft({ title: rTitle, at: rDate, expiryDate }, new Date());
    if (error) { toast.error(error); return; }
    const fields = {
      title: rTitle.trim(),
      description: rDesc.trim(),
      at: rDate.toISOString(),
    };
    setReminders((prev) => sortReminders(
      editingReminder
        // Keep triggeredAt (null for an editable entry) and id as-is.
        ? prev.map((r) => (r.id === editingReminder.id ? { ...r, ...fields } : r))
        : [...prev, {
            id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            ...fields,
            triggeredAt: null,
          }],
    ));
    setEditorVisible(false);
  };

  const handleDeleteReminder = (id) => {
    // Only reachable from a future reminder's row — triggered entries
    // render no buttons at all.
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  // The local `reminders` copy is seeded once at mount, so a triggered
  // stamp made by the context sweep while THIS screen is open never
  // reaches the rows here — worse, saving the task would write the stale
  // `triggeredAt: null` back over the stamp and resurrect the reminder as
  // editable. Two stamp-only fixes (null → stamped, never the reverse, so
  // in-flight edits stay safe):
  // - mirror the live task's stamps from context whenever they change;
  // - a 30s tick stamps locally-due entries so a row flips to read-only
  //   promptly instead of waiting for the context's 60s sweep.
  const liveReminders =
    state.tasks.find((t) => t.id === editingTask?.id)?.reminders || null;
  useEffect(() => {
    if (!liveReminders) return;
    setReminders((prev) => {
      let changed = false;
      const next = prev.map((r) => {
        if (r.triggeredAt) return r;
        const live = liveReminders.find((lr) => lr.id === r.id);
        if (live?.triggeredAt) { changed = true; return { ...r, triggeredAt: live.triggeredAt }; }
        return r;
      });
      return changed ? next : prev;
    });
  }, [liveReminders]);
  useEffect(() => {
    const tick = setInterval(() => {
      setReminders((prev) => markDueReminderList(prev, new Date()));
    }, 30000);
    return () => clearInterval(tick);
  }, []);

  // Before-expiry reminder state. `beforeExpiryMinutes` is the value used
  // when saving (a number or null). The custom stepper drives a
  // three-unit {days, hours, minutes} split plus an active unit; the
  // total minutes is recomputed via partsToMinutes() whenever the user
  // is in custom mode. `beforeExpiryCustomMode` is a separate latched
  // flag so we can stay in "Custom" mode even when the picked number
  // happens to coincide with a preset (e.g. 60 min == "1 hour").
  const [beforeExpiryOn, setBeforeExpiryOn] = useState(() => {
    const v = editingTask?.beforeExpiryMinutes;
    return typeof v === 'number' && v > 0;
  });
  const [beforeExpiryMinutes, setBeforeExpiryMinutes] = useState(() => {
    const v = editingTask?.beforeExpiryMinutes;
    return typeof v === 'number' && v > 0 ? v : 30;
  });

  // Seed the d/h/m parts and active unit from the saved value, or from
  // a sensible default if there's nothing saved yet.
  const _seedParts = (() => {
    const v = editingTask?.beforeExpiryMinutes;
    if (typeof v === 'number' && v > 0) return minutesToParts(v);
    return minutesToParts(DEFAULT_CUSTOM_BEFORE_EXPIRY);
  })();
  const [beforeExpiryCustomDays,    setBeforeExpiryCustomDays]    = useState(_seedParts.days);
  const [beforeExpiryCustomHours,   setBeforeExpiryCustomHours]   = useState(_seedParts.hours);
  const [beforeExpiryCustomMinutes, setBeforeExpiryCustomMinutes] = useState(_seedParts.minutes);

  // Distinct boolean so "Custom…" stays selected even when the value
  // matches a preset (e.g. user incremented to 60).
  const [beforeExpiryCustomMode, setBeforeExpiryCustomMode] = useState(() => {
    const v = editingTask?.beforeExpiryMinutes;
    return typeof v === 'number' && v > 0 &&
      !BEFORE_EXPIRY_PRESETS.some((p) => p.minutes === v);
  });

  // "Go back without saving?" — the guard snapshots this draft on first
  // render and flags the form dirty only while the live values differ
  // from it, so a field edited and then manually reverted does NOT
  // trigger the discard prompt. Dates → timestamps so the snapshot is
  // JSON-stable.
  const draft = {
    title,
    notes,
    categoryId,
    priority,
    expiryDate: expiryDate ? expiryDate.getTime() : null,
    reminders: reminders.map((r) => ({ ...r })),
    beforeExpiryOn,
    beforeExpiryMinutes,
  };
  const guard = useUnsavedGuard(draft);

  // While in custom mode, keep `beforeExpiryMinutes` in sync with the
  // d/h/m sum. While in preset mode (not custom), keep the d/h/m parts
  // mirrored from the active preset so a later "Custom…" tap picks up
  // where the user left off.
  useEffect(() => {
    if (beforeExpiryCustomMode) {
      const total = partsToMinutes({
        days: beforeExpiryCustomDays,
        hours: beforeExpiryCustomHours,
        minutes: beforeExpiryCustomMinutes,
      });
      setBeforeExpiryMinutes(total);
    } else {
      const parts = minutesToParts(beforeExpiryMinutes);
      setBeforeExpiryCustomDays(parts.days);
      setBeforeExpiryCustomHours(parts.hours);
      setBeforeExpiryCustomMinutes(parts.minutes);
    }
  }, [
    beforeExpiryCustomMode,
    beforeExpiryCustomDays, beforeExpiryCustomHours, beforeExpiryCustomMinutes,
    beforeExpiryMinutes,
  ]);

  // Dynamic cap: max minutes the user can pick, given the current
  // expiryDate. Null when expiry is missing or already in the past —
  // in that case the before-expiry card is hidden (see JSX below).
  const dynamicMaxMinutes = expiryDate ? maxBeforeExpiryMinutes(expiryDate) : null;

  // When the dynamic cap shrinks (e.g. user shortened the expiry),
  // clamp the d/h/m parts down so the total never exceeds it.
  useEffect(() => {
    if (!beforeExpiryCustomMode || dynamicMaxMinutes == null) return;
    const total =
      beforeExpiryCustomDays * 1440 +
      beforeExpiryCustomHours * 60 +
      beforeExpiryCustomMinutes;
    if (total <= dynamicMaxMinutes) return;
    const clamped = partsWithinMax(dynamicMaxMinutes);
    setBeforeExpiryCustomDays(clamped.days);
    setBeforeExpiryCustomHours(clamped.hours);
    setBeforeExpiryCustomMinutes(clamped.minutes);
  }, [
    dynamicMaxMinutes,
    beforeExpiryCustomMode,
    beforeExpiryCustomDays,
    beforeExpiryCustomHours,
    beforeExpiryCustomMinutes,
  ]);

  const handleSubmit = () => {
    if (!title.trim()) { toast.error('Please enter a task title.'); return; }
    if (beforeExpiryOn && !expiryDate) {
      toast.error('Set an expiry date to use a before-expiry reminder.'); return;
    }
    if (beforeExpiryOn && expiryDate) {
      const max = maxBeforeExpiryMinutes(expiryDate);
      if (max == null || beforeExpiryMinutes > max) {
        toast.error('This expiry is too close for the chosen reminder offset.'); return;
      }
      if (addMinutes(expiryDate, -beforeExpiryMinutes) <= new Date()) {
        toast.error('This expiry is too close for the chosen reminder offset.'); return;
      }
    }

    const task = {
      ...(editingTask || {}),
      id: editingTask?.id || genId(),
      title: title.trim(),
      notes: notes.trim(),
      categoryId,
      priority,
      expiryDate: expiryDate ? expiryDate.toISOString() : null,
      // Kept null for backup-code compatibility — the custom one-shot
      // was replaced by the `reminders` list (v1.4.6).
      customReminderTime: null,
      // A triggered reminder must survive a save: merge in any triggeredAt
      // the context sweep stamped after this screen mounted — writing the
      // local copy verbatim could resurrect it as editable (the local
      // sync effect closes the window too, this covers the race).
      reminders: reminders.map((r) => {
        if (r.triggeredAt) return { ...r };
        const live = isEditing
          ? state.tasks.find((t) => t.id === editingTask.id)?.reminders
              ?.find((lr) => lr.id === r.id)
          : null;
        return live?.triggeredAt ? { ...r, triggeredAt: live.triggeredAt } : { ...r };
      }),
      beforeExpiryMinutes: beforeExpiryOn ? beforeExpiryMinutes : null,
      status:      editingTask?.status    || 'pending',
      createdAt:   editingTask?.createdAt || new Date().toISOString(),
      completedAt: editingTask?.completedAt || null,
    };
    if (isEditing) {
      updateTask(task);
      toast.success('Task updated');
    } else {
      addTask(task);
      toast.success('Task created');
    }
    guard.clearDirty();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: COLORS.bg }]}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}
          >
            <Ionicons name="chevron-back" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: COLORS.text }]}>
            {isEditing ? 'Edit task' : 'New task'}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Title */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: COLORS.textMuted }]}>TITLE *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border, color: COLORS.text }]}
            placeholder="What needs to be done?"
            placeholderTextColor={COLORS.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
        </View>

        {/* Notes */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: COLORS.textMuted }]}>NOTES</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border, color: COLORS.text }]}
            placeholder="Add details or description..."
            placeholderTextColor={COLORS.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Category — flowing grid (no horizontal scroll). */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: COLORS.textMuted }]}>CATEGORY</Text>
          <View style={styles.chipGrid}>
            {state.categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.catChip,
                  // mono(): stored category colors render grayscale while
                  // the white accent (dark mode) is active.
                  { borderColor: mono(cat.color) + '55', backgroundColor: COLORS.surfaceAlt },
                  categoryId === cat.id && { backgroundColor: mono(cat.color) + '22', borderColor: mono(cat.color) },
                ]}
                onPress={() => setCategoryId(cat.id)}
              >
                <Ionicons
                  name={cat.icon}
                  size={14}
                  color={categoryId === cat.id ? mono(cat.color) : COLORS.textSub}
                />
                <Text style={[
                  styles.catChipText,
                  { color: COLORS.textSub },
                  categoryId === cat.id && { color: mono(cat.color) },
                ]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Priority */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: COLORS.textMuted }]}>PRIORITY</Text>
          <View style={styles.priorityRow}>
            {PRIORITY_LEVELS.map(p => (
              <TouchableOpacity
                key={p.label}
                style={[
                  styles.priorityChip,
                  { borderColor: p.color + '55', backgroundColor: COLORS.surfaceAlt },
                  priority === p.label && { backgroundColor: p.color + '22', borderColor: p.color },
                ]}
                onPress={() => setPriority(p.label)}
              >
                {/* Radio dot — hollow circle when unselected, filled when
                    the priority is picked (user request). */}
                <Ionicons
                  name={priority === p.label ? 'ellipse' : 'ellipse-outline'}
                  size={14}
                  color={priority === p.label ? p.color : COLORS.textSub}
                />
                <Text style={[
                  styles.catChipText,
                  { color: COLORS.textSub },
                  priority === p.label && { color: p.color },
                ]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Expiry date & time */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: COLORS.textMuted }]}>EXPIRY</Text>
          <DateTimeCard
            label="Expiry date & time"
            icon="alarm-outline"
            iconColor={COLORS.danger}
            value={expiryDate}
            onChange={setExpiryDate}
            onClear={() => setExpiryDate(null)}
            COLORS={COLORS}
          />
        </View>

        {/* Reminders — the custom-reminders list + the before-expiry opt-in card. */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: COLORS.textMuted }]}>REMINDERS</Text>

          {/* Custom reminders — multiple per task, one notification each. */}
          <View style={[styles.card, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconWrap, { backgroundColor: COLORS.accent + '22' }]}>
                <Ionicons name="notifications-outline" size={18} color={COLORS.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: COLORS.text }]}>Custom reminders</Text>
                <Text style={[styles.cardSub, { color: COLORS.textMuted }]}>
                  {(() => {
                    const upcoming = reminders.filter((r) => !r.triggeredAt).length;
                    if (reminders.length === 0) return 'None yet — add one below';
                    if (upcoming === 0) return 'All reminded';
                    return `${upcoming} upcoming reminder${upcoming === 1 ? '' : 's'}`;
                  })()}
                </Text>
              </View>
            </View>

            {reminders.map((r) => (
              r.triggeredAt ? (
                // Past its time — read-only, no edit/delete. The exact
                // wording is the feature contract ("reminded X at T on D").
                <Text key={r.id} style={[styles.remindedText, { color: COLORS.textMuted }]}>
                  {`reminded ${r.title} at ${format(new Date(r.at), 'h:mm a')} on ${format(new Date(r.at), 'MMM d, yyyy')}`}
                </Text>
              ) : (
                <View key={r.id} style={[styles.reminderRow, { borderColor: COLORS.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.reminderRowTitle, { color: COLORS.text }]}>
                      {r.title}
                    </Text>
                    <Text style={[styles.reminderRowDate, { color: COLORS.textMuted }]}>
                      {format(new Date(r.at), 'EEE, MMM d • h:mm a')}
                    </Text>
                    {r.description ? (
                      <Text style={[styles.reminderRowDesc, { color: COLORS.textMuted }]}>
                        {r.description}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => openReminderEditor(r)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  >
                    <Ionicons name="pencil" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteReminder(r.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  >
                    <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              )
            ))}

            <TouchableOpacity
              style={[styles.setBtn, { borderColor: COLORS.accent }]}
              onPress={() => openReminderEditor(null)}
            >
              <Ionicons name="add" size={16} color={COLORS.accent} />
              <Text style={[styles.setBtnText, { color: COLORS.accent }]}>Add reminder</Text>
            </TouchableOpacity>
          </View>

          {/* Before-expiry reminder — only available when an expiry is set. */}
          {expiryDate && (
          <View style={[styles.card, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border, marginTop: SPACING.sm }]}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setBeforeExpiryOn(v => !v)}
              style={styles.cardHeader}
            >
              <View style={[styles.cardIconWrap, { backgroundColor: COLORS.danger + '22' }]}>
                <Ionicons name="timer-outline" size={18} color={COLORS.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: COLORS.text }]}>Before expiry</Text>
                <Text style={[styles.cardSub, { color: COLORS.textMuted }]}>
                  {(() => {
                    if (!beforeExpiryOn) return 'Tap to enable — fires before the task expires';
                    if (!expiryDate)    return 'Set an expiry date to use this';
                    const breakdown = formatDuration(partsToMinutes({
                      days: beforeExpiryCustomDays,
                      hours: beforeExpiryCustomHours,
                      minutes: beforeExpiryCustomMinutes,
                    }));
                    const cap = dynamicMaxMinutes;
                    return cap
                      ? `Notify ${breakdown} before expiry — max ${formatDuration(cap)}`
                      : `Notify ${breakdown} before expiry`;
                  })()}
                </Text>
              </View>
              {beforeExpiryOn && (
                <TouchableOpacity
                  onPress={(e) => { e?.stopPropagation?.(); setBeforeExpiryOn(false); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {beforeExpiryOn && (
              <View style={{ marginTop: 10 }}>
                <View style={styles.presetGrid}>
                  {BEFORE_EXPIRY_PRESETS.map((p) => {
                    const active = p.label === activeChipLabel({
                      minutes: beforeExpiryMinutes,
                      customMode: beforeExpiryCustomMode,
                    });
                    return (
                      <TouchableOpacity
                        key={p.label}
                        style={[
                          styles.presetChip,
                          { backgroundColor: COLORS.surface, borderColor: COLORS.border },
                          active && { backgroundColor: COLORS.danger + '22', borderColor: COLORS.danger },
                        ]}
                        onPress={() => {
                          if (p.minutes === null) {
                            // Tap "Custom…" — enter custom mode. The d/h/m
                            // parts mirror beforeExpiryMinutes while in
                            // preset mode (via useEffect), so the user picks
                            // up where they left off.
                            setBeforeExpiryCustomMode(true);
                          } else {
                            // Tap a named preset — exit custom mode and set
                            // the value. The useEffect re-seeds the parts
                            // from this preset's minutes.
                            setBeforeExpiryCustomMode(false);
                            setBeforeExpiryMinutes(p.minutes);
                          }
                        }}
                      >
                        <Text style={[
                          styles.presetChipText,
                          { color: COLORS.textMuted },
                          active && { color: COLORS.danger },
                        ]}>
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Custom duration — scrollable d/h/m wheels (Bug 6: replaces
                    the 5-minute-step stepper; every value 0 min .. 7 days is
                    reachable in 1-minute granularity). The dynamic cap from
                    time-to-expiry is enforced by the clamp useEffect above. */}
                {isCustomStepperVisible({
                  minutes: beforeExpiryMinutes,
                  customMode: beforeExpiryCustomMode,
                }) && (
                  <View style={[styles.customStepper, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}>
                    <DurationWheelPicker
                      parts={{
                        days: beforeExpiryCustomDays,
                        hours: beforeExpiryCustomHours,
                        minutes: beforeExpiryCustomMinutes,
                      }}
                      onChange={(p) => {
                        setBeforeExpiryCustomDays(p.days);
                        setBeforeExpiryCustomHours(p.hours);
                        setBeforeExpiryCustomMinutes(p.minutes);
                      }}
                      accent={COLORS.danger}
                      surface={COLORS.surfaceAlt}
                      border={COLORS.border}
                      text={COLORS.text}
                      textMuted={COLORS.textMuted}
                    />
                    <DurationWheelLabels textMuted={COLORS.textMuted} />

                    {/* Summary of the total — d/h/m breakdown only, no raw
                        minute total. */}
                    <Text style={[styles.stepperSummary, { color: COLORS.textMuted }]}>
                      {`Notify ${formatDuration(beforeExpiryMinutes)} before expiry`}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
          )}

        </View>

        {/* Created/Last edited timestamps */}
        {isEditing && editingTask?.createdAt && (
          <Text style={[styles.timestamp, { color: COLORS.textMuted }]}>
            Created {relTime(editingTask.createdAt)}
          </Text>
        )}

        {/* Submit */}
        <PrimaryButton
          label={isEditing ? 'Save changes' : 'Create task'}
          icon={isEditing ? 'save-outline' : 'checkmark'}
          color={COLORS.accent}
          onPress={handleSubmit}
        />

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Reminder editor — add/edit one custom reminder (mirrors the
          HobbiesScreen modal form pattern). */}
      <Modal visible={editorVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: COLORS.text }]}>
                {editingReminder ? 'Edit reminder' : 'New reminder'}
              </Text>
              <TouchableOpacity onPress={closeReminderEditor}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >

              <Text style={[styles.fieldLabel, { color: COLORS.textMuted }]}>TITLE</Text>
              <TextInput
                style={[styles.input, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border, color: COLORS.text }]}
                placeholder="e.g. Take meds, Call back"
                placeholderTextColor={COLORS.textMuted}
                value={rTitle}
                onChangeText={setRTitle}
                maxLength={60}
              />

              <Text style={[styles.fieldLabel, { color: COLORS.textMuted }]}>DESCRIPTION</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border, color: COLORS.text }]}
                placeholder="Optional details shown in the notification..."
                placeholderTextColor={COLORS.textMuted}
                value={rDesc}
                onChangeText={setRDesc}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <Text style={[styles.fieldLabel, { color: COLORS.textMuted }]}>DATE</Text>
              <MonthGridCalendar
                value={rDate}
                onChange={setRDate}
                minDate={new Date()}
                maxDate={expiryDate}
                accent={COLORS.accent}
                onAccent={COLORS.onAccent}
                surface={COLORS.surface}
                surfaceAlt={COLORS.surfaceAlt}
                border={COLORS.border}
                text={COLORS.text}
                textMuted={COLORS.textMuted}
              />

              <View style={{ marginTop: 10 }}>
                <TimeField label="TIME" value={rDate} onChange={setRDate} COLORS={COLORS} />
              </View>

              <TouchableOpacity
                style={[styles.saveReminderBtn, { backgroundColor: COLORS.accent }]}
                onPress={handleSaveReminder}
              >
                <Text style={[styles.saveReminderBtnText, { color: COLORS.onAccent }]}>
                  {editingReminder ? 'Save changes' : 'Add reminder'}
                </Text>
              </TouchableOpacity>

            </ScrollView>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={guard.confirmVisible}
        title="Discard changes?"
        message="You have unsaved changes. Going back now will lose them."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={guard.discard}
        onCancel={guard.keepEditing}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  container: { flex: 1, paddingHorizontal: SPACING.lg },

  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: SPACING.lg, marginBottom: SPACING.lg },
  backBtn:  { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  title:    { ...FONTS.heading, fontSize: 22 },

  timestamp: { fontSize: 12, marginTop: SPACING.md, fontStyle: 'italic' },

  field:  { marginBottom: SPACING.lg },
  label:  { ...FONTS.label, marginBottom: SPACING.sm, fontSize: 11 },
  subLabel: { ...FONTS.label, fontSize: 10, marginBottom: 6 },

  input:    { borderRadius: RADIUS.md, borderWidth: 1, fontSize: 15, paddingHorizontal: 14, paddingVertical: 13 },
  textArea: { minHeight: 90, paddingTop: 12 },

  // Category chips — wrap, no horizontal scroll.
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 6,
  },
  catChipText: { fontSize: 13, fontWeight: '600' },

  // Priority — equal-width row.
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 6,
  },

  // Generic card (used by DateTimeCard + reminder cards).
  card: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
  },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSub:   { fontSize: 11, marginTop: 2 },

  dateWrap: { marginTop: 12 },
  setBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  setBtnText: { fontSize: 13, fontWeight: '700' },

  // Before-expiry preset chips.
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  presetChipText: { fontSize: 12, fontWeight: '700' },

  customStepper: {
    marginTop: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: 8,
    gap: 8,
  },
  stepperSummary: { fontSize: 11, textAlign: 'center', marginTop: 2 },

  // Custom reminders list rows (inside the reminders card).
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reminderRowTitle: { fontSize: 14, fontWeight: '700' },
  reminderRowDate: { fontSize: 11, marginTop: 2 },
  reminderRowDesc: { fontSize: 11, marginTop: 4 },
  remindedText: { fontSize: 11, fontStyle: 'italic', marginTop: 10 },

  // Reminder editor modal (mirrors the HobbiesScreen modal).
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modal:        { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: SPACING.xl, borderWidth: 1, borderBottomWidth: 0, height: '92%' },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:   { ...FONTS.heading, fontSize: 20 },
  modalScroll:  { flex: 1 },
  modalScrollContent: { paddingBottom: SPACING.xxl },
  fieldLabel:   { ...FONTS.label, marginBottom: SPACING.sm, fontSize: 11 },
  saveReminderBtn:     { borderRadius: RADIUS.lg, paddingVertical: 14, alignItems: 'center', marginTop: SPACING.lg, ...SHADOW.accent },
  saveReminderBtnText: { fontSize: 16, fontWeight: '800' },
});
