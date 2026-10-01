import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radii, spacing } from "../design/tokens";
import { useVoticTheme } from "../theme/ThemeProvider";
import { ChartPoint, formatDuration, spokenDuration } from "./activityModel";

/**
 * Validated categorical pair (blue, then orange) for listening and reading, with light and dark
 * steps. They stay the same whatever accent someone picks, so the chart always reads the same.
 */
export function seriesColors(isDark: boolean) {
  return isDark ? { listening: "#3987e5", reading: "#d95926" } : { listening: "#2a78d6", reading: "#eb6834" };
}

const CHART_HEIGHT = 132;
// Each maximum has a whole-number halfway mark, so the middle gridline label is exact.
const NICE_MINUTES = [10, 20, 30, 60, 90, 120, 180, 240, 360, 480, 720, 1200, 2400, 4800, 9600];

function scaleMax(points: ChartPoint[]) {
  const largest = Math.max(...points.map((point) => point.reading + point.listening), 0) / 60_000;
  return (NICE_MINUTES.find((value) => value >= largest) ?? Math.ceil(largest / 60) * 60) * 60_000;
}
function axisLabel(ms: number) {
  const minutes = Math.round(ms / 60_000);
  return minutes >= 60 ? `${Math.round((minutes / 60) * 10) / 10} h` : `${minutes} min`;
}
function describe(point: ChartPoint) {
  if (!point.reading && !point.listening) return `${point.longLabel}: no activity`;
  return `${point.longLabel}: reading ${spokenDuration(point.reading)}, listening ${spokenDuration(point.listening)}`;
}

/** Stacked daily (or monthly) bars of reading and listening, with a legend and a table view. */
export function TimeChart({ points, title }: { points: ChartPoint[]; title: string }) {
  const { theme } = useVoticTheme();
  const colors = seriesColors(theme.isDark);
  const [selected, setSelected] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const max = scaleMax(points);
  const empty = points.every((point) => !point.reading && !point.listening);
  const selectedPoint = points.find((point) => point.key === selected);
  // Month views label every fifth day so labels never collide.
  const showLabel = (index: number) => points.length <= 12 || index === 0 || (index + 1) % 5 === 0;

  return (
    <View style={s.wrap}>
      <View style={s.legendRow}>
        <View style={s.legend}>
          <Legend color={colors.reading} label="Reading" />
          <Legend color={colors.listening} label="Listening" />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={table ? "Show chart" : "Show as table"}
          onPress={() => setTable((value) => !value)}
          hitSlop={8}
          style={s.toggle}
        >
          <Text style={[s.toggleText, { color: theme.accent }]}>{table ? "Chart" : "Table"}</Text>
        </Pressable>
      </View>
      {table ? (
        <View accessibilityLabel={`${title} as a table`}>
          {points.map((point) => (
            <View
              key={point.key}
              accessible
              accessibilityLabel={describe(point)}
              style={[s.tableRow, { borderBottomColor: theme.border }]}
            >
              <Text style={[s.tableLabel, { color: theme.text }]}>{point.longLabel}</Text>
              <Text style={[s.tableValue, { color: theme.mutedText }]}>
                {formatDuration(point.reading)} reading · {formatDuration(point.listening)} listening
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <>
          <Text accessibilityLiveRegion="polite" style={[s.readout, { color: theme.text }]}>
            {selectedPoint
              ? `${selectedPoint.longLabel} · ${formatDuration(selectedPoint.reading)} reading · ${formatDuration(selectedPoint.listening)} listening`
              : empty
                ? "No reading or listening in this period."
                : "Tap a bar for details."}
          </Text>
          <View style={s.plot}>
            <View style={s.axis}>
              <Text style={[s.axisText, { color: theme.mutedText }]}>{axisLabel(max)}</Text>
              <Text style={[s.axisText, { color: theme.mutedText }]}>{axisLabel(max / 2)}</Text>
              <Text style={[s.axisText, { color: theme.mutedText }]}>0</Text>
            </View>
            <View style={s.bars}>
              <View pointerEvents="none" style={[s.grid, { top: 0, backgroundColor: theme.border }]} />
              <View
                pointerEvents="none"
                style={[s.grid, { top: CHART_HEIGHT / 2, backgroundColor: theme.border }]}
              />
              <View
                pointerEvents="none"
                style={[s.grid, { top: CHART_HEIGHT, backgroundColor: theme.border }]}
              />
              {points.map((point, index) => {
                const readingHeight = (point.reading / max) * CHART_HEIGHT;
                const listeningHeight = (point.listening / max) * CHART_HEIGHT;
                const active = point.key === selected;
                return (
                  <Pressable
                    key={point.key}
                    accessibilityRole="button"
                    accessibilityLabel={describe(point)}
                    onPress={() => setSelected(active ? null : point.key)}
                    style={s.slot}
                  >
                    <View style={[s.column, { height: CHART_HEIGHT }]}>
                      {/* Reading sits on top of listening, separated by a 2px surface gap. */}
                      {readingHeight > 0 ? (
                        <View
                          style={[
                            s.segment,
                            s.top,
                            {
                              height: Math.max(2, readingHeight),
                              backgroundColor: colors.reading,
                              opacity: selected && !active ? 0.45 : 1,
                              marginBottom: listeningHeight > 0 ? 2 : 0,
                            },
                          ]}
                        />
                      ) : null}
                      {listeningHeight > 0 ? (
                        <View
                          style={[
                            s.segment,
                            readingHeight > 0 ? null : s.top,
                            {
                              height: Math.max(2, listeningHeight),
                              backgroundColor: colors.listening,
                              opacity: selected && !active ? 0.45 : 1,
                            },
                          ]}
                        />
                      ) : null}
                    </View>
                    <Text
                      numberOfLines={1}
                      maxFontSizeMultiplier={1.3}
                      style={[
                        s.label,
                        { color: active ? theme.text : theme.mutedText, fontWeight: active ? "800" : "600" },
                      ]}
                    >
                      {showLabel(index) ? point.label : " "}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </>
      )}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const { theme } = useVoticTheme();
  return (
    <View style={s.legendItem}>
      <View style={[s.swatch, { backgroundColor: color }]} />
      <Text style={[s.legendText, { color: theme.text }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: spacing.sm },
  legendRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, flex: 1 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontSize: 14 },
  toggle: { minHeight: 44, minWidth: 44, alignItems: "flex-end", justifyContent: "center" },
  toggleText: { fontSize: 14, fontWeight: "800" },
  readout: { fontSize: 14, lineHeight: 19, minHeight: 19 },
  plot: { flexDirection: "row", gap: spacing.xs },
  axis: { height: CHART_HEIGHT, justifyContent: "space-between", marginTop: -7, marginBottom: 7 },
  axisText: { fontSize: 11, textAlign: "right", minWidth: 34 },
  bars: { flex: 1, flexDirection: "row", alignItems: "flex-start" },
  grid: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth },
  slot: { flex: 1, alignItems: "center", minHeight: 44 },
  column: { width: "70%", maxWidth: 24, justifyContent: "flex-end" },
  segment: { width: "100%" },
  top: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  label: { fontSize: 12, marginTop: 6 },
  tableRow: {
    minHeight: 48,
    borderBottomWidth: 1,
    paddingVertical: spacing.xs,
    justifyContent: "center",
    borderRadius: radii.sm,
  },
  tableLabel: { fontSize: 15, fontWeight: "700" },
  tableValue: { fontSize: 14, marginTop: 2 },
});
