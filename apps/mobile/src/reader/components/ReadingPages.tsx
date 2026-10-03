import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View, type TextStyle } from "react-native";
import { wordMatches } from "../readerText";
import { useVoticTheme } from "../../theme/ThemeProvider";

type Page = { text: string; start: number; end: number };
type Line = { text: string; height: number };

/** Native text measurements determine page breaks; saved positions remain document word locations. */
export function pagesFromLines(text: string, lines: Line[], height: number): Page[] {
  const pages: Page[] = [];
  let cursor = 0;
  let start = 0;
  let used = 0;
  for (const line of lines) {
    const content = line.text.trim();
    const found = content ? text.indexOf(content, cursor) : cursor;
    const lineStart = found < 0 ? cursor : found;
    if (used > 0 && used + line.height > height) {
      pages.push({ text: text.slice(start, lineStart), start, end: lineStart });
      start = lineStart;
      used = 0;
    }
    cursor = lineStart + (content.length || line.text.length);
    used += line.height;
  }
  pages.push({ text: text.slice(start), start, end: text.length });
  return pages;
}

export function ReadingPages({
  passages,
  index,
  wordIndex,
  textStyle,
  onLocation,
  onReady,
}: {
  passages: string[];
  index: number;
  wordIndex: number;
  textStyle: TextStyle;
  onLocation: (index: number, word: number) => void;
  onReady: () => void;
}) {
  const { theme } = useVoticTheme();
  const list = useRef<FlatList<Page>>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [measurement, setMeasurement] = useState<{ key: string; lines: Line[] } | null>(null);
  const text = useMemo(() => passages.join("\n\n"), [passages]);
  const offsets = useMemo(() => {
    return passages.reduce<number[]>(
      (starts, _, at) => [...starts, at === 0 ? 0 : starts[at - 1] + passages[at - 1].length + 2],
      [],
    );
  }, [passages]);
  const key = JSON.stringify([text, size, textStyle]);
  const pages = useMemo(
    () =>
      measurement?.key === key ? pagesFromLines(text, measurement.lines, Math.max(1, size.height - 32)) : [],
    [key, measurement, text, size.height],
  );
  const location = (offsets[index] ?? 0) + (wordMatches(passages[index] ?? "")[wordIndex]?.index ?? 0);
  const target = Math.max(
    0,
    pages.findIndex((entry) => location < entry.end),
  );
  const page = target;
  useEffect(() => {
    if (!pages.length || !size.width) return;
    list.current?.scrollToOffset({ offset: target * size.width, animated: false });
    onReady();
  }, [pages, target, size.width, onReady]);
  function turn(next: number) {
    if (!pages.length) return;
    const bounded = Math.max(0, Math.min(pages.length - 1, next));
    list.current?.scrollToOffset({ offset: bounded * size.width, animated: false });
    const offset = pages[bounded].start;
    let passage = 0;
    offsets.forEach((start, at) => {
      if (start <= offset) passage = at;
    });
    const words = wordMatches(passages[passage] ?? "");
    let word = 0;
    words.forEach((match, at) => {
      if ((match.index ?? 0) <= offset - offsets[passage]) word = at;
    });
    onLocation(passage, word);
  }
  return (
    <View style={styles.container}>
      <View
        style={styles.viewport}
        onLayout={({ nativeEvent: { layout } }) => {
          if (layout.width !== size.width || layout.height !== size.height)
            setSize({ width: layout.width, height: layout.height });
        }}
        testID="reading-pages"
      >
        {size.width > 0 && measurement?.key !== key ? (
          <Text
            key={key}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            testID="reading-measurement"
            style={[textStyle, styles.measurement, { width: size.width - 48 }]}
            onTextLayout={({ nativeEvent }) => setMeasurement({ key, lines: nativeEvent.lines })}
          >
            {text}
          </Text>
        ) : null}
        <FlatList
          ref={list}
          data={pages}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(entry) => String(entry.start)}
          getItemLayout={(_, at) => ({ length: size.width, offset: size.width * at, index: at })}
          onMomentumScrollEnd={({ nativeEvent }) =>
            turn(Math.round(nativeEvent.contentOffset.x / size.width))
          }
          renderItem={({ item }) => (
            <View style={{ width: size.width, paddingHorizontal: 24, paddingVertical: 16 }}>
              <Text selectable style={[textStyle, { color: theme.text }]}>
                {item.text}
              </Text>
            </View>
          )}
        />
      </View>
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous page"
          disabled={page === 0}
          onPress={() => turn(page - 1)}
          style={styles.button}
        >
          <Text style={{ color: page === 0 ? theme.mutedText : theme.accent }}>‹</Text>
        </Pressable>
        <Text style={{ color: theme.mutedText }}>
          {pages.length ? `Page ${target + 1} of ${pages.length}` : "Preparing pages…"}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next page"
          disabled={!pages.length || page === pages.length - 1}
          onPress={() => turn(page + 1)}
          style={styles.button}
        >
          <Text style={{ color: theme.accent }}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  viewport: { flex: 1, overflow: "hidden" },
  measurement: { position: "absolute", opacity: 0, left: 24, top: 16 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  button: { minWidth: 48, minHeight: 44, alignItems: "center", justifyContent: "center" },
});
