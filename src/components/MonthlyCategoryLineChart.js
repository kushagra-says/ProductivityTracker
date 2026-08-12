import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  format, startOfMonth, endOfMonth, subMonths,
} from 'date-fns';
import { useTheme, FONTS, RADIUS, SPACING } from '../utils/theme';
import LineChart, { ChartLegend } from './LineChart';

/**
 * One line per category that had at least one completed task in the selected month.
 * X-axis is static for the whole month — always day 1 → last day of the month,
 * including future days which simply read as 0. This avoids layout churn as
 * days tick over (the source of the historical rendering bug).
 * Width is fluid: the inner chart adapts to whatever width the parent gives it.
 */
export default function MonthlyCategoryLineChart({ tasks, categories }) {
  const { COLORS } = useTheme();
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const isCurrentMonth = format(selectedMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  // Static date range — always 1..last day of the selected month, even for
  // the current month. Future days show as 0 so the x-axis never grows
  // and the chart never has to recompute its widths/positions as time
  // passes. This was the source of the rendering bug.
  const daysInMonth = monthEnd.getDate();

  // Days array: dates for each day in this month window.
  const days = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(monthStart);
      d.setDate(i + 1);
      return d;
    });
  }, [monthStart, daysInMonth]);

  // Build per-category per-day counts of completed tasks.
  // Single pass over `tasks`: bucket each completed task by categoryId +
  // `yyyy-MM-dd` of completion. Then map buckets onto the static days
  // array, defaulting missing days (including future ones) to 0.
  // This is O(tasks + cats*days) instead of O(cats*days*tasks).
  const dailyCounts = useMemo(() => {
    const buckets = new Map(); // key: `${catId}|${yyyy-MM-dd}` -> count
    for (const t of tasks) {
      if (t.status !== 'completed' || !t.completedAt) continue;
      const d = new Date(t.completedAt);
      const key = `${t.categoryId}|${format(d, 'yyyy-MM-dd')}`;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    return categories.map((cat) => {
      const data = days.map((d) => {
        const key = `${cat.id}|${format(d, 'yyyy-MM-dd')}`;
        return { day: d.getDate(), count: buckets.get(key) || 0 };
      });
      return { ...cat, daily: data };
    });
  }, [tasks, categories, days]);

  // Visible series — only categories with at least one completion this month.
  const [hidden, setHidden] = useState({});
  const visibleCats = dailyCounts.filter((c) =>
    c.daily.some((d) => d.count > 0),
  );

  // Data points use 1-based day numbers as their x. The LineChart's xToPx
  // adapter (set below) maps (day, plotW, yAxisW) → pixel position.
  // Include ALL days of the month (zero on inactive days) so the line dips
  // to the baseline on idle days instead of bridging across them.
  const series = visibleCats.map((cat) => ({
    color: cat.color,
    name: cat.name,
    hidden: !!hidden[cat.id],
    data: cat.daily.map((d) => ({ x: d.day, y: d.count })),
  }));

  const yMax = Math.max(1, ...series.flatMap((s) => s.data.map((p) => p.y)));

  // X-axis ticks: every 5 days, plus the last day of the month so 29/30/31
  // day months get a marker at the right edge instead of stopping at 28.
  // With a static axis, these are stable for the whole month — the graph
  // never has to relayout as days tick over.
  const xLabels = [];
  const tickDays = [1, 5, 10, 15, 20, 25, 30].filter((d) => d <= daysInMonth);
  tickDays.forEach((d) => {
    xLabels.push({ x: d, label: String(d) });
  });
  // Always show the month-end label when it isn't already covered.
  if (daysInMonth >= 29 && !tickDays.includes(daysInMonth)) {
    xLabels.push({ x: daysInMonth, label: String(daysInMonth) });
  }
  if (isCurrentMonth) {
    const todayDay = new Date().getDate();
    if (todayDay > 28 && todayDay !== daysInMonth) {
      xLabels.push({ x: todayDay, label: String(todayDay), emph: true });
    }
  }

  const todayX = isCurrentMonth ? new Date().getDate() : null;

  // Adapter: maps a 1-based day number to a pixel position within the plot.
  // The chart's onLayout gives us the actual plot width so 28–31 days fit
  // the card without scrolling.
  const xToPx = (day, plotW, yAxisW) => {
    if (!daysInMonth || daysInMonth <= 1) return yAxisW;
    return yAxisW + ((day - 1) / (daysInMonth - 1)) * plotW;
  };

  const toggleSeries = (idx) => {
    const cat = visibleCats[idx];
    setHidden((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }));
  };

  return (
    <View>
      <View style={styles.monthSelector}>
        <TouchableOpacity
          onPress={() => setSelectedMonth(subMonths(selectedMonth, 1))}
          style={[styles.monthBtn, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}
        >
          <Text style={[styles.monthBtnText, { color: COLORS.accent }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.monthText, { color: COLORS.text }]}>
          {format(selectedMonth, 'MMMM yyyy')}
        </Text>
        <TouchableOpacity
          disabled={isCurrentMonth}
          onPress={() => setSelectedMonth(subMonths(selectedMonth, -1))}
          style={[
            styles.monthBtn,
            {
              backgroundColor: COLORS.surfaceAlt,
              borderColor: COLORS.border,
              opacity: isCurrentMonth ? 0.35 : 1,
            },
          ]}
        >
          <Text style={[styles.monthBtnText, { color: COLORS.accent }]}>›</Text>
        </TouchableOpacity>
      </View>

      <ChartLegend series={series} onToggle={toggleSeries} />

      {series.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: COLORS.textMuted }]}>
            No completed tasks in {format(selectedMonth, 'MMMM')}
          </Text>
        </View>
      ) : (
        <LineChart
          series={series}
          height={200}
          yMax={yMax}
          yTicks={Math.min(yMax, 4)}
          xLabels={xLabels}
          todayX={todayX}
          xToPx={xToPx}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  monthSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  monthBtn: {
    width: 36,
    height: 32,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthBtnText: { fontSize: 22, fontWeight: '700' },
  monthText: { ...FONTS.subheading, fontSize: 14 },

  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 13 },
});
