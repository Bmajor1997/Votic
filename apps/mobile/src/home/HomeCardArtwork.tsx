import { StyleSheet, View } from "react-native";
import { VoticDocument } from "../documents/types";
import { FileTypeIcon } from "../components/FileTypeIcon";

/** Existing Home card footprint, with the same file identity used in lists. */
export function HomeDocumentArtwork({
  document,
  featured = false,
}: {
  document: VoticDocument;
  featured?: boolean;
}) {
  return (
    <View
      testID="home-document-artwork"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[s.artwork, featured && s.featured]}
    >
      <View style={[s.backSheet, { borderColor: "#BAC7DA", backgroundColor: "#EEF0F5" }]} />
      <FileTypeIcon filename={document.sourceName} size={featured ? 84 : 72} decorative />
    </View>
  );
}

/** Static geometry adds depth without motion or image/native dependencies. */
export function WidgetHalo({ color }: { color: string }) {
  return (
    <View
      testID="home-widget-halo"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[s.halo, { borderColor: color }]}
    />
  );
}
const s = StyleSheet.create({
  backSheet: {
    position: "absolute",
    width: 58,
    height: 76,
    borderWidth: 1,
    borderRadius: 12,
    transform: [{ rotate: "-12deg" }],
    left: 13,
    top: 18,
    opacity: 0.6,
  },
  artwork: { width: 104, height: 122, flexShrink: 0, alignItems: "center", justifyContent: "center" },
  featured: { width: 94, height: 124 },
  halo: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 28,
    opacity: 0.3,
    right: -85,
    top: -95,
  },
});
