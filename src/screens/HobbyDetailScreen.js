import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useTheme, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
import { currentStreak, longestStreak, lastNDays, dayKey } from '../utils/hobbyStats';
import {
  buildMonthSections,
  isFutureCell,
  isCellInMonth,
  DOW_SHORT,
} from '../utils/yearGrid';
import { format } from 'date-fns';
import ConfirmDialog from '../components/ConfirmDialog';

const CHART_HEIGHT = 130;
const CHART_BAR_GAP = 6;
// Square size for each day-cell in the all-time history grid. Matches the
// look of the 7-day mini-chart at the top so the two read as one design.
const CELL = 14;
const CELL_GAP = 3;
// Visual gap between month sections in the year grid. The user wants
// each month to be a self-contained block, so this gap is what makes
// "July ends on Wednesday, then Aug starts on Thursday" readable at
// a glance.
const SECTION_GAP = 12;

function WeekChart({ hobby, COLORS, today }) {
  const days = lastNDays(7);
  const max = 1; // 0 or 1 — simple bar chart.

  return (
    <View>
      <View style={styles.chartRow}>
        {days.map((d) => {
          const k = dayKey(d);
          const isDone = hobby.completions && hobby.completions[k];
          const isToday = k === today;
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

// Vertical day-of-week labels (Mon, Tue, Wed, Thu, Fri, Sat, Sun) shown
// on the left edge of the GitHub-style grid. `DOW_LABELS` is sourced
// from `src/utils/yearGrid.js` so the row index of the body matches
// the label exactly (row 0 = Mon, row 6 = Sun).

// Render the current year of history as a row of per-month week
// blocks (Mon..Sun) like the GitHub contribution graph, but with
// each month rendered as its own self-contained block of weeks, with
// a visual gap between blocks so the user can see where one month
// ends and the next begins.
//
// Layout rules (Bug 3 fix + inter-month spacing):
//   - The grid is split into per-month sections. Each section is a
//     self-contained block of week columns.
//   - Each block starts on the Monday of the week containing the 1st
//     of the month, and ends on the Sunday of the week containing the
//     last day of the month.
//   - Cells inside a block that don't belong to the block's month
//     (e.g. Jun 29-30 in the July block, Aug 1-2 in the July block)
//     are skipped at render time — the block has empty cells in
//     those positions. This is what creates the visual "empty space
//     after Wednesday until the next month's block starts on Thursday".
//   - Cells for days strictly after today are NOT drawn at all
//     (no ghost, no border).
//   - The day-of-week gutter maps rowIdx 0..6 to Mon..Sun.
function YearGrid({ hobby, COLORS, today }) {
  // `today` is the YYYY-MM-DD string from state.today. We also keep
  // a Date mirror so `isFutureCell` / `buildMonthSections` can do
  // local-day comparisons.
  const todayDate = new Date(today + 'T00:00:00');

  // Per-month sections for the current year up to today's month.
  // Each section has its own weeks array; between sections the render
  // path inserts a visual gap so the user can see where one month
  // ends and the next begins.
  const sections = useMemo(() => buildMonthSections(todayDate), [today]);

  return (
    // The day-of-week gutter is FIXED on the left and does NOT scroll
    // with the history — the user always sees Mon..Sun (first letter
    // only) regardless of which month they're looking at. The actual
    // grid (month sections) is the only thing inside the horizontal
    // ScrollView.
    <View style={styles.ghRoot}>
      {/* Fixed DOW gutter on the left edge. */}
      <View style={styles.ghDowGutter}>
        {DOW_SHORT.map((letter, i) => (
          <View key={`dow-${i}`} style={styles.ghDowSlot}>
            <Text style={[styles.ghDowLabel, { color: COLORS.textMuted }]}>
              {letter}
            </Text>
          </View>
        ))}
      </View>

      {/* Horizontally scrolling region — one row of per-month blocks. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.ghScrollContent}
      >
        <View style={styles.ghRow}>
          {/* Per-month sections. Each section is a self-contained block
              of week columns with its own month label and a gap after it. */}
          {sections.map((section, secIdx) => (
            <View
              key={`sec-${section.year}-${section.month}`}
              style={[
                styles.ghSection,
                // No trailing gap after the last section.
                secIdx === sections.length - 1 ? null : { marginRight: SECTION_GAP },
              ]}
            >
              {/* Month label header — sits over the first week column. */}
              <View style={styles.ghSectionHeader}>
                <Text style={[styles.ghMonthLabel, { color: COLORS.textMuted }]}>
                  {section.label}
                </Text>
              </View>

              {/* 7 body rows (Mon..Sun) × N week columns for this month.
                  A skipped cell (out-of-month or future) renders a
                  transparent spacer of the same dimensions so the
                  row's flex layout keeps the remaining cells in their
                  correct column positions. Without the spacer, a row
                  of [Mon, Tue, null, null, null, null, null] would
                  compress to the left and break the column alignment
                  across week columns. */}
              {Array.from({ length: 7 }).map((_, rowIdx) => (
                <View key={`row-${rowIdx}`} style={styles.ghRow}>
                  {section.weeks.map((week, colIdx) => {
                    const date = week[rowIdx];
                    // Out-of-month or future cells both render as a
                    // transparent spacer of the same dimensions so the
                    // row's flex layout keeps the remaining cells in
                    // their correct column positions.
                    if (
                      !isCellInMonth(date, section.year, section.month) ||
                      isFutureCell(date, todayDate)
                    ) {
                      return (
                        <View
                          key={`sp-${secIdx}-${colIdx}-${rowIdx}`}
                          style={styles.ghCellSpacer}
                        />
                      );
                    }
                    const k = dayKey(date);
                    const isDone = !!(hobby.completions && hobby.completions[k]);
                    const isToday = k === today;
                    return (
                      <View
                        key={`c-${secIdx}-${colIdx}-${rowIdx}`}
                        style={[
                          styles.ghCell,
                          {
                            width: CELL,
                            height: CELL,
                            backgroundColor: isDone
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
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
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

  const today = state.today;
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
          <WeekChart hobby={hobby} COLORS={COLORS} today={state.today} />
        </View>

        {/* Year grid */}
        <View style={[styles.section, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>All-time history</Text>
          <YearGrid hobby={hobby} COLORS={COLORS} today={state.today} />
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

  // All-time history — GitHub-style contribution graph. The grid is
  // a horizontal list of per-month week blocks, separated by a visual
  // gap. Rows are days of the week (Mon..Sun). Each block carries its
  // own month label. The day-of-week gutter on the left is fixed and
  // does NOT scroll with the history; only the per-month blocks are
  // inside the horizontal ScrollView.
  ghRoot: { flexDirection: 'row', alignItems: 'flex-start' },
  ghScrollContent: { paddingRight: SPACING.sm, alignItems: 'flex-start' },
  ghRow:      { flexDirection: 'row', alignItems: 'flex-start' },
  ghDowGutter: {
    width: 16,
    flexDirection: 'column',
    // The first row of cells in a section starts BELOW the section
    // header (height 12 + marginBottom 4 = 16). Push the gutter down
    // by the same amount so the first label (Mon) lines up with the
    // first row of cells, not with the month label.
    marginTop: 16,
    marginRight: CELL_GAP,
  },
  ghDowSlot: {
    height: CELL + CELL_GAP,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  ghDowLabel: { fontSize: 9, fontWeight: '700' },
  ghSection:    { flexDirection: 'column' },
  ghSectionHeader: {
    height: 12,
    marginBottom: 4,
    flexDirection: 'row',
  },
  ghMonthLabel: { fontSize: 9, fontWeight: '700' },
  ghCell: {
    borderRadius: 2,
    marginRight: CELL_GAP,
    marginBottom: CELL_GAP,
  },
  // Transparent placeholder rendered in place of a skipped cell
  // (out-of-month or future) so the surrounding cells in the same
  // row keep their position. Without this, a row of [Mon, Tue, null,
  // null, null, null, null] would compress to the left and break
  // the column alignment across week columns.
  ghCellSpacer: {
    width: CELL,
    height: CELL,
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
