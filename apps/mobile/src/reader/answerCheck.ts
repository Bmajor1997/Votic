/**
 * The on-device part of Check my understanding. It compares an answer with the passage it is about, and is
 * deliberately honest about what wording alone can show:
 *
 * - "insufficient": too little to compare yet.
 * - "check-detail": the answer states something the passage does not support: a number it never mentions, a
 *   "not"/"never" it does not say, or the opposite of one of its words ("decreases" for "increases"). This is the
 *   strict case: matching other words never outweighs a claim that contradicts the passage.
 * - "matches": the answer shares most of the passage's key ideas (word forms and small typos count).
 * - "partial": it shares some key ideas; feedback names the ones it could not find.
 * - "unconfirmed": little shared wording. A correct answer in someone's own words can look like this, so Votic
 *   says it couldn't confirm the answer instead of calling it incomplete or wrong.
 *
 * Judging meaning beyond wording needs a model grounded in the passage; this check never claims to have done that.
 */

export type AnswerCheckLevel = "insufficient" | "check-detail" | "matches" | "partial" | "unconfirmed";
export type AnswerCheck = {
  level: AnswerCheckLevel;
  /** A short label for the result, such as "Matches the passage". */
  title: string;
  feedback: string;
  /** Key passage words the answer did not mention, most important first (at most three). */
  missing: string[];
};

/** Fewer content words than this is too little to compare. */
const MIN_CONTENT_WORDS = 3;
/**
 * How many of a passage's key words are counted. A short passage counts all of them; a long one doesn't expect a
 * summary to repeat every word.
 */
const KEY_TERM_TARGET = 12;
/** Share of those key words an answer needs to match the passage, or to partly match it. */
const MATCH_SHARE = 0.5;
const PARTIAL_SHARE = 0.2;
/** Words this long or longer tolerate one typo ("photosynthsis"). */
const TYPO_MIN_LENGTH = 6;

const STOP_WORDS = new Set(
  (
    "a an and are as at be been being but by can could did do does for from had has have he her his how i if in into " +
    "is it its it's just me more most my of on one or our over she so some such than that the their them then there " +
    "these they this those through to too up us very was we were what when where which while who why will with " +
    "would you your about also because each like many may might must only other own same should what's main point " +
    "part passage text says say said idea ideas important detail details"
  ).split(" "),
);
const NEGATIONS = new Set(["not", "never", "no", "none", "cannot", "without", "neither", "nor"]);
/** Common opposites. Saying one when the passage says the other is a contradiction, not a paraphrase. */
const OPPOSITES: [string, string][] = [
  ["increase", "decrease"],
  ["rise", "fall"],
  ["higher", "lower"],
  ["larger", "smaller"],
  ["absorb", "reflect"],
  ["accept", "reject"],
  ["allow", "prevent"],
  ["gain", "lose"],
  ["positive", "negative"],
  ["true", "false"],
  ["strong", "weak"],
  ["early", "late"],
];

