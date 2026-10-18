import { Ionicons } from "@expo/vector-icons";
import { ReactNode, useEffect, useState } from "react";
import { Animated, Easing, Image, LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { FILE_TYPE_PALETTE } from "../documents/fileTypes";
import { useVoticTheme } from "../theme/ThemeProvider";

/**
 * Motion for Welcome and the account screens: the Votic mark grows out of a soft glow, a shelf of
 * documents drifts past, and the headline's words light up one at a time the way Votic highlights words
 * as it reads aloud. All of it is decorative and hidden from screen readers, and Less motion (or the
 * phone's Reduce Motion) shows the same screen standing still.
 */

const BRAND_BLUE = "#2563EB";
const GLOW_LAYERS = [1, 0.9, 0.8, 0.7, 0.62, 0.55, 0.48];

/** A 0→1 value that plays once when the screen opens, after `delay` ms (already 1 with Less motion). */
export function useEntrance(delay = 0, duration = 520) {
  const { reduceMotion } = useAccessibilityPreferences();
  const [value] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useEffect(() => {
    if (reduceMotion) {
      value.setValue(1);
      return;
    }
    const animation = Animated.timing(value, {
      toValue: 1,
      delay,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, duration, reduceMotion, value]);
  return value;
}

/** Fades and lifts its children into place. */
export function RiseIn({
  delay = 0,
  distance = 18,
  children,
}: {
  delay?: number;
  distance?: number;
  children: ReactNode;
}) {
  const progress = useEntrance(delay);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] });
  return <Animated.View style={{ opacity: progress, transform: [{ translateY }] }}>{children}</Animated.View>;
}

/** The Votic V, arriving from a glow: it grows toward the reader, overshoots a touch, then breathes. */
export function GlowMark({ size = 72, delay = 0 }: { size?: number; delay?: number }) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const [arrive] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  const [breathe] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduceMotion) {
      arrive.setValue(1);
      breathe.setValue(0);
      return;
    }
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.spring(arrive, { toValue: 1, speed: 5, bounciness: 9, useNativeDriver: true }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(breathe, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(breathe, {
            toValue: 0,
            duration: 1800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ),
    ]);
    animation.start();
    return () => animation.stop();
  }, [arrive, breathe, delay, reduceMotion]);
  const markScale = Animated.add(
    arrive.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
    breathe.interpolate({ inputRange: [0, 1], outputRange: [0, 0.04] }),
  );
  const glowScale = Animated.add(
    arrive.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
    breathe.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }),
  );
  const halo = size * 1.9;
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ width: halo, height: halo, alignItems: "center", justifyContent: "center" }}
    >
      {/* Many faint, shrinking circles stack into a soft glow, since React Native has no blur. */}
      {GLOW_LAYERS.map((layer, index) => (
        <Animated.View
          key={index}
          style={[
            s.glow,
            {
              width: halo * layer,
              height: halo * layer,
              borderRadius: halo,
              backgroundColor: index % 3 === 2 ? theme.accent : BRAND_BLUE,
              opacity: arrive.interpolate({
                inputRange: [0, 1],
                outputRange: [0, theme.isDark ? 0.11 : 0.07],
              }),
              transform: [{ scale: glowScale }],
            },
          ]}
        />
      ))}
      <Animated.View
        style={[
          s.markTile,
          theme.elevation,
          {
            width: size,
            height: size,
            borderRadius: size * 0.3,
            backgroundColor: theme.isDark ? "#F4F6FB" : "#FFFFFF",
            opacity: arrive.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
            transform: [{ scale: markScale }],
          },
        ]}
      >
        <Image
          source={require("../../assets/votic-mark.png")}
          resizeMode="contain"
          style={{ width: size * 0.62, height: size * 0.62 }}
        />
      </Animated.View>
    </View>
  );
}

type Tile =
  | { kind: "file"; label: string; family: keyof typeof FILE_TYPE_PALETTE }
  | { kind: "listen"; title: string; minutes: number }
  | { kind: "highlight" }
  | { kind: "note"; title: string }
  | { kind: "ask"; prompt: string };

const ROWS: Tile[][] = [
  [
    { kind: "file", label: "PDF", family: "pdf" },
    { kind: "listen", title: "Chapter 4", minutes: 18 },
    { kind: "file", label: "EPUB", family: "epub" },
    { kind: "highlight" },
    { kind: "file", label: "DOCX", family: "word" },
    { kind: "ask", prompt: "Explain this part" },
  ],
  [
    { kind: "note", title: "Key idea" },
    { kind: "file", label: "PPTX", family: "slides" },
    { kind: "ask", prompt: "Summarize it for me" },
    { kind: "file", label: "HTML", family: "html" },
    { kind: "listen", title: "Lecture notes", minutes: 9 },
    { kind: "file", label: "PNG", family: "image" },
  ],
  [
    { kind: "file", label: "RTF", family: "rtf" },
    { kind: "highlight" },
    { kind: "file", label: "ODT", family: "odt" },
    { kind: "note", title: "Remember" },
    { kind: "file", label: "WEBP", family: "photo" },
    { kind: "listen", title: "Article", minutes: 6 },
  ],
];

