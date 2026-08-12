import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { format, startOfMonth, subMonths } from 'date-fns';
import { useTheme, FONTS, RADIUS, SPACING } from '../utils/theme';
import LineChart from './LineChart';

/**
 * One hobby, one line, 0 or 1 per day across the selected month.
 * Width is fluid: the chart fits its parent card regardless of month length.
 */
export default function HobbyMonthlyChart({ hobby }) {
  const { COLORS } = useTheme();
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const isCurrentMonth = format(selectedMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');
  const monthStart = startOfMonth(selectedMonth);
  const daysInMonth = isCurrentMonth
    ? new Date().getDate()
    : new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate();

  const data = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(monthStart);
      d.setDate(i + 1);
      const key = format(d, 'yyyy-MM-dd');
      const done = !!(hobby.completions && hobby.completions[key]);
      return { day: d.getDate(), done };
    });
  }, [hobby.completions, monthStart, daysInMonth]);

  // Data points use 1-based day numbers; the chart maps day → pixel via xToPx.
  const series = [
    {
      color: hobby.color,
      name: hobby.name,
      hidden: false,
      data: data.filter((d) => d.done).map((d) => ({ x: d.day, y: 1 })),
    },
  ];

  // X-axis ticks: every ~7 days plus the last day of the month so 29/30/31
  // day months get a marker at the right edge instead of stopping at 28.
  const xLabels = [];
  [1, 7, 14, 21, 28]
    .filter((d) => d <= daysInMonth)
    .forEach((d) => {
      xLabels.push({ x: d, label: String(d) });
    });
  if (daysInMonth >= 29) {
    xLabels.push({ x: daysInMonth, label: String(daysInMonth) });
  }
  if (isCurrentMonth && new Date().getDate() > 28) {
    const todayDay = new Date().getDate();
    if (todayDay !== daysInMonth) {
      xLabels.push({ x: todayDay, label: String(todayDay), emph: true });
    }
  }

  const todayX = isCurrentMonth ? new Date().getDate() : null;

  const xToPx = (day, plotW, yAxisW) => {
    if (!daysInMonth || daysInMonth <= 1) return yAxisW;
    return yAxisW + ((day - 1) / (daysInMonth - 1)) * plotW;
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

      <View style={styles.legend}>
        <View style={[styles.dot, { backgroundColor: hobby.color }]} />
        <Text style={[styles.legendText, { color: COLORS.text }]} numberOfLines={1}>
          {hobby.name}
        </Text>
        <Text style={[styles.legendPct, { color: COLORS.textMuted }]}>
          {data.filter((d) => d.done).length}/{daysInMonth}
        </Text>
      </View>

      <LineChart
        series={series}
        height={140}
        yMax={1}
        yTicks={1}
        xLabels={xLabels}
        todayX={todayX}
        xToPx={xToPx}
        yFormat={(v) => (v >= 1 ? '✓' : '')}
        emptyLabel="No completions"
      />
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
    width: 32,
    height: 28,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthBtnText: { fontSize: 18, fontWeight: '700' },
  monthText: { ...FONTS.subheading, fontSize: 13 },

  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.md,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  legendPct: { fontSize: 11, fontWeight: '600', marginLeft: 4 },
});
