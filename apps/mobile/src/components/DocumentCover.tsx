import { StyleSheet, Text, View } from "react-native";
import { coverExcerpt, fileTypeLabel } from "../documents/documentDisplay";
import { VoticDocument } from "../documents/types";
import { useVoticTheme } from "../theme/ThemeProvider";
import { documentTypeColor } from "./DocumentTypeIcon";

/** A short code that fits on the smallest cover; the full type name is shown in metadata. */
function coverTypeCode(sourceName: string) {
  const label = fileTypeLabel(sourceName);
  return label === "PowerPoint"
    ? "PPT"
    : label === "Word"
      ? "DOC"
      : label === "Markdown"
        ? "MD"
        : label === "Text"
          ? "TXT"
          : label.toUpperCase();
}

const SIZES = {
  sm: { width: 40, height: 52, band: 11, lines: 4 },
  md: { width: 52, height: 68, band: 14, lines: 5 },
  lg: { width: 76, height: 100, band: 18, lines: 7 },
} as const;

/**
 * A small "first page" for a document: its file-type color and label on top, then its opening
 * text (large size) or line shapes taken from its opening words (smaller sizes). The same
 * document looks the same on Home, Documents, Notes, and Statistics. Votic keeps extracted text,
 * not page images, so this is drawn from the text rather than a rendered page.
 */
export function DocumentCover({
  document,
  size = "md",
}: {
  document: VoticDocument;
  size?: keyof typeof SIZES;
}) {
  const { theme } = useVoticTheme();
  const spec = SIZES[size];
  const color = documentTypeColor(document.sourceName);
  const excerpt = coverExcerpt(document);
  // Line widths follow the opening words, so each document has its own recognizable texture.
  const words = excerpt.split(" ");
  const widths = Array.from({ length: spec.lines }, (_, index) => {
    const length = (words[index * 3]?.length ?? 4) + (words[index * 3 + 1]?.length ?? 3);
    return 55 + ((length * 7) % 40);
  });
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        s.page,
        {
          width: spec.width,
          height: spec.height,
          borderColor: theme.border,
          backgroundColor: theme.surface,
        },
      ]}
    >
      <View style={[s.band, { height: spec.band, backgroundColor: color }]}>
        <Text
          numberOfLines={1}
          allowFontScaling={false}
          style={[s.type, { fontSize: size === "lg" ? 9 : 7 }]}
        >
          {coverTypeCode(document.sourceName)}
        </Text>
      </View>
      {size === "lg" && excerpt ? (
        <Text numberOfLines={7} allowFontScaling={false} style={[s.excerpt, { color: theme.mutedText }]}>
          {excerpt}
        </Text>
      ) : (
        <View style={s.lines}>
          {widths.map((width, index) => (
            <View
              key={index}
              style={[
                s.line,
                {
                  width: `${width}%`,
                  backgroundColor: theme.isDark ? "#5B616A" : "#D9DCE1",
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  page: { borderWidth: 1, borderRadius: 8, overflow: "hidden", flexShrink: 0 },
  band: { justifyContent: "center", paddingHorizontal: 4 },
  type: { color: "#FFFFFF", fontWeight: "900", letterSpacing: 0.4 },
  excerpt: { fontSize: 6.5, lineHeight: 9, paddingHorizontal: 5, paddingTop: 4 },
  lines: { paddingHorizontal: 5, paddingTop: 5, gap: 4 },
  line: { height: 2.5, borderRadius: 2 },
});
