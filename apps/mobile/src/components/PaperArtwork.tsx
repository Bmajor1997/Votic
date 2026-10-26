import { Image, StyleSheet, View } from "react-native";

/** Bundled original illustration; decorative only, never a preview or playback control. */
export function PaperArtwork({ compact = false }: { compact?: boolean }) {
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[s.stage, compact && s.compact]}
    >
      <Image
        source={require("../../assets/votic-paper-listening.png")}
        resizeMode="contain"
        style={s.image}
        accessible={false}
      />
    </View>
  );
}
const s = StyleSheet.create({
  stage: { height: 146, width: 280, maxWidth: "100%", alignSelf: "center" },
  compact: { height: 132, width: 264 },
  image: { width: "100%", height: "100%" },
});
