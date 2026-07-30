import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp, todayKey } from '../context/AppContext';
import { useTheme, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
import {
  format, subDays, startOfDay, isWithinInterval, endOfDay,
} from 'date-fns';
import MonthlyCategoryLineChart from '../components/MonthlyCategoryLineChart';
import { lastNDays, dayKey } from '../utils/hobbyStats';
import { useCountUp } from '../hooks/useCountUp';
import { usePullRefresh } from '../hooks/usePullRefresh';

const FALLBACK_CATEGORY_ICON = 'folder-outline';
function isIoniconsName(s) {
  return typeof s === 'string' && /^[a-z]+(?:-outline)?$/.test(s);
}

function BarChart({ data, color, COLORS, height = 100, maxOverride = null }) {
  const max = maxOverride ?? Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 4 }}>
      {data.map((d, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <View
            style={{
              width: '80%',
              height: Math.max(4, (d.value / max) * (height - 22)),
              backgroundColor: color + (d.value > 0 ? 'FF' : '33'),
              borderRadius: 4,
            }}
          />
          <Text style={{ fontSize: 9, color: COLORS.textMuted, fontWeight: '600' }}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

const RANGES = [
  { key: 'all',    label: 'All time' },
  { key: '30',     label: '30 days' },
  { key: '7',      label: '7 days'  },
];

function rangeCutoff(range) {
  if (range === 'all') return new Date(0);
  const days = parseInt(range, 10);
  return subDays(new Date(), days);
}

export default function InsightsScreen() {
  const { state } = useApp();
  const { COLORS } = useTheme();
  const [range, setRange] = useState('all');
  const { refreshing, onRefresh } = usePullRefresh();

  // 7-day daily completions (hobby + task) — independent of range filter.
  const last7 = useMemo(() => {
    return lastNDays(7).map((d) => {
      const k = dayKey(d);
      const taskDone = state.tasks.filter(
        (t) =>
          t.status === 'completed' &&
          t.completedAt &&
          isWithinInterval(new Date(t.completedAt), { start: startOfDay(d), end: endOfDay(d) }),
      ).length;
      const hobbyDone = state.hobbies.reduce((acc, h) => {
        return acc + (h.completions && h.completions[k] ? 1 : 0);
      }, 0);
      return { label: format(d, 'EEE'), taskValue: taskDone, hobbyValue: hobbyDone };
    });
  }, [state.tasks, state.hobbies]);

  // Range-filtered stats.
  const stats = useMemo(() => {
    const cutoff = rangeCutoff(range);
    const filtered = state.tasks.filter((t) => new Date(t.createdAt) >= cutoff);
    const completed = filtered.filter((t) => t.status === 'completed').length;
    const expired = filtered.filter((t) => t.status === 'expired').length;
    const pending = filtered.filter((t) => t.status === 'pending').length;
    const total = filtered.length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, expired, pending, total, rate };
  }, [state.tasks, range]);

  // All-time stats (always shown — this is the "all-time" panel).
  const allTime = useMemo(() => {
    const completed = state.tasks.filter((t) => t.status === 'completed').length;
    const total = state.tasks.length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const activeHobbies = state.hobbies.length;
    const totalHobbyDays = state.hobbies.reduce(
      (acc, h) => acc + (h.completions ? Object.keys(h.completions).length : 0),
      0,
    );
    return {
      completed,
      total,
      rate,
      activeHobbies,
      totalHobbyDays,
      bestStreak: state.streak,
    };
  }, [state.tasks, state.hobbies, state.streak]);

  // Today's combined progress — drives the hero card.
  // Task rate uses "active today" (created on/before today and not expired),
  // so the rate stays meaningful even if old tasks are still in the list.
  // Hobby rate is fraction of total hobbies checked off for today.
  // Combined is a simple average so each contributes equally.
  const todayStats = useMemo(() => {
    const now = new Date();
    const start = startOfDay(now);
    const end = endOfDay(now);
    const k = todayKey();

    const tasksActiveToday = state.tasks.filter((t) => {
      if (!t || t.status === 'expired') return false;
      const created = new Date(t.createdAt);
      if (created > end) return false;
      if (t.expiryDate && new Date(t.expiryDate) < start) return false;
      return true;
    });
    const tasksCompletedToday = tasksActiveToday.filter(
      (t) =>
        t.status === 'completed' &&
        t.completedAt &&
        isWithinInterval(new Date(t.completedAt), { start, end }),
    );
    const taskRate =
      tasksActiveToday.length > 0
        ? Math.round((tasksCompletedToday.length / tasksActiveToday.length) * 100)
        : 0;

    const totalHobbies = state.hobbies.length;
    const hobbiesDoneToday = state.hobbies.reduce(
      (acc, h) => acc + (h.completions && h.completions[k] ? 1 : 0),
      0,
    );
    const hobbyRate =
      totalHobbies > 0 ? Math.round((hobbiesDoneToday / totalHobbies) * 100) : 0;

    // Combined: average the two percentages, weighted only by which side
    // has any data. If both empty → 0. If only one side has data, use it.
    let combined = 0;
    const sides = [tasksActiveToday.length > 0, totalHobbies > 0].filter(Boolean).length;
    if (sides === 2) combined = Math.round((taskRate + hobbyRate) / 2);
    else if (sides === 1) combined = tasksActiveToday.length > 0 ? taskRate : hobbyRate;

    return {
      tasksCompletedToday: tasksCompletedToday.length,
      tasksActiveToday: tasksActiveToday.length,
      taskRate,
      hobbiesDoneToday,
      totalHobbies,
      hobbyRate,
      combined,
      hasAnyData: sides > 0,
    };
  }, [state.tasks, state.hobbies]);

  const categoryStats = useMemo(() => {
    const cutoff = rangeCutoff(range);
    return state.categories
      .map((cat) => {
        const tasks = state.tasks.filter((t) => t.categoryId === cat.id && new Date(t.createdAt) >= cutoff);
        const done = tasks.filter((t) => t.status === 'completed').length;
        const expired = tasks.filter((t) => t.status === 'expired').length;
        const pending = tasks.filter((t) => t.status === 'pending').length;
        const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
        return { ...cat, tasks: tasks.length, done, expired, pending, pct };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [state.categories, state.tasks, range]);

  const priorityStats = useMemo(() => {
    const cutoff = rangeCutoff(range);
    return ['High', 'Medium', 'Low'].map((p) => {
      const pTasks = state.tasks.filter((t) => t.priority === p && new Date(t.createdAt) >= cutoff);
      const done = pTasks.filter((t) => t.status === 'completed').length;
      const pct = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0;
      return { label: p, tasks: pTasks, done, pct };
    });
  }, [state.tasks, range]);

  const rangeLabel = RANGES.find((r) => r.key === range)?.label || 'All time';

  // Animated counters — tick up whenever the underlying value changes.
  const animatedRate       = useCountUp(todayStats.combined);
  const animatedCompleted  = useCountUp(stats.completed);
  const animatedPending    = useCountUp(stats.pending);
  const animatedExpired    = useCountUp(stats.expired);
  const animatedHobbies    = useCountUp(allTime.activeHobbies);
  const animatedHobbyDays  = useCountUp(allTime.totalHobbyDays);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: COLORS.bg }]}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
      >

        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: COLORS.text }]}>Insights</Text>
          <View style={styles.rangeChips}>
            {RANGES.map((r) => (
              <TouchableOpacity
                key={r.key}
                onPress={() => setRange(r.key)}
                style={[
                  styles.rangeChip,
                  { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border },
                  range === r.key && { backgroundColor: COLORS.accentDim, borderColor: COLORS.accent },
                ]}
              >
                <Text
                  style={[
                    styles.rangeChipText,
                    { color: COLORS.textMuted },
                    range === r.key && { color: COLORS.accent },
                  ]}
                >
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Today hero — combined tasks + hobbies */}
        <View style={[styles.rateCard, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.accent + '33' }]}>
          <View style={styles.rateLeft}>
            <Text style={[styles.chartTitle, { color: COLORS.textMuted }]}>Today</Text>
            <Text style={[styles.rateValue, { color: COLORS.text }]}>{animatedRate}%</Text>
            <Text style={[styles.rateSubtext, { color: COLORS.textSub }]}>
              {todayStats.hasAnyData
                ? `${todayStats.tasksCompletedToday} of ${todayStats.tasksActiveToday} tasks · ${todayStats.hobbiesDoneToday} of ${todayStats.totalHobbies} hobbies`
                : 'Add a task or hobby to start tracking'}
            </Text>
            <View style={styles.streakInfo}>
              <Ionicons name="flame" size={14} color={COLORS.warning} />
              <Text style={[styles.streakInfoText, { color: COLORS.warning }]}>
                {state.streak} day current streak
              </Text>
            </View>
          </View>
          <View style={styles.rateCircle}>
            <View style={[styles.rateCircleInner, { borderColor: COLORS.accent }]}>
              <Text style={[styles.rateCirclePercent, { color: COLORS.accent }]}>
                {`${animatedRate}%`}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats summary */}
        <View style={styles.summaryRow}>
          {[
            { val: animatedCompleted, color: COLORS.success, label: 'Completed', icon: 'checkmark-circle' },
            { val: animatedPending,   color: COLORS.accent,  label: 'Pending',   icon: 'time-outline' },
            { val: animatedExpired,   color: COLORS.danger,  label: 'Expired',   icon: 'alert-circle' },
          ].map((item) => (
            <View
              key={item.label}
              style={[styles.summaryCard, { backgroundColor: COLORS.surfaceAlt, borderColor: item.color + '44' }]}
            >
              <Ionicons name={item.icon} size={18} color={item.color} />
              <Text style={[styles.summaryVal, { color: item.color }]}>{item.val}</Text>
              <Text style={[styles.summaryLabel, { color: COLORS.textMuted }]}>
                {item.label} ({rangeLabel.toLowerCase()})
              </Text>
            </View>
          ))}
        </View>

        {/* Hobbies summary */}
        <View style={[styles.chartCard, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="leaf-outline" size={18} color={COLORS.success} />
            <Text style={[styles.chartTitle, { color: COLORS.text, marginLeft: 8, marginBottom: 0 }]}>Hobbies</Text>
          </View>
          <View style={styles.hobbyStatsRow}>
            {[
              { val: animatedHobbies,   label: 'Active hobbies', color: COLORS.accent,  icon: 'leaf' },
              { val: animatedHobbyDays, label: 'Days completed', color: COLORS.success, icon: 'calendar' },
              { val: state.streak,      label: 'Day streak',     color: COLORS.warning, icon: 'flame' },
            ].map((s) => (
              <View
                key={s.label}
                style={[styles.summaryCard, { backgroundColor: COLORS.surface, borderColor: s.color + '33' }]}
              >
                <Ionicons name={s.icon} size={18} color={s.color} />
                <Text style={[styles.summaryVal, { color: COLORS.text }]}>{s.val}</Text>
                <Text style={[styles.summaryLabel, { color: COLORS.textMuted }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Task daily completions (last 7) */}
        <View style={[styles.chartCard, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
          <Text style={[styles.chartTitle, { color: COLORS.text }]}>Task completions (past 7 days)</Text>
          <BarChart
            data={last7.map((d) => ({ label: d.label, value: d.taskValue }))}
            color={COLORS.accent}
            COLORS={COLORS}
            height={100}
          />
        </View>

        {/* Hobby daily completions (last 7) */}
        <View style={[styles.chartCard, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
          <Text style={[styles.chartTitle, { color: COLORS.text }]}>Hobby consistency (past 7 days)</Text>
          <BarChart
            data={last7.map((d) => ({ label: d.label, value: d.hobbyValue }))}
            color={COLORS.success}
            COLORS={COLORS}
            height={100}
            maxOverride={Math.max(state.hobbies.length, 1)}
          />
          {state.hobbies.length === 0 && (
            <Text style={{ color: COLORS.textMuted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
              Add a hobby to see consistency.
            </Text>
          )}
        </View>

        {/* Category performance */}
        <View style={[styles.chartCard, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
          <Text style={[styles.chartTitle, { color: COLORS.text }]}>Category performance</Text>
          <Text style={[styles.rangeSub, { color: COLORS.textMuted }]}>
            {rangeLabel.toLowerCase()}
          </Text>
          {categoryStats.length === 0 ? (
            <Text style={[styles.empty, { color: COLORS.textMuted }]}>No category data yet</Text>
          ) : (
            categoryStats.map((cat) => {
              const iconName = isIoniconsName(cat.icon) ? cat.icon : FALLBACK_CATEGORY_ICON;
              return (
                <View key={cat.id} style={styles.catRow}>
                  <Ionicons name={iconName} size={22} color={cat.color} />
                  <View style={styles.catRowInfo}>
                    <View style={styles.catRowTop}>
                      <Text style={[styles.catRowName, { color: cat.color }]}>{cat.name}</Text>
                      <Text style={[styles.catRowPct, { color: cat.color }]}>{cat.pct}%</Text>
                    </View>
                    <View style={[styles.catRowBar, { backgroundColor: COLORS.border }]}>
                      <View style={[styles.catRowFill, { width: `${cat.pct}%`, backgroundColor: cat.color }]} />
                    </View>
                    <View style={styles.catRowMeta}>
                      <Text style={[styles.catMetaText, { color: COLORS.textMuted }]}>
                        {cat.done} done
                      </Text>
                      <Text style={[styles.catMetaText, { color: COLORS.textMuted }]}>
                        {cat.pending} pending
                      </Text>
                      <Text style={[styles.catMetaText, { color: COLORS.textMuted }]}>
                        {cat.expired} expired
                      </Text>
                      <Text style={[styles.catMetaText, { color: COLORS.textMuted }]}>
                        {cat.tasks} total
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Priority distribution */}
        <View style={[styles.chartCard, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
          <Text style={[styles.chartTitle, { color: COLORS.text }]}>Priority distribution</Text>
          <Text style={[styles.rangeSub, { color: COLORS.textMuted }]}>
            {rangeLabel.toLowerCase()}
          </Text>
          {priorityStats.map((p, i) => {
            const color = [COLORS.danger, COLORS.warning, COLORS.success][i];
            return (
              <View key={p.label} style={styles.priorityRow}>
                <Text style={[styles.priorityLabel, { color }]}>{p.label}</Text>
                <View style={[styles.priorityBarWrap, { backgroundColor: COLORS.border }]}>
                  <View style={[styles.priorityBarFill, { width: `${p.pct}%`, backgroundColor: color }]} />
                </View>
                <Text style={[styles.priorityPct, { color }]}>{p.pct}%</Text>
                <Text style={[styles.priorityCount, { color: COLORS.textMuted }]}>({p.tasks.length})</Text>
              </View>
            );
          })}
        </View>

        {/* Monthly history */}
        <View style={[styles.chartCard, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
          <Text style={[styles.chartTitle, { color: COLORS.text }]}>Category history (monthly)</Text>
          <MonthlyCategoryLineChart tasks={state.tasks} categories={state.categories} />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  container: { flex: 1, paddingHorizontal: SPACING.lg },

  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.lg,
    marginBottom: SPACING.lg,
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  title:     { ...FONTS.heading, fontSize: 28 },
  rangeChips:{ flexDirection: 'row', gap: 6 },
  rangeChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill, borderWidth: 1 },
  rangeChipText: { fontSize: 11, fontWeight: '700' },

  rangeSub: { fontSize: 11, marginTop: -SPACING.sm, marginBottom: SPACING.md, textTransform: 'uppercase', letterSpacing: 0.5 },

  summaryRow:   { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  summaryCard:  { flex: 1, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', borderWidth: 1, gap: 4 },
  summaryVal:   { fontSize: 22, fontWeight: '800' },
  summaryLabel: { fontSize: 10, fontWeight: '600', marginTop: 3, textAlign: 'center', letterSpacing: 0.3 },

  rateCard:        { borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
  rateLeft:        { flex: 1 },
  rateValue:       { ...FONTS.heading, fontSize: 40, marginTop: 2 },
  rateSubtext:     { fontSize: 12, marginTop: 4 },
  streakInfo:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  streakInfoText:  { fontSize: 13, fontWeight: '700' },
  rateCircle:      { alignItems: 'center', justifyContent: 'center' },
  rateCircleInner: { width: 80, height: 80, borderRadius: 40, borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
  rateCirclePercent: { ...FONTS.heading, fontSize: 22, textAlign: 'center' },

  chartCard:  { borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, marginBottom: SPACING.lg },
  chartTitle: { ...FONTS.subheading, fontSize: 15, marginBottom: SPACING.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  empty:      { fontSize: 14, textAlign: 'center', paddingVertical: SPACING.lg },

  hobbyStatsRow: { flexDirection: 'row', gap: SPACING.sm },

  catRow:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.md, gap: SPACING.sm },
  catRowInfo:{ flex: 1 },
  catRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  catRowName:{ fontSize: 14, fontWeight: '700' },
  catRowPct: { fontSize: 14, fontWeight: '800' },
  catRowBar: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  catRowFill:{ height: '100%', borderRadius: 3 },
  catRowMeta:{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  catMetaText:{ fontSize: 11 },

  priorityRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  priorityLabel:  { fontSize: 12, fontWeight: '700', width: 48 },
  priorityBarWrap:{ flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  priorityBarFill:{ height: '100%', borderRadius: 4 },
  priorityPct:    { fontSize: 12, fontWeight: '800', width: 32, textAlign: 'right' },
  priorityCount:  { fontSize: 11, width: 28 },
});
