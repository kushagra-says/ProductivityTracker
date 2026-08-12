import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Polyline, Line, Circle, G, Rect } from 'react-native-svg';
import { useTheme, FONTS, RADIUS, SPACING } from '../utils/theme';

/**
 * Reusable line-chart primitive.
 *
 * Each series is one line. Series with `hidden === true` are skipped from rendering.
 * Width is captured via onLayout so the chart always fits the parent card.
 *
 * Props:
 *   series:   [{ color, data: [{ x: number, y: number }], hidden?: boolean }]
 *   height:   number   — total height of the chart area (incl. axes).
 *   yMax:     number   — top of the y axis. bottom is always 0.
 *   yTicks:   number   — number of horizontal gridlines (default 4).
 *   xLabels:  [{ x: number, label: string }] — placed below the plot.
 *   todayX:   number?  — vertical highlight line at this x value.
 *   yFormat:  (v) => string   — formatter for the Y-axis labels (default Math.round).
 */
export default function LineChart({
  series,
  height = 200,
  yMax = 1,
  yTicks = 4,
  xLabels = [],
  todayX = null,
  yFormat = (v) => String(Math.round(v)),
  emptyLabel = 'No data',
  xToPx: xToPxProp,
}) {
  const { COLORS } = useTheme();
  const [width, setWidth] = useState(0);

  const Y_AXIS_W = 17;     // px reserved on the left for tick labels
  const X_AXIS_H = 22;     // px reserved at the bottom for labels
  const PAD_TOP = 8;
  const PAD_BOTTOM = 4;

  const plotW = Math.max(0, width - Y_AXIS_W);
  const plotH = Math.max(0, height - X_AXIS_H - PAD_TOP - PAD_BOTTOM);
  const yMaxSafe = Math.max(yMax, 1);

  // X scale: if `xToPx` provided by parent, use it (lets parents like
  // MonthlyCategoryLineChart fit days across the measured plot width).
  // Otherwise treat `x` as a pre-computed pixel offset for older callers.
  const xToPx = xToPxProp
    ? (x) => xToPxProp(x, plotW, Y_AXIS_W)
    : (x) => Y_AXIS_W + x;

  const yToPx = (y) => PAD_TOP + plotH - (Math.max(0, Math.min(y, yMaxSafe)) / yMaxSafe) * plotH;

  // Build polyline points string from a series. Skip series that are hidden
  // or that have no data with a numeric x in range.
  const visibleSeries = series.filter((s) => !s.hidden);

  const hasAnyData = visibleSeries.some(
    (s) => Array.isArray(s.data) && s.data.length > 0,
  );

  // Y-axis ticks — top of plot carries the highest value, baseline is 0.
  // i = 0 is the top tick (max), i = yTicks is the bottom tick (0).
  const yTickValues = Array.from(
    { length: yTicks + 1 },
    (_, i) => yMaxSafe - (yMaxSafe / yTicks) * i,
  );

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ width: '100%' }}>
      <View style={{ flexDirection: 'row', height }}>
        {/* Y-axis labels */}
        <View style={[styles.yAxis, { width: Y_AXIS_W }]}>
          {yTickValues.map((v, i) => {
            // i=0 → top tick (max), so top = PAD_TOP
            // i=yTicks → bottom tick (0), so top = PAD_TOP + plotH
            const top = PAD_TOP + (plotH * i) / yTicks;
            return (
              <Text
                key={i}
                style={[
                  styles.yLabel,
                  {
                    color: COLORS.textMuted,
                    position: 'absolute',
                    top: top - 6,
                    right: 12 ,
                  },
                ]}
              >
                {yFormat(v)}
              </Text>
            );
          })}
        </View>

        {/* Plot area */}
        <View style={{ width: plotW, height: plotH + PAD_TOP + PAD_BOTTOM, position: 'relative' }}>
          {width > 0 && (
            <Svg width={plotW} height={plotH + PAD_TOP + PAD_BOTTOM}>
              {/* Today highlight (vertical band) */}
              {todayX != null && (
                <Rect
                  x={(xToPx(todayX) - Y_AXIS_W) - 0.5}
                  y={PAD_TOP}
                  width={1}
                  height={plotH}
                  fill={COLORS.accent}
                  opacity={0.35}
                />
              )}

              {/* Horizontal gridlines */}
              <G>
                {yTickValues.map((_, i) => {
                  const y = PAD_TOP + (plotH * i) / yTicks;
                  return (
                    <Line
                      key={i}
                      x1={0}
                      x2={plotW}
                      y1={y}
                      y2={y}
                      stroke={COLORS.border}
                      strokeWidth={i === yTicks ? 1 : 0.5}
                      opacity={i === 0 ? 0 : 1}
                    />
                  );
                })}
              </G>

              {/* Series */}
              {hasAnyData &&
                visibleSeries.map((s, idx) => {
                  const points = (s.data || [])
                    .filter((p) => p && typeof p.x === 'number' && Number.isFinite(p.y))
                    .sort((a, b) => a.x - b.x)
                    .map((p) => `${xToPx(p.x) - Y_AXIS_W},${yToPx(p.y)}`)
                    .join(' ');
                  return (
                    <G key={idx}>
                      <Polyline
                        points={points}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                      {(s.data || []).map((p, i) => (
                        <Circle
                          key={`${idx}-${i}`}
                          cx={xToPx(p.x) - Y_AXIS_W}
                          cy={yToPx(p.y)}
                          r={2.4}
                          fill={s.color}
                        />
                      ))}
                    </G>
                  );
                })}

              {!hasAnyData && (
                <Rect
                  x={0}
                  y={PAD_TOP}
                  width={plotW}
                  height={plotH}
                  fill="transparent"
                />
              )}
            </Svg>
          )}

          {!hasAnyData && (
            <View
              style={[
                styles.emptyOverlay,
                { top: PAD_TOP, height: plotH },
              ]}
              pointerEvents="none"
            >
              <Text style={[styles.emptyText, { color: COLORS.textMuted }]}>{emptyLabel}</Text>
            </View>
          )}
        </View>
      </View>

      {/* X-axis labels — positioned as a percentage of the plot width so
          they auto-resize with the chart and never depend on the first
          onLayout measurement. Each label is centered on its tick via
          `translateX(-16)` (half of the 32-px cell width). */}
      <View
        style={[
          styles.xAxis,
          { height: X_AXIS_H, marginLeft: Y_AXIS_W, width: plotW },
        ]}
        pointerEvents="none"
      >
        {xLabels.map((lab, i) => {
          // Fractional position (0..1) within the plot area, clamped. RN
          // doesn't support `calc()` in stylesheets, so we use a plain
          // percentage and re-center with a translateX.
          const frac = plotW > 0
            ? Math.max(0, Math.min(1, (xToPx(lab.x) - Y_AXIS_W) / plotW))
            : 0;
          return (
            <View
              key={i}
              style={[
                styles.xLabelWrap,
                {
                  position: 'absolute',
                  left: `${frac * 100}%`,
                  top: 1,
                  backgroundColor: COLORS.surfaceAlt,
                  opacity: plotW > 0 ? 1 : 0,
                },
              ]}
            >
              <Text
                style={[
                  styles.xLabel,
                  {
                    color: lab.emph ? COLORS.text : COLORS.textMuted,
                    fontWeight: lab.emph ? '800' : '700',
                  },
                ]}
              >
                {lab.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Default legend row that pairs with <LineChart />.
 * Tap a series to toggle visibility.
 */
export function ChartLegend({ series, onToggle }) {
  const { COLORS } = useTheme();
  return (
    <View style={legendStyles.row}>
      {series.map((s, i) => (
        <TouchableOpacity
          key={i}
          activeOpacity={0.6}
          onPress={() => onToggle && onToggle(i)}
          style={[
            legendStyles.item,
            {
              backgroundColor: s.hidden ? 'transparent' : COLORS.surfaceAlt,
              borderColor: s.hidden ? COLORS.border : s.color + '55',
              opacity: s.hidden ? 0.45 : 1,
            },
          ]}
        >
          <View
            style={[
              legendStyles.dot,
              {
                backgroundColor: s.color,
                opacity: s.hidden ? 0.3 : 1,
              },
            ]}
          />
          <Text
            style={[
              legendStyles.label,
              { color: s.hidden ? COLORS.textMuted : COLORS.text },
            ]}
            numberOfLines={1}
          >
            {s.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  yAxis: { position: 'relative' },
  yLabel: { fontSize: 10, fontWeight: '600', textAlign: 'right' },

  xAxis: { position: 'relative', overflow: 'visible' },
  xLabelWrap: {
    width: 32,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    // Each label sits at its tick's x%; shift the cell left by half its
    // width so the tick mark visually passes through the cell center.
    transform: [{ translateX: -16 }],
  },
  xLabel: { fontSize: 11, width: 32, textAlign: 'center' },

  emptyOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontSize: 13 },
});

const legendStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    gap: 6,
    maxWidth: 160,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 11, fontWeight: '700', flexShrink: 1 },
});
