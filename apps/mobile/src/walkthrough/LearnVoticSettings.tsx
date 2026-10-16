import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ComponentProps, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useDocumentLibrary } from "../documents/DocumentLibraryProvider";
import { useOnboarding } from "../onboarding/OnboardingProvider";
import { spacing, typography } from "../design/tokens";
import { useVoticTheme } from "../theme/ThemeProvider";
import { SECTION_LABELS, SECTIONS, SectionId } from "./walkthroughFlows";
import { useWalkthrough } from "./WalkthroughProvider";

const ROUTES: Record<Exclude<SectionId, "reader">, "/" | "/documents" | "/notes"> = {
  home: "/",
  documents: "/documents",
  notes: "/notes",
};
const ICONS: Record<SectionId, ComponentProps<typeof Ionicons>["name"]> = {
  home: "home-outline",
  documents: "documents-outline",
  notes: "create-outline",
  reader: "book-outline",
};

/** Settings → Help → Learn Votic: replays one walkthrough by taking the person to that part of Votic. */
export function LearnVoticSettings() {
  const { theme } = useVoticTheme();
  const { reset } = useWalkthrough();
  const { showTipsAgain } = useOnboarding();
  const { documents, openDocument } = useDocumentLibrary();
  const [message, setMessage] = useState("");

  function replay(section: SectionId) {
    reset(section);
    setMessage("");
    if (section !== "reader") return router.push(ROUTES[section]);
    const latest = [...documents].sort(
      (a, b) => (b.lastOpenedAt || b.updatedAt) - (a.lastOpenedAt || a.updatedAt),
    )[0];
    if (!latest) return setMessage("Upload a document, and the Reader walkthrough will start when it opens.");
    openDocument(latest.id);
    router.push("/reader");
  }

  return (
    <View style={s.group}>
      <Text style={[s.label, { color: theme.mutedText }]}>LEARN VOTIC</Text>
      {SECTIONS.map((section) => (
        <Pressable
          key={section}
          accessibilityRole="button"
          accessibilityLabel={`Replay the ${SECTION_LABELS[section]} walkthrough`}
          onPress={() => replay(section)}
          style={({ pressed }) => [
            s.row,
            { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceMuted : theme.surface },
          ]}
        >
          <Ionicons name={ICONS[section]} size={21} color={theme.accent} />
          <Text style={[s.rowText, { color: theme.text }]}>{SECTION_LABELS[section]}</Text>
          <Ionicons name="play-circle-outline" size={20} color={theme.mutedText} />
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Show all walkthroughs and tips again"
        onPress={() => {
          reset("all");
          // The Getting Started checklist on Home comes back too.
          showTipsAgain();
          setMessage(
            "Walkthroughs, tips, and the Getting Started checklist will appear again as you use Votic.",
          );
        }}
        style={s.resetAll}
      >
        <Text style={[s.resetText, { color: theme.accent }]}>Show all walkthroughs and tips again</Text>
      </Pressable>
      {message ? (
        <Text accessibilityLiveRegion="polite" style={[s.message, { color: theme.mutedText }]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  group: { gap: spacing.sm },
  label: { ...typography.eyebrow, marginTop: spacing.xs },
  row: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  rowText: { flex: 1, fontSize: 16, fontWeight: "700" },
  resetAll: { minHeight: 48, justifyContent: "center" },
  resetText: { fontSize: 15, fontWeight: "700" },
  message: { fontSize: 13, lineHeight: 18 },
});
