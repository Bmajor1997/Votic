import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { useVoticTheme } from "../theme/ThemeProvider";

/** Static, decorative shapes: no rotating demonstration or motion to follow. */
export function WelcomeArtwork() {
  const { theme } = useVoticTheme();
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={s.stage}
    >
      <View style={[s.halo, { backgroundColor: theme.brandTint }]} />
      <View style={[s.orbit, s.read, theme.elevation, { backgroundColor: "#2563EB" }]}>
        <Ionicons name="book-outline" size={54} color="#FFF" />
      </View>
      <View style={[s.orbit, s.listen, { backgroundColor: theme.isDark ? "#38456D" : "#E5DFFF" }]}>
        <Ionicons name="headset-outline" size={32} color={theme.isDark ? "#DFD5FF" : "#59409B"} />
      </View>
      <View style={[s.orbit, s.note, { backgroundColor: theme.isDark ? "#344E4B" : "#DCEEE5" }]}>
        <Ionicons name="create-outline" size={30} color={theme.isDark ? "#B8E2CF" : "#2D6952"} />
      </View>
      <View style={[s.spark, { backgroundColor: theme.isDark ? "#55462F" : "#FFEDC9" }]}>
        <Ionicons name="sparkles" size={22} color={theme.isDark ? "#F8D68C" : "#98621A"} />
      </View>
      <View style={[s.dot, { backgroundColor: "#769EFF", top: 27, left: 64 }]} />
      <View
        style={[
          s.dot,
          {
            backgroundColor: theme.isDark ? "#59647A" : "#C7D6F2",
            bottom: 26,
            right: 86,
            width: 10,
            height: 10,
          },
        ]}
      />
    </View>
  );
}
const s = StyleSheet.create({
  stage: { width: 300, height: 230, alignSelf: "center" },
  halo: { width: 192, height: 192, borderRadius: 96, position: "absolute", top: 18, left: 52 },
  orbit: { position: "absolute", alignItems: "center", justifyContent: "center" },
  read: { width: 116, height: 116, borderRadius: 38, left: 87, top: 50, transform: [{ rotate: "-12deg" }] },
  listen: { width: 74, height: 74, borderRadius: 26, right: 7, top: 22, transform: [{ rotate: "12deg" }] },
  note: { width: 68, height: 68, borderRadius: 24, left: 11, bottom: 22, transform: [{ rotate: "-10deg" }] },
  spark: {
    position: "absolute",
    width: 46,
    height: 46,
    borderRadius: 18,
    right: 25,
    bottom: 24,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "12deg" }],
  },
  dot: { position: "absolute", width: 14, height: 14, borderRadius: 7 },
});
