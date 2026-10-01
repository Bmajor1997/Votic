import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAccessibilityPreferences } from "../../accessibility/AccessibilityProvider";
import { controlSizes, spacing, typography } from "../../design/tokens";
import { useVoticTheme } from "../../theme/ThemeProvider";
import { useAccount } from "../AccountProvider";
import { ChoiceCard, OnboardingScreen, PrimaryButton, StepDots } from "../components/OnboardingUI";
import {
  EMPTY_ANSWERS,
  Option,
  isAnswered,
  PersonalizationAnswers,
  QUESTIONS,
  toggleMultiple,
} from "../onboardingModel";

type Props = { mode: "onboarding" } | { mode: "edit"; onClose: () => void };

/**
 * "Make Votic work for you": five quick, optional questions. During setup every change is saved as it
 * happens, so closing Votic mid-way resumes on the same question with the same answers.
 */
export function PersonalizeScreen(props: Props) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const account = useAccount();
  const editing = props.mode === "edit";
  const saved = account.onboarding;
  // Editing from Settings works on a copy that is only saved when the person taps Save.
  const [draft, setDraft] = useState<PersonalizationAnswers>(() => saved?.answers ?? EMPTY_ANSWERS);
  const [editStep, setEditStep] = useState(0);
  const answers = editing ? draft : (saved?.answers ?? EMPTY_ANSWERS);
  const step = editing ? editStep : (saved?.currentStep ?? 0);
  const question = QUESTIONS[step];
  const last = step === QUESTIONS.length - 1;
  const entrance = useState(() => new Animated.Value(1))[0];

  function setAnswers(next: PersonalizationAnswers) {
    if (editing) setDraft(next);
    else account.setAnswers(next);
  }
  function goTo(next: number) {
    if (editing) setEditStep(next);
    else account.setStep(next);
  }
  function finish(skipped: boolean) {
    if (props.mode === "edit") {
      account.savePersonalization(draft);
      props.onClose();
    } else account.finishPersonalization({ skipped });
  }
  function back() {
    if (step > 0) goTo(step - 1);
    else if (props.mode === "edit") props.onClose();
  }
  const canGoBack = step > 0 || editing;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      `Step ${step + 1} of ${QUESTIONS.length}. ${QUESTIONS[step].title}`,
    );
    if (reduceMotion) return;
    entrance.setValue(0);
    Animated.timing(entrance, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [step, reduceMotion, entrance]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack) return false;
      back();
      return true;
    });
    return () => subscription.remove();
  });

  function choose(value: string) {
    if (question.kind === "single") {
      setAnswers({ ...answers, explanationStyle: value as PersonalizationAnswers["explanationStyle"] });
      return;
    }
    const current = answers[question.key] as string[];
    setAnswers({
      ...answers,
      [question.key]: toggleMultiple(question as { options: Option<string>[] }, current, value),
    });
  }
  function isSelected(value: string) {
    const current = answers[question.key];
    return Array.isArray(current) ? (current as string[]).includes(value) : current === value;
  }
  const answered = isAnswered(question, answers);
  const continueLabel = last ? (editing ? "Save" : "Continue") : answered ? "Continue" : "Skip for now";

  return (
    <OnboardingScreen
      onBack={canGoBack ? back : undefined}
      backLabel={step > 0 ? "Previous question" : "Close"}
      showLogo={false}
      headerAction={
        editing ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip setup"
            accessibilityHint="Uses Votic's defaults. You can change these later in Settings."
            onPress={() => finish(true)}
            hitSlop={8}
            style={s.skip}
          >
            <Text style={[s.skipText, { color: theme.mutedText }]}>Skip</Text>
          </Pressable>
        )
      }
      footer={<PrimaryButton label={continueLabel} onPress={() => (last ? finish(false) : goTo(step + 1))} />}
    >
      <View style={s.intro}>
        <Text style={[s.eyebrow, { color: theme.accent }]}>MAKE VOTIC WORK FOR YOU</Text>
        {step === 0 ? (
          <Text style={[s.support, { color: theme.mutedText }]}>
            {"Choose how you'd like Votic to help. You can change any of this later."}
          </Text>
        ) : null}
        <StepDots step={step} total={QUESTIONS.length} />
      </View>
      <Animated.View
        style={[
          s.question,
          {
            opacity: entrance,
            transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          },
        ]}
      >
        <View style={s.heading}>
          <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
            {question.title}
          </Text>
          <Text style={[s.instruction, { color: theme.mutedText }]}>{question.instruction}</Text>
        </View>
        <View accessibilityRole={question.kind === "single" ? "radiogroup" : undefined} style={s.choices}>
          {question.options.map((option) => (
            <ChoiceCard
              key={option.value}
              kind={question.kind}
              label={option.label}
              detail={option.detail}
              selected={isSelected(option.value)}
              onPress={() => choose(option.value)}
            />
          ))}
        </View>
      </Animated.View>
    </OnboardingScreen>
  );
}

const s = StyleSheet.create({
  intro: { gap: spacing.sm },
  eyebrow: { ...typography.eyebrow },
  support: { ...typography.body, fontSize: 16, lineHeight: 24 },
  question: { gap: spacing.lg },
  heading: { gap: spacing.xs },
  title: { ...typography.screenTitle, fontSize: 25, lineHeight: 32 },
  instruction: { fontSize: 16, lineHeight: 22 },
  choices: { gap: spacing.sm },
  skip: { minHeight: controlSizes.minimumTouch, justifyContent: "center", paddingHorizontal: spacing.xs },
  skipText: { fontSize: 16, fontWeight: "700" },
});
