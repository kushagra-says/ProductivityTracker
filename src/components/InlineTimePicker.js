import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { WheelColumn } from './WheelPicker';

/**
 * Custom in-app time picker — two scrollable wheels for hour and minute
 * plus an AM/PM toggle. Pure React Native, no system UI.
 *
 * The hour wheel scrolls 1..12 and the minute wheel scrolls 0..59 in
 * 1-minute steps — the value that settles in the middle of each wheel is
 * the selection (Bug 6: replaces the old +/- buttons, which stepped
 * minutes by 5 and made values like 7 unreachable).
 *
 * Used by:
 *   - hobby reminder UI
 *   - task reminder UI
 *   - settings screen (notification times)
 *
 * The caller controls the active palette via the `accent`/`surface`/etc.
 * props so this component stays theme-agnostic.
 */
export default function InlineTimePicker({
  value,
  onChange,
  accent,
  surface,
  surfaceAlt,
  border,
  text,
  textMuted,
  // Content color for the ACTIVE AM/PM pill — dark in the monochrome
  // (Paper) mode where the accent bg is white. Defaults to white.
  onAccent = '#fff',
}) {
  const hour24 = value.getHours();
  const minute = value.getMinutes();
  const isPM = hour24 >= 12;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  // Mutate a single field of the time, keeping the others stable.
  const apply = (next12, nextMin, nextIsPM) => {
    let h = next12 % 12;
    if (nextIsPM) h += 12;
    if (h === 24) h = 0;
    const d = new Date(value);
    d.setHours(h, nextMin, 0, 0);
    onChange(d);
  };

  const hourItems = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: String(i + 1),
  }));
  const minuteItems = Array.from({ length: 60 }, (_, i) => ({
    value: i,
    label: String(i).padStart(2, '0'),
  }));

  return (
    <View style={[styles.wrap, { backgroundColor: surface, borderColor: border }]}>
      <WheelColumn
        items={hourItems}
        value={hour12}
        onChange={(h) => apply(h, minute, isPM)}
        width={58}
        accent={accent}
        text={text}
        textMuted={textMuted}
      />
      <Text style={[styles.colon, { color: textMuted }]}>:</Text>
      <WheelColumn
        items={minuteItems}
        value={minute}
        onChange={(m) => apply(hour12, m, isPM)}
        width={58}
        accent={accent}
        text={text}
        textMuted={textMuted}
      />
      <View style={styles.ampm}>
        <TouchableOpacity
          style={[
            styles.ampmBtn,
            {
              backgroundColor: !isPM ? accent : surfaceAlt,
              borderColor: accent,
            },
          ]}
          onPress={() => apply(hour12, minute, false)}
        >
          <Text style={[styles.ampmText, { color: !isPM ? onAccent : textMuted }]}>AM</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.ampmBtn,
            {
              backgroundColor: isPM ? accent : surfaceAlt,
              borderColor: accent,
              marginTop: 4,
            },
          ]}
          onPress={() => apply(hour12, minute, true)}
        >
          <Text style={[styles.ampmText, { color: isPM ? onAccent : textMuted }]}>PM</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 8,
    gap: 2,
  },
  colon: {
    fontSize: 26,
    fontWeight: '800',
    marginHorizontal: 2,
    marginTop: -8,
  },
  ampm: { marginLeft: 8, alignItems: 'center' },
  ampmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 46,
    alignItems: 'center',
  },
  ampmText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
});