import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { VoticDocument } from "../documents/types";
import { split_passages } from "../documents/passages";
import { file_type_palette, resolve_file_type } from "../documents/fileTypes";
import { document_type_label } from "../documents/documentDisplay";
import { documentPreviewColors } from "../design/documentPreviewColors";
import { editorial } from "../design/editorial";

function preview_identity(document: VoticDocument) {
  const type = resolve_file_type({ filename: document.sourceName });
  const label = document_type_label(document);
  const palette = file_type_palette(type);
  // Known image files keep their own format identity even when imported via OCR.
  if (label === "Scan" && type.family === "unknown")
    return { kind: "page", label: "SCAN", color: documentPreviewColors.scan.ink };
  if (label === "Webpage")
    return { kind: "browser", label: "WEBPAGE", color: documentPreviewColors.html.ink };
  const kind =
    type.family === "html"
      ? "browser"
      : type.family === "pdf"
        ? "pdf"
        : type.family === "epub"
          ? "book"
          : "page";
  return { kind, label: type.monogram, color: palette.ink, accent: palette.accent };
}

/** Minimal frame around actual retained text, explicitly labeled as reflowed, not a source page. */
export const HomeDocumentArtwork = memo(function HomeDocumentArtwork({
  document,
}: {
  document: VoticDocument;
}) {
  const identity = preview_identity(document);
  const excerpt = useMemo(
    () => split_passages(document.plainText.slice(0, 1200)).join(" ").slice(0, 520),
    [document.plainText],
  );
  return (
    <View
      testID="home-document-artwork"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={s.artwork}
    >
      <View testID={`home-preview-${identity.kind}`} style={[s.frame, { borderColor: identity.color }]}>
        <View style={s.formatBar}>
          <View style={[s.marker, { backgroundColor: identity.accent ?? identity.color }]} />
          <Text allowFontScaling={false} numberOfLines={1} style={[s.formatLabel, { color: identity.color }]}>
            {identity.label}
          </Text>
        </View>
        <View testID="home-page-preview" style={s.page}>
          <Text allowFontScaling={false} numberOfLines={7} style={s.content}>
            {excerpt || "Preview unavailable"}
          </Text>
        </View>
        <Text allowFontScaling={false} numberOfLines={1} style={[s.caption, { color: identity.color }]}>
          {excerpt ? "Text excerpt · reflowed" : "No preview available"}
        </Text>
      </View>
    </View>
  );
});
const s = StyleSheet.create({
  artwork: { width: "100%", height: "100%", padding: 4 },
  frame: { flex: 1, borderWidth: 1, borderRadius: 8, backgroundColor: "#FFFFFF", overflow: "hidden" },
  formatBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 34,
    marginHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  marker: { width: 5, height: 15, borderRadius: 2 },
  formatLabel: { flexShrink: 1, fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  page: { flex: 1, paddingHorizontal: 13, paddingVertical: 12, overflow: "hidden" },
  content: { ...editorial, color: "#202124", fontSize: 12, lineHeight: 18, letterSpacing: 0 },
  caption: { paddingHorizontal: 12, paddingBottom: 9, fontSize: 9, lineHeight: 12 },
});
