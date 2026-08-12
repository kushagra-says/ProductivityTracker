import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Custom in-app time picker — two column wheels for hour and minute with
 * -/+ buttons plus quick "AM/PM" toggle. Pure React Native, no system UI.
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

  const bump = (field, delta) => {
    if (field === 'hour') {
      // 12-hour wrap inside ±1..±12.
      let n = (hour12 - 1 + delta + 12) % 12 + 1;
      apply(n, minute, isPM);
    } else if (field === 'min') {
      let n = (minute + delta + 60) % 60;
      apply(hour12, n, isPM);
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor: surface, borderColor: border }]}>
      <TimeWheel
        label="HOUR"
        value={hour12}
        onMinus={() => bump('hour', -1)}
        onPlus={() => bump('hour', 1)}
        accent={accent}
        surfaceAlt={surfaceAlt}
        text={text}
        textMuted={textMuted}
      />
      <Text style={[styles.colon, { color: textMuted }]}>:</Text>
      <TimeWheel
        label="MIN"
        value={minute}
        pad={2}
        onMinus={() => bump('min', -5)}
        onPlus={() => bump('min', 5)}
        accent={accent}
        surfaceAlt={surfaceAlt}
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
          <Text style={[styles.ampmText, { color: !isPM ? '#fff' : textMuted }]}>AM</Text>
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
          <Text style={[styles.ampmText, { color: isPM ? '#fff' : textMuted }]}>PM</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TimeWheel({ label, value, pad = 0, onMinus, onPlus, accent, surfaceAlt, text, textMuted }) {
  const display = pad > 0 ? String(value).padStart(pad, '0') : String(value);
  return (
    <View style={styles.wheel}>
      <TouchableOpacity
        style={[styles.wheelBtn, { backgroundColor: surfaceAlt, borderColor: accent + '44' }]}
        onPress={onPlus}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="chevron-up" size={16} color={accent} />
      </TouchableOpacity>
      <Text style={[styles.wheelValue, { color: text }]}>{display}</Text>
      <Text style={[styles.wheelLabel, { color: textMuted }]}>{label}</Text>
      <TouchableOpacity
        style={[styles.wheelBtn, { backgroundColor: surfaceAlt, borderColor: accent + '44' }]}
        onPress={onMinus}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="chevron-down" size={16} color={accent} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  colon: {
    fontSize: 26,
    fontWeight: '800',
    marginHorizontal: 2,
    marginBottom: 18,
  },
  wheel: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  wheelBtn: {
    width: '100%',
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelValue: { fontSize: 30, fontWeight: '800', letterSpacing: -1 },
  wheelLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  ampm: { marginLeft: 6, marginBottom: 0, alignItems: 'center' },
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
