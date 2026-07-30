import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp, todayKey } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useTheme, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
import { currentStreak, longestStreak, lastNDays, dayKey } from '../utils/hobbyStats';
import { format, startOfYear, getDay, addDays, subDays } from 'date-fns';

const CHART_HEIGHT = 130;
const CHART_BAR_GAP = 6;

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

function YearGrid({ hobby, COLORS }) {
  // Build a Mon-first weekly grid. Trim the trailing weeks to the one
  // containing today so the user can never scroll into the future — only
  // into the past.
  const today = new Date();
  const yearStart = startOfYear(today);
  const firstDay = getDay(yearStart); // 0 = Sun
  const offsetDays = (firstDay + 6) % 7; // shift to Mon-first
  const gridStart = subDays(yearStart, offsetDays);

  const weeks = [];
  let cursor = new Date(gridStart);
  // Stop at the week containing today (its Sunday is the last cell of that
  // week). We don't push any weeks whose first day is after today.
  while (true) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
    // Week's Monday (= week[0]) is already past today → this was the last
    // week we need. Break BEFORE pushing it if it's a wholly-future week.
    if (week[0] > today) {
      weeks.pop();
      break;
    }
    // Safety cap — never loop forever.
    if (weeks.length >= 60) break;
  }

  // Month labels: only the FIRST week of each month (chronological order).
  const monthLabels = [];
  let lastMonth = -1;
  weeks.forEach((week, i) => {
    const wk = week[0];
    if (wk.getMonth() !== lastMonth && wk.getFullYear() === today.getFullYear()) {
      monthLabels.push({ i, label: format(wk, 'MMM') });
      lastMonth = wk.getMonth();
    }
  });

  // Cell sizing must match the styles below: 14 + 3 (gap).
  const CELL = 14;
  const GAP = 3;
  const cellStride = CELL + GAP;

  // Scroll-to-end on first layout so the user lands on today (latest, right side).
  const scrollRef = useRef(null);
  const [didScroll, setDidScroll] = useState(false);
  const onContentSizeChange = () => {
    if (didScroll) return;
    setDidScroll(true);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
    });
  };

  return (
    <ScrollView
      horizontal
      ref={scrollRef}
      showsHorizontalScrollIndicator={false}
      onContentSizeChange={onContentSizeChange}
    >
      <View>
        {/* Month labels row — scrolls along with the grid below */}
        <View style={[styles.gridHeader, { width: weeks.length * cellStride - GAP }]}>
          {monthLabels.map((m) => (
            <Text
              key={m.i}
              style={[
                styles.gridMonthLabel,
                { color: COLORS.textMuted, left: m.i * cellStride },
              ]}
              numberOfLines={1}
            >
              {m.label}
            </Text>
          ))}
        </View>

        {/* Grid cells — same width so labels stay aligned as the user scrolls */}
        <View style={[styles.gridContainer, { width: weeks.length * cellStride - GAP }]}>
          {weeks.map((week, i) => (
            <View key={i} style={styles.gridCol}>
              {week.map((d) => {
                const inYear = d.getFullYear() === today.getFullYear();
                const k = dayKey(d);
                const isDone = inYear && hobby.completions && hobby.completions[k];
                const isFuture = d > today;
                return (
                  <View
                    key={k}
                    style={[
                      styles.gridCell,
                      {
                        backgroundColor: !inYear
                          ? 'transparent'
                          : isDone
                            ? hobby.color
                            : isFuture
                              ? 'transparent'
                              : COLORS.border,
                      },
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function isLeap(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
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

  const handleDelete = () => {
    Alert.alert(
      'Delete hobby',
      `Delete "${hobby.name}"? This also removes its history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteHobby(hobby.id);
            toast.danger('Hobby deleted');
            navigation.goBack();
          },
        },
      ]
    );
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
          <View style={{ width: 36 }} />
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

  gridHeader: { height: 16, position: 'relative', marginBottom: SPACING.xs },
  gridMonthLabel: { fontSize: 10, fontWeight: '700', position: 'absolute' },
  gridContainer: { flexDirection: 'row', gap: 3 },
  gridCol: { gap: 3 },
  gridCell: { width: 14, height: 14, borderRadius: 3 },

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
