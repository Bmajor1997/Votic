import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ComponentProps } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useAccessibilityPreferences } from "../../accessibility/AccessibilityProvider";
import { controlSizes, radii, spacing, typography } from "../../design/tokens";
import { useVoticTheme } from "../../theme/ThemeProvider";
import { timeSpentLabel } from "../readerText";

/** Shown when the listener finishes a document, with the next useful places to go. */
export function CompletionModal({
  visible,
  onClose,
  title,
  timeSpentSeconds,
  passageCount,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  timeSpentSeconds: number;
  passageCount: number;
}) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  function go(action: () => void) {
    onClose();
    action();
  }
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={onClose}
    >
      <View style={s.backdrop}>
        <View
          accessibilityViewIsModal
          style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close completion experience"
            onPress={onClose}
            style={s.close}
          >
            <Ionicons name="close" size={23} color={theme.mutedText} />
          </Pressable>
          <Image
            accessibilityLabel="Highlighted reading notes"
            source={require("../../../assets/reader-highlight.png")}
            resizeMode="contain"
            style={s.image}
          />
          <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
            Nicely done.
          </Text>
          <Text numberOfLines={2} style={[s.document, { color: theme.mutedText }]}>
            {title}
          </Text>
          <Text style={[s.message, { color: theme.mutedText }]}>
            You made it through the whole document. Choose what would be useful next.
          </Text>
          <View style={s.stats}>
            <View style={s.stat}>
              <Text style={[s.value, { color: theme.text }]}>{timeSpentLabel(timeSpentSeconds)}</Text>
              <Text style={[s.label, { color: theme.mutedText }]}>Time spent</Text>
            </View>
            <View style={[s.divider, { backgroundColor: theme.border }]} />
            <View style={s.stat}>
              <Text style={[s.value, { color: theme.text }]}>{passageCount}</Text>
              <Text style={[s.label, { color: theme.mutedText }]}>Passages</Text>
            </View>
          </View>
          <View style={s.grid}>
            <CompletionAction
              icon="chatbubble-ellipses-outline"
              label="Ask Votic"
              onPress={() => go(() => router.push("/assistant"))}
            />
            <CompletionAction
              icon="bookmarks-outline"
              label="Notes"
              onPress={() => go(() => router.push("/notes"))}
            />
            <CompletionAction
              icon="refresh-outline"
              label="Review"
              onPress={() => go(() => router.push("/review"))}
            />
            <CompletionAction
              icon="add-circle-outline"
              label="Start another"
              onPress={() => go(() => router.replace("/documents"))}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CompletionAction({
  icon,
  label,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        s.action,
        { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceMuted : theme.surface },
      ]}
    >
      <Ionicons name={icon} size={22} color={theme.accent} />
      <Text style={[s.actionText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: radii.sheet,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  close: {
    position: "absolute",
    right: spacing.sm,
    top: spacing.sm,
    width: controlSizes.minimumTouch,
    height: controlSizes.minimumTouch,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  image: { width: 150, height: 132 },
  title: { ...typography.screenTitle, fontSize: 26, textAlign: "center" },
  document: { fontSize: 15, textAlign: "center" },
  message: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  stats: { width: "100%", flexDirection: "row", alignItems: "center", marginVertical: spacing.sm },
  stat: { flex: 1, alignItems: "center", gap: spacing.xs },
  value: { fontSize: 21, fontWeight: "800" },
  label: { fontSize: 13 },
  divider: { width: 1, height: 44 },
  grid: { width: "100%", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  action: {
    width: "48%",
    flexGrow: 1,
    minHeight: 64,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  actionText: { fontSize: 14, fontWeight: "700" },
});
