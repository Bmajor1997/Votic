import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAccessibilityPreferences } from "../../accessibility/AccessibilityProvider";
import { BrandMark, useMarkFlight } from "../../onboarding/WelcomeMotion";
import { PaywallPreview } from "../../subscription/PaywallPreview";
import { useVoticTheme } from "../../theme/ThemeProvider";
import { AIStatus } from "../AIResponse";
import { VoticPulse } from "./VoticPulse";

export const MOTION_SAMPLE = "Your documents become something you can listen to, understand, and explore.";
type Demo = "intro" | "listen" | "ask" | "premium";
export const MOTION_DEMOS: { id: Demo; title: string; subtitle: string }[] = [
  { id: "intro", title: "App introduction", subtitle: "The Votic V takes flight, as when you sign in" },
  { id: "listen", title: "Text-to-speech", subtitle: "Hear a sample with a live playback pulse" },
  { id: "ask", title: "Ask Votic", subtitle: "The bouncing ball, then an example answer" },
  { id: "premium", title: "Votic Premium preview", subtitle: "The interactive preview from the paywall" },
];

/**
 * A test-build-only screen for checking Votic's animations on a device. It never purchases, never calls the
 * AI service, and everything it shows is labelled as an example.
 */
export function MotionShowcase({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const [demo, setDemo] = useState<Demo>("intro");
  const [speaking, setSpeaking] = useState(false);
  const [answer, setAnswer] = useState(false);
  const mark = useMarkFlight();
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      void Speech.stop();
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  function reset_demos() {
    void Speech.stop();
    setSpeaking(false);
    setAnswer(false);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    mark.cancel();
    [...mark.flight.wings, mark.flight.stroke, mark.flight.glow].forEach((value) => value.setValue(0));
  }
  function close() {
    reset_demos();
    setDemo("intro");
    onClose();
  }
  function choose(next: Demo) {
    reset_demos();
    setDemo(next);
  }
  function play_intro() {
    reset_demos();
    // After the pieces have flown, the V comes back so the intro can be replayed.
    mark.fly(() => {
      resetTimer.current = setTimeout(reset_demos, 700);
    });
  }
  function play_sample() {
    if (speaking) {
      void Speech.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    const done = () => setSpeaking(false);
    Speech.speak(MOTION_SAMPLE, { onDone: done, onStopped: done, onError: done });
  }

  return (
    <Modal visible={visible} animationType={reduceMotion ? "none" : "slide"} onRequestClose={close}>
      <SafeAreaView style={[s.page, { backgroundColor: theme.background }]}>
        <View style={s.header}>
          <Text accessibilityRole="header" style={[s.heading, { color: theme.text }]}>
            Votic motion lab
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close animation preview"
            onPress={close}
            style={s.close}
          >
            <Ionicons name="close" size={26} color={theme.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={s.body}>
          <View accessibilityRole="radiogroup" accessibilityLabel="Animation to preview" style={s.list}>
            {MOTION_DEMOS.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="radio"
                accessibilityLabel={`${item.title}. ${item.subtitle}`}
                accessibilityState={{ checked: demo === item.id }}
                onPress={() => choose(item.id)}
                style={[
                  s.item,
                  {
                    borderColor: demo === item.id ? theme.accent : theme.border,
                    backgroundColor: theme.surface,
                  },
                ]}
              >
                <Text style={[s.itemTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={{ color: theme.mutedText }}>{item.subtitle}</Text>
              </Pressable>
            ))}
          </View>

          {demo === "premium" ? (
            <PaywallPreview />
          ) : (
            <View style={[s.stage, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {demo === "intro" ? (
                <>
                  <BrandMark size={110} flight={mark.flight} />
                  <Text style={[s.title, { color: theme.text }]}>Votic</Text>
                  <Text style={{ color: theme.mutedText }}>Read. Listen. Understand.</Text>
                  <Action label="Play intro" onPress={play_intro} />
                  {reduceMotion ? (
                    <Text style={[s.note, { color: theme.mutedText }]}>
                      Less motion is on, so the V stays still.
                    </Text>
                  ) : null}
                </>
              ) : null}
              {demo === "listen" ? (
                <>
                  <VoticPulse active={speaking} size={58} />
                  <Text style={[s.title, { color: theme.text }]}>Listen naturally</Text>
                  <Text style={[s.sample, { color: theme.text }]}>{MOTION_SAMPLE}</Text>
                  <Action label={speaking ? "Stop sample" : "Play sample"} onPress={play_sample} />
                </>
              ) : null}
              {demo === "ask" ? (
                <>
                  <Text style={[s.title, { color: theme.text }]}>Ask Votic</Text>
                  <Text style={[s.sample, { color: theme.text }]}>What can Votic help me do?</Text>
                  {answer ? (
                    <Text accessibilityLiveRegion="polite" style={[s.sample, { color: theme.mutedText }]}>
                      Example answer: Read, listen to, and ask questions about your documents.
                    </Text>
                  ) : (
                    <AIStatus label="Thinking" />
                  )}
                  <Action
                    label={answer ? "Reset example" : "Show example answer"}
                    onPress={() => setAnswer(!answer)}
                  />
                </>
              ) : null}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[s.action, { backgroundColor: theme.accent }]}
    >
      <Text style={[s.actionText, { color: theme.onAccent }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  page: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  heading: { fontSize: 24, fontWeight: "800" },
  close: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  body: { padding: 20, gap: 12, paddingBottom: 48 },
  list: { gap: 12 },
  item: { borderWidth: 2, borderRadius: 14, padding: 14, gap: 5 },
  itemTitle: { fontSize: 16, fontWeight: "700" },
  stage: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 24,
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  title: { fontSize: 27, fontWeight: "800", textAlign: "center" },
  sample: { fontSize: 16, lineHeight: 24, textAlign: "center" },
  note: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  action: {
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { fontWeight: "700", fontSize: 16 },
});
