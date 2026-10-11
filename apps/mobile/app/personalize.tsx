import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { HighlightMode, useAccessibilityPreferences } from "../src/accessibility/AccessibilityProvider";
import { radii, spacing } from "../src/design/tokens";
import { useAccountSetup } from "../src/onboarding/AccountSetupProvider";
import { OptionRow, PrimaryButton, StepScaffold } from "../src/onboarding/components";
import {
  EMPTY_ANSWERS,
  ListeningPreference,
  PersonalizationAnswers,
} from "../src/onboarding/onboardingModel";
import {
  EXPLANATION_STYLES,
  ExplanationStyle,
  PURPOSES,
  useVoticPurpose,
} from "../src/personalization/PurposeProvider";
import { formatPlaybackRate } from "../src/playback/rates";
import { readerType } from "../src/reader/readerText";
import { useVoticTheme } from "../src/theme/ThemeProvider";

const STEPS = 4;

/**
 * First-time setup: four quick questions, one per screen. Choices apply straight away and are saved with this
 * account's setup, so closing Votic mid-way resumes on the same question. Finishing (or skipping) leads on to
 * Votic Premium, then the Home Screen widgets and "Votic is ready for you".
 */
export default function Personalize() {
  const setup = useAccountSetup();
  const { purpose } = useVoticPurpose();
  const answers = setup.setup?.answers ?? EMPTY_ANSWERS;
  const step = Math.min(STEPS - 1, setup.setup?.currentStep ?? 0);

  function finish() {
    void Speech.stop();
    const answeredSomething =
      Boolean(purpose) || Boolean(answers.explanationStyle) || answers.listening.length > 0;
    setup.finishPersonalization({ skipped: !answeredSomething });
  }
  const next = () => (step === STEPS - 1 ? finish() : setup.setStep(step + 1));
  const back = step > 0 ? () => setup.setStep(step - 1) : undefined;

  // Android's back button steps back through the questions rather than leaving them.
  const backRef = useRef(back);
  useEffect(() => {
    backRef.current = back;
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!backRef.current) return false;
      backRef.current();
      return true;
    });
    return () => subscription.remove();
  }, []);

  const props = {
    step,
    onBack: back,
    onNext: next,
    answers,
    setAnswers: (value: PersonalizationAnswers) => setup.setAnswers(value),
  };
  if (step === 0) return <GoalStep {...props} />;
  if (step === 1) return <ComfortStep {...props} />;
  if (step === 2) return <ExplanationStep {...props} />;
  return <ListeningStep {...props} />;
}

type StepProps = {
  step: number;
  onBack?: () => void;
  onNext: () => void;
  answers: PersonalizationAnswers;
  setAnswers: (answers: PersonalizationAnswers) => void;
};

function GoalStep({ step, onBack, onNext }: StepProps) {
  const { purpose, setPurpose } = useVoticPurpose();
  return (
    <StepScaffold
      step={step}
      total={STEPS}
      onBack={onBack}
      onSkip={onNext}
      title="What should Votic help you with?"
      subtitle="We'll tune suggestions to fit. You can change this anytime."
      footer={<PrimaryButton label="Continue" disabled={!purpose} onPress={onNext} />}
    >
      <View accessibilityRole="radiogroup" style={s.options}>
        {PURPOSES.map((item) => (
          <OptionRow
            key={item.value}
            label={item.label}
            detail={item.detail}
            icon={item.icon}
            selected={purpose === item.value}
            onPress={() => setPurpose(item.value)}
          />
        ))}
      </View>
    </StepScaffold>
  );
}