/** Rows of documents, listening cards, and notes drifting past in alternating directions. */
export function DriftingShelf({
  height = 300,
  rowCount = ROWS.length,
}: {
  height?: number;
  rowCount?: number;
}) {
  const appear = useEntrance(250, 700);
  return (
    <Animated.View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[s.shelf, { height, opacity: appear }]}
    >
      <View style={s.tilted}>
        {ROWS.slice(0, rowCount).map((row, index) => (
          <DriftRow key={index} tiles={row} reverse={index % 2 === 1} speed={34 + index * 6} />
        ))}
      </View>
    </Animated.View>
  );
}

function DriftRow({ tiles, reverse, speed }: { tiles: Tile[]; reverse: boolean; speed: number }) {
  const { reduceMotion } = useAccessibilityPreferences();
  const [width, setWidth] = useState(0);
  const [offset] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!width || reduceMotion) {
      offset.setValue(reverse ? -width / 2 : 0);
      return;
    }
    // Two copies of the row side by side: sliding by one copy's width loops without a seam.
    offset.setValue(reverse ? -width : 0);
    const animation = Animated.loop(
      Animated.timing(offset, {
        toValue: reverse ? 0 : -width,
        duration: width * speed,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [offset, reduceMotion, reverse, speed, width]);
  const copy = (key: string, measure?: (event: LayoutChangeEvent) => void) => (
    <View key={key} onLayout={measure} style={s.copy}>
      {tiles.map((tile, index) => (
        <ShelfTile key={index} tile={tile} tilt={((index * 7) % 5) - 2} />
      ))}
    </View>
  );
  return (
    <Animated.View style={[s.row, { transform: [{ translateX: offset }] }]}>
      {copy("a", (event) => setWidth(Math.round(event.nativeEvent.layout.width)))}
      {copy("b")}
    </Animated.View>
  );
}

function ShelfTile({ tile, tilt }: { tile: Tile; tilt: number }) {
  const { theme } = useVoticTheme();
  const card = [
    s.card,
    theme.elevation,
    { backgroundColor: theme.surface, transform: [{ rotate: `${tilt}deg` }] },
  ];
  if (tile.kind === "file") {
    const palette = FILE_TYPE_PALETTE[tile.family];
    return (
      <View
        style={[
          s.file,
          theme.elevation,
          { backgroundColor: palette.accent, transform: [{ rotate: `${tilt * 2}deg` }] },
        ]}
      >
        <Ionicons name="document-text" size={18} color="rgba(255,255,255,0.75)" />
        <Text allowFontScaling={false} style={s.fileLabel}>
          {tile.label}
        </Text>
      </View>
    );
  }
  if (tile.kind === "listen")
    return (
      <View style={[card, s.listen]}>
        <View style={[s.play, { backgroundColor: theme.accent }]}>
          <Ionicons name="play" size={14} color={theme.onAccent} />
        </View>
        <View style={s.grow}>
          <Text allowFontScaling={false} numberOfLines={1} style={[s.cardTitle, { color: theme.text }]}>
            {tile.title}
          </Text>
          <View style={s.wave}>
            {[5, 11, 7, 14, 9, 12, 6, 10, 4].map((bar, index) => (
              <View
                key={index}
                style={[s.bar, { height: bar, backgroundColor: index < 4 ? theme.accent : theme.border }]}
              />
            ))}
          </View>
          <Text allowFontScaling={false} style={[s.cardMeta, { color: theme.mutedText }]}>
            {tile.minutes} min listen
          </Text>
        </View>
      </View>
    );
  if (tile.kind === "highlight")
    return (
      <View style={[card, s.highlight]}>
        <View style={[s.line, { width: "92%", backgroundColor: theme.border }]} />
        <View style={s.lineRow}>
          <View style={[s.line, { width: 22, backgroundColor: theme.border }]} />
          <View style={[s.spoken, { backgroundColor: theme.wordHighlight }]}>
            <Text allowFontScaling={false} style={[s.spokenText, { color: theme.text }]}>
              read aloud
            </Text>
          </View>
          <View style={[s.line, { flex: 1, backgroundColor: theme.border }]} />
        </View>
        <View style={[s.line, { width: "70%", backgroundColor: theme.border }]} />
      </View>
    );
  if (tile.kind === "note")
    return (
      <View style={[card, s.note, { backgroundColor: theme.isDark ? "#4A4129" : "#FFF4CF" }]}>
        <View style={s.noteHead}>
          <Ionicons name="create-outline" size={14} color={theme.isDark ? "#F8D68C" : "#8A5A12"} />
          <Text
            allowFontScaling={false}
            style={[s.cardTitle, { color: theme.isDark ? "#F8E7BD" : "#5E3E0C" }]}
          >
            {tile.title}
          </Text>
        </View>
        <View style={[s.line, { width: "88%", backgroundColor: theme.isDark ? "#6D5F3C" : "#EED9A0" }]} />
        <View style={[s.line, { width: "60%", backgroundColor: theme.isDark ? "#6D5F3C" : "#EED9A0" }]} />
      </View>
    );
  return (
    <View style={[card, s.ask]}>
      <Ionicons name="sparkles" size={15} color={BRAND_BLUE} />
      <Text allowFontScaling={false} numberOfLines={2} style={[s.cardTitle, s.grow, { color: theme.text }]}>
        {tile.prompt}
      </Text>
    </View>
  );
}

/**
 * The headline, with each word lit up in turn like Votic reading it aloud. Screen readers hear the plain
 * sentence once; the highlight is visual only and stands still with Less motion.
 */
export function SpokenHeadline({
  lines,
  delay = 0,
  style,
}: {
  lines: string[];
  delay?: number;
  style?: object;
}) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const words = lines.map((line) => line.split(" "));
  const total = words.flat().length;
  const [spoken, setSpoken] = useState(-1);
  useEffect(() => {
    if (reduceMotion) return;
    let index = -1;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      index = index + 1 >= total ? -1 : index + 1;
      setSpoken(index);
      // Each pass reads the line at a calm pace, then rests before reading it again.
      timer = setTimeout(step, index === -1 ? 3200 : 420);
    };
    timer = setTimeout(step, delay + 900);
    return () => clearTimeout(timer);
  }, [delay, reduceMotion, total]);
  // Where each line starts in the sentence, so every word knows its place in the reading order.
  const starts = words.map((_, lineIndex) => words.slice(0, lineIndex).flat().length);
  const current = reduceMotion ? -1 : spoken;
  return (
    <Text accessibilityRole="header" accessibilityLabel={lines.join("\n")} style={style}>
      {words.map((line, lineIndex) => (
        <Text key={lineIndex}>
          {lineIndex > 0 ? "\n" : ""}
          {line.map((word, wordIndex) => {
            const lit = starts[lineIndex] + wordIndex === current;
            const last = lineIndex === words.length - 1;
            return (
              <Text key={wordIndex}>
                {wordIndex > 0 ? " " : ""}
                <Text
                  style={[
                    last && { color: theme.accentText },
                    lit && { backgroundColor: theme.wordHighlight, color: theme.text },
                  ]}
                >
                  {word}
                </Text>
              </Text>
            );
          })}
        </Text>
      ))}
    </Text>
  );
}

