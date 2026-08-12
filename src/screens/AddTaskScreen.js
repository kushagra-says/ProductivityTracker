import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useTheme, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
import PrimaryButton from '../components/PrimaryButton';
import InlineTimePicker from '../components/InlineTimePicker';
import InlineDatePicker from '../components/InlineDatePicker';
import { format, addMinutes, isPast, isToday } from 'date-fns';
import { relTime } from '../utils/relTime';

const genId = () => `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// Preset offsets for the "before expiry" reminder. `null` opens a custom
// stepper controlled by `customBeforeExpiry`.
const BEFORE_EXPIRY_PRESETS = [
  { label: '5 min',     minutes: 5 },
  { label: '15 min',    minutes: 15 },
  { label: '30 min',    minutes: 30 },
  { label: '1 hour',    minutes: 60 },
  { label: '2 hours',   minutes: 120 },
  { label: '1 day',     minutes: 1440 },
  { label: 'Custom…',   minutes: null },
];

const DEFAULT_CUSTOM_BEFORE_EXPIRY = 45; // minutes — used when the user picks "Custom"

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
 * Date+time card — used for start, expiry, and the custom one-shot.
 * Renders the inline date stepper on top, then the time wheels below.
 */
function DateTimeCard({ label, icon, iconColor, value, onChange, onClear, COLORS, dismissTime = false }) {
  const desc = describeDateTime(value);
  return (
    <View style={[styles.card, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconWrap, { backgroundColor: (iconColor || COLORS.accent) + '22' }]}>
          <Ionicons name={icon} size={18} color={iconColor || COLORS.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: COLORS.text }]}>{label}</Text>
          <Text style={[styles.cardSub, { color: COLORS.textMuted }]}>
            {desc ? `${desc.formatted} • ${desc.time}` : 'Not set'}
          </Text>
        </View>
        {value && onClear && (
          <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {value && (
        <>
          <View style={styles.dateWrap}>
            <InlineDatePicker
              value={value}
              onChange={onChange}
              minDate={new Date()}
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

      {!value && (
        <TouchableOpacity
          style={[styles.setBtn, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}
          onPress={() => {
            // Seed with 1 hour from now, rounded to the next 5 minutes.
            const d = new Date();
            d.setMinutes(d.getMinutes() + 60 - (d.getMinutes() % 5 === 0 ? 0 : 5 - (d.getMinutes() % 5)));
            d.setSeconds(0, 0);
            onChange(d);
          }}
        >
          <Ionicons name="add" size={14} color={COLORS.accent} />
          <Text style={[styles.setBtnText, { color: COLORS.accent }]}>Set {label.toLowerCase()}</Text>
        </TouchableOpacity>
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
  const [startDate,  setStartDate]  = useState(editingTask?.startDate  ? new Date(editingTask.startDate)  : null);
  const [expiryDate, setExpiryDate] = useState(editingTask?.expiryDate ? new Date(editingTask.expiryDate) : null);

  // Custom one-shot reminder state.
  const [customOn,      setCustomOn]      = useState(!!editingTask?.customReminderTime);
  const [customDate,    setCustomDate]    = useState(() => {
    if (editingTask?.customReminderTime) return new Date(editingTask.customReminderTime);
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  });

  // Before-expiry reminder state. `beforeExpiryMinutes` is a number or null.
  const [beforeExpiryOn, setBeforeExpiryOn] = useState(() => {
    const v = editingTask?.beforeExpiryMinutes;
    return typeof v === 'number' && v > 0;
  });
  const [beforeExpiryMinutes, setBeforeExpiryMinutes] = useState(
    typeof editingTask?.beforeExpiryMinutes === 'number' && editingTask.beforeExpiryMinutes > 0
      ? editingTask.beforeExpiryMinutes
      : 30,
  );
  const [beforeExpiryCustom, setBeforeExpiryCustom] = useState(
    typeof editingTask?.beforeExpiryMinutes === 'number' &&
      editingTask.beforeExpiryMinutes > 0 &&
      !BEFORE_EXPIRY_PRESETS.some((p) => p.minutes === editingTask.beforeExpiryMinutes)
      ? editingTask.beforeExpiryMinutes
      : DEFAULT_CUSTOM_BEFORE_EXPIRY,
  );

  const handleSubmit = () => {
    if (!title.trim()) { Alert.alert('Missing title', 'Please enter a task title.'); return; }
    if (expiryDate && startDate && expiryDate <= startDate) {
      Alert.alert('Invalid dates', 'Expiry must be after start date.'); return;
    }
    if (customOn && isPast(customDate)) {
      Alert.alert('Invalid time', 'Custom reminder must be in the future.'); return;
    }
    if (beforeExpiryOn && !expiryDate) {
      Alert.alert('Missing expiry', 'Set an expiry date to use a before-expiry reminder.'); return;
    }
    if (beforeExpiryOn && expiryDate && addMinutes(expiryDate, -beforeExpiryMinutes) <= new Date()) {
      Alert.alert('Too soon', 'This expiry is too close for the chosen reminder offset.'); return;
    }

    const task = {
      ...(editingTask || {}),
      id: editingTask?.id || genId(),
      title: title.trim(),
      notes: notes.trim(),
      categoryId,
      priority,
      startDate:  startDate  ? startDate.toISOString()  : null,
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
    const rootNav = navigation.getParent ? navigation.getParent() : null;
    if (rootNav && rootNav.navigate) rootNav.navigate('Tasks', { screen: 'TasksList' });
    else navigation.navigate('Tasks', { screen: 'TasksList' });
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

        {/* Start date & time */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: COLORS.textMuted }]}>START</Text>
          <DateTimeCard
            label="Start date & time"
            icon="calendar-outline"
            iconColor={COLORS.accent}
            value={startDate}
            onChange={setStartDate}
            onClear={() => setStartDate(null)}
            COLORS={COLORS}
          />
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

          {/* Custom one-shot reminder */}
          <View style={[styles.card, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconWrap, { backgroundColor: COLORS.accent + '22' }]}>
                <Ionicons name="notifications-outline" size={18} color={COLORS.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: COLORS.text }]}>Custom reminder</Text>
                <Text style={[styles.cardSub, { color: COLORS.textMuted }]}>
                  {customOn
                    ? `${format(customDate, 'EEE, MMM d • h:mm a')}${isToday(customDate) ? ' (today)' : ''}`
                    : 'Off — toggle on for a one-shot at a specific time'}
                </Text>
              </View>
              <Switch
                value={customOn}
                onValueChange={setCustomOn}
                trackColor={{ false: COLORS.border, true: COLORS.accent + '88' }}
                thumbColor={customOn ? COLORS.accent : COLORS.textMuted}
              />
            </View>

            {customOn && (
              <View style={{ marginTop: 10 }}>
                <InlineDatePicker
                  value={customDate}
                  onChange={setCustomDate}
                  minDate={new Date()}
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

          {/* Before-expiry reminder */}
          <View style={[styles.card, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border, marginTop: SPACING.sm }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconWrap, { backgroundColor: COLORS.danger + '22' }]}>
                <Ionicons name="timer-outline" size={18} color={COLORS.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: COLORS.text }]}>Before expiry</Text>
                <Text style={[styles.cardSub, { color: COLORS.textMuted }]}>
                  {beforeExpiryOn
                    ? expiryDate
                      ? `Notify ${beforeExpiryMinutes} min before expiry`
                      : 'Set an expiry date to use this'
                    : 'Off — toggle on to fire before expiry'}
                </Text>
              </View>
              <Switch
                value={beforeExpiryOn}
                onValueChange={setBeforeExpiryOn}
                trackColor={{ false: COLORS.border, true: COLORS.danger + '88' }}
                thumbColor={beforeExpiryOn ? COLORS.danger : COLORS.textMuted}
              />
            </View>

            {beforeExpiryOn && (
              <View style={{ marginTop: 10 }}>
                <View style={styles.presetGrid}>
                  {BEFORE_EXPIRY_PRESETS.map((p) => {
                    const active = p.minutes === null
                      ? !BEFORE_EXPIRY_PRESETS.some((q) => q.minutes === beforeExpiryMinutes)
                      : beforeExpiryMinutes === p.minutes;
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
                            setBeforeExpiryMinutes(beforeExpiryCustom);
                          } else {
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

                {/* Custom stepper — visible only when "Custom…" is active. */}
                {!BEFORE_EXPIRY_PRESETS.some((q) => q.minutes === beforeExpiryMinutes) && (
                  <View style={[styles.customStepper, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}>
                    <TouchableOpacity
                      style={[styles.stepperBtn, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}
                      onPress={() => {
                        const n = Math.max(1, beforeExpiryCustom - 5);
                        setBeforeExpiryCustom(n);
                        setBeforeExpiryMinutes(n);
                      }}
                    >
                      <Ionicons name="remove" size={16} color={COLORS.danger} />
                    </TouchableOpacity>
                    <View style={styles.stepperMid}>
                      <Text style={[styles.stepperValue, { color: COLORS.text }]}>
                        {beforeExpiryCustom}
                      </Text>
                      <Text style={[styles.stepperUnit, { color: COLORS.textMuted }]}>minutes</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.stepperBtn, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}
                      onPress={() => {
                        const n = Math.min(7 * 24 * 60, beforeExpiryCustom + 5);
                        setBeforeExpiryCustom(n);
                        setBeforeExpiryMinutes(n);
                      }}
                    >
                      <Ionicons name="add" size={16} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: 8,
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
});
