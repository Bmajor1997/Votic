import { DEFAULT_ACCENT, make_theme } from "../theme/ThemeProvider";
import { useMemo } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { split_passages } from "../documents/passages";
import { VoticDocument } from "../documents/types";
import { darkCards } from "../design/cardPalette";
import { editorial } from "../design/editorial";
import { saved_excerpt } from "./savedExcerpt";

// Preview paper stays light independently of the surrounding app or reader appearance.
const paper = make_theme(DEFAULT_ACCENT, "light", true);

/** Text already stored on device, using the same passage boundaries as Reader and speech. */
export function ContinuePreview({ document }: { document: VoticDocument }) {
  const { width, fontScale } = useWindowDimensions();
  const passages = useMemo(() => split_passages(document.plainText), [document.plainText]);
  const excerpt = useMemo(
    () => saved_excerpt(passages, document.sentenceIndex, document.wordIndex),
    [passages, document.sentenceIndex, document.wordIndex],
  );
  return (
    <View testID="home-position-preview" style={[s.preview, { width: width <= 350 ? 104 : 132 }]}>
      <Text style={s.label}>{excerpt ? "AT YOUR SAVED POSITION" : "DOCUMENT PREVIEW"}</Text>
      <View style={s.sheets}>
        <View
          accessible={false}
          pointerEvents="none"
          style={[s.backSheet, { backgroundColor: paper.surfaceMuted }]}
        />
        <View
          testID="home-preview-paper"
          style={[s.page, { backgroundColor: paper.background, borderColor: paper.border }]}
        >
          <Text numberOfLines={fontScale > 1.3 ? 5 : 7} style={[s.excerpt, { color: paper.text }]}>
            {excerpt || "Open this document to pick up where you left off."}
          </Text>
        </View>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  preview: { flexShrink: 0, gap: 8 },
  label: { color: darkCards.chapter.detail, fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  sheets: { paddingRight: 4, paddingBottom: 5 },
  backSheet: {
    position: "absolute",
    top: 6,
    right: 0,
    bottom: 0,
    left: 5,
    borderRadius: 3,
    transform: [{ rotate: "3deg" }],
  },
  page: {
    minHeight: 184,
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 15,
    gap: 9,
    shadowColor: "#060F20",
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  excerpt: { ...editorial, fontSize: 12, lineHeight: 18, letterSpacing: 0 },
});
