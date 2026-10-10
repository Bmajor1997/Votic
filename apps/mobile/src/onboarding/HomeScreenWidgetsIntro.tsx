import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { AccessibilityInfo, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { VoticLogo } from "../components/VoticLogo";
import { radii, spacing, typography } from "../design/tokens";
import { widgetPalette } from "../home/widgetDesign";
import { useVoticTheme } from "../theme/ThemeProvider";
import { PrimaryButton } from "./components";

type Step = { icon: React.ComponentProps<typeof Ionicons>["name"]; text: string };

/** How to add a widget, in each platform's own words. */
export const WIDGET_STEPS: Record<"ios" | "android", Step[]> = {
  ios: [
    {
      icon: "hand-left-outline",
      text: "Touch and hold an empty spot on your Home Screen until the apps jiggle.",
    },
    { icon: "add-circle-outline", text: "Tap Edit in the top corner, then Add Widget." },
    { icon: "search-outline", text: "Search for Votic, choose Continue or This Week, then tap Add Widget." },
  ],
  android: [
    { icon: "hand-left-outline", text: "Touch and hold an empty spot on your Home Screen." },
    { icon: "apps-outline", text: "Tap Widgets." },
    {
      icon: "search-outline",
      text: "Find Votic, then touch and hold Continue or This Week and drag it into place.",
    },
  ],
};

/**
 * Tells people Votic has Home Screen widgets and how to add one. Shown once during setup (`mode="setup"`,
 * before "Votic is ready for you"), and any time from Settings → Help (`mode="settings"`).
 */
export function HomeScreenWidgetsIntro({ mode, onDone }: { mode: "setup" | "settings"; onDone: () => void }) {
  const { theme } = useVoticTheme();
  const platform = Platform.OS === "android" ? "android" : "ios";
  useEffect(() => {
    if (mode === "setup") AccessibilityInfo.announceForAccessibility?.("Votic on your Home Screen.");
  }, [mode]);
  return (
    <SafeAreaView style={[s.fill, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.brand}>
          {mode === "settings" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={onDone}
              hitSlop={8}
              style={s.back}
            >
              <Ionicons name="chevron-back" size={26} color={theme.text} />
            </Pressable>
          ) : (
            <VoticLogo />
          )}
        </View>
        <View style={s.copy}>
          <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
            Votic on your Home Screen
          </Text>
          <Text style={[s.subtitle, { color: theme.mutedText }]}>
            Add a Votic widget to see what you&apos;re reading and pick up where you left off, without opening
            the app first.
          </Text>
        </View>
        <WidgetPreview />
        <View style={[s.steps, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <Text accessibilityRole="header" style={[s.stepsTitle, { color: theme.text }]}>
            How to add one
          </Text>
          {WIDGET_STEPS[platform].map((step, index) => (
            <View
              key={step.text}
              accessible
              accessibilityLabel={`Step ${index + 1}: ${step.text}`}
              style={s.step}
            >
              <View style={[s.stepIcon, { backgroundColor: theme.sentenceHighlight }]}>
                <Ionicons name={step.icon} size={20} color={theme.accentText} />
              </View>
              <Text style={[s.stepText, { color: theme.text }]}>{step.text}</Text>
            </View>
          ))}
          {platform === "ios" ? (
            <Text style={[s.note, { color: theme.mutedText }]}>
              Continue also fits on your Lock Screen: touch and hold the Lock Screen, tap Customize, choose
              Lock Screen, then tap the widget area and add Votic.
            </Text>
          ) : null}
        </View>
      </ScrollView>
      <View style={[s.footer, { borderTopColor: theme.border }]}>
        <PrimaryButton label={mode === "setup" ? "Continue" : "Done"} onPress={onDone} />
      </View>
    </SafeAreaView>
  );
}

/**
 * A picture of the two widgets with example content, drawn in the widgets' own colors. The real widgets
 * show the person's own documents and reading time.
 */
function WidgetPreview() {
  const { theme } = useVoticTheme();
  const book = widgetPalette(theme.isDark, "chapter");
  const week = widgetPalette(theme.isDark, "activity");
  const days = [0.55, 0.7, 0, 0.95, 0.45, 0, 0];
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Example widgets. Continue shows a document's progress with Listen and Read buttons. This Week shows reading and listening time for each day."
      style={[s.preview, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
    >
      <View style={[s.continueWidget, { backgroundColor: book.surface, borderColor: book.border }]}>
        <View
          style={[
            s.cover,
            { borderColor: book.border, backgroundColor: theme.isDark ? book.art : "#FFFFFF" },
          ]}
        >
          <View style={[s.coverBand, { backgroundColor: book.strong }]} />
          {[1, 0.8, 1, 0.55].map((width, index) => (
            <View
              key={index}
              style={[
                s.coverLine,
                {
                  width: `${width * 70}%`,
                  // In dark mode the cover is drawn in the art color, so its lines need a lighter one.
                  backgroundColor: theme.isDark ? book.detail : book.art,
                  opacity: theme.isDark ? 0.45 : 1,
                },
              ]}
            />
          ))}
        </View>
        <View style={s.grow}>
          <Text style={[s.widgetEyebrow, { color: book.detail }]}>CONTINUE</Text>
          <Text numberOfLines={1} style={[s.widgetTitle, { color: book.ink }]}>
            Your document
          </Text>
          <View style={[s.track, { backgroundColor: book.art }]}>
            <View style={[s.trackFill, { width: "42%", backgroundColor: book.strong }]} />
          </View>
          <View style={s.pills}>
            <View style={[s.pill, { backgroundColor: book.strong }]}>
              <Ionicons name="play" size={12} color={book.onStrong} />
              <Text style={[s.pillText, { color: book.onStrong }]}>Listen</Text>
            </View>
            <View style={[s.pill, { borderWidth: 1, borderColor: book.border }]}>
              <Ionicons name="book-outline" size={12} color={book.ink} />
              <Text style={[s.pillText, { color: book.ink }]}>Read</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={s.previewRow}>
        <View style={[s.smallWidget, { backgroundColor: week.surface, borderColor: week.border }]}>
          <Text style={[s.widgetEyebrow, { color: week.detail }]}>THIS WEEK</Text>
          <Text style={[s.weekTotal, { color: week.ink }]}>1 h 20 min</Text>
          <View style={s.bars}>
            {days.map((value, index) => (
              <View
                key={index}
                style={[
                  s.bar,
                  { height: value ? 6 + value * 26 : 4, backgroundColor: value ? week.strong : week.art },
                ]}
              />
            ))}
          </View>
        </View>
        <View style={s.appGrid}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={[s.appIcon, { backgroundColor: theme.border }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1, minWidth: 0, gap: 4 },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.xl },
  brand: { minHeight: 58, justifyContent: "center" },
  back: { width: 44, height: 44, justifyContent: "center", marginLeft: -spacing.sm },
  copy: { gap: spacing.sm },
  title: { ...typography.screenTitle, lineHeight: 36 },
  subtitle: { fontSize: 17, lineHeight: 25 },
  preview: { borderWidth: 1, borderRadius: 28, padding: spacing.lg, gap: spacing.md },
  continueWidget: {
    flexDirection: "row",
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: 20,
    padding: spacing.md,
  },
  cover: { width: 44, height: 58, borderWidth: 1, borderRadius: 7, overflow: "hidden", gap: 3 },
  coverBand: { height: 10, marginBottom: 3 },
  coverLine: { height: 3, borderRadius: 2, marginLeft: 5 },
  widgetEyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  widgetTitle: { fontSize: 15, fontWeight: "800" },
  track: { height: 5, borderRadius: 3, overflow: "hidden", marginTop: 2 },
  trackFill: { height: "100%", borderRadius: 3 },
  pills: { flexDirection: "row", gap: spacing.sm, marginTop: 4 },
  pill: {
    flex: 1,
    minHeight: 28,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  pillText: { fontSize: 12, fontWeight: "800" },
  previewRow: { flexDirection: "row", gap: spacing.md, alignItems: "stretch" },
  smallWidget: { flex: 1, borderWidth: 1, borderRadius: 20, padding: spacing.md, gap: 4 },
  weekTotal: { fontSize: 18, fontWeight: "800" },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 5, height: 34, marginTop: 2 },
  bar: { width: 7, borderRadius: 4 },
  appGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    alignContent: "center",
    justifyContent: "center",
  },
  appIcon: { width: 48, height: 48, borderRadius: 12 },
  steps: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
  stepsTitle: { fontSize: 17, fontWeight: "800" },
  step: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  stepText: { flex: 1, fontSize: 15, lineHeight: 21 },
  note: { fontSize: 14, lineHeight: 20 },
  footer: { borderTopWidth: 1, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
});
