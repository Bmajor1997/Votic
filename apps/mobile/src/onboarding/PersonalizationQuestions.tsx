import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { HighlightMode, useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { radii, spacing } from "../design/tokens";
import { useAccountSetup } from "./AccountSetupProvider";
import { OptionRow, PrimaryButton, StepScaffold } from "./components";
import { EMPTY_ANSWERS, ListeningPreference, PersonalizationAnswers } from "./onboardingModel";
import {
  EXPLANATION_STYLES,
  ExplanationStyle,
  PURPOSES,
  useVoticPurpose,
} from "../personalization/PurposeProvider";
import { format_playback_rate } from "../playback/rates";
import { reader_type } from "../reader/readerText";
import { useVoticTheme } from "../theme/ThemeProvider";

const STEPS = 4;

/**
 * The same four questions, for setup or for changing answers later from Settings. When editing, the answers
 * are saved together at the end, and going back from the first question (or Android's back button) closes.
 */
export function PersonalizationQuestions(props: { mode: "setup" } | { mode: "edit"; onClose: () => void }) {
  const access = useAccessibilityPreferences();
  const purposePreferences = useVoticPurpose();
  const editing = props.mode === "edit";
  const [preview, setPreview] = useState(() => ({ ...access }));
  const [purposePreview, setPurposePreview] = useState(() => ({ ...purposePreferences }));
  const a = editing
    ? {
        ...preview,
        setTextSize: (textSize: typeof access.textSize) => setPreview((value) => ({ ...value, textSize })),
        setReadingSpacing: (readingSpacing: typeof access.readingSpacing) =>
          setPreview((value) => ({ ...value, readingSpacing })),
        setReaderFont: (readerFont: typeof access.readerFont) =>
          setPreview((value) => ({ ...value, readerFont })),
        setTextSpacing: (textSpacing: typeof access.textSpacing) =>
          setPreview((value) => ({ ...value, textSpacing })),
        setReduceMotion: (reduceMotion: boolean) => setPreview((value) => ({ ...value, reduceMotion })),
        setHighlightMode: (highlightMode: HighlightMode) =>
          setPreview((value) => ({ ...value, highlightMode })),
      }
    : access;
  const personalization = editing
    ? {
        ...purposePreview,
        setPurpose: (purpose: NonNullable<typeof purposePreferences.purpose>) =>
          setPurposePreview((value) => ({ ...value, purpose })),
        setExplanationStyle: (explanationStyle: ExplanationStyle) =>
          setPurposePreview((value) => ({ ...value, explanationStyle })),
        setDefaultPlaybackRate: (defaultPlaybackRate: number) =>
          setPurposePreview((value) => ({ ...value, defaultPlaybackRate })),
      }
    : purposePreferences;
  const setup = useAccountSetup();
  const { purpose } = personalization;
  const [draft, setDraft] = useState<PersonalizationAnswers>(() => setup.setup?.answers ?? EMPTY_ANSWERS);
  const [editStep, setEditStep] = useState(0);
  const answers = editing ? draft : (setup.setup?.answers ?? EMPTY_ANSWERS);
  const step = Math.min(STEPS - 1, editing ? editStep : (setup.setup?.currentStep ?? 0));
  const onClose = props.mode === "edit" ? props.onClose : undefined;

  function go_to(next: number) {
    if (editing) setEditStep(next);
    else setup.setStep(next);
  }
  function finish() {
    void Speech.stop();
    if (onClose) {
      access.setTextSize(preview.textSize);
      access.setReadingSpacing(preview.readingSpacing);
      access.setReaderFont(preview.readerFont);
      access.setTextSpacing(preview.textSpacing);
      if (preview.reduceMotion !== access.reduceMotion) access.setReduceMotion(preview.reduceMotion);
      if (purposePreview.purpose) purposePreferences.setPurpose(purposePreview.purpose);
      setup.savePersonalization(draft);
      // Explicit choices (including "No highlighting") override older saved answers.
      access.setHighlightMode(preview.highlightMode);
      purposePreferences.setExplanationStyle(purposePreview.explanationStyle);
      purposePreferences.setDefaultPlaybackRate(purposePreview.defaultPlaybackRate);
      onClose();
      return;
    }
    const answeredSomething =
      Boolean(purpose) || Boolean(answers.explanationStyle) || answers.listening.length > 0;
    setup.finishPersonalization({ skipped: !answeredSomething });
  }
  const next = () => (step === STEPS - 1 ? finish() : go_to(step + 1));
  const back = step > 0 ? () => go_to(step - 1) : onClose;

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

  const stepProps = {
    access: a,
    personalization,
    step,
    onBack: back,
    onNext: next,
    answers,
    setAnswers: (value: PersonalizationAnswers) => (editing ? setDraft(value) : setup.setAnswers(value)),
    finishLabel: editing ? "Save" : "Continue",
  };
  if (step === 0) return <GoalStep {...stepProps} />;
  if (step === 1) return <ComfortStep {...stepProps} />;
  if (step === 2) return <ExplanationStep {...stepProps} />;
  return <ListeningStep {...stepProps} />;
}

type StepProps = {
  access: ReturnType<typeof useAccessibilityPreferences>;
  personalization: ReturnType<typeof useVoticPurpose>;
  step: number;
  onBack?: () => void;
  onNext: () => void;
  answers: PersonalizationAnswers;
  setAnswers: (answers: PersonalizationAnswers) => void;
  /** The last question's button: "Save" when changing answers from Settings. */
  finishLabel: string;
};

function GoalStep({ step, onBack, onNext, personalization }: StepProps) {
  const { purpose, setPurpose } = personalization;
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

function ComfortStep({ step, onBack, onNext, access: a }: StepProps) {
  const { theme } = useVoticTheme();
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
            reader_type(a.textSize, a.readingSpacing, a.readerFont, a.textSpacing),
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

function ExplanationStep({ step, onBack, onNext, answers, setAnswers, personalization }: StepProps) {
  const { theme } = useVoticTheme();
  // Shows this account's current style ("Adapt to the question" until something else is chosen).
  const { explanationStyle, setExplanationStyle } = personalization;
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

function ListeningStep({
  step,
  onBack,
  onNext,
  answers,
  setAnswers,
  finishLabel,
  access: a,
  personalization,
}: StepProps) {
  const { theme } = useVoticTheme();
  const { defaultPlaybackRate, setDefaultPlaybackRate } = personalization;
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
    void Speech.stop()
      .then(() => {
        if (session.current !== current) return;
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
        });
      })
      .catch(done);
  }
  // Leaving this step (or setup) always stops the sample.
  useEffect(
    () => () => {
      session.current += 1;
      void Speech.stop();
    },
    [],
  );

  function choose_speed(rate: number) {
    setDefaultPlaybackRate(rate);
    if (playing) play(rate);
  }
  function choose_highlight(mode: HighlightMode) {
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
          label={finishLabel}
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
              accessibilityLabel={`${format_playback_rate(rate)} speed`}
              onPress={() => choose_speed(rate)}
              style={[
                s.speed,
                {
                  borderColor: selected ? theme.accent : theme.border,
                  backgroundColor: selected ? theme.sentenceHighlight : theme.surface,
                },
              ]}
            >
              <Text style={[s.speedText, { color: theme.text, fontWeight: selected ? "800" : "600" }]}>
                {format_playback_rate(rate)}
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
            onPress={() => choose_highlight(item.value)}
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
