import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp, todayKey } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useTheme, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
import { currentStreak, longestStreak, lastNDays, dayKey } from '../utils/hobbyStats';
import { format, getDay, startOfMonth, addMonths, getDaysInMonth } from 'date-fns';
import ConfirmDialog from '../components/ConfirmDialog';

const CHART_HEIGHT = 130;
const CHART_BAR_GAP = 6;
// Square size for each day-cell in the all-time history grid. Matches the
// look of the 7-day mini-chart at the top so the two read as one design.
const MONTH_CELL = 18;

function WeekChart({ hobby, COLORS }) {
  const days = lastNDays(7);
  const max = 1; // 0 or 1 — simple bar chart.

  return (
    <View>
      <View style={styles.chartRow}>
        {days.map((d) => {
          const k = dayKey(d);
          const isDone = hobby.completions && hobby.completions[k];
          const isToday = k === todayKey();
          const height = Math.max(8, (isDone ? 1 : 0) / max * (CHART_HEIGHT - 24));

          return (
            <View key={k} style={styles.chartCol}>
              <View
                style={[
                  styles.chartBar,
                  {
                    height,
                    backgroundColor: isDone ? hobby.color : COLORS.border,
                    borderColor: isToday ? hobby.color : 'transparent',
                    borderWidth: isToday ? 2 : 0,
                  },
                ]}
              />
              <Text style={[styles.chartLabel, { color: COLORS.textMuted }]}>
                {format(d, 'EEE')[0]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// Day-of-week labels shown in the left column of every month block.
// Order is Mon-first (Monday = 0) so it lines up with the row indexing.
const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function MonthBlock({ monthDate, hobby, COLORS, today }) {
  const daysInMonth = getDaysInMonth(monthDate);
  const firstDow = getDay(monthDate); // 0 = Sun
  // Convert Sun-first index to Mon-first index so the first row is Monday.
  const leadingBlanks = (firstDow + 6) % 7;

  return (
    <View style={[styles.monthBlock, { borderColor: COLORS.border }]}>
      <Text style={[styles.monthTitle, { color: COLORS.text }]}>
        {format(monthDate, 'MMMM yyyy')}
      </Text>

      {/* Body: 7 weekday rows. Each row has its short label on the left
          and a horizontally-scrollable strip of cells, one per day. Cells
          are placed only where (day - 1 + leadingBlanks) % 7 === rowIndex.
          Each populated cell shows its day number on top so the user can
          read the date without a separate header row that would scroll
          out of sync. */}
      {DOW_LABELS.map((label, rowIdx) => (
        <View key={label} style={styles.monthRow}>
          <View style={styles.dowLabelCol}>
            <Text style={[styles.dowLabel, { color: COLORS.textMuted }]}>{label}</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.monthCellsScroll}
          >
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
              const colIdx = d - 1 + leadingBlanks;
              const belongsHere = colIdx % 7 === rowIdx;
              const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), d);
              const k = dayKey(date);
              const isDone = !!(hobby.completions && hobby.completions[k]);
              const isFuture = date > today;
              const isToday = k === todayKey();
              return (
                <View
                  key={d}
                  style={[
                    styles.monthCell,
                    {
                      width: MONTH_CELL,
                      height: MONTH_CELL,
                      backgroundColor: !belongsHere
                        ? 'transparent'
                        : isDone
                          ? hobby.color
                          : isFuture
                            ? 'transparent'
                            : COLORS.border,
                      borderColor: isToday ? hobby.color : 'transparent',
                      borderWidth: isToday ? 2 : 0,
                      // Hide non-matching cells completely so they don't
                      // waste a slot in the horizontal scroll.
                      opacity: belongsHere ? 1 : 0,
                    },
                  ]}
                >
                  {belongsHere && !isFuture && (
                    <Text style={[styles.monthCellNum, { color: COLORS.textMuted }]}>{d}</Text>
                  )}
                  {belongsHere && isFuture && (
                    <Text style={[styles.monthCellNum, { color: COLORS.textMuted, opacity: 0.4 }]}>{d}</Text>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

function YearGrid({ hobby, COLORS }) {
  // Oldest month at top → current month at bottom (matches a calendar /
  // log timeline). Each month is a separate block whose width is dictated
  // by the number of days in that month.
  const today = new Date();
  const createdAt = hobby.createdAt ? new Date(hobby.createdAt) : today;
  const startMonth = startOfMonth(createdAt);
  const endMonth = startOfMonth(today);

  const months = [];
  let cursor = startMonth;
  while (cursor <= endMonth) {
    months.push(new Date(cursor));
    cursor = addMonths(cursor, 1);
    if (months.length > 240) break; // safety cap — 20 years of history
  }

  // The screen already wraps this in a vertical ScrollView, so the
  // month list is just a plain View here. Each month block internally
  // scrolls horizontally to fit 28-31 day-columns.
  return (
    <View>
      {months.map((m) => (
        <MonthBlock
          key={m.toISOString()}
          monthDate={m}
          hobby={hobby}
          COLORS={COLORS}
          today={today}
        />
      ))}
    </View>
  );
}

export default function HobbyDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { COLORS } = useTheme();
  const { state, toggleHobbyToday, deleteHobby } = useApp();
  const toast = useToast();

  const initialId = route.params?.hobby?.id;
  const hobby = useMemo(
    () => state.hobbies.find((h) => h.id === initialId) || route.params?.hobby,
    [state.hobbies, initialId, route.params]
  );

  if (!hobby) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: COLORS.bg }]}>
        <Text style={{ color: COLORS.text, padding: SPACING.lg }}>Hobby not found.</Text>
      </SafeAreaView>
    );
  }

  const today = todayKey();
  const done = !!(hobby.completions && hobby.completions[today]);
  const streak = currentStreak(hobby.completions);
  const longest = longestStreak(hobby.completions);
  const totalDays = objectCount(hobby.completions);
  const memberSince = format(new Date(hobby.createdAt), 'MMM d, yyyy');

  // Confirm-dialog visibility — opening the dialog is just a state flip,
  // the actual deletion is gated on the user tapping Delete inside it.
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = () => setConfirmOpen(true);

  const confirmDelete = () => {
    setConfirmOpen(false);
    deleteHobby(hobby.id);
    toast.danger('Hobby deleted');
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: COLORS.bg }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}
          >
            <Ionicons name="chevron-back" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: COLORS.text }]}>Hobby</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('EditHobby', { hobby })}
            style={[styles.backBtn, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}
          >
            <Ionicons name="pencil-outline" size={18} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Hero card */}
        <View
          style={[
            styles.hero,
            { backgroundColor: COLORS.surfaceAlt, borderColor: hobby.color + '66' },
          ]}
        >
          <View style={[styles.heroIcon, { backgroundColor: hobby.color + '22' }]}>
            <Ionicons name={hobby.icon} size={36} color={hobby.color} />
          </View>
          <Text style={[styles.heroName, { color: COLORS.text }]}>{hobby.name}</Text>
          <Text style={[styles.heroSub, { color: COLORS.textMuted }]}>Since {memberSince}</Text>

          <TouchableOpacity
            onPress={() => toggleHobbyToday(hobby.id, today)}
            style={[
              styles.bigCheck,
              {
                borderColor: hobby.color,
                backgroundColor: done ? hobby.color : 'transparent',
              },
            ]}
          >
            {done ? (
              <Ionicons name="checkmark" size={28} color="#fff" />
            ) : (
              <Text style={[styles.bigCheckLabel, { color: hobby.color }]}>Mark today</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {[
            { val: streak,  label: 'Current streak',  icon: 'flame',      color: COLORS.warning },
            { val: longest, label: 'Longest streak',  icon: 'trophy-outline', color: COLORS.accent },
            { val: totalDays, label: 'Total days',    icon: 'calendar-outline', color: COLORS.success },
          ].map((s) => (
            <View
              key={s.label}
              style={[styles.statCard, { backgroundColor: COLORS.surfaceAlt, borderColor: s.color + '44' }]}
            >
              <Ionicons name={s.icon} size={16} color={s.color} />
              <Text style={[styles.statVal, { color: COLORS.text }]}>{s.val}</Text>
              <Text style={[styles.statLabel, { color: COLORS.textMuted }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Weekly chart */}
        <View style={[styles.section, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Past 7 days</Text>
          <WeekChart hobby={hobby} COLORS={COLORS} />
        </View>

        {/* Year grid */}
        <View style={[styles.section, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>All-time history</Text>
          <YearGrid hobby={hobby} COLORS={COLORS} />
        </View>

        <TouchableOpacity
          style={[styles.deleteBtn, { backgroundColor: COLORS.dangerDim, borderColor: COLORS.danger + '55' }]}
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
          <Text style={[styles.deleteBtnText, { color: COLORS.danger }]}>Delete hobby</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <ConfirmDialog
        visible={confirmOpen}
        title="Delete hobby"
        message={`Delete "${hobby.name}"? This also removes its history.`}
        icon="trash-outline"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </SafeAreaView>
  );
}

function objectCount(obj) {
  if (!obj) return 0;
  let count = 0;
  for (const k in obj) if (obj[k]) count++;
  return count;
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  container: { paddingHorizontal: SPACING.lg, paddingBottom: 40 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: SPACING.lg, marginBottom: SPACING.lg },
  backBtn:{ width: 36, height: 36, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  title:  { ...FONTS.heading, fontSize: 22 },

  hero: {
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    borderWidth: 1,
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  heroIcon: { width: 76, height: 76, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  heroName: { ...FONTS.heading, fontSize: 22, marginTop: SPACING.sm },
  heroSub:  { fontSize: 12 },
  bigCheck: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 14,
    borderRadius: RADIUS.pill,
    borderWidth: 2,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigCheckLabel: { fontWeight: '700', fontSize: 14 },

  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  statCard: { flex: 1, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, alignItems: 'center', gap: 4 },
  statVal:   { ...FONTS.heading, fontSize: 22 },
  statLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },

  section: { borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, marginBottom: SPACING.lg },
  sectionTitle: { ...FONTS.subheading, fontSize: 15, marginBottom: SPACING.md },

  chartRow: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, gap: CHART_BAR_GAP },
  chartCol: { flex: 1, alignItems: 'center', gap: SPACING.xs, justifyContent: 'flex-end' },
  chartBar: { width: '80%', borderRadius: 4 },
  chartLabel: { fontSize: 10, fontWeight: '700' },

  // All-time history — one block per month.
  monthBlock: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    backgroundColor: 'transparent',
  },
  monthTitle: { ...FONTS.subheading, fontSize: 13, marginBottom: SPACING.sm },
  monthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  dowLabelCol: { width: 36, alignItems: 'flex-start', justifyContent: 'center' },
  dowLabel: { fontSize: 10, fontWeight: '700' },
  monthCellsScroll: { flexDirection: 'row' },
  monthCell: { borderRadius: 3, marginRight: 3, alignItems: 'center', justifyContent: 'center' },
  monthCellNum: { fontSize: 8, fontWeight: '700' },

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.md,
  },
  deleteBtnText: { fontWeight: '700', fontSize: 14 },
});
