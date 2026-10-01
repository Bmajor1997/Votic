import type { HighlightMode } from "../accessibility/AccessibilityProvider";

export const ONBOARDING_VERSION = 1;

export type Goal =
  | "understand-reading"
  | "explain-difficult"
  | "listen-instead"
  | "find-quickly"
  | "summarize"
  | "take-notes"
  | "remember"
  | "stay-focused";
export type ReadingHelp =
  | "simpler-language"
  | "key-points"
  | "ask-while-reading"
  | "find-specific"
  | "read-aloud"
  | "track-important"
  | "resume"
  | "decide-as-i-go";
export type ExplanationStyle = "quick" | "simple" | "detailed" | "adaptive";
export type ListeningPreference =
  "highlight-words" | "highlight-sentence" | "change-speed" | "jump" | "remember-position" | "mainly-read";
export type KeepingTrack =
  | "quick-save"
  | "create-notes"
  | "save-passages"
  | "organize-key-points"
  | "questions-with-notes"
  | "find-notes"
  | "organize-myself";

export type PersonalizationAnswers = {
  goals: Goal[];
  readingHelp: ReadingHelp[];
  explanationStyle: ExplanationStyle | null;
  listening: ListeningPreference[];
  keepingTrack: KeepingTrack[];
};

/**
 * One account's onboarding on this device. Separate from signing in (Firebase) and from paying (RevenueCat):
 * finishing onboarding never implies an active subscription.
 */
export type OnboardingState = {
  version: number;
  /** The question to show when setup resumes (0–4). */
  currentStep: number;
  answers: PersonalizationAnswers;
  /** Set when the person finishes or skips personalization. */
  personalizationCompletedAt: number | null;
  personalizationSkipped: boolean;
  /** Set when the person first enters Votic after setup. */
  completedAt: number | null;
};

export const EMPTY_ANSWERS: PersonalizationAnswers = {
  goals: [],
  readingHelp: [],
  explanationStyle: null,
  listening: [],
  keepingTrack: [],
};

export function newOnboardingState(): OnboardingState {
  return {
    version: ONBOARDING_VERSION,
    currentStep: 0,
    answers: { ...EMPTY_ANSWERS },
    personalizationCompletedAt: null,
    personalizationSkipped: false,
    completedAt: null,
  };
}

/** Explanation style used when the person skips that question. */
export const DEFAULT_EXPLANATION_STYLE: ExplanationStyle = "adaptive";

export type Option<T extends string> = { value: T; label: string; detail?: string; exclusive?: boolean };
type MultiQuestion<K extends keyof PersonalizationAnswers, T extends string> = {
  key: K;
  kind: "multiple";
  title: string;
  instruction: string;
  options: Option<T>[];
};
type SingleQuestion = {
  key: "explanationStyle";
  kind: "single";
  title: string;
  instruction: string;
  options: Option<ExplanationStyle>[];
};
export type Question =
  | MultiQuestion<"goals", Goal>
  | MultiQuestion<"readingHelp", ReadingHelp>
  | SingleQuestion
  | MultiQuestion<"listening", ListeningPreference>
  | MultiQuestion<"keepingTrack", KeepingTrack>;

export const QUESTIONS: Question[] = [
  {
    key: "goals",
    kind: "multiple",
    title: "What would you like Votic to help you do?",
    instruction: "Choose anything that would be helpful.",
    options: [
      { value: "understand-reading", label: "Understand something I'm reading" },
      { value: "explain-difficult", label: "Explain difficult or confusing information" },
      { value: "listen-instead", label: "Listen instead of read" },
      { value: "find-quickly", label: "Find important information quickly" },
      { value: "summarize", label: "Summarize long documents" },
      { value: "take-notes", label: "Take and organize notes" },
      { value: "remember", label: "Remember important information" },
      { value: "stay-focused", label: "Stay focused while reading" },
    ],
  },
  {
    key: "readingHelp",
    kind: "multiple",
    title: "How can Votic make reading easier for you?",
    instruction: "Choose what sounds useful.",
    options: [
      { value: "simpler-language", label: "Explain things in simpler language" },
      { value: "key-points", label: "Give me the key points" },
      { value: "ask-while-reading", label: "Let me ask questions as I read" },
      { value: "find-specific", label: "Help me find specific information" },
      { value: "read-aloud", label: "Read the document aloud" },
      { value: "track-important", label: "Help me keep track of important information" },
      { value: "resume", label: "Help me pick up where I left off" },
      { value: "decide-as-i-go", label: "I'll decide as I go", exclusive: true },
    ],
  },
  {
    key: "explanationStyle",
    kind: "single",
    title: "When Votic explains something, how would you like it explained?",
    instruction: "Choose one.",
    options: [
      { value: "quick", label: "Quickly", detail: "Just give me the answer." },
      { value: "simple", label: "Simply", detail: "Make it easy to understand." },
      { value: "detailed", label: "In detail", detail: "Give me more context." },
      { value: "adaptive", label: "Adapt to me", detail: "Let Votic decide based on what I ask." },
    ],
  },
  {
    key: "listening",
    kind: "multiple",
    title: "What would make listening more useful for you?",
    instruction: "Choose what sounds useful.",
    options: [
      { value: "highlight-words", label: "Highlight the words as they're read" },
      { value: "highlight-sentence", label: "Highlight the current sentence" },
      { value: "change-speed", label: "Let me easily change the reading speed" },
      { value: "jump", label: "Make it easy to jump backward or forward" },
      { value: "remember-position", label: "Remember where I stopped" },
      { value: "mainly-read", label: "I'm mainly here to read", exclusive: true },
    ],
  },
  {
    key: "keepingTrack",
    kind: "multiple",
    title: "How should Votic help you keep track of important things?",
    instruction: "Choose what sounds useful.",
    options: [
      { value: "quick-save", label: "Let me quickly save something" },
      { value: "create-notes", label: "Help me create notes" },
      { value: "save-passages", label: "Save important passages" },
      { value: "organize-key-points", label: "Organize key points for me" },
      { value: "questions-with-notes", label: "Keep my questions with my notes" },
      { value: "find-notes", label: "Help me find my notes later" },
      { value: "organize-myself", label: "I'll organize things myself", exclusive: true },
    ],
  },
];

