import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';

/**
 * Reusable scrollable wheel column (iOS-style picker wheel).
 *
 * A vertical ScrollView with snap-to-item scrolling. The item that
 * settles in the middle of the wheel IS the selection — no +/- buttons,
 * no fixed step: every value in `items` is reachable by scrolling.
 *
 * Used by:
 *   - InlineTimePicker (hour / minute wheels)
 *   - DurationWheelPicker (before-expiry d/h/m wheels)
 *
 * The caller controls the active palette via the `accent`/`text`/etc.
 * props so this component stays theme-agnostic.
 */
export const ITEM_HEIGHT = 38;
export const VISIBLE_ITEMS = 3;
export const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const SCREEN_W = Dimensions.get('window').width;

/**
 * One scrollable column.
 *
 * props:
 *   items    — array of { value, label } in scroll order.
 *   value    — currently selected value (must exist in items).
 *   onChange — called with the newly selected value once the wheel settles.
 *   width    — flex-basis width of the column (defaults flexible).
 */
export function WheelColumn({
  items,
  value,
  onChange,
  width = 64,
  accent,
  text,
  textMuted,
}) {
  const listRef = useRef(null);
  // Guards against re-anchoring the scroll position when the parent
  // re-renders with the very value this wheel just reported.
  const settledIndexRef = useRef(-1);
  const momentumRef = useRef(false);
  const dragTimerRef = useRef(null);
  const [curIndex, setCurIndex] = useState(() =>
    Math.max(0, items.findIndex((i) => i.value === value)),
  );

  const indexFor = (v) => {
    const i = items.findIndex((it) => it.value === v);
    return i >= 0 ? i : 0;
  };

  // Report the item that settled in the middle: derive its index from the
  // raw scroll offset, highlight it, and push the new value up to the
  // parent (skipped when the parent already holds that value).
  const settle = useCallback(
    (offsetY) => {
      const idx = Math.max(0, Math.min(items.length - 1, Math.round(offsetY / ITEM_HEIGHT)));
      settledIndexRef.current = idx;
      setCurIndex(idx);
      const next = items[idx];
      if (next && next.value !== value) onChange(next.value);
    },
    [items, value, onChange],
  );

  // External value change (parent state, clamps, editing a saved task) —
  // re-anchor the wheel unless the user already settled on that value.
  useEffect(() => {
    const idx = indexFor(value);
    if (idx === settledIndexRef.current) return;
    setCurIndex(idx);
    // The list may not exist yet on the very first frame — retry once the
    // layout pass has run.
    const t = setTimeout(() => {
      listRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, items]);

  useEffect(() => () => clearTimeout(dragTimerRef.current), []);

  return (
    <View style={[styles.column, { width }]}>
      {/* Selection band — the row that lands here becomes the value. */}
      <View
        pointerEvents="none"
        style={[
          styles.band,
          {
            top: ITEM_HEIGHT,
            height: ITEM_HEIGHT,
            borderColor: accent + '55',
          },
        ]}
      />
      {/* A plain (non-virtualized) ScrollView — wheels hold at most 60
          rows, and a VirtualizedList here would be nested inside the
          screens' ScrollViews, which RN warns against. */}
      <ScrollView
        ref={listRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        nestedScrollEnabled
        style={styles.list}
        contentContainerStyle={styles.listContent}
        onMomentumScrollBegin={() => { momentumRef.current = true; }}
        onMomentumScrollEnd={(e) => {
          momentumRef.current = false;
          clearTimeout(dragTimerRef.current);
          settle(e.nativeEvent.contentOffset.y);
        }}
        onScrollEndDrag={(e) => {
          // Android: a drag released without velocity produces no momentum
          // events. Fall back to settling from the last known offset.
          const y = e.nativeEvent.contentOffset.y;
          clearTimeout(dragTimerRef.current);
          dragTimerRef.current = setTimeout(() => {
            if (momentumRef.current) return; // onMomentumScrollEnd handles it
            settle(y);
          }, 120);
        }}
      >
        {items.map((item, index) => {
          const selected = index === curIndex;
          return (
            <View key={String(item.value)} style={[styles.item, { height: ITEM_HEIGHT }]}>
              <Text
                style={[
                  styles.itemText,
                  { color: selected ? text : textMuted },
                  selected && styles.itemTextSelected,
                ]}
              >
                {item.label}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/**
 * Days / hours / minutes duration wheel — the scrollable replacement for
 * the before-expiry custom stepper. Any total up to 7 days is reachable
 * with 1-unit granularity (no 5-minute stepping).
 *
 * props:
 *   parts    — { days, hours, minutes }
 *   onChange — called with the updated { days, hours, minutes } object.
 *   maxDays  — upper bound for the days column (7 by default).
 */
export function DurationWheelPicker({
  parts,
  onChange,
  maxDays = 7,
  accent,
  surface,
  border,
  text,
  textMuted,
}) {
  const range = (n) => Array.from({ length: n + 1 }, (_, i) => i);

  const dayItems = range(maxDays).map((n) => ({
    value: n,
    label: n === 1 ? '1 day' : `${n} days`,
  }));
  const hourItems = range(23).map((n) => ({
    value: n,
    label: n === 1 ? '1 hr' : `${n} hrs`,
  }));
  const minItems = range(59).map((n) => ({
    value: n,
    label: `${n}`,
  }));

  const patch = (field) => (v) => onChange({ ...parts, [field]: v });

  return (
    <View
      style={[
        styles.durationWrap,
        { backgroundColor: surface, borderColor: border },
      ]}
    >
      <WheelColumn
        items={dayItems}
        value={parts.days}
        onChange={patch('days')}
        width={SCREEN_W * 0.24}
        accent={accent}
        text={text}
        textMuted={textMuted}
      />
      <WheelColumn
        items={hourItems}
        value={parts.hours}
        onChange={patch('hours')}
        width={SCREEN_W * 0.2}
        accent={accent}
        text={text}
        textMuted={textMuted}
      />
      <WheelColumn
        items={minItems}
        value={parts.minutes}
        onChange={patch('minutes')}
        width={SCREEN_W * 0.2}
        accent={accent}
        text={text}
        textMuted={textMuted}
      />
    </View>
  );
}

/**
 * Header labels matching the three DurationWheelPicker columns.
 */
export function DurationWheelLabels({ textMuted, labelStyle }) {
  const SCREEN_W_ = Dimensions.get('window').width;
  return (
    <View style={styles.labelsRow}>
      <Text style={[styles.labelText, { color: textMuted, width: SCREEN_W_ * 0.24 }, labelStyle]}>DAYS</Text>
      <Text style={[styles.labelText, { color: textMuted, width: SCREEN_W_ * 0.2 }, labelStyle]}>HRS</Text>
      <Text style={[styles.labelText, { color: textMuted, width: SCREEN_W_ * 0.2 }, labelStyle]}>MIN</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { height: WHEEL_HEIGHT, overflow: 'hidden' },
  band: {
    position: 'absolute',
    left: 2,
    right: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  list: { flex: 1 },
  listContent: { paddingVertical: ITEM_HEIGHT },
  item: { alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 16, fontWeight: '600' },
  itemTextSelected: { fontSize: 20, fontWeight: '800' },
  durationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    gap: 2,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 2,
    marginTop: 6,
  },
  labelText: { fontSize: 9, fontWeight: '700', letterSpacing: 1, textAlign: 'center' },
});