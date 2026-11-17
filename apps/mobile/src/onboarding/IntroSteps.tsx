import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { radii, spacing } from "../design/tokens";
import { useVoticPurpose } from "../personalization/PurposeProvider";
import { PaywallBenefits } from "../subscription/PaywallContent";
import { useVoticTheme } from "../theme/ThemeProvider";
import { useDeviceVoices } from "../voices/useDeviceVoices";
import { featured_voices } from "../voices/voiceDetails";
import { PrimaryButton, StepScaffold, TextButton } from "./components";
import { ListeningPlayer, useSamplePlayback } from "./ListeningStep";
import { PREVIEW_SAMPLES } from "./sampleDocument";

/** The tour's first step: hear a sample page read with the words lighting up, then see a prepared Ask Votic answer. */
export function IntroTryStep({
  step,
  total,
  on_back,
  on_next,
}: {
  step: number;
  total: number;
  on_back: () => void;
  on_next: () => void;
}) {
  const { theme } = useVoticTheme();
  const access = useAccessibilityPreferences();
  const { defaultPlaybackRate } = useVoticPurpose();
  const sample = PREVIEW_SAMPLES.default;
  const playback = useSamplePlayback(sample.text);
  const [asked, setAsked] = useState(false);
  const { voices, names } = useDeviceVoices();
  const current =
    voices.find((voice) => voice.identifier === access.voiceIdentifier) ??
    featured_voices(voices, access.voiceIdentifier, 1)[0];
  const words = sample.text.split(" ").length;
  const progress = playback.playing && playback.word >= 0 ? Math.min(1, (playback.word + 1) / words) : 0;
  const leave = (go: () => void) => () => {
    playback.stop();
    go();
  };
  return (
    <StepScaffold
      step={step}
      total={total}
      on_back={leave(on_back)}
      on_skip={leave(on_next)}
      title="See it work."
      subtitle="Tap play to hear a page read aloud. The words light up as Votic reads, the same way your own documents will."
      footer={<PrimaryButton label="Continue" on_press={leave(on_next)} />}
    >
      <ListeningPlayer
        access={access}
        sample={sample}
        playing={playback.playing}
        word={playback.word}
        highlightMode={access.highlightMode === "word" ? "both" : access.highlightMode}
        currentName={current ? (names[current.identifier] ?? "Device voice") : "Device voice"}
        current={current}
        rate={defaultPlaybackRate}
        progress={progress}
        on_stop={playback.stop}
        on_play={() => playback.play(defaultPlaybackRate, access.voiceIdentifier)}
      />
      <View style={[s.ask, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[s.askLabel, { color: theme.mutedText }]}>ASK VOTIC ABOUT THIS PAGE</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ask: ${sample.question}`}
          accessibilityState={{ expanded: asked }}
          onPress={() => setAsked(true)}
          style={({ pressed }) => [
            s.question,
            { borderColor: theme.accent, backgroundColor: pressed ? theme.surfaceMuted : theme.background },
          ]}
        >
          <Ionicons name="sparkles-outline" size={18} color={theme.accentText} />
          <Text style={[s.questionText, { color: theme.accentText }]}>{sample.question}</Text>
        </Pressable>
        {asked ? (
          <View accessibilityLiveRegion="polite" accessible accessibilityLabel={`Answer: ${sample.answer}`}>
            <Text style={[s.answer, { color: theme.text, backgroundColor: theme.surfaceMuted }]}>
              {sample.answer}
            </Text>
            <Text style={[s.note, { color: theme.mutedText }]}>
              A prepared example. With your documents, Votic answers from the page you&apos;re reading.
            </Text>
          </View>
        ) : null}
      </View>
    </StepScaffold>
  );
}

const FREE_PERKS = [
  { lead: "∞", title: "Read and listen", detail: "No time limit, with words highlighted as they're read." },
  { lead: "5", title: "Documents", detail: "Keep up to 5 PDFs, Word files, text files or web pages." },
  { lead: "25", title: "Notes and bookmarks", detail: "Save what matters as you go." },
  {
    lead: "75",
    title: "AI credits a month",
    detail: "For questions, up to 5 summaries and 3 scanned pages.",
  },
];

/** The tour's last step: what Votic Free includes, then Create account, with Free and Plus side by side on request. */
export function IntroFreeStep({
  step,
  total,
  on_back,
  on_create,
}: {
  step: number;
  total: number;
  on_back: () => void;
  on_create: () => void;
}) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const [comparing, setComparing] = useState(false);
  return (
    <StepScaffold
      step={step}
      total={total}
      on_back={on_back}
      title="Free to start."
      subtitle="No card needed. Here's what Votic Free includes:"
      footer={
        <View style={s.footer}>
          <PrimaryButton label="Create my account" on_press={on_create} />
          <TextButton label="Compare Free and Plus" on_press={() => setComparing(true)} />
        </View>
      }
    >
      <View style={s.perks}>
        {FREE_PERKS.map((perk) => (
          <View
            key={perk.title}
            accessible
            accessibilityLabel={`${perk.lead === "∞" ? "" : perk.lead + " "}${perk.title}. ${perk.detail}`}
            style={[s.perk, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Text style={[s.perkLead, { color: theme.accentText }]}>{perk.lead}</Text>
            <View style={s.perkCopy}>
              <Text style={[s.perkTitle, { color: theme.text }]}>{perk.title}</Text>
              <Text style={[s.perkDetail, { color: theme.mutedText }]}>{perk.detail}</Text>
            </View>
          </View>
        ))}
      </View>
      <Modal
        visible={comparing}
        animationType={reduceMotion ? "none" : "slide"}
        onRequestClose={() => setComparing(false)}
      >
        <SafeAreaView style={[s.fill, { backgroundColor: theme.background }]}>
          <View style={s.modalBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close comparison"
              onPress={() => setComparing(false)}
              style={s.close}
            >
              <Ionicons name="close" size={26} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.modalContent}>
            <PaywallBenefits />
            <Text style={[s.note, { color: theme.mutedText }]}>
              You can try Votic Plus after you create your account.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </StepScaffold>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  ask: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  askLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
  question: {
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: 24,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "flex-start",
  },
  questionText: { fontSize: 16, fontWeight: "700" },
  answer: { fontSize: 16, lineHeight: 23, borderRadius: radii.md, padding: spacing.md, overflow: "hidden" },
  note: { fontSize: 14, lineHeight: 20, marginTop: spacing.sm },
  perks: { gap: spacing.md },
  perk: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  perkLead: { width: 52, textAlign: "center", fontSize: 30, fontWeight: "800" },
  perkCopy: { flex: 1, gap: 3 },
  perkTitle: { fontSize: 18, fontWeight: "700" },
  perkDetail: { fontSize: 15, lineHeight: 21 },
  footer: { gap: spacing.xs, alignItems: "stretch" },
  modalBar: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: spacing.md },
  close: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  modalContent: { padding: spacing.xl, gap: spacing.md },
});