const s = StyleSheet.create({
  glow: { position: "absolute" },
  markTile: { alignItems: "center", justifyContent: "center" },
  shelf: { overflow: "hidden", width: "100%" },
  tilted: { gap: 14, paddingTop: 18, transform: [{ rotate: "-7deg" }, { scale: 1.12 }], marginLeft: -40 },
  row: { flexDirection: "row" },
  copy: { flexDirection: "row", alignItems: "center", gap: 14, paddingRight: 14 },
  card: { borderRadius: 18, padding: 12 },
  file: { width: 70, height: 84, borderRadius: 18, alignItems: "center", justifyContent: "center", gap: 4 },
  fileLabel: { color: "#FFFFFF", fontSize: 15, fontWeight: "900", letterSpacing: 0.4 },
  listen: { width: 172, flexDirection: "row", alignItems: "center", gap: 10 },
  play: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  grow: { flex: 1 },
  cardTitle: { fontSize: 13, fontWeight: "800" },
  cardMeta: { fontSize: 11, fontWeight: "600" },
  wave: { flexDirection: "row", alignItems: "center", gap: 3, height: 16, marginVertical: 3 },
  bar: { width: 3, borderRadius: 2 },
  highlight: { width: 176, gap: 9, paddingVertical: 14 },
  line: { height: 7, borderRadius: 4 },
  lineRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  spoken: { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  spokenText: { fontSize: 12, fontWeight: "800" },
  note: { width: 146, gap: 8 },
  noteHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  ask: { width: 158, flexDirection: "row", alignItems: "center", gap: 8 },
});
