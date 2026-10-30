import type { ExplanationStyle, PersonalizationAnswers } from "../onboarding/onboardingModel";
import type { VoticPurpose } from "./PurposeProvider";

/**
 * Ask Votic and Notes suggestions, chosen from what the person said they want help with in personalization.
 * People who haven't answered those questions keep the suggestions their legacy "purpose" gave them.
 */

/** The suggestions shown on the Ask Votic screen. Never more than this many. */
export const ASK_SUGGESTION_COUNT = 6;

/** What Ask Votic suggested before personalization existed, and still suggests with no answers or purpose. */
export const DEFAULT_ASK_SUGGESTIONS = [
  "Summarize this document",
  "Explain this section",
  "Find key points",
  "Help with my notes",
  "Compare key ideas",
  "Find information",
];

/** The legacy purpose suggestions, unchanged, for people who chose a purpose and no personalization answers. */
const LEGACY_ASK_SUGGESTIONS: Record<VoticPurpose, string[]> = {
  learning: [
    "Summarize this document",
    "Explain this section",
    "Quiz me on this document",
    "Help with my notes",
    "Compare key ideas",
    "Find information",
  ],
  work: [
    "Summarize this document",
    "Find action items",
    "Highlight key decisions",
    "Explain this section",
    "Compare key details",
    "Find information",
  ],
  personal: DEFAULT_ASK_SUGGESTIONS,
};

type Answer = { key: "goals" | "readingHelp" | "keepingTrack"; value: string };
const has = (answers: PersonalizationAnswers, { key, value }: Answer) =>
  (answers[key] as string[]).includes(value);

/** Answers that only say "I'll decide" don't express a preference. */
const NEUTRAL = new Set(["decide-as-i-go", "organize-myself"]);

/** Whether the person told personalization anything Ask Votic or Notes can act on. */
export function has_suggestion_preferences(answers: PersonalizationAnswers | null | undefined) {
  if (!answers) return false;
  return [...answers.goals, ...answers.readingHelp, ...answers.keepingTrack].some(
    (value) => !NEUTRAL.has(value),
  );
}

/** Whether explanations should be in plain language, from either answer that asks for it. */
export function wants_simple_explanations(answers: PersonalizationAnswers) {
  return answers.explanationStyle === "simple" || answers.readingHelp.includes("simpler-language");
}

/**
 * Each rule ties an answer to an existing suggestion that says the same thing. Only direct matches are
 * listed; answers without one (listening, focus, remembering, organizing) leave their places to the usual
 * suggestions rather than being stretched to fit. Rules are checked in this order.
 */
const ASK_RULES: { when: Answer[]; suggestion: string }[] = [
  { when: [{ key: "goals", value: "summarize" }], suggestion: "Summarize this document" },
  {
    when: [
      { key: "goals", value: "explain-difficult" },
      { key: "readingHelp", value: "simpler-language" },
    ],
    suggestion: "Explain this section",
  },
  { when: [{ key: "goals", value: "understand-reading" }], suggestion: "Help me understand this passage" },
  { when: [{ key: "readingHelp", value: "key-points" }], suggestion: "Find key points" },
  {
    when: [
      { key: "goals", value: "find-quickly" },
      { key: "readingHelp", value: "find-specific" },
    ],
    suggestion: "Find information",
  },
  {
    when: [
      { key: "goals", value: "take-notes" },
      { key: "keepingTrack", value: "create-notes" },
    ],
    suggestion: "Help with my notes",
  },
];

export function ask_suggestions(
  answers: PersonalizationAnswers | null | undefined,
  purpose: VoticPurpose | null,
) {
  if (!answers || !has_suggestion_preferences(answers))
    return purpose ? LEGACY_ASK_SUGGESTIONS[purpose] : DEFAULT_ASK_SUGGESTIONS;
  const simple = wants_simple_explanations(answers);
  const chosen = ASK_RULES.filter((rule) => rule.when.some((answer) => has(answers, answer))).map((rule) =>
    rule.suggestion === "Explain this section" && simple ? "Explain this section simply" : rule.suggestion,
  );
  // Fill any remaining places with the usual suggestions, so there are always a few to choose from.
  const explain = simple ? "Explain this section simply" : "Explain this section";
  const fill = DEFAULT_ASK_SUGGESTIONS.map((item) => (item === "Explain this section" ? explain : item));
  return [...new Set([...chosen, ...fill])].slice(0, ASK_SUGGESTION_COUNT);
}

/** The same suggestions worded for notes, used when Ask Votic is asked about notes rather than a document. */
const NOTES_WORDING: Record<string, string> = {
  "Summarize this document": "Summarize these notes",
  "Explain this section": "Explain these notes",
  "Explain this section simply": "Explain these notes simply",
  "Help me understand this passage": "Help me understand these notes",
  "Quiz me on this document": "Quiz me on these notes",
  "Help with my notes": "What do these notes have in common?",
  "Ask about my notes": "What do these notes have in common?",
};
export function notes_suggestions(suggestions: readonly string[]) {
  return [...new Set(suggestions.map((item) => NOTES_WORDING[item] ?? item))];
}

export type NotebookStudyAction = {
  icon: "school-outline" | "checkbox-outline" | "flask-outline" | "key-outline";
  label: string;
  question: string;
};
const QUIZ: NotebookStudyAction = {
  icon: "school-outline",
  label: "Quiz me",
  question: "Quiz me on these notes",
};
const KEY_POINTS: NotebookStudyAction = {
  icon: "key-outline",
  label: "Key points",
  question: "Find the most important points in my notes",
};
const LEGACY_STUDY_ACTIONS: Partial<Record<VoticPurpose, NotebookStudyAction>> = {
  learning: QUIZ,
  work: {
    icon: "checkbox-outline",
    label: "Action items",
    question: "Find the action items and decisions in my notes",
  },
};

/** The notebook's third action, and whether its Explain button says "Explain key ideas". */
export function notebook_actions(
  answers: PersonalizationAnswers | null | undefined,
  purpose: VoticPurpose | null,
) {
  if (!answers || !has_suggestion_preferences(answers))
    return {
      studyAction: (purpose && LEGACY_STUDY_ACTIONS[purpose]) || KEY_POINTS,
      explainLabel: purpose === "learning" ? "Explain key ideas" : "Explain",
    };
  // No personalization answer asks for quizzes, action items, or findings, so the study action is the
  // default "Key points". The Explain button says what it does for people who asked for explanations.
  const wantsExplaining = answers.goals.includes("explain-difficult") || wants_simple_explanations(answers);
  return { studyAction: KEY_POINTS, explainLabel: wantsExplaining ? "Explain key ideas" : "Explain" };
}

/** The explanation style sent with Ask Votic questions; "adaptive" (the default) adds no instruction. */
export function explanation_style_to_send(
  answers: PersonalizationAnswers | null | undefined,
): Exclude<ExplanationStyle, "adaptive"> | undefined {
  const style = answers?.explanationStyle;
  return style && style !== "adaptive" ? style : undefined;
}

/** The extra argument for askVotic: the style when there is one, nothing otherwise (so calls stay unchanged). */
export function explanation_style_args(answers: PersonalizationAnswers | null | undefined) {
  const style = explanation_style_to_send(answers);
  return style ? ([style] as const) : ([] as const);
}
