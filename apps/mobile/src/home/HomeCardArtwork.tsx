import { Ionicons } from "@expo/vector-icons";
import { memo, useMemo, type ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";
import { VoticDocument } from "../documents/types";
import { split_passages } from "../documents/passages";
import { resolve_file_type } from "../documents/fileTypes";
import { document_type_label } from "../documents/documentDisplay";
import { documentPreviewColors } from "../design/documentPreviewColors";
import { editorial } from "../design/editorial";

function preview_identity(document: VoticDocument) {
  const type = resolve_file_type({ filename: document.sourceName });
  const label = document_type_label(document);
  if (label === "Scan")
    return {
      kind: "page",
      label: "SCAN",
      color: documentPreviewColors.scan.ink,
      bar: documentPreviewColors.scan.bar,
      icon: "scan-outline" as const,
    };
  const webpage = label === "Webpage";
  if (webpage || type.family === "html")
    return {
      kind: "browser",
      label: webpage ? "WEBPAGE" : "HTML",
      color: documentPreviewColors.html.ink,
      bar: documentPreviewColors.html.bar,
      icon: (webpage ? "globe-outline" : "code-slash-outline") as ComponentProps<typeof Ionicons>["name"],
    };
  if (type.family === "pdf")
    return {
      kind: "pdf",
      label: "PDF",
      color: documentPreviewColors.pdf.ink,
      bar: documentPreviewColors.pdf.bar,
      icon: "document-text-outline" as const,
    };
  if (type.family === "epub")
    return {
      kind: "book",
      label: "EPUB",
      color: documentPreviewColors.epub.ink,
      bar: documentPreviewColors.epub.bar,
      icon: "book-outline" as const,
    };
  return {
    kind: "page",
    label: type.label.toUpperCase(),
    color: documentPreviewColors.text.ink,
    bar: documentPreviewColors.text.bar,
    icon: "document-outline" as const,
  };
}

/** Format-specific frames around real retained text; no claim to reproduce the source's original layout. */
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
      <View
        testID={`home-preview-${identity.kind}`}
        style={[s.frame, { borderColor: identity.color }, identity.kind === "book" && s.book]}
      >
        <View style={[s.formatBar, { backgroundColor: identity.bar }]}>
          {identity.kind === "browser" ? (
            <View style={s.browserDots}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[s.dot, { backgroundColor: identity.color }]} />
              ))}
            </View>
          ) : null}
          <Ionicons name={identity.icon} size={16} color={identity.color} />
          <Text allowFontScaling={false} style={[s.formatLabel, { color: identity.color }]}>
            {identity.label}
          </Text>
        </View>
        {identity.kind === "book" ? <View style={[s.spine, { backgroundColor: identity.color }]} /> : null}
        <View testID="home-page-preview" style={[s.page, identity.kind === "book" && s.bookPage]}>
          <Text allowFontScaling={false} numberOfLines={8} style={s.content}>
            {excerpt || "Your next read starts here."}
          </Text>
        </View>
        {identity.kind === "pdf" ? <View style={s.fold} /> : null}
      </View>
    </View>
  );
});
const s = StyleSheet.create({
  artwork: { width: "100%", height: "100%" },
  frame: { flex: 1, borderWidth: 1, borderRadius: 8, backgroundColor: "#FFFCF7", overflow: "hidden" },
  book: { borderTopLeftRadius: 3, borderBottomLeftRadius: 3, borderRightWidth: 4 },
  formatBar: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 32, paddingHorizontal: 12 },
  formatLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  browserDots: { flexDirection: "row", gap: 3, marginRight: 4 },
  dot: { width: 4, height: 4, borderRadius: 2, opacity: 0.65 },
  page: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  bookPage: { paddingLeft: 23, backgroundColor: "#F5EFDF" },
  spine: { position: "absolute", top: 32, bottom: 0, left: 0, width: 9, zIndex: 1 },
  content: { ...editorial, color: "#40382C", fontSize: 12, lineHeight: 18, letterSpacing: 0 },
  fold: {
    position: "absolute",
    top: 32,
    right: 0,
    width: 19,
    height: 19,
    backgroundColor: "#EAC6C0",
    borderBottomLeftRadius: 4,
  },
});
