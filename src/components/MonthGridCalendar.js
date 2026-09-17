import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  buildMonthMatrix,
  isCellDisabled,
  isSameLocalDay,
  WEEKDAY_LABELS,
  MONTH_SHORT,
} from '../utils/calendar';

/**
 * Inline month-grid calendar — replaces the older pill + Today / +1wk /
 * -1wk picker. When `value` is set, the card body expands a full month
 * grid (Mon-first, 7 columns, 6 rows). Tapping a non-disabled day
 * updates the date portion of `value` while preserving its current
 * time-of-day. The grid supports a `minDate` (default = today) and an
 * optional `maxDate` (used by the custom-reminder card to cap at
 * expiry). Disabled days render as greyed-out, non-interactive cells.
 *
 * Visual matches InlineTimePicker: same border radii, palette props,
 * and chevron controls. Pure RN — no native DatePicker.
 */
export default function MonthGridCalendar({
  value,
  onChange,
  minDate,
  maxDate,
  accent,
  surface,
  surfaceAlt,
  border,
  text,
  textMuted,
  // Content color on a selected day — dark in the monochrome (Paper) mode
  // where the accent bg is white. Defaults to white.
  onAccent = '#fff',
}) {
  const today = useMemo(() => new Date(), []);
  const safeMin = minDate || today;

  const [view, setView] = useState(() => {
    const d = value instanceof Date ? value : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const matrix = useMemo(
    () => buildMonthMatrix(view.year, view.month, today),
    [view.year, view.month, today],
  );

  const goPrev = () => {
    const m = view.month - 1;
    if (m < 0) setView({ year: view.year - 1, month: 11 });
    else setView({ year: view.year, month: m });
  };
  const goNext = () => {
    const m = view.month + 1;
    if (m > 11) setView({ year: view.year + 1, month: 0 });
    else setView({ year: view.year, month: m });
  };

  // Disallow stepping into a month whose every day is below the min.
  const prevDisabled = (() => {
    const lastOfPrev = new Date(view.year, view.month, 0);
    return isCellDisabled(lastOfPrev, safeMin, null);
  })();

  const onPick = (cell) => {
    if (!cell || !cell.inMonth) return;
    if (isCellDisabled(cell.date, safeMin, maxDate)) return;
    // Preserve the existing time-of-day; only the date changes.
    const next = value instanceof Date ? new Date(value) : new Date();
    next.setFullYear(cell.date.getFullYear(), cell.date.getMonth(), cell.date.getDate());
    onChange(next);
    // Snap the visible month to whatever the user picked so the grid
    // doesn't jump back to its initial view on the next render.
    setView({ year: cell.date.getFullYear(), month: cell.date.getMonth() });
  };

  return (
    <View style={[styles.wrap, { backgroundColor: surface, borderColor: border }]}>
      {/* Month header — title + prev / next chevrons. */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={goPrev}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={prevDisabled}
          style={[
            styles.navBtn,
            { borderColor: accent + '44', backgroundColor: surfaceAlt, opacity: prevDisabled ? 0.4 : 1 },
          ]}
        >
          <Ionicons name="chevron-back" size={16} color={accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: text }]}>
          {MONTH_SHORT[view.month]} {view.year}
        </Text>
        <TouchableOpacity
          onPress={goNext}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.navBtn, { borderColor: accent + '44', backgroundColor: surfaceAlt }]}
        >
          <Ionicons name="chevron-forward" size={16} color={accent} />
        </TouchableOpacity>
      </View>

      {/* Weekday gutter — Mon first. */}
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((w, i) => (
          <Text key={`wd-${i}`} style={[styles.weekdayText, { color: textMuted }]}>{w}</Text>
        ))}
      </View>

      {/* Day grid — 6 rows × 7 cells. */}
      {matrix.weeks.map((week, wi) => (
        <View key={`wk-${wi}`} style={styles.weekRow}>
          {week.map((cell, ci) => {
            const disabled = !cell.inMonth || isCellDisabled(cell.date, safeMin, maxDate);
            const isSelected = value instanceof Date && isSameLocalDay(cell.date, value);
            const isToday = isSameLocalDay(cell.date, today);
            return (
              <TouchableOpacity
                key={`c-${wi}-${ci}`}
                onPress={() => onPick(cell)}
                disabled={disabled}
                style={[
                  styles.dayCell,
                  {
                    backgroundColor: isSelected ? accent : 'transparent',
                    borderColor: isToday && !isSelected ? accent : 'transparent',
                    borderWidth: isToday && !isSelected ? 1 : 0,
                  },
                  !cell.inMonth && { opacity: 0.35 },
                  disabled && !isSelected && { opacity: 0.25 },
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    { color: isSelected ? onAccent : text },
                    disabled && !isSelected && { color: textMuted },
                  ]}
                >
                  {cell.day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '700',
  },
});