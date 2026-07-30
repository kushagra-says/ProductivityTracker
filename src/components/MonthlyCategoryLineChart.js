import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  format, startOfMonth, endOfMonth, startOfDay, endOfDay, isWithinInterval, subMonths,
} from 'date-fns';
import { useTheme, FONTS, RADIUS, SPACING } from '../utils/theme';
import LineChart, { ChartLegend } from './LineChart';

/**
 * One line per category that had at least one completed task in the selected month.
 * X-axis runs from day 1 → end of month (or today, if current month).
 * Width is fluid: the inner chart adapts to whatever width the parent gives it.
 */
export default function MonthlyCategoryLineChart({ tasks, categories }) {
  const { COLORS } = useTheme();
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const isCurrentMonth = format(selectedMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const daysInMonth = isCurrentMonth
    ? new Date().getDate()
    : monthEnd.getDate();

  // Days array: dates for each day in this month window.
  const days = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(monthStart);
      d.setDate(i + 1);
      return d;
    });
  }, [monthStart, daysInMonth]);

  // Build per-category per-day counts of completed tasks.
  const dailyCounts = useMemo(() => {
    return categories.map((cat) => {
      const data = days.map((d) => {
        const count = tasks.filter(
          (t) =>
            t.categoryId === cat.id &&
            t.status === 'completed' &&
            t.completedAt &&
            isWithinInterval(new Date(t.completedAt), {
              start: startOfDay(d),
              end: endOfDay(d),
            }),
        ).length;
        return { day: d.getDate(), count };
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
  const series = visibleCats.map((cat) => ({
    color: cat.color,
    name: cat.name,
    hidden: !!hidden[cat.id],
    data: cat.daily
      .filter((d) => d.count > 0)
      .map((d) => ({ x: d.day, y: d.count })),
  }));

  const yMax = Math.max(1, ...series.flatMap((s) => s.data.map((p) => p.y)));

  // X-axis ticks: every ~7 days, plus today if in current month.
  const xLabels = [];
  const tickDays = [1, 7, 14, 21, 28].filter((d) => d <= daysInMonth);
  tickDays.forEach((d) => {
    xLabels.push({ x: d, label: String(d) });
  });
  if (isCurrentMonth) {
    const todayDay = new Date().getDate();
    if (todayDay > 28) {
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
