import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radii, spacing } from "../design/tokens";
import { useVoticTheme } from "../theme/ThemeProvider";
import { ChartPoint, format_duration, shows_axis_label, spoken_duration } from "./activityModel";

/**
 * Validated categorical pair (blue, then orange) for listening and reading, with light and dark
 * steps. They stay the same whatever accent someone picks, so the chart always reads the same.
 */
export function series_colors(isDark: boolean) {
  return isDark ? { listening: "#3987e5", reading: "#d95926" } : { listening: "#2a78d6", reading: "#eb6834" };
}

const CHART_HEIGHT = 132;
/** Room for the widest label ("29") at the largest allowed font size. The selected day is named in the readout. */
const LABEL_WIDTH = 40;
// Each maximum has a whole-number halfway mark, so the middle gridline label is exact.
const NICE_MINUTES = [10, 20, 30, 60, 90, 120, 180, 240, 360, 480, 720, 1200, 2400, 4800, 9600];

function scale_max(points: ChartPoint[]) {
  // Bars stand side by side, so the scale fits the taller of the two, not their sum.
  const largest = Math.max(...points.map((point) => Math.max(point.reading, point.listening)), 0) / 60_000;
  return (NICE_MINUTES.find((value) => value >= largest) ?? Math.ceil(largest / 60) * 60) * 60_000;
}
function axis_label(ms: number) {
  const minutes = Math.round(ms / 60_000);
  return minutes >= 60 ? `${Math.round((minutes / 60) * 10) / 10} h` : `${minutes} min`;
}
function describe(point: ChartPoint) {
  if (!point.reading && !point.listening) return `${point.longLabel}: no activity`;
  return `${point.longLabel}: reading ${spoken_duration(point.reading)}, listening ${spoken_duration(point.listening)}`;
}

/** Daily (or monthly) reading and listening bars side by side, with a legend and a table view. */
export function TimeChart({ points, title }: { points: ChartPoint[]; title: string }) {
  const { theme } = useVoticTheme();
  const colors = series_colors(theme.isDark);
  const [selected, setSelected] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const max = scale_max(points);
  const empty = points.every((point) => !point.reading && !point.listening);
  const selectedPoint = points.find((point) => point.key === selected);

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
                {format_duration(point.reading)} reading · {format_duration(point.listening)} listening
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <>
          <Text accessibilityLiveRegion="polite" style={[s.readout, { color: theme.text }]}>
            {selectedPoint
              ? `${selectedPoint.longLabel} · ${format_duration(selectedPoint.reading)} reading · ${format_duration(selectedPoint.listening)} listening`
              : empty
                ? "No reading or listening in this period."
                : "Tap a bar for details."}
          </Text>
          <View style={s.plot}>
            <View style={s.axis}>
              <Text style={[s.axisText, { color: theme.mutedText }]}>{axis_label(max)}</Text>
              <Text style={[s.axisText, { color: theme.mutedText }]}>{axis_label(max / 2)}</Text>
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
                    <View style={[s.pair, { height: CHART_HEIGHT }]}>
                      {/* Reading, then listening, both rising from the baseline with a 2px gap between. */}
                      {[
                        { key: "reading", height: readingHeight, color: colors.reading },
                        { key: "listening", height: listeningHeight, color: colors.listening },
                      ].map((bar) => (
                        <View
                          key={bar.key}
                          testID={`bar-${point.key}-${bar.key}`}
                          style={[
                            s.bar,
                            {
                              height: bar.height > 0 ? Math.max(2, bar.height) : 0,
                              backgroundColor: bar.color,
                              opacity: selected && !active ? 0.45 : 1,
                            },
                          ]}
                        />
                      ))}
                    </View>
                    {/* A month's bars are narrower than "30", so the label gets its own fixed width, centred
                        under the bar, instead of being squeezed (and cut to "…") by the bar's slot. */}
                    <Text
                      testID={`label-${point.key}`}
                      numberOfLines={1}
                      maxFontSizeMultiplier={1.3}
                      style={[
                        s.label,
                        { color: active ? theme.text : theme.mutedText, fontWeight: active ? "800" : "600" },
                      ]}
                    >
                      {shows_axis_label(index, points.length) ? point.label : " "}
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
  pair: { width: "80%", maxWidth: 30, flexDirection: "row", alignItems: "flex-end", gap: 2 },
  bar: { flex: 1, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  label: { width: LABEL_WIDTH, fontSize: 12, marginTop: 6, textAlign: "center" },
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
