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
import {
  format, startOfMonth, startOfWeek, addDays, isAfter,
} from 'date-fns';
import ConfirmDialog from '../components/ConfirmDialog';

const CHART_HEIGHT = 130;
const CHART_BAR_GAP = 6;
// Square size for each day-cell in the all-time history grid. Matches the
// look of the 7-day mini-chart at the top so the two read as one design.
const CELL = 14;
const CELL_GAP = 3;

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

// Vertical day-of-week labels (Mon, Wed, Fri) shown on the left edge of
// the GitHub-style grid. Only every other row is labeled to keep the
// gutter compact.
const DOW_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

// Render the current year of history as a row of weeks (Mon..Sun) like
// the GitHub contribution graph. The grid starts on the Monday of the
// week containing Jan 1 of the current year and ends on today's date.
// Future days in the week containing today are rendered as transparent
// ghost cells so the rightmost column completes neatly.
function YearGrid({ hobby, COLORS }) {
  const today = new Date();
  // Anchor the grid to the Monday of the week containing Jan 1 of the
  // current year. Pre-Jan days are transparent placeholders so columns
  // line up.
  const startDate = startOfWeek(
    new Date(today.getFullYear(), 0, 1),
    { weekStartsOn: 1 },
  );
  const endDate = today;

  // Build an array of weeks from startDate..endDate, inclusive.
  const weeks = [];
  let cursor = startDate;
  while (!isAfter(cursor, endDate)) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  // If the last week doesn't include today, add a trailing week so the
  // grid can show today's cell always in the rightmost column.
  if (weeks.length === 0 || weeks[weeks.length - 1][6] < today) {
    const trailing = [];
    let t = startOfWeek(addDays(weeks[weeks.length - 1]?.[6] || today, 1), { weekStartsOn: 1 });
    for (let d = 0; d < 7; d++) {
      trailing.push(new Date(t));
      t = addDays(t, 1);
    }
    weeks.push(trailing);
  }

  // For each column, figure out which month label (if any) sits above it.
  // We place the label wherever the first day of a new month falls.
  const monthLabels = [];
  weeks.forEach((week, colIdx) => {
    const firstDay = week[0];
    // Only label the column whose Monday is in the first 7 days of a
    // month — otherwise mid-month labels would appear once and look
    // like floating words.
    if (firstDay.getDate() <= 7) {
      const monthStart = startOfMonth(firstDay);
      monthLabels.push({
        colIdx,
        label: format(monthStart, 'MMM'),
      });
    }
  });

  return (
    // Horizontal scroll for the whole graph — GitHub's behaviour on
    // mobile. The vertical parent ScrollView (screen) provides the
    // page-level scroll; this inner one lets the user drag the graph
    // left/right to see earlier/later weeks. The header row and 7 body
    // rows live inside the same scroller so month labels stay aligned
    // with their columns as the user scrolls.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.ghScrollContent}
    >
      <View>
        {/* Month labels row — one absolute slot per week column. */}
        <View style={styles.ghHeaderRow}>
          <View style={styles.ghDowGutter} />
          <View style={styles.ghColumnsArea}>
            {weeks.map((_, colIdx) => {
              const lbl = monthLabels.find((m) => m.colIdx === colIdx);
              return (
                <View
                  key={`mh-${colIdx}`}
                  style={[styles.ghMonthCell, { width: CELL }]}
                >
                  {lbl ? (
                    <Text style={[styles.ghMonthLabel, { color: COLORS.textMuted }]}>
                      {lbl.label}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

      {/* Grid body — 7 rows (Mon..Sun) × N week columns. */}
      <View style={styles.ghBody}>
        {Array.from({ length: 7 }).map((_, rowIdx) => (
          <View key={`row-${rowIdx}`} style={styles.ghRow}>
            <View style={styles.ghDowGutter}>
              <Text style={[styles.ghDowLabel, { color: COLORS.textMuted }]}>
                {DOW_LABELS[rowIdx]}
              </Text>
            </View>
            <View style={styles.ghColumnsArea}>
              {weeks.map((week, colIdx) => {
                const date = week[rowIdx];
                const isFuture = isAfter(date, today);
                // Cells outside the active year still render so the
                // row spacing is consistent, but as transparent ghosts.
                const showCell = !isFuture;
                const k = dayKey(date);
                const isDone = showCell && !!(hobby.completions && hobby.completions[k]);
                const isToday = k === todayKey();
                return (
                  <View
                    key={`c-${colIdx}-${rowIdx}`}
                    style={[
                      styles.ghCell,
                      {
                        width: CELL,
                        height: CELL,
                        backgroundColor: !showCell
                          ? 'transparent'
                          : isDone
                            ? hobby.color
                            : COLORS.border,
                        borderColor: isToday ? hobby.color : 'transparent',
                        borderWidth: isToday ? 2 : 0,
                      },
                    ]}
                  />
                );
              })}
            </View>
          </View>
        ))}
      </View>
      </View>
    </ScrollView>
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

  // All-time history — GitHub-style contribution graph. The whole grid is
  // a horizontal list of week columns; rows are days of the week
  // (Mon..Sun). Months label only the column where the month begins,
  // matching GitHub. The entire grid scrolls vertically as one block —
  // individual cells never have their own scroller.
  ghScrollContent: { paddingRight: SPACING.sm },
  ghHeaderRow: { flexDirection: 'row', marginBottom: 4 },
  ghBody:     { flexDirection: 'column' },
  ghRow:      { flexDirection: 'row' },
  ghDowGutter: {
    width: 30,
    height: CELL + CELL_GAP,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingTop: 0,
  },
  ghDowLabel: { fontSize: 9, fontWeight: '700' },
  ghColumnsArea: { flexDirection: 'row' },
  ghMonthCell:  { height: 12, marginRight: CELL_GAP, justifyContent: 'flex-end' },
  ghMonthLabel: { fontSize: 9, fontWeight: '700' },
  ghCell: {
    borderRadius: 2,
    marginRight: CELL_GAP,
    marginBottom: CELL_GAP,
  },

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
