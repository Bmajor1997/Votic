import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { radii, spacing } from "../design/tokens";
import { fileTypeLabel, readableTitle } from "../documents/documentDisplay";
import { VoticDocument } from "../documents/types";
import { useVoticTheme } from "../theme/ThemeProvider";
import { documentWidgetTone, widgetPalette } from "./widgetDesign";

/** Home's stylized cover is decorative; the adjacent document title and actions carry its meaning. */
export function HomeDocumentArtwork({
  document,
  featured = false,
}: {
  document: VoticDocument;
  featured?: boolean;
}) {
  const { theme } = useVoticTheme();
  const colors = widgetPalette(theme.isDark, documentWidgetTone(document.sourceName));
  const monogram = readableTitle(document.title)
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return (
    <View
      testID="home-document-artwork"
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[s.artwork, featured && s.featured]}
    >
      <View style={[s.backPage, { backgroundColor: colors.art, borderColor: colors.border }]} />
      <View style={[s.cover, { backgroundColor: colors.strong }]}>
        <View style={[s.spine, { backgroundColor: colors.onStrong, opacity: 0.2 }]} />
        <View style={[s.orbit, { borderColor: colors.onStrong }]} />
        <Text allowFontScaling={false} style={[s.monogram, { color: colors.onStrong }]}>
          {monogram}
        </Text>
        <View style={s.coverFooter}>
          <Ionicons name="document-text-outline" size={14} color={colors.onStrong} />
          <Text allowFontScaling={false} style={[s.type, { color: colors.onStrong }]}>
            {fileTypeLabel(document.sourceName)}
          </Text>
        </View>
      </View>
      {featured ? (
        <View style={[s.badge, { backgroundColor: theme.accent }]}>
          <Ionicons name="headset" size={19} color={theme.onAccent} />
        </View>
      ) : null}
    </View>
  );
}

/** Static geometry adds depth without motion or image/native dependencies. */
export function WidgetHalo({ color }: { color: string }) {
  return (
    <View
      testID="home-widget-halo"
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[s.halo, { borderColor: color }]}
    />
  );
}
const s = StyleSheet.create({
  artwork: { width: 104, height: 122, flexShrink: 0, alignItems: "center", justifyContent: "center" },
  featured: { width: 94, height: 124 },
  backPage: {
    position: "absolute",
    width: 76,
    height: 100,
    borderWidth: 1,
    borderRadius: radii.sm,
    transform: [{ rotate: "9deg" }],
    left: 17,
    top: 8,
  },
  cover: {
    width: 78,
    height: 104,
    borderRadius: radii.sm,
    padding: spacing.md,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  spine: { position: "absolute", top: 0, bottom: 0, left: 5, width: 2 },
  orbit: {
    position: "absolute",
    width: 94,
    height: 94,
    borderRadius: 47,
    borderWidth: 12,
    opacity: 0.14,
    top: -38,
    right: -48,
  },
  monogram: { fontSize: 25, fontWeight: "800", letterSpacing: -1, marginTop: spacing.xs },
  coverFooter: { gap: spacing.xs },
  type: { fontSize: 10, fontWeight: "700" },
  badge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
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