function tokens(text: string) {
  return (
    text
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLocaleLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/n't\b/g, " not")
      .match(/[\p{L}\p{N}]+(?:'[\p{L}]+)?/gu) || []
  );
}

/** A light English stem, so "converts", "converted", and "converting" match. Short words are left as they are. */
function stem(word: string) {
  const base = word.replace(/'s$/, "");
  if (base.length <= 4) return base;
  for (const [suffix, replacement] of [
    ["ational", "ate"],
    ["ization", "ize"],
    ["ations", "ate"],
    ["ation", "ate"],
    ["ments", ""],
    ["ment", ""],
    ["ness", ""],
    ["ings", ""],
    ["ing", ""],
    ["ies", "y"],
    ["ied", "y"],
    ["edly", ""],
    ["ed", ""],
    ["es", ""],
    ["ly", ""],
    ["s", ""],
  ] as const)
    if (base.endsWith(suffix) && base.length - suffix.length >= 3)
      return base.slice(0, base.length - suffix.length) + replacement;
  return base;
}

function within_one_edit(a: string, b: string) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < TYPO_MIN_LENGTH || Math.abs(a.length - b.length) > 1) return false;
  let i = 0,
    j = 0,
    edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function content_terms(text: string) {
  const terms: { stem: string; word: string }[] = [];
  const seen = new Set<string>();
  for (const word of tokens(text)) {
    if (STOP_WORDS.has(word) || NEGATIONS.has(word) || /^\d/.test(word)) continue;
    const key = stem(word);
    if (key.length < 3 || seen.has(key)) continue;
    seen.add(key);
    terms.push({ stem: key, word });
  }
  return terms;
}

const NUMBER_WORDS =
  "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty".split(
    " ",
  );
/** Standalone numbers written as digits, so "CO2" is not read as 2 and "2,000" equals "2000". */
const digits = (text: string) =>
  new Set(
    (text.match(/(?<![\p{L}\p{N}])\d[\d,]*(?:\.\d+)?(?![\p{L}\p{N}])/gu) ?? []).map((n) =>
      n.replace(/,/g, ""),
    ),
  );

/** A claim the passage does not support, explained in a sentence, or null when none was found. */
function unsupported_claim(answer: string, source: string): string | null {
  // A passage's "seven" supports an answer's "7". Only digits the answer writes are checked.
  const sourceNumbers = digits(source);
  for (const word of tokens(source))
    if (NUMBER_WORDS.includes(word)) sourceNumbers.add(String(NUMBER_WORDS.indexOf(word)));
  const extra = [...digits(answer)].find((value) => !sourceNumbers.has(value));
  if (extra) return `The passage doesn't mention ${extra}. Check that number against the passage.`;
  const answerWords = new Set(tokens(answer));
  const sourceWords = new Set(tokens(source));
  const negation = [...answerWords].find((word) => NEGATIONS.has(word) && !sourceWords.has(word));
  if (negation)
    return `Your answer says "${negation}", which the passage doesn't. Check whether it says this or the opposite.`;
  const answerStems = new Set([...answerWords].map(stem));
  const sourceStems = new Set([...sourceWords].map(stem));
  for (const [a, b] of OPPOSITES) {
    const [sa, sb] = [stem(a), stem(b)];
    if (answerStems.has(sa) && sourceStems.has(sb) && !sourceStems.has(sa))
      return `Your answer says "${a}" where the passage says "${b}". Check which one the passage means.`;
    if (answerStems.has(sb) && sourceStems.has(sa) && !sourceStems.has(sb))
      return `Your answer says "${b}" where the passage says "${a}". Check which one the passage means.`;
  }
  return null;
}

export function check_answer(answer: string, source: string): AnswerCheck {
  const answerTerms = content_terms(answer);
  if (answer.trim().length < 20 || answerTerms.length < MIN_CONTENT_WORDS)
    return {
      level: "insufficient",
      title: "Add a little more",
      feedback: "Write a sentence or two in your own words, then check again.",
      missing: [],
    };
  const claim = unsupported_claim(answer, source);
  if (claim) return { level: "check-detail", title: "Check one detail", feedback: claim, missing: [] };

  const keyTerms = content_terms(source);
  const found = (term: { stem: string }) => answerTerms.some((a) => within_one_edit(a.stem, term.stem));
  const matched = keyTerms.filter(found);
  const missing = keyTerms
    .filter((term) => !found(term))
    .slice(0, 3)
    .map((term) => term.word);
  const expected = Math.min(keyTerms.length, KEY_TERM_TARGET);
  const share = expected ? Math.min(1, matched.length / expected) : 0;
  if (share >= MATCH_SHARE)
    return {
      level: "matches",
      title: "Matches the passage",
      feedback: missing.length
        ? `Your answer covers the main ideas here. For an even fuller answer, you could mention ${list(missing)}.`
        : "Your answer covers the main ideas in this passage.",
      missing,
    };
  if (share >= PARTIAL_SHARE)
    return {
      level: "partial",
      title: "Partly matches",
      feedback: `You have part of it. The passage also talks about ${list(missing)}. Does your answer cover that?`,
      missing,
    };
  return {
    level: "unconfirmed",
    title: "Compare with the passage",
    feedback:
      "Votic couldn't match your wording to the passage. If your answer says the same thing in your own words, you've got it. Compare it with the passage below.",
    missing,
  };
}

function list(words: string[]) {
  const quoted = words.map((word) => `“${word}”`);
  return quoted.length > 1 ? `${quoted.slice(0, -1).join(", ")} and ${quoted.at(-1)}` : (quoted[0] ?? "");
}