function ComfortStep({ step, onBack, onNext }: StepProps) {
  const { theme } = useVoticTheme();
  const a = useAccessibilityPreferences();
  // Each choice applies straight away, so the preview shows exactly what the Reader will look like.
  const choices = [
    {
      label: "Larger text",
      on: a.textSize !== "default",
      toggle: () => a.setTextSize(a.textSize === "default" ? "large" : "default"),
    },
    {
      label: "More space between lines",
      on: a.readingSpacing === "extra",
      toggle: () => a.setReadingSpacing(a.readingSpacing === "extra" ? "default" : "extra"),
    },
    {
      label: "An easier-to-read font",
      on: a.readerFont === "accessible",
      toggle: () => a.setReaderFont(a.readerFont === "accessible" ? "system" : "accessible"),
    },
    {
      label: "Wider letter spacing",
      on: a.textSpacing === "wide",
      toggle: () => a.setTextSpacing(a.textSpacing === "wide" ? "default" : "wide"),
    },
    {
      label: "Less motion",
      on: a.reduceMotion,
      toggle: () => a.setReduceMotion(!a.reduceMotion),
    },
  ];
  return (
    <StepScaffold
      step={step}
      total={STEPS}
      onBack={onBack}
      onSkip={onNext}
      title="What makes reading easier for you?"
      subtitle="Pick any. The preview updates as you go."
      footer={<PrimaryButton label="Continue" onPress={onNext} />}
    >
      <View
        accessible
        accessibilityLabel="Reading preview"
        style={[s.preview, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <Text style={[s.previewLabel, { color: theme.mutedText }]}>PREVIEW</Text>
        <Text
          style={[
            readerType(a.textSize, a.readingSpacing, a.readerFont, a.textSpacing),
            { color: theme.text },
          ]}
        >
          A clear page helps ideas stick. Votic remembers how you like to read.
        </Text>
      </View>
      <View style={s.options}>
        {choices.map((choice) => (
          <OptionRow
            key={choice.label}
            label={choice.label}
            multiple
            selected={choice.on}
            onPress={choice.toggle}
          />
        ))}
      </View>
    </StepScaffold>
  );
}

const SAMPLE_QUESTION = "What does “net revenue” mean?";
const SAMPLE_ANSWERS: Record<ExplanationStyle, string> = {
  quick: "The money a company keeps from sales after returns and discounts.",
  simple:
    "It's the money a business really gets from selling things, after refunds and discounts are taken away.",
  detailed:
    "Net revenue is total sales minus returns, allowances, and discounts. It shows what a company actually earned from selling, before costs like wages or rent. That makes it a fairer number than gross sales when comparing one period with another.",
  adaptive: "Votic keeps quick questions short and goes deeper when a question needs it.",
};

function ExplanationStep({ step, onBack, onNext, answers, setAnswers }: StepProps) {
  const { theme } = useVoticTheme();
  // Shows this account's current style ("Adapt to the question" until something else is chosen).
  const { explanationStyle, setExplanationStyle } = useVoticPurpose();
  function choose(value: ExplanationStyle) {
    setExplanationStyle(value);
    setAnswers({ ...answers, explanationStyle: value });
  }
  return (
    <StepScaffold
      step={step}
      total={STEPS}
      onBack={onBack}
      onSkip={onNext}
      title="How should Votic explain things?"
      subtitle="This shapes Ask Votic's answers. Change it anytime."
      footer={<PrimaryButton label="Continue" onPress={onNext} />}
    >
      <View accessibilityRole="radiogroup" style={s.options}>
        {EXPLANATION_STYLES.map((item) => (
          <OptionRow
            key={item.value}
            label={item.label}
            detail={item.detail}
            selected={explanationStyle === item.value}
            onPress={() => choose(item.value)}
          />
        ))}
      </View>
      <View
        accessible
        accessibilityLabel={`Example. Question: ${SAMPLE_QUESTION} Answer: ${SAMPLE_ANSWERS[explanationStyle]}`}
        accessibilityLiveRegion="polite"
        style={[s.preview, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <Text style={[s.previewLabel, { color: theme.mutedText }]}>EXAMPLE</Text>
        <Text style={[s.question, { color: theme.text }]}>{SAMPLE_QUESTION}</Text>
        <Text style={[s.answer, { color: theme.text, backgroundColor: theme.surfaceMuted }]}>
          {SAMPLE_ANSWERS[explanationStyle]}
        </Text>
      </View>
    </StepScaffold>
  );
}

const SPEEDS = [0.8, 1, 1.2, 1.5, 2];
const HIGHLIGHTS: { value: HighlightMode; label: string; detail: string }[] = [
  { value: "both", label: "Words and sentences", detail: "Follow every word as it's read" },
  { value: "sentence", label: "Sentences only", detail: "A calmer highlight" },
  { value: "off", label: "No highlighting", detail: "Just listen" },
];
/** The listening answers saved with this account for each highlight choice. */
const LISTENING_FOR: Record<HighlightMode, ListeningPreference[]> = {
  both: ["highlight-words", "highlight-sentence"],
  word: ["highlight-words"],
  sentence: ["highlight-sentence"],
  off: [],
};
const LISTEN_SAMPLE = "This is how Votic sounds when it reads to you.";
const LISTEN_WORDS = LISTEN_SAMPLE.split(" ");

function ListeningStep({ step, onBack, onNext, answers, setAnswers }: StepProps) {
  const { theme } = useVoticTheme();
  const a = useAccessibilityPreferences();
  const { defaultPlaybackRate, setDefaultPlaybackRate } = useVoticPurpose();
  const [playing, setPlaying] = useState(false);
  const [word, setWord] = useState(-1);
  const session = useRef(0);
  const highlightMode = a.highlightMode === "word" ? "both" : a.highlightMode;

  function stop() {
    session.current += 1;
    setPlaying(false);
    setWord(-1);
    void Speech.stop();
  }
  function play(rate = defaultPlaybackRate) {
    const current = session.current + 1;
    session.current = current;
    setPlaying(true);
    setWord(0);
    const done = () => {
      if (session.current !== current) return;
      setPlaying(false);
      setWord(-1);
    };
    void Speech.stop().then(() =>
      Speech.speak(LISTEN_SAMPLE, {
        rate,
        voice: a.voiceIdentifier || undefined,
        onBoundary: (event: { charIndex?: number }) => {
          if (session.current !== current) return;
          const offset = Number(event?.charIndex);
          if (!Number.isFinite(offset)) return;
          setWord(LISTEN_SAMPLE.slice(0, offset).split(" ").length - 1);
        },
        onDone: done,
        onStopped: done,
        onError: done,
      }),
    );
  }
  // Leaving this step (or setup) always stops the sample.
  useEffect(
    () => () => {
      session.current += 1;
      void Speech.stop();
    },
    [],
  );

  function chooseSpeed(rate: number) {
    setDefaultPlaybackRate(rate);
    if (playing) play(rate);
  }
  function chooseHighlight(mode: HighlightMode) {
    a.setHighlightMode(mode);
    setAnswers({ ...answers, listening: LISTENING_FOR[mode] });
  }

  return (
    <StepScaffold
      step={step}
      total={STEPS}
      onBack={() => {
        stop();
        onBack?.();
      }}
      onSkip={() => {
        stop();
        onNext();
      }}
      title="How do you like to listen?"
      subtitle="Tap play to hear a sample."
      footer={
        <PrimaryButton
          label="Continue"
          onPress={() => {
            stop();
            onNext();
          }}
        />
      }
    >
      <View style={[s.preview, s.listenCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? "Stop sample" : "Play sample"}
          onPress={() => (playing ? stop() : play())}
          style={({ pressed }) => [
            s.play,
            { backgroundColor: theme.playButton, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name={playing ? "stop" : "play"} size={24} color={theme.playIcon} />
        </Pressable>
        <Text
          style={[
            s.listenText,
            { color: theme.text },
            playing && highlightMode !== "off" && { backgroundColor: theme.sentenceHighlight },
          ]}
        >
          {LISTEN_WORDS.map((value, index) => (
            <Text
              key={index}
              style={
                playing && highlightMode === "both" && index === word
                  ? { backgroundColor: theme.wordHighlight, fontWeight: "800" }
                  : undefined
              }
            >
              {value}
              {index < LISTEN_WORDS.length - 1 ? " " : ""}
            </Text>
          ))}
        </Text>
      </View>
      <Text style={[s.groupLabel, { color: theme.text }]}>Speed</Text>
      <View accessibilityRole="radiogroup" style={s.speeds}>
        {SPEEDS.map((rate) => {
          const selected = defaultPlaybackRate === rate;
          return (
            <Pressable
              key={rate}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${formatPlaybackRate(rate)} speed`}
              onPress={() => chooseSpeed(rate)}
              style={[
                s.speed,
                {
                  borderColor: selected ? theme.accent : theme.border,
                  backgroundColor: selected ? theme.sentenceHighlight : theme.surface,
                },
              ]}
            >
              <Text style={[s.speedText, { color: theme.text, fontWeight: selected ? "800" : "600" }]}>
                {formatPlaybackRate(rate)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[s.groupLabel, { color: theme.text }]}>Follow along</Text>
      <View accessibilityRole="radiogroup" style={s.options}>
        {HIGHLIGHTS.map((item) => (
          <OptionRow
            key={item.value}
            label={item.label}
            detail={item.detail}
            selected={highlightMode === item.value}
            onPress={() => chooseHighlight(item.value)}
          />
        ))}
      </View>
    </StepScaffold>
  );
}

const s = StyleSheet.create({
  options: { gap: spacing.md },
  preview: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm },
  previewLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
  question: { fontSize: 16, fontWeight: "700" },
  answer: { fontSize: 16, lineHeight: 23, borderRadius: radii.md, padding: spacing.md, overflow: "hidden" },
  listenCard: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  play: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  listenText: { flex: 1, fontSize: 18, lineHeight: 28 },
  groupLabel: { fontSize: 17, fontWeight: "800", marginTop: spacing.sm },
  speeds: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  speed: {
    minHeight: 48,
    minWidth: 60,
    flexGrow: 1,
    borderWidth: 2,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  speedText: { fontSize: 16 },
});
