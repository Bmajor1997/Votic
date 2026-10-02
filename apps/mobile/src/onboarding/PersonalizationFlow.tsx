import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { radii, spacing } from "../design/tokens";
import { useVoticPurpose } from "../personalization/PurposeProvider";
import { formatPlaybackRate } from "../playback/rates";
import { useVoticTheme } from "../theme/ThemeProvider";
import { useAccountSetup } from "./AccountSetupProvider";
import { OptionRow, PrimaryButton, StepScaffold } from "./components";
import {
  EMPTY_ANSWERS,
  ExplanationStyle,
  ListeningPreference,
  Option,
  PersonalizationAnswers,
  QUESTIONS,
  highlightModeFor,
  isAnswered,
  toggleMultiple,
} from "./onboardingModel";

type Props = { mode: "onboarding" } | { mode: "edit"; onClose: () => void };

/**
 * Five quick, optional questions, one per screen. During setup every answer and the current question are
 * saved as they change, so closing Votic mid-way resumes on the same question with the same answers.
 * From Settings the answers are edited on a copy and saved only with Save.
 */
export function PersonalizationFlow(props: Props) {
  const setup = useAccountSetup();
  const editing = props.mode === "edit";
  const saved = setup.setup;
  const [draft, setDraft] = useState<PersonalizationAnswers>(() => saved?.answers ?? EMPTY_ANSWERS);
  const [editStep, setEditStep] = useState(0);
  const answers = editing ? draft : (saved?.answers ?? EMPTY_ANSWERS);
  const step = editing ? editStep : (saved?.currentStep ?? 0);
  const question = QUESTIONS[step];
  const last = step === QUESTIONS.length - 1;

  function setAnswers(next: PersonalizationAnswers) {
    if (editing) setDraft(next);
    else setup.setAnswers(next);
  }
  function goTo(next: number) {
    if (editing) setEditStep(next);
    else setup.setStep(next);
  }
  const onClose = props.mode === "edit" ? props.onClose : undefined;
  function finish() {
    void Speech.stop();
    if (onClose) {
      setup.savePersonalization(draft);
      onClose();
    } else setup.finishPersonalization({ skipped: !QUESTIONS.some((item) => isAnswered(item, answers)) });
  }
  const next = () => (last ? finish() : goTo(step + 1));
  const back = step > 0 ? () => goTo(step - 1) : onClose;

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

  function choose(value: string) {
    if (question.kind === "single")
      setAnswers({
        ...answers,
        explanationStyle: answers.explanationStyle === value ? null : (value as ExplanationStyle),
      });
    else {
      const key = question.key;
      const selected = answers[key] as string[];
      setAnswers({
        ...answers,
        [key]: toggleMultiple(question as { options: Option<string>[] }, selected, value),
      });
    }
  }
  const selected = (value: string) =>
    question.kind === "single"
      ? answers.explanationStyle === value
      : (answers[question.key] as string[]).includes(value);

  return (
    <StepScaffold
      step={step}
      total={QUESTIONS.length}
      onBack={back}
      onSkip={next}
      title={question.title}
      subtitle={
        question.kind === "multiple" ? `${question.instruction} Select all that apply.` : question.instruction
      }
      footer={<PrimaryButton label={last && editing ? "Save" : "Continue"} onPress={next} />}
    >
      {question.key === "explanationStyle" ? <ExplanationExample style={answers.explanationStyle} /> : null}
      {question.key === "listening" ? <ListeningSample listening={answers.listening} /> : null}
      <View accessibilityRole={question.kind === "single" ? "radiogroup" : undefined} style={s.options}>
        {question.options.map((option) => (
          <OptionRow
            key={option.value}
            label={option.label}
            detail={option.detail}
            multiple={question.kind === "multiple"}
            selected={selected(option.value)}
            onPress={() => choose(option.value)}
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

/** A sample answer in the chosen style, so the choice is concrete. */
function ExplanationExample({ style }: { style: ExplanationStyle | null }) {
  const { theme } = useVoticTheme();
  const answer = SAMPLE_ANSWERS[style ?? "adaptive"];
  return (
    <View
      accessible
      accessibilityLabel={`Example. Question: ${SAMPLE_QUESTION} Answer: ${answer}`}
      accessibilityLiveRegion="polite"
      style={[s.preview, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <Text style={[s.previewLabel, { color: theme.mutedText }]}>EXAMPLE</Text>
      <Text style={[s.question, { color: theme.text }]}>{SAMPLE_QUESTION}</Text>
      <Text style={[s.answer, { color: theme.text, backgroundColor: theme.surfaceMuted }]}>{answer}</Text>
    </View>
  );
}

const SPEEDS = [0.8, 1, 1.2, 1.5, 2];
const LISTEN_SAMPLE = "This is how Votic sounds when it reads to you.";
const LISTEN_WORDS = LISTEN_SAMPLE.split(" ");

/** A playable sample that highlights the way the chosen answers will, plus the starting speed. */
function ListeningSample({ listening }: { listening: ListeningPreference[] }) {
  const { theme } = useVoticTheme();
  const a = useAccessibilityPreferences();
  const { defaultPlaybackRate, setDefaultPlaybackRate } = useVoticPurpose();
  const [playing, setPlaying] = useState(false);
  const [word, setWord] = useState(-1);
  const session = useRef(0);
  // What the Reader will do once these answers are saved; until something is chosen, today's setting.
  const highlight = highlightModeFor(listening) ?? a.highlightMode;
  const words = highlight === "word" || highlight === "both";
  const sentence = highlight === "sentence" || highlight === "both";

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
  // Leaving this question (or setup) always stops the sample.
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

  return (
    <View style={s.listenGroup}>
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
            playing && sentence && { backgroundColor: theme.sentenceHighlight },
          ]}
        >
          {LISTEN_WORDS.map((value, index) => (
            <Text
              key={index}
              style={
                playing && words && index === word
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
      <Text style={[s.groupLabel, { color: theme.text }]}>Starting speed</Text>
      <View accessibilityRole="radiogroup" style={s.speeds}>
        {SPEEDS.map((rate) => {
          const chosen = defaultPlaybackRate === rate;
          return (
            <Pressable
              key={rate}
              accessibilityRole="radio"
              accessibilityState={{ checked: chosen }}
              accessibilityLabel={`${formatPlaybackRate(rate)} speed`}
              onPress={() => chooseSpeed(rate)}
              style={[
                s.speed,
                {
                  borderColor: chosen ? theme.accent : theme.border,
                  backgroundColor: chosen ? theme.sentenceHighlight : theme.surface,
                },
              ]}
            >
              <Text style={[s.speedText, { color: theme.text, fontWeight: chosen ? "800" : "600" }]}>
                {formatPlaybackRate(rate)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  options: { gap: spacing.md },
  preview: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm },
  previewLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
  question: { fontSize: 16, fontWeight: "700" },
  answer: { fontSize: 16, lineHeight: 23, borderRadius: radii.md, padding: spacing.md, overflow: "hidden" },
  listenGroup: { gap: spacing.md },
  listenCard: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  play: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  listenText: { flex: 1, fontSize: 18, lineHeight: 28 },
  groupLabel: { fontSize: 17, fontWeight: "800" },
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
