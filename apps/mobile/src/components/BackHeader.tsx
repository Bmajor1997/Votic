import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useVoticTheme } from "../theme/ThemeProvider";

/**
 * The top bar of a pushed screen: a Back button, the screen's title as its heading, and an optional
 * one-line subtitle. Shared so every such screen names its Back button and heading for screen readers.
 */
export function BackHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { theme } = useVoticTheme();
  return (
    <View style={[s.header, { borderBottomColor: theme.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => router.back()}
        style={s.icon}
      >
        <Ionicons name="chevron-back" size={26} color={theme.text} />
      </Pressable>
      <View style={s.titles}>
        <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[s.subtitle, { color: theme.mutedText }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {/* Balances the Back button so the title stays centered. */}
      <View style={s.icon} />
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    height: 64,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  icon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  titles: { flex: 1 },
  title: { textAlign: "center", fontSize: 18, fontWeight: "800" },
  subtitle: { fontSize: 12, textAlign: "center" },
});