/**
 * Toggles a multiple-choice answer. "I'll decide as I go"-style options stand alone: choosing one clears
 * the others, and choosing any other option clears it.
 */
export function toggleMultiple<T extends string>(
  question: { options: Option<T>[] },
  selected: T[],
  value: T,
): T[] {
  if (selected.includes(value)) return selected.filter((item) => item !== value);
  const option = question.options.find((item) => item.value === value);
  if (!option) return selected;
  if (option.exclusive) return [value];
  const exclusive = new Set(question.options.filter((item) => item.exclusive).map((item) => item.value));
  return [...selected.filter((item) => !exclusive.has(item)), value];
}

/** Whether the question has an answer, which decides between "Continue" and "Skip" on its button. */
export function isAnswered(question: Question, answers: PersonalizationAnswers) {
  const value = answers[question.key];
  return Array.isArray(value) ? value.length > 0 : value !== null;
}

function keep<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is T => allowed.includes(item as T)))];
}
const allowed = <K extends keyof PersonalizationAnswers>(key: K) =>
  QUESTIONS.find((question) => question.key === key)!.options.map((option) => option.value);

/** Reads saved onboarding, discarding anything unexpected, so a damaged or older record never crashes startup. */
export function parseOnboardingState(raw: string | null): OnboardingState | null {
  if (!raw) return null;
  let value: Partial<OnboardingState> & { answers?: Partial<Record<keyof PersonalizationAnswers, unknown>> };
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const answers: Partial<Record<keyof PersonalizationAnswers, unknown>> = value.answers || {};
  const style = answers.explanationStyle;
  const time = (item: unknown) => (typeof item === "number" && Number.isFinite(item) ? item : null);
  const step = Number.isInteger(value.currentStep) ? (value.currentStep as number) : 0;
  return {
    version: typeof value.version === "number" ? value.version : ONBOARDING_VERSION,
    currentStep: Math.min(QUESTIONS.length - 1, Math.max(0, step)),
    answers: {
      goals: keep(answers.goals, allowed("goals") as Goal[]),
      readingHelp: keep(answers.readingHelp, allowed("readingHelp") as ReadingHelp[]),
      explanationStyle: (allowed("explanationStyle") as string[]).includes(style as string)
        ? (style as ExplanationStyle)
        : null,
      listening: keep(answers.listening, allowed("listening") as ListeningPreference[]),
      keepingTrack: keep(answers.keepingTrack, allowed("keepingTrack") as KeepingTrack[]),
    },
    personalizationCompletedAt: time(value.personalizationCompletedAt),
    personalizationSkipped: value.personalizationSkipped === true,
    completedAt: time(value.completedAt),
  };
}

/** The explanation style Ask Votic should use; "adaptive" when the person hasn't chosen. */
export function explanationStyleFor(answers: PersonalizationAnswers): ExplanationStyle {
  return answers.explanationStyle || DEFAULT_EXPLANATION_STYLE;
}

/**
 * The Reader highlight setting implied by the listening answers, or null to leave the current setting alone.
 * Listening itself is never turned off: "I'm mainly here to read" only leaves highlighting as it is.
 */
export function highlightModeFor(listening: ListeningPreference[]): HighlightMode | null {
  const words = listening.includes("highlight-words");
  const sentence = listening.includes("highlight-sentence");
  if (words && sentence) return "both";
  if (words) return "word";
  if (sentence) return "sentence";
  return null;
}
