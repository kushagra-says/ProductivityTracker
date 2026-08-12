import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { useTheme, ACCENTS, ACCENTS_CREAM, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
import InlineTimePicker from '../components/InlineTimePicker';

// Parse a stored "HH:mm" string into a Date for the time picker.
const timeFromHHMM = (hhmm) => {
  const d = new Date();
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  d.setHours(h, m, 0, 0);
  return d;
};

const hhmmFromDate = (d) => {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const formatTime = (hhmm) => {
  const d = timeFromHHMM(hhmm);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

function NotificationRow({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  timeValue,
  onTimeChange,
  COLORS,
  danger,
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={[styles.notifRow, { borderBottomColor: COLORS.border }]}>
      <View style={styles.notifRowTop}>
        <View style={[styles.rowIconWrap, { backgroundColor: COLORS.accentDim }]}>
          <Ionicons name={icon} size={18} color={danger ? COLORS.danger : COLORS.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: COLORS.text }]}>{title}</Text>
          <Text style={[styles.rowSub, { color: COLORS.textMuted }]}>
            {value
              ? `At ${formatTime(timeValue)}`
              : subtitle}
          </Text>
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: COLORS.border, true: COLORS.accent + '88' }}
          thumbColor={value ? COLORS.accent : COLORS.textMuted}
        />
      </View>

      {value && (
        <View style={styles.timeBlock}>
          <TouchableOpacity
            style={[styles.timeBtn, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}
            onPress={() => setExpanded((v) => !v)}
          >
            <Ionicons name="time-outline" size={16} color={COLORS.accent} />
            <Text style={[styles.timeBtnText, { color: COLORS.text }]}>
              {formatTime(timeValue)}
            </Text>
            <Ionicons
              name={expanded ? 'chevron-down' : 'chevron-up'}
              size={14}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>

          {expanded && (
            <View style={{ marginTop: 10 }}>
              <InlineTimePicker
                value={timeFromHHMM(timeValue)}
                onChange={(d) => onTimeChange(hhmmFromDate(d))}
                accent={COLORS.accent}
                surface={COLORS.surface}
                surfaceAlt={COLORS.surfaceAlt}
                border={COLORS.border}
                text={COLORS.text}
                textMuted={COLORS.textMuted}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const { COLORS, mode, accent, visibleAccentKeys, setAccentChoice, toggleThemeMode } = useTheme();
  const { state, updateSettings } = useApp();
  const navigation = useNavigation();
  const settings = state.settings;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: COLORS.bg }]}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}
          >
            <Ionicons name="chevron-back" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: COLORS.text }]}>Settings</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Theme toggle */}
        <Text style={[styles.section, { color: COLORS.textMuted }]}>APPEARANCE</Text>
        <View style={[styles.card, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
          <TouchableOpacity
            style={styles.row}
            onPress={toggleThemeMode}
          >
            <View style={[styles.rowIconWrap, { backgroundColor: COLORS.accentDim }]}>
              <Ionicons
                name={mode === 'dark' ? 'moon' : 'sunny'}
                size={18}
                color={COLORS.accent}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: COLORS.text }]}>Theme</Text>
              <Text style={[styles.rowSub, { color: COLORS.textMuted }]}>
                {mode === 'dark' ? 'Dark' : 'Cream'} — tap to switch
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Accent picker — grid depends on the active theme. Dark shows the
            original 4; cream shows 4 + a 'brown' row. */}
        <Text style={[styles.section, { color: COLORS.textMuted, marginTop: SPACING.xl }]}>
          ACCENT COLOR
        </Text>
        <View style={styles.accentGrid}>
          {visibleAccentKeys.map((key) => {
            const palette = mode === 'dark' ? ACCENTS : ACCENTS_CREAM;
            const c = palette[key];
            const isActive = accent === key;
            return (
              <TouchableOpacity
                key={key}
                activeOpacity={0.7}
                onPress={() => setAccentChoice(key)}
                style={[
                  styles.accentCard,
                  {
                    backgroundColor: COLORS.surfaceAlt,
                    borderColor: isActive ? c.accent : COLORS.border,
                    borderWidth: isActive ? 2 : 1,
                  },
                ]}
              >
                <View style={[styles.accentSwatch, { backgroundColor: c.accent }]}>
                  {isActive && <Ionicons name="checkmark" size={20} color="#fff" />}
                </View>
                <Text style={[styles.accentName, { color: COLORS.text }]}>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Notifications */}
        <Text style={[styles.section, { color: COLORS.textMuted, marginTop: SPACING.xl }]}>
          NOTIFICATIONS
        </Text>
        <View style={[styles.card, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
          <NotificationRow
            icon="list-circle-outline"
            title="Pending tasks reminder"
            subtitle="Daily reminder to clear pending work"
            value={settings.tasksReminderEnabled}
            onValueChange={(v) => updateSettings({ tasksReminderEnabled: v })}
            timeValue={settings.tasksReminderTime}
            onTimeChange={(t) => updateSettings({ tasksReminderTime: t })}
            COLORS={COLORS}
          />
          <NotificationRow
            icon="sunny-outline"
            title="Morning briefing"
            subtitle="Wake-up nudge with today's plan"
            value={settings.morningBriefingEnabled}
            onValueChange={(v) => updateSettings({ morningBriefingEnabled: v })}
            timeValue={settings.morningBriefingTime}
            onTimeChange={(t) => updateSettings({ morningBriefingTime: t })}
            COLORS={COLORS}
          />
          <NotificationRow
            icon="flame-outline"
            title="Streak-at-risk nudge"
            subtitle="One-shot ping if you haven't completed anything yet today"
            value={settings.streakNudgeEnabled}
            onValueChange={(v) => updateSettings({ streakNudgeEnabled: v })}
            timeValue={settings.streakNudgeTime}
            onTimeChange={(t) => updateSettings({ streakNudgeTime: t })}
            COLORS={COLORS}
            danger
          />
        </View>

        {/* Data info */}
        <Text style={[styles.section, { color: COLORS.textMuted, marginTop: SPACING.xl }]}>
          ABOUT
        </Text>
        <View style={[styles.card, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
          <View style={styles.aboutRow}>
            <Ionicons name="lock-closed-outline" size={16} color={COLORS.textMuted} />
            <Text style={[styles.aboutText, { color: COLORS.textSub }]}>
              All your data stays on this device.
            </Text>
          </View>
          <View style={styles.aboutRow}>
            <Ionicons name="refresh-outline" size={16} color={COLORS.textMuted} />
            <Text style={[styles.aboutText, { color: COLORS.textSub }]}>
              Reinstalling over the existing app keeps your progress.
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  container: { flex: 1, paddingHorizontal: SPACING.lg },

  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: SPACING.lg, marginBottom: SPACING.xl },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  title:   { ...FONTS.heading, fontSize: 22 },

  section: { ...FONTS.label, marginBottom: SPACING.sm, fontSize: 11 },

  card: { borderRadius: RADIUS.lg, padding: 4, borderWidth: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSub:   { fontSize: 11, marginTop: 2 },

  // Notification rows — a column with the toggle row + the time button.
  notifRow: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  notifRowTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  timeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACING.md,
    marginLeft: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  timeBtnText: { flex: 1, fontSize: 14, fontWeight: '700' },

  accentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  accentCard: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  accentSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentName: { fontSize: 14, fontWeight: '700' },

  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  aboutText: { fontSize: 12, flex: 1 },
});