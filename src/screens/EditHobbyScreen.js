import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useTheme, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
import InlineTimePicker from '../components/InlineTimePicker';

const ICONS = [
  'barbell-outline', 'book-outline', 'brush-outline', 'leaf-outline',
  'musical-notes-outline', 'bicycle-outline', 'water-outline', 'flame-outline',
  'medkit-outline', 'fitness-outline', 'headset-outline', 'cafe-outline',
  'airplane-outline', 'bed-outline', 'walk-outline', 'code-slash-outline',
  'camera-outline', 'flower-outline', 'pizza-outline', 'game-controller-outline',
  'pencil-outline', 'heart-outline',
];

const COLOR_OPTIONS_KEY = 'cat';

// Day-of-week letters shown in the reminder row. Order matches JS getDay()
// (0 = Sunday).
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_LONG   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Format a Date as "8:00 PM" — display only; storage is 24-hour.
function formatTimeHHMM(d) {
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Render "Daily at 8:00 PM" or "Mon, Wed, Fri at 8:00 PM".
function formatReminderSummary(date, days) {
  const time = formatTimeHHMM(date);
  if (!days || days.length === 0) return `Never — pick at least one day`;
  if (days.length === 7) return `Daily at ${time}`;
  return `${days.map((d) => DAY_LONG[d]).join(', ')} at ${time}`;
}

// Parse "HH:mm" (or null) into a Date object for the time picker; defaults
// to 8:00 PM when the hobby has no reminder yet.
function parseHHMMToDate(hhmm) {
  const d = new Date();
  if (!hhmm) {
    d.setHours(20, 0, 0, 0);
    return d;
  }
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  d.setHours(h, m, 0, 0);
  return d;
}

export default function EditHobbyScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const hobby = route.params?.hobby;
  const { updateHobby } = useApp();
  const { COLORS } = useTheme();
  const toast = useToast();

  const COLOR_OPTIONS = COLORS[COLOR_OPTIONS_KEY];

  // Pre-fill from the existing hobby. If the hobby is missing, bail out.
  const [name, setName] = useState(hobby?.name || '');
  const [icon, setIcon] = useState(hobby?.icon || ICONS[0]);
  const [color, setColor] = useState(hobby?.color || COLOR_OPTIONS[0]);

  // Reminder fields — initialized from the stored values, falling back to
  // sensible defaults if the hobby was created before reminders existed.
  const [reminderOn, setReminderOn]     = useState(!!hobby?.reminderTime);
  const [reminderTime, setReminderTime] = useState(() => parseHHMMToDate(hobby?.reminderTime));
  const [reminderDays, setReminderDays] = useState(
    Array.isArray(hobby?.reminderDays) && hobby.reminderDays.length > 0
      ? hobby.reminderDays.slice()
      : [0, 1, 2, 3, 4, 5, 6],
  );

  if (!hobby) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: COLORS.bg }]}>
        <Text style={{ color: COLORS.text, padding: SPACING.lg }}>Hobby not found.</Text>
      </SafeAreaView>
    );
  }

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a hobby name.');
      return;
    }
    if (reminderOn && reminderDays.length === 0) {
      Alert.alert('Pick a day', 'Choose at least one day for the reminder.');
      return;
    }
    const hh = String(reminderTime.getHours()).padStart(2, '0');
    const mm = String(reminderTime.getMinutes()).padStart(2, '0');
    updateHobby({
      ...hobby,
      name: name.trim(),
      icon,
      color,
      reminderTime: reminderOn ? `${hh}:${mm}` : null,
      reminderDays:  reminderOn ? reminderDays.slice() : null,
    });
    toast.success('Hobby updated');
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: COLORS.bg }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.containerContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}
          >
            <Ionicons name="chevron-back" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: COLORS.text }]}>Edit hobby</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={[styles.preview, { backgroundColor: COLORS.surfaceAlt, borderColor: color + '66' }]}>
          <Ionicons name={icon} size={26} color={color} />
          <Text style={[styles.previewName, { color }]}>{name || 'Hobby name'}</Text>
        </View>

        <Text style={[styles.fieldLabel, { color: COLORS.textMuted }]}>NAME</Text>
        <TextInput
          style={[styles.input, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border, color: COLORS.text }]}
          placeholder="e.g. Read, Run, Meditate"
          placeholderTextColor={COLORS.textMuted}
          value={name}
          onChangeText={setName}
          maxLength={40}
        />

        <Text style={[styles.fieldLabel, { color: COLORS.textMuted }]}>ICON</Text>
        <View style={styles.iconGrid}>
          {ICONS.map((ic) => (
            <TouchableOpacity
              key={ic}
              style={[
                styles.iconBtn,
                { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border },
                icon === ic && { borderColor: color, backgroundColor: color + '22' },
              ]}
              onPress={() => setIcon(ic)}
            >
              <Ionicons
                name={ic}
                size={20}
                color={icon === ic ? color : COLORS.textSub}
              />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.fieldLabel, { color: COLORS.textMuted }]}>COLOR</Text>
        <View style={styles.colorRow}>
          {COLOR_OPTIONS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.colorDot,
                { backgroundColor: c },
                color === c && styles.colorDotSelected,
              ]}
              onPress={() => setColor(c)}
            >
              {color === c && (
                <Ionicons name="checkmark" size={12} color="#fff" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Daily reminder — opt-in toggle, time picker, day-of-week pills. */}
        <View style={[styles.reminderCard, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
          <View style={styles.reminderHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.reminderTitle, { color: COLORS.text }]}>Daily reminder</Text>
              <Text style={[styles.reminderSub, { color: COLORS.textMuted }]}>
                {reminderOn
                  ? formatReminderSummary(reminderTime, reminderDays)
                  : 'Off — toggle on to get a daily nudge'}
              </Text>
            </View>
            <Switch
              value={reminderOn}
              onValueChange={setReminderOn}
              trackColor={{ false: COLORS.border, true: COLORS.accent + '88' }}
              thumbColor={reminderOn ? COLORS.accent : COLORS.textMuted}
            />
          </View>

          {reminderOn && (
            <>
              <Text style={[styles.timePickerLabel, { color: COLORS.textMuted }]}>TIME</Text>
              <InlineTimePicker
                value={reminderTime}
                onChange={setReminderTime}
                accent={COLORS.accent}
                surface={COLORS.surface}
                surfaceAlt={COLORS.surfaceAlt}
                border={COLORS.border}
                text={COLORS.text}
                textMuted={COLORS.textMuted}
              />

              <Text style={[styles.dayPickerLabel, { color: COLORS.textMuted }]}>DAYS</Text>
              <View style={styles.dayPickerRow}>
                {DAY_LETTERS.map((letter, i) => {
                  const active = reminderDays.includes(i);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.dayPill,
                        {
                          backgroundColor: active ? color : COLORS.surface,
                          borderColor: active ? color : COLORS.border,
                        },
                      ]}
                      onPress={() => {
                        setReminderDays((prev) =>
                          prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort(),
                        );
                      }}
                    >
                      <Text
                        style={[
                          styles.dayPillText,
                          { color: active ? '#fff' : COLORS.textMuted },
                        ]}
                      >
                        {letter}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: color }]}
          onPress={handleSave}
        >
          <Ionicons name="save-outline" size={16} color="#fff" />
          <Text style={styles.saveBtnText}>Save changes</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, paddingHorizontal: SPACING.lg },
  containerContent: { paddingBottom: SPACING.xxl },

  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: SPACING.lg, marginBottom: SPACING.xl },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  title:   { ...FONTS.heading, fontSize: 22 },

  preview:     { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, gap: SPACING.md, marginBottom: SPACING.xl },
  previewName: { fontSize: 18, fontWeight: '800' },

  fieldLabel: { ...FONTS.label, marginBottom: SPACING.sm, fontSize: 11 },
  input:      { borderRadius: RADIUS.md, borderWidth: 1, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12, marginBottom: SPACING.lg },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  iconBtn:  { width: 44, height: 44, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },

  colorRow:        { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg, flexWrap: 'wrap' },
  colorDot:        { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  colorDotSelected:{ borderColor: '#fff', transform: [{ scale: 1.15 }] },

  // Reminder card
  reminderCard: { borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, marginBottom: SPACING.lg, gap: SPACING.md },
  reminderHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
  reminderTitle: { fontSize: 15, fontWeight: '700' },
  reminderSub:   { fontSize: 11, marginTop: 2 },
  timePickerLabel: { ...FONTS.label, fontSize: 11 },
  dayPickerLabel: { ...FONTS.label, fontSize: 11 },
  dayPickerRow: { flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
  dayPill: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  dayPillText: { fontSize: 13, fontWeight: '800' },

  saveBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.lg, paddingVertical: 14, marginTop: SPACING.md, gap: 8, ...SHADOW.accent },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
