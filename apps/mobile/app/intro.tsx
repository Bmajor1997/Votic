import { editorial } from "../src/design/editorial";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AccountHighlightPreferences,
  useAccessibilityPreferences,
} from "../src/accessibility/AccessibilityProvider";
import { VoticLogo } from "../src/components/VoticLogo";
import { spacing } from "../src/design/tokens";
import { IntroFreeStep, IntroTryStep } from "../src/onboarding/IntroSteps";
import { useIntro } from "../src/onboarding/IntroProvider";
import { IntroEntry } from "../src/onboarding/introModel";
import { ListeningStep } from "../src/onboarding/ListeningStep";
import { EMPTY_ANSWERS, PersonalizationAnswers } from "../src/onboarding/onboardingModel";
import { ComfortStep, GoalStep } from "../src/onboarding/PersonalizationQuestions";
import { BrandMark, useMarkFlight } from "../src/onboarding/WelcomeMotion";
import { PrimaryButton, TextButton } from "../src/onboarding/components";
import { AccountPurposePreferences, useVoticPurpose } from "../src/personalization/PurposeProvider";
import { useVoticTheme } from "../src/theme/ThemeProvider";

/** Hear it, what it should help with, the reading style, how it sounds, and what's free. */
const STEPS = 5;

/**
 * The first-launch tour, before an account exists: the welcome, then five steps with progress and Skip. Reading
 * style and the voice are device settings and apply at once; what Votic helps with, the highlight and the speed are
 * kept with the tour and given to the account created at the end. "I already have an account" goes to Sign in.
 */
export default function Intro() {
  const { update } = useIntro();
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState<PersonalizationAnswers>(EMPTY_ANSWERS);
  const mark = useMarkFlight();
  const finish = (entry: IntroEntry) => update({ done: true, toured: true, entry });
  const next = () => setStep((value) => Math.min(value + 1, STEPS - 1));
  const back = () => {
    if (step === 0) mark.land();
    setStep((value) => Math.max(value - 1, -1));
  };

  if (step < 0)
    return (
      <IntroWelcome
        mark={mark}
        on_start={() => mark.fly(() => setStep(0))}
        on_have_account={() => mark.fly(() => finish("sign-in"))}
      />
    );
  return (
    <TourPreferences>
      <TourStep
        step={step}
        answers={answers}
        set_answers={setAnswers}
        on_back={back}
        on_next={next}
        on_finish={finish}
      />
    </TourPreferences>
  );
}

function TourStep({
  step,
  answers,
  set_answers,
  on_back,
  on_next,
  on_finish,
}: {
  step: number;
  answers: PersonalizationAnswers;
  set_answers: (answers: PersonalizationAnswers) => void;
  on_back: () => void;
  on_next: () => void;
  on_finish: (entry: IntroEntry) => void;
}) {
  const access = useAccessibilityPreferences();
  const personalization = useVoticPurpose();
  const props = {
    access,
    personalization,
    step,
    on_back,
    on_next,
    answers,
    set_answers,
    finishLabel: "Continue",
  };
  if (step === 0) return <IntroTryStep step={step} total={STEPS} on_back={on_back} on_next={on_next} />;
  if (step === 1) return <GoalStep {...props} />;
  if (step === 2) return <ComfortStep {...props} />;
  if (step === 3) return <ListeningStep {...props} total={STEPS} />;
  return <IntroFreeStep step={step} total={STEPS} on_back={on_back} on_create={() => on_finish("create")} />;
}

/**
 * Before sign-in, the account settings (what Votic helps with, highlight, speed) belong to the tour; the steps read
 * and change them exactly as they do during setup.
 */
function TourPreferences({ children }: { children: React.ReactNode }) {
  const { intro, update } = useIntro();
  const purpose = useVoticPurpose();
  return (
    <AccountPurposePreferences
      purpose={intro.purpose}
      set_purpose={(value) => update({ purpose: value })}
      explanationStyle={purpose.explanationStyle}
      set_explanation_style={purpose.set_explanation_style}
      defaultPlaybackRate={intro.defaultPlaybackRate}
      set_default_playback_rate={(value) => update({ defaultPlaybackRate: value })}
    >
      <AccountHighlightPreferences
        highlightMode={intro.highlightMode}
        set_highlight_mode={(value) => update({ highlightMode: value })}
      >
        {children}
      </AccountHighlightPreferences>
    </AccountPurposePreferences>
  );
}

function IntroWelcome({
  mark,
  on_start,
  on_have_account,
}: {
  mark: ReturnType<typeof useMarkFlight>;
  on_start: () => void;
  on_have_account: () => void;
}) {
  const { theme } = useVoticTheme();
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.topBar}>
          <VoticLogo />
        </View>
        {/* Drawn after the top bar so the V's pieces pass over it as they leave. */}
        <View style={s.art}>
          <BrandMark size={112} flight={mark.flight} />
        </View>
        <View style={s.bottom}>
          <View style={s.copy}>
            <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
              Make room for{"\n"}
              <Text style={{ color: theme.accentText }}>what matters.</Text>
            </Text>
            <Text style={[s.subtitle, { color: theme.mutedText }]}>
              Votic reads your documents aloud, answers your questions, and keeps your notes.
            </Text>
          </View>
          <PrimaryButton label="Get started" on_press={on_start} />
          <View style={s.link}>
            <TextButton label="I already have an account" on_press={on_have_account} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  topBar: { minHeight: 60, flexDirection: "row", alignItems: "center" },
  art: { flexGrow: 1, alignItems: "center", justifyContent: "center", minHeight: 210, paddingVertical: 10 },
  bottom: { gap: 12 },
  copy: { alignItems: "center", gap: 10, marginBottom: 12 },
  title: { ...editorial, fontSize: 38, lineHeight: 44, textAlign: "center" },
  subtitle: { fontSize: 16, lineHeight: 23, textAlign: "center", maxWidth: 320 },
  link: { minHeight: 48, alignItems: "center", justifyContent: "center" },
});
