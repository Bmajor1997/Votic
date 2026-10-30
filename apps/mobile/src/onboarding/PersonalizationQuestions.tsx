import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import { HighlightMode, useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { radii, spacing } from "../design/tokens";
import { useAccountSetup } from "./AccountSetupProvider";
import { OptionRow, PrimaryButton, StepScaffold } from "./components";
import { ListeningStep } from "./ListeningStep";
import { SampleDocumentHeading } from "./SampleDocumentHeading";
import { PREVIEW_SAMPLES, sample_explanation } from "./sampleDocument";
import { EMPTY_ANSWERS, PersonalizationAnswers } from "./onboardingModel";
import {
  EXPLANATION_STYLES,
  ExplanationStyle,
  PURPOSES,
  useVoticPurpose,
} from "../personalization/PurposeProvider";
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
  return <ListeningStep {...stepProps} total={STEPS} />;
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

function ComfortStep({ step, onBack, onNext, access: a, personalization }: StepProps) {
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
      title="Make the page your own."
      subtitle="Try a reading style. Your documents will use these settings."
      footer={<PrimaryButton label="Continue" onPress={onNext} />}
    >
      <View
        accessible
        accessibilityLabel="Reading preview"
        style={[s.preview, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <SampleDocumentHeading title={PREVIEW_SAMPLES[personalization.purpose ?? "default"].title} />
        <Text
          style={[
            reader_type(a.textSize, a.readingSpacing, a.readerFont, a.textSpacing),
            { color: theme.text },
          ]}
        >
          {PREVIEW_SAMPLES[personalization.purpose ?? "default"].text}
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

function ExplanationStep({ step, onBack, onNext, answers, setAnswers, personalization }: StepProps) {
  const { theme } = useVoticTheme();
  // Shows this account's current style ("Adapt to the question" until something else is chosen).
  const { explanationStyle, setExplanationStyle, purpose } = personalization;
  const sample = PREVIEW_SAMPLES[purpose ?? "default"];
  const answer = sample_explanation(purpose, explanationStyle);
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
      title="A clearer way to understand."
      subtitle="Try an explanation style on the same sample page."
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
        accessibilityLabel={`Example. Question: ${sample.question} Answer: ${answer}`}
        accessibilityLiveRegion="polite"
        style={[s.preview, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <SampleDocumentHeading title={sample.title} />
        <Text style={[s.previewLabel, { color: theme.mutedText }]}>PREPARED EXAMPLE</Text>
        <Text style={[s.question, { color: theme.text }]}>{sample.question}</Text>
        <Text style={[s.answer, { color: theme.text, backgroundColor: theme.surfaceMuted }]}>{answer}</Text>
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
});
