import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';

/**
 * Reusable scrollable wheel column (iOS-style picker wheel).
 *
 * A vertical ScrollView with snap-to-item scrolling. The item that
 * settles in the middle of the wheel IS the selection — no +/- buttons,
 * no fixed step: every value in `items` is reachable by scrolling.
 *
 * By default the wheel LOOPS: scrolling past the last item wraps around
 * to the first (and vice versa), like a rotary dial. The items array is
 * rendered several times; the scroll offset is re-anchored into the
 * middle copy after every settle, so the wheel never hits an end.
 * Pass `loop={false}` for a finite list.
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
 *   loop     — wrap around at the ends (default true).
 *   width    — width of the column (defaults 64).
 */
export function WheelColumn({
  items,
  value,
  onChange,
  width = 64,
  accent,
  text,
  textMuted,
  loop = true,
}) {
  const N = items.length;
  // Copies rendered above and below the middle copy. Enough headroom that
  // even a hard fling (≈40 rows of travel) can never reach an end before
  // the settle handler re-anchors into the middle copy.
  const perSide = loop ? Math.max(2, Math.ceil(40 / N)) : 0;
  const REPEATS = loop ? perSide * 2 + 1 : 1;
  const total = N * REPEATS;
  const centerStart = N * perSide; // first row of the middle copy

  const listRef = useRef(null);
  // Guards against re-anchoring the scroll position when the parent
  // re-renders with the very value this wheel just reported.
  const settledIndexRef = useRef(-1);
  // True while a programmatic (non-animated) re-anchor is in flight —
  // the momentum handler must not "settle" from it.
  const anchoringRef = useRef(false);
  const momentumRef = useRef(false);
  const dragTimerRef = useRef(null);
  const [curIndex, setCurIndex] = useState(() => {
    const i = items.findIndex((it) => it.value === value);
    return i >= 0 ? i : 0;
  });

  const indexFor = (v) => {
    const i = items.findIndex((it) => it.value === v);
    return i >= 0 ? i : 0;
  };
  const rawIndexFor = (trueIdx) => (loop ? centerStart + trueIdx : trueIdx);

  // Highlight + report the row that settled in the middle. In loop mode
  // the raw row index maps back into [0, N) with modulo.
  const settle = useCallback(
    (offsetY) => {
      anchoringRef.current = false;
      const raw = Math.max(0, Math.min(total - 1, Math.round(offsetY / ITEM_HEIGHT)));
      const trueIdx = loop ? ((raw % N) + N) % N : raw;
      settledIndexRef.current = trueIdx;
      setCurIndex(trueIdx);
      const next = items[trueIdx];
      if (next && next.value !== value) onChange(next.value);
      // Re-anchor into the middle copy so the next fling never runs out
      // of rows in either direction. Non-animated, so it's invisible —
      // the wheel is periodic.
      const wanted = rawIndexFor(trueIdx);
      if (loop && raw !== wanted) {
        anchoringRef.current = true;
        listRef.current?.scrollTo({ y: wanted * ITEM_HEIGHT, animated: false });
        setTimeout(() => { anchoringRef.current = false; }, 100);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, value, onChange, loop, N, total, centerStart],
  );

  // External value change (parent state, clamps, editing a saved task) —
  // re-anchor the wheel unless the user already settled on that value.
  useEffect(() => {
    const trueIdx = indexFor(value);
    if (trueIdx === settledIndexRef.current) return;
    setCurIndex(trueIdx);
    // The list may not exist yet on the very first frame — retry once the
    // layout pass has run.
    const t = setTimeout(() => {
      listRef.current?.scrollTo({ y: rawIndexFor(trueIdx) * ITEM_HEIGHT, animated: false });
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, items, loop, centerStart]);

  useEffect(() => () => clearTimeout(dragTimerRef.current), []);

  const rows = loop
    ? Array.from({ length: total }, (_, i) => ({ ...items[i % N], raw: i }))
    : items.map((it, i) => ({ ...it, raw: i }));

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
      {/* A plain (non-virtualized) ScrollView — a VirtualizedList here
          would be nested inside the screens' ScrollViews, which RN warns
          against. A few hundred simple rows render fine. */}
      <ScrollView
        ref={listRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        nestedScrollEnabled
        overScrollMode="never"
        style={styles.list}
        contentContainerStyle={styles.listContent}
        scrollEventThrottle={16}
        onScroll={(e) => {
          // Live highlight while the wheel is in motion.
          const raw = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
          const trueIdx = loop
            ? ((raw % N) + N) % N
            : Math.max(0, Math.min(N - 1, raw));
          if (trueIdx !== curIndex) setCurIndex(trueIdx);
        }}
        onMomentumScrollBegin={() => { momentumRef.current = true; }}
        onMomentumScrollEnd={(e) => {
          momentumRef.current = false;
          clearTimeout(dragTimerRef.current);
          if (anchoringRef.current) return; // our own re-anchor, not the user
          settle(e.nativeEvent.contentOffset.y);
        }}
        onScrollEndDrag={(e) => {
          // Android: a drag released without velocity produces no momentum
          // events. Fall back to settling from the last known offset.
          const y = e.nativeEvent.contentOffset.y;
          clearTimeout(dragTimerRef.current);
          dragTimerRef.current = setTimeout(() => {
            if (momentumRef.current || anchoringRef.current) return;
            settle(y);
          }, 120);
        }}
      >
        {rows.map((item) => {
          const trueIdx = loop ? item.raw % N : item.raw;
          const selected = trueIdx === curIndex;
          return (
            <View key={item.raw} style={[styles.item, { height: ITEM_HEIGHT }]}>
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
 * with 1-unit granularity (no 5-minute stepping). Columns show bare
 * numbers only — the units live in the header labels below.
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

  const dayItems = range(maxDays).map((n) => ({ value: n, label: `${n}` }));
  const hourItems = range(23).map((n) => ({ value: n, label: `${n}` }));
  const minItems = range(59).map((n) => ({ value: n, label: String(n).padStart(2, '0') }));

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