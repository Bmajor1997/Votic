import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PropsWithChildren, createContext, useContext, useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { radii, spacing, typography } from "../design/tokens";
import { useVoticTheme } from "../theme/ThemeProvider";

const TOUR_KEY = "votic.mobile.first-run-tour.v1";
const EXISTING_KEYS = [
  "votic.mobile.documents.v1",
  "votic.mobile.library.v2",
  "votic.mobile.collections.v1",
  "votic.mobile.theme.v1",
  "votic.mobile.accessibility.v1",
];
const steps = [
  {
    icon: "home-outline",
    title: "Welcome to Votic",
    body: "Votic helps you read, listen, understand, ask questions, and capture what matters from your documents.",
  },
  {
    icon: "documents-outline",
    title: "Your document library",
    body: "Open Documents to search, organize, and continue your files. Choose Upload to add PDF, Word, PowerPoint, EPUB, text, or Markdown files.",
  },
  {
    icon: "book-outline",
    title: "Read your way",
    body: "Open a document to read normally, or choose Listen whenever you want narration, synchronized highlighting, speed controls, and voices.",
  },
  {
    icon: "bookmark-outline",
    title: "Save useful passages",
    body: "Bookmark a passage in Reader, add an optional note, and find it later from Notes or your document library.",
  },
  {
    icon: "chatbubble-ellipses-outline",
    title: "Ask Votic",
    body: "Use Ask Votic when you want help understanding the current document or exploring an idea.",
  },
  {
    icon: "settings-outline",
    title: "Make reading yours",
    body: "Settings includes Light, Dark, and System appearance, accent colors, text size, spacing, and Reduce Motion. Reader controls also include highlighting, voice, and speed.",
  },
] as const;

type TourContextValue = { replay: () => void };
const TourContext = createContext<TourContextValue | null>(null);

export function FirstRunTourProvider({ children }: PropsWithChildren) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => {
    void (async () => {
      const complete = await AsyncStorage.getItem(TOUR_KEY);
      if (complete) return;
      const existing = await AsyncStorage.multiGet(EXISTING_KEYS);
      if (existing.some(([, value]) => value !== null)) {
        await AsyncStorage.setItem(TOUR_KEY, "migrated");
        return;
      }
      setVisible(true);
    })();
  }, []);
  function replay() {
    setStep(0);
    setVisible(true);
  }
  async function close() {
    setVisible(false);
    setStep(0);
    await AsyncStorage.setItem(TOUR_KEY, "complete");
  }
  const current = steps[step];
  return (
    <TourContext.Provider value={{ replay }}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType={reduceMotion ? "none" : "fade"}
        onRequestClose={() => void close()}
      >
        <SafeAreaView style={s.backdrop}>
          <View
            accessibilityViewIsModal
            style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={[s.icon, { backgroundColor: theme.sentenceHighlight }]}>
              <Ionicons name={current.icon} size={34} color={theme.accent} />
            </View>
            <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
              {current.title}
            </Text>
            <Text style={[s.body, { color: theme.mutedText }]}>{current.body}</Text>
            <View style={s.dots}>
              {steps.map((_, index) => (
                <View
                  key={index}
                  style={[s.dot, { backgroundColor: index === step ? theme.accent : theme.border }]}
                />
              ))}
            </View>
            <View style={s.actions}>
              <Pressable accessibilityRole="button" onPress={() => void close()} style={s.secondary}>
                <Text style={[s.secondaryText, { color: theme.mutedText }]}>
                  {step === steps.length - 1 ? "Close" : "Skip"}
                </Text>
              </Pressable>
              {step > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setStep((value) => value - 1)}
                  style={[s.secondary, s.back]}
                >
                  <Text style={[s.secondaryText, { color: theme.text }]}>Back</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => (step === steps.length - 1 ? void close() : setStep((value) => value + 1))}
                style={[s.primary, { backgroundColor: theme.accent }]}
              >
                <Text style={s.primaryText}>{step === steps.length - 1 ? "Finish" : "Next"}</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </TourContext.Provider>
  );
}

export function useFirstRunTour() {
  const value = useContext(TourContext);
  if (!value) throw new Error("useFirstRunTour must be used inside FirstRunTourProvider");
  return value;
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.55)", justifyContent: "center", padding: spacing.xl },
  card: { borderWidth: 1, borderRadius: radii.sheet, padding: spacing.xl, gap: spacing.md },
  icon: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { ...typography.screenTitle, fontSize: 25 },
  body: { ...typography.body, lineHeight: 23 },
  dots: { flexDirection: "row", gap: 6, marginTop: spacing.sm },
  dot: { height: 5, flex: 1, borderRadius: 3 },
  actions: { flexDirection: "row", alignItems: "center", marginTop: spacing.md, gap: spacing.sm },
  secondary: { minHeight: 46, justifyContent: "center", paddingHorizontal: spacing.sm },
  back: { marginLeft: "auto" },
  secondaryText: { fontSize: 15, fontWeight: "700" },
  primary: {
    minHeight: 46,
    minWidth: 92,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  primaryText: { color: "#FFF", fontSize: 15, fontWeight: "800" },
});
