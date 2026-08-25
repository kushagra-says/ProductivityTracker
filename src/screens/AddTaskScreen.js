import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView,
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
import { format, addMinutes, isPast } from 'date-fns';
import { relTime } from '../utils/relTime';
import {
  BEFORE_EXPIRY_PRESETS,
  activeChipLabel,
  isCustomStepperVisible,
  minutesToParts,
  clampUnitValue,
  partsToMinutes,
  partsWithinMax,
  maxBeforeExpiryMinutes,
  maxForUnit,
  UNITS,
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
 * Date+time card — used for the expiry card and the custom one-shot.
 * Renders the inline month-grid calendar on top, then the time wheels
 * below. Accepts an optional `maxDate` so the custom-reminder card can
 * cap itself at the expiry.
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
  const { COLORS } = useTheme();
  const toast = useToast();
  const navigation = useNavigation();
  const route = useRoute();

  const editingTask = route.params?.task || null;
  const isEditing = !!editingTask;

  const PRIORITY_LEVELS = [
    { label: 'Low',    color: COLORS.success, icon: 'ellipse-outline' },
    { label: 'Medium', color: COLORS.warning, icon: 'ellipse' },
    { label: 'High',   color: COLORS.danger,  icon: 'ellipse' },
  ];

  const [title,      setTitle]      = useState(editingTask?.title || '');
  const [notes,      setNotes]      = useState(editingTask?.notes || '');
  const [categoryId, setCategoryId] = useState(editingTask?.categoryId || state.categories[0]?.id || null);
  const [priority,   setPriority]   = useState(editingTask?.priority || 'Medium');
  const [expiryDate, setExpiryDate] = useState(editingTask?.expiryDate ? new Date(editingTask.expiryDate) : null);

  // Custom one-shot reminder state. `customDate` is the full fire-at
  // datetime. The user picks it via the inline month-grid calendar +
  // time wheel. When an expiry is set, the calendar caps at the
  // expiry date so the reminder can't fire after the task expires.
  const [customOn,   setCustomOn]   = useState(!!editingTask?.customReminderTime);
  const [customDate, setCustomDate] = useState(() => {
    if (editingTask?.customReminderTime) return new Date(editingTask.customReminderTime);
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  });

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
  const [beforeExpiryCustomUnit,    setBeforeExpiryCustomUnit]    = useState(
    _seedParts.days > 0 ? 'days' : _seedParts.hours > 0 ? 'hours' : 'minutes',
  );

  // Distinct boolean so "Custom…" stays selected even when the value
  // matches a preset (e.g. user incremented to 60).
  const [beforeExpiryCustomMode, setBeforeExpiryCustomMode] = useState(() => {
    const v = editingTask?.beforeExpiryMinutes;
    return typeof v === 'number' && v > 0 &&
      !BEFORE_EXPIRY_PRESETS.some((p) => p.minutes === v);
  });

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
    if (customOn && isPast(customDate)) {
      toast.error('Custom reminder must be in the future.'); return;
    }
    // Reminder must also be before the expiry when one is set.
    if (customOn && expiryDate && customDate > expiryDate) {
      toast.error('Custom reminder cannot be after the expiry date.'); return;
    }
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
      customReminderTime: customOn ? customDate.toISOString() : null,
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
                  { borderColor: cat.color + '55', backgroundColor: COLORS.surfaceAlt },
                  categoryId === cat.id && { backgroundColor: cat.color + '22', borderColor: cat.color },
                ]}
                onPress={() => setCategoryId(cat.id)}
              >
                <Ionicons
                  name={cat.icon}
                  size={14}
                  color={categoryId === cat.id ? cat.color : COLORS.textSub}
                />
                <Text style={[
                  styles.catChipText,
                  { color: COLORS.textSub },
                  categoryId === cat.id && { color: cat.color },
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
                <Ionicons name={p.icon} size={14} color={priority === p.label ? p.color : COLORS.textSub} />
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

        {/* Reminders — two opt-in cards. */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: COLORS.textMuted }]}>REMINDERS</Text>

          {/* Custom one-shot reminder — tap the header to toggle. */}
          <View style={[styles.card, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setCustomOn(v => !v)}
              style={styles.cardHeader}
            >
              <View style={[styles.cardIconWrap, { backgroundColor: COLORS.accent + '22' }]}>
                <Ionicons name="notifications-outline" size={18} color={COLORS.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: COLORS.text }]}>Custom reminder</Text>
                <Text style={[styles.cardSub, { color: COLORS.textMuted }]}>
                  {customOn
                    ? `${format(customDate, 'EEE, MMM d • h:mm a')}${
                        expiryDate && customDate > expiryDate ? ' · after expiry!' : ''
                      }`
                    : 'Tap to enable — one-shot at a specific time'}
                </Text>
              </View>
              {customOn && (
                <TouchableOpacity
                  onPress={(e) => { e?.stopPropagation?.(); setCustomOn(false); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {customOn && (
              <View style={{ marginTop: 10 }}>
                <MonthGridCalendar
                  value={customDate}
                  onChange={setCustomDate}
                  minDate={new Date()}
                  maxDate={expiryDate}
                  accent={COLORS.accent}
                  surface={COLORS.surface}
                  surfaceAlt={COLORS.surfaceAlt}
                  border={COLORS.border}
                  text={COLORS.text}
                  textMuted={COLORS.textMuted}
                />
                <View style={{ marginTop: 10 }}>
                  <TimeField label="TIME" value={customDate} onChange={setCustomDate} COLORS={COLORS} />
                </View>
              </View>
            )}
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
                    const d = beforeExpiryCustomDays;
                    const h = beforeExpiryCustomHours;
                    const m = beforeExpiryCustomMinutes;
                    const parts = [];
                    if (d) parts.push(`${d} day${d === 1 ? '' : 's'}`);
                    if (h) parts.push(`${h} hour${h === 1 ? '' : 's'}`);
                    if (m) parts.push(`${m} min`);
                    const breakdown = parts.length ? parts.join(' ') : '0 min';
                    const cap = dynamicMaxMinutes;
                    return cap
                      ? `Notify ${breakdown} (${beforeExpiryMinutes} min) before expiry — max ${cap} min`
                      : `Notify ${breakdown} (${beforeExpiryMinutes} min) before expiry`;
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

                {/* Custom stepper — visible whenever custom mode is on. */}
                {isCustomStepperVisible({
                  minutes: beforeExpiryMinutes,
                  customMode: beforeExpiryCustomMode,
                }) && (
                  <View style={[styles.customStepper, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}>
                    {/* Unit chips: days / hours / minutes. */}
                    <View style={styles.unitChipRow}>
                      {UNITS.map((u) => {
                        const isActive = beforeExpiryCustomUnit === u;
                        return (
                          <TouchableOpacity
                            key={u}
                            style={[
                              styles.unitChip,
                              { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border },
                              isActive && { backgroundColor: COLORS.danger + '22', borderColor: COLORS.danger },
                            ]}
                            onPress={() => setBeforeExpiryCustomUnit(u)}
                          >
                            <Text style={[
                              styles.unitChipText,
                              { color: COLORS.textMuted },
                              isActive && { color: COLORS.danger },
                            ]}>
                              {u}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Stepper row — +/- on the active unit, clamped to its
                        range AND the dynamic cap from time-to-expiry. */}
                    <View style={styles.stepperRow}>
                      <TouchableOpacity
                        style={[styles.stepperBtn, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}
                        onPress={() => {
                          if (beforeExpiryCustomUnit === 'days') {
                            setBeforeExpiryCustomDays(clampUnitValue(beforeExpiryCustomDays - 1, 'days'));
                          } else if (beforeExpiryCustomUnit === 'hours') {
                            setBeforeExpiryCustomHours(clampUnitValue(beforeExpiryCustomHours - 1, 'hours'));
                          } else {
                            // minutes step by 5 to stay usable; clamp to [0, 59].
                            setBeforeExpiryCustomMinutes(clampUnitValue(beforeExpiryCustomMinutes - 5, 'minutes'));
                          }
                        }}
                      >
                        <Ionicons name="remove" size={16} color={COLORS.danger} />
                      </TouchableOpacity>
                      <View style={styles.stepperMid}>
                        <Text style={[styles.stepperValue, { color: COLORS.text }]}>
                          {beforeExpiryCustomUnit === 'days'
                            ? beforeExpiryCustomDays
                            : beforeExpiryCustomUnit === 'hours'
                              ? beforeExpiryCustomHours
                              : beforeExpiryCustomMinutes}
                        </Text>
                        <Text style={[styles.stepperUnit, { color: COLORS.textMuted }]}>
                          {(() => {
                            const cap = dynamicMaxMinutes;
                            if (cap == null) {
                              return beforeExpiryCustomUnit === 'minutes' ? 'minutes (step 5)' : beforeExpiryCustomUnit;
                            }
                            const unitMax = maxForUnit(
                              beforeExpiryCustomUnit,
                              {
                                days: beforeExpiryCustomDays,
                                hours: beforeExpiryCustomHours,
                                minutes: beforeExpiryCustomMinutes,
                              },
                              cap,
                            );
                            const label = beforeExpiryCustomUnit === 'minutes' ? 'minutes' : beforeExpiryCustomUnit;
                            return `${label} · max ${unitMax}`;
                          })()}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.stepperBtn, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}
                        onPress={() => {
                          if (beforeExpiryCustomUnit === 'days') {
                            const cap = dynamicMaxMinutes ?? 7 * 24 * 60;
                            const unitMax = maxForUnit('days',
                              {
                                days: beforeExpiryCustomDays,
                                hours: beforeExpiryCustomHours,
                                minutes: beforeExpiryCustomMinutes,
                              }, cap);
                            const next = Math.min(unitMax, beforeExpiryCustomDays + 1);
                            setBeforeExpiryCustomDays(next);
                          } else if (beforeExpiryCustomUnit === 'hours') {
                            const cap = dynamicMaxMinutes ?? 7 * 24 * 60;
                            const unitMax = maxForUnit('hours',
                              {
                                days: beforeExpiryCustomDays,
                                hours: beforeExpiryCustomHours,
                                minutes: beforeExpiryCustomMinutes,
                              }, cap);
                            const next = Math.min(unitMax, beforeExpiryCustomHours + 1);
                            setBeforeExpiryCustomHours(next);
                          } else {
                            const cap = dynamicMaxMinutes ?? 7 * 24 * 60;
                            const unitMax = maxForUnit('minutes',
                              {
                                days: beforeExpiryCustomDays,
                                hours: beforeExpiryCustomHours,
                                minutes: beforeExpiryCustomMinutes,
                              }, cap);
                            const step = 5;
                            const next = Math.min(unitMax, beforeExpiryCustomMinutes + step);
                            setBeforeExpiryCustomMinutes(next);
                          }
                        }}
                      >
                        <Ionicons name="add" size={16} color={COLORS.danger} />
                      </TouchableOpacity>
                    </View>

                    {/* Summary of the total — shows the d/h/m breakdown + total minutes. */}
                    <Text style={[styles.stepperSummary, { color: COLORS.textMuted }]}>
                      {(() => {
                        const d = beforeExpiryCustomDays;
                        const h = beforeExpiryCustomHours;
                        const m = beforeExpiryCustomMinutes;
                        const parts = [];
                        if (d) parts.push(`${d} day${d === 1 ? '' : 's'}`);
                        if (h) parts.push(`${h} hour${h === 1 ? '' : 's'}`);
                        if (m) parts.push(`${m} min`);
                        const breakdown = parts.length ? parts.join(' ') : '0 min';
                        return `Notify ${breakdown} (${beforeExpiryMinutes} min) before expiry`;
                      })()}
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
  
  unitChipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  unitChip: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  unitChipText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperMid: { flex: 1, alignItems: 'center' },
  stepperValue: { fontSize: 22, fontWeight: '800' },
  stepperUnit: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 },
  stepperSummary: { fontSize: 11, textAlign: 'center', marginTop: 2 },
});
