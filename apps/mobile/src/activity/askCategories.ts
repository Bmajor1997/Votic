/**
 * Ask Votic question types for Statistics. Classification happens on the device with simple,
 * documented word rules; the question text itself is never stored or sent anywhere for this.
 */
export type AskCategory = "summary" | "explanation" | "comparison" | "definition" | "other";

export const ASK_CATEGORY_LABELS: Record<AskCategory, string> = {
  summary: "Summaries",
  explanation: "Explanations",
  comparison: "Comparisons",
  definition: "Definitions",
  other: "Other questions",
};

const RULES: [AskCategory, RegExp][] = [
  ["comparison", /\b(compare|comparison|contrast|difference|differences|differ|versus|vs\.?)\b/i],
  ["summary", /\b(summar\w*|recap|overview|tl;?dr|key (points|ideas|takeaways)|main (points|ideas))\b/i],
  ["definition", /\b(define|definition|meaning of|what does .{1,40} mean)\b/i],
  [
    "explanation",
    /\b(explain\w*|why|how (does|do|did|is|are|can)|help me understand|clarify|walk me through)\b/i,
  ],
];

/**
 * What Statistics keeps about one question: when, its type, whether it began a conversation, and
 * the suggestion's label if a built-in suggestion was used exactly. Typed text is not kept.
 */
export function askEventFor(
  question: string,
  options: { newConversation: boolean; builtInPrompts?: string[]; at?: number },
) {
  const text = question.trim();
  return {
    at: options.at ?? Date.now(),
    category: categorizeQuestion(text),
    newConversation: options.newConversation,
    ...(options.builtInPrompts?.includes(text) ? { prompt: text } : {}),
  };
}

/** The first matching type in a fixed order; anything else is "Other questions". */
export function categorizeQuestion(question: string): AskCategory {
  const text = question.trim();
  for (const [category, rule] of RULES) if (rule.test(text)) return category;
  // A short "What is X?" asks for a definition; longer "what is" questions stay uncategorized.
  if (/^what (is|are) (a |an |the )?[\w'’ -]{1,40}\?*$/i.test(text) && text.split(/\s+/).length <= 6)
    return "definition";
  return "other";
}
