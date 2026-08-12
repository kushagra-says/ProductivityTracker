import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays, subDays, isToday, isPast, startOfDay } from 'date-fns';

/**
 * Custom in-app date picker — three big controls (prev day, today/next
 * day) and a readable date pill. Matches the InlineTimePicker visual
 * language so the two pair cleanly when stacked.
 *
 * The caller controls the active palette via the `accent`/`surface`/etc.
 * props so this component stays theme-agnostic.
 *
 * `minDate` (optional Date) — used to disable going earlier than that day.
 * `onChange(date)` is only fired for non-past, in-range dates.
 */
export default function InlineDatePicker({
  value,
  onChange,
  minDate,
  accent,
  surface,
  surfaceAlt,
  border,
  text,
  textMuted,
}) {
  // Normalize `value` to start-of-day for comparisons, but keep its time
  // intact for downstream consumption. We only mutate via setDate helpers
  // (prev/next/today) so the time portion of `value` survives across edits.
  const today = startOfDay(new Date());
  const min = minDate ? startOfDay(new Date(minDate)) : null;
  const vStart = startOfDay(value);

  const isPrevDisabled = !!min && vStart.getTime() <= min.getTime();
  const isNextDisabled = false; // We allow free forward navigation.

  const setDate = (next) => {
    if (isPast(startOfDay(next)) && (!min || next < min)) return;
    // Keep the existing time-of-day; only the date changes.
    const d = new Date(value);
    d.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
    onChange(d);
  };

  return (
    <View>
      {/* Date pill — large, readable, what the user is setting. */}
      <View style={[styles.pill, { backgroundColor: surface, borderColor: border }]}>
        <TouchableOpacity
          style={[
            styles.pillBtn,
            { backgroundColor: surfaceAlt, borderColor: accent + '44', opacity: isPrevDisabled ? 0.4 : 1 },
          ]}
          onPress={() => !isPrevDisabled && setDate(subDays(vStart, 1))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={isPrevDisabled}
        >
          <Ionicons name="chevron-back" size={18} color={accent} />
        </TouchableOpacity>
        <View style={styles.pillText}>
          <Text style={[styles.pillMain, { color: text }]}>{format(value, 'EEE, MMM d')}</Text>
          <Text style={[styles.pillSub, { color: textMuted }]}>
            {format(value, 'yyyy')}
            {isToday(value) ? ' · Today' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.pillBtn, { backgroundColor: surfaceAlt, borderColor: accent + '44' }]}
          onPress={() => setDate(addDays(vStart, 1))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-forward" size={18} color={accent} />
        </TouchableOpacity>
      </View>

      {/* Quick-jump row: Today button + 7-day steppers for fast forward nav. */}
      <View style={styles.jumpRow}>
        <TouchableOpacity
          style={[
            styles.jumpBtn,
            { backgroundColor: surfaceAlt, borderColor: border, opacity: isToday(value) ? 0.4 : 1 },
          ]}
          onPress={() => !isToday(value) && setDate(today)}
          disabled={isToday(value)}
        >
          <Ionicons name="today-outline" size={14} color={accent} />
          <Text style={[styles.jumpText, { color: accent }]}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.jumpBtn, { backgroundColor: surfaceAlt, borderColor: border }]}
          onPress={() => setDate(addDays(vStart, 7))}
        >
          <Text style={[styles.jumpText, { color: text }]}>+1 wk</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.jumpBtn, { backgroundColor: surfaceAlt, borderColor: border }]}
          onPress={() => setDate(subDays(vStart, 7))}
          disabled={!!min && subDays(vStart, 7) < min}
        >
          <Text style={[styles.jumpText, { color: text }]}>-1 wk</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  pillBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { flex: 1, alignItems: 'center' },
  pillMain: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  pillSub: { fontSize: 11, fontWeight: '700', marginTop: 2 },

  jumpRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  jumpBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  jumpText: { fontSize: 12, fontWeight: '700' },
});
