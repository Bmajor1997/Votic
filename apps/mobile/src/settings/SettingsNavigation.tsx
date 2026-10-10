import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ComponentProps, PropsWithChildren, useEffect, useRef } from "react";
import { AccessibilityInfo, findNodeHandle, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { controlSizes, radii, spacing, typography } from "../design/tokens";
import { useVoticTheme } from "../theme/ThemeProvider";

export const SETTINGS_CATEGORIES = {
  appearance: "Appearance",
  reading: "Reading & Listening",
  accessibility: "Accessibility",
  personalization: "Personalization",
  account: "Account & Membership",
  help: "Help",
} as const;
export type SettingsCategory = keyof typeof SETTINGS_CATEGORIES;

export function isSettingsCategory(value: unknown): value is SettingsCategory {
  return typeof value === "string" && Object.hasOwn(SETTINGS_CATEGORIES, value);
}

export function SettingsRow({
  label,
  detail,
  icon,
  onPress,
  hint,
  separated = false,
}: {
  label: string;
  detail: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  hint: string;
  separated?: boolean;
}) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityValue={{ text: detail }}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        {
          backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: separated ? StyleSheet.hairlineWidth : 0,
        },
      ]}
    >
      <View style={[s.icon, { backgroundColor: theme.brandTint }]}>
        <Ionicons name={icon} size={23} color={theme.accentText} accessible={false} />
      </View>
      <View style={s.copy}>
        <Text style={[s.rowTitle, { color: theme.text }]}>{label}</Text>
        <Text style={[s.detail, { color: theme.mutedText }]}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.mutedText} accessible={false} />
    </Pressable>
  );
}

export function SettingsGroup({ children, title }: PropsWithChildren<{ title?: string }>) {
  const { theme } = useVoticTheme();
  return (
    <View style={s.group}>
      {title ? (
        <Text accessibilityRole="header" style={[s.eyebrow, { color: theme.mutedText }]}>
          {title}
        </Text>
      ) : null}
      <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>{children}</View>
    </View>
  );
}

export function SettingsPage({ title, children }: PropsWithChildren<{ title: string }>) {
  const { theme } = useVoticTheme();
  const heading = useRef<Text>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const handle = heading.current ? findNodeHandle(heading.current) : null;
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    });
    return () => cancelAnimationFrame(frame);
  }, [title]);
  return (
    <Screen title={title} hideTitle>
      <View style={s.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Settings"
          accessibilityHint="Returns to the Settings categories"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/settings"))}
          style={({ pressed }) => [
            s.back,
            { backgroundColor: pressed ? theme.surfaceMuted : theme.brandTint },
          ]}
        >
          <Ionicons name="chevron-back" size={25} color={theme.accentText} accessible={false} />
        </Pressable>
        <Text ref={heading} accessibilityRole="header" style={[s.title, { color: theme.text }]}>
          {title}
        </Text>
      </View>
      {children}
    </Screen>
  );
}

const s = StyleSheet.create({
  group: { gap: spacing.sm },
  eyebrow: { ...typography.eyebrow, paddingHorizontal: spacing.xs },
  card: { borderWidth: 1, borderRadius: radii.lg, overflow: "hidden" },
  row: { minHeight: 84, padding: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: {
    width: controlSizes.minimumTouch,
    height: controlSizes.minimumTouch,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, gap: spacing.xs },
  rowTitle: { ...typography.control },
  detail: { fontSize: 14, lineHeight: 21 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  back: {
    width: controlSizes.minimumTouch,
    height: controlSizes.minimumTouch,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...typography.screenTitle, fontSize: 26, flex: 1 },
});
