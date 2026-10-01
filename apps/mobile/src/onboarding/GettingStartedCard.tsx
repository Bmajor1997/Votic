import { Ionicons } from "@expo/vector-icons";
import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth/AuthProvider";
import { radii, spacing } from "../design/tokens";
import { useDocumentLibrary } from "../documents/DocumentLibraryProvider";
import { cleanLocalDocumentText } from "../documents/importDocument";
import { VoticDocument } from "../documents/types";
import { openFrom, useDocumentImport } from "../documents/useDocumentImport";
import { useDocumentTransition } from "../navigation/DocumentTransitionProvider";
import { useVoticPurpose } from "../personalization/PurposeProvider";
import { useVoticTheme } from "../theme/ThemeProvider";
import { useWalkthroughTarget } from "../walkthrough/WalkthroughProvider";
import { PrimaryButton, SecondaryButton } from "./components";
import { useOnboarding } from "./OnboardingProvider";
import { VOTIC_GUIDE_SOURCE_NAME, VOTIC_GUIDE_TEXT } from "./voticGuide";

export function gettingStartedSteps(documents: VoticDocument[], askedVotic: boolean) {
  return [
    { label: "Add a document", done: documents.length > 0 },
    {
      label: "Listen to a passage",
      done: documents.some((document) =>
        Object.values(document.activity || {}).some((day) => day.listeningSeconds > 0),
      ),
    },
    {
      label: "Save a passage",
      done: documents.some((document) => (document.savedPassages || []).length > 0),
    },
    { label: "Ask Votic a question", done: askedVotic },
  ];
}

/** Continues onboarding inside Home: one clear first action, and a checklist that fills in as people use Votic. */
export function GettingStartedCard() {
  const { theme } = useVoticTheme();
  const { user } = useAuth();
  const { documents, addTextDocument, openDocument } = useDocumentLibrary();
  const { defaultPlaybackRate } = useVoticPurpose();
  const onboarding = useOnboarding();
  const transition = useDocumentTransition();
  const uploadRef = useRef<View>(null);
  const guideRef = useRef<View>(null);
  const { importing, importDocument } = useDocumentImport(uploadRef);
  const startTarget = useWalkthroughTarget("home.start");
  if (onboarding.checklistDismissed) return null;

  const steps = gettingStartedSteps(documents, onboarding.askedVotic);
  const remaining = steps.filter((step) => !step.done).length;
  const firstName = user?.displayName?.trim().split(/\s+/)[0];

  function openGuide() {
    if (transition.transitioning) return;
    const existing = documents.find((document) => document.sourceName === VOTIC_GUIDE_SOURCE_NAME);
    if (existing) openDocument(existing.id);
    else
      addTextDocument(VOTIC_GUIDE_SOURCE_NAME, cleanLocalDocumentText(VOTIC_GUIDE_TEXT), {
        playbackRate: defaultPlaybackRate,
      });
    // The guide asks people to press Play, so it opens with the listening controls.
    openFrom(guideRef, transition, { mode: "listen" });
  }

  return (
    <View
      ref={startTarget}
      collapsable={false}
      style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={s.header}>
        <View style={s.headerCopy}>
          <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
            {remaining === 0 ? "You're all set" : firstName ? `Welcome, ${firstName}` : "Welcome to Votic"}
          </Text>
          <Text style={[s.subtitle, { color: theme.mutedText }]}>
            {remaining === 0
              ? "You've tried everything Votic does best."
              : documents.length
                ? `${remaining} quick ${remaining === 1 ? "step" : "steps"} to get the most from Votic.`
                : "Start with a document. Votic will show you around as you go."}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hide getting started"
          onPress={onboarding.dismissChecklist}
          hitSlop={6}
          style={({ pressed }) => [s.close, { opacity: pressed ? 0.55 : 1 }]}
        >
          <Ionicons name="close" size={22} color={theme.mutedText} />
        </Pressable>
      </View>
      {documents.length === 0 ? (
        <View style={s.actions}>
          <View ref={uploadRef} collapsable={false}>
            <PrimaryButton
              label="Upload a document"
              icon="add"
              busy={importing}
              onPress={() => void importDocument()}
            />
          </View>
          <View ref={guideRef} collapsable={false}>
            <SecondaryButton
              label="Try the Votic guide"
              icon={<Ionicons name="headset-outline" size={20} color={theme.text} />}
              onPress={openGuide}
            />
          </View>
        </View>
      ) : null}
      <View style={s.steps}>
        {steps.map((step) => (
          <View
            key={step.label}
            accessible
            accessibilityLabel={`${step.label}, ${step.done ? "done" : "not done yet"}`}
            style={s.step}
          >
            <Ionicons
              name={step.done ? "checkmark-circle" : "ellipse-outline"}
              size={22}
              color={step.done ? theme.accent : theme.mutedText}
            />
            <Text
              style={[
                s.stepText,
                { color: step.done ? theme.mutedText : theme.text },
                step.done && s.stepDone,
              ]}
            >
              {step.label}
            </Text>
          </View>
        ))}
      </View>
      {remaining === 0 ? <PrimaryButton label="Done" onPress={onboarding.dismissChecklist} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.lg },
  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  headerCopy: { flex: 1, gap: spacing.xs },
  title: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  subtitle: { fontSize: 15, lineHeight: 21 },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -10,
    marginRight: -10,
  },
  actions: { gap: spacing.md },
  steps: { gap: spacing.sm },
  step: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepText: { fontSize: 15, fontWeight: "600" },
  stepDone: { textDecorationLine: "line-through" },
});
