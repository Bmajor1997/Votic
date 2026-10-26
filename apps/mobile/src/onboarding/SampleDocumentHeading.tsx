import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useVoticTheme } from "../theme/ThemeProvider";

/** A consistent document identity across the reading, explanation and listening demonstrations. */
export function SampleDocumentHeading({ title }: { title: string }) {
  const { theme } = useVoticTheme();
  return (
    <View style={s.heading}>
      <View style={[s.icon, { backgroundColor: theme.brandTint }]}>
        <Ionicons name="document-text-outline" size={21} color={theme.accentText} />
      </View>
      <View style={s.copy}>
        <Text style={[s.title, { color: theme.text }]}>{title}</Text>
        <Text style={[s.caption, { color: theme.mutedText }]}>Sample document · Yours to explore</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  heading: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 3 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: "700" },
  caption: { fontSize: 13, lineHeight: 19 },
});
