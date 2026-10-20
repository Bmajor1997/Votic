import type { AnswerCheckLevel } from "./answerCheck";

/**
 * A fixed set of answers to Check my understanding, labelled with the rubric a careful human grader would use. It
 * is the regression set for answer checking: the on-device check and any future model-based grader are measured
 * against the same cases, so changes in strictness are visible rather than anecdotal.
 */
export type GradedCategory =
  | "correct-paraphrase"
  | "mostly-correct"
  | "partially-correct"
  | "contradiction"
  | "unsupported"
  | "insufficient";

export type GradedAnswer = {
  id: string;
  passage: string;
  answer: string;
  category: GradedCategory;
  /** A correct answer sharing little wording with the passage: the case the old "start of it" feedback got wrong. */
  ownWords?: boolean;
};

const PHOTOSYNTHESIS =
  "Photosynthesis lets plants convert sunlight into chemical energy. Chlorophyll in the leaves absorbs light, and the plant uses that energy to turn water and carbon dioxide into glucose, releasing oxygen.";
const SLEEP =
  "Adults who sleep fewer than 7 hours a night show slower reaction times and weaker memory consolidation, according to the study of 2,000 participants.";
const ROME =
  "The Roman Republic gave way to the Empire after Julius Caesar's assassination in 44 BC, when Augustus consolidated power and became the first emperor.";
const INTEREST =
  "When the central bank raises interest rates, borrowing becomes more expensive, so consumer spending tends to decrease and inflation slows.";
const SCHEDULE =
  "During the first 25 days, new staff complete safety training in week one, shadow a mentor in weeks two and three, and lead a supervised shift by day 25.";

export const GRADED_ANSWERS: GradedAnswer[] = [
  // Accurate restatements, including different word forms and a harmless typo.
  {
    id: "photo-paraphrase",
    passage: PHOTOSYNTHESIS,
    category: "correct-paraphrase",
    answer:
      "Plants convert sunlight into chemical energy: chlorophyll absorbs the light and they turn water and carbon dioxide into glucose, giving off oxygen.",
  },
  {
    id: "photo-typo",
    passage: PHOTOSYNTHESIS,
    category: "correct-paraphrase",
    answer:
      "Photosynthsis is how plants converting sunlight to chemical energy, using chlorophyll to absorb light and make glucose.",
  },
  {
    id: "sleep-paraphrase",
    passage: SLEEP,
    category: "correct-paraphrase",
    answer:
      "Adults sleeping under 7 hours had slower reactions and weaker memory, based on a study of 2,000 participants.",
  },
  {
    id: "rome-paraphrase",
    passage: ROME,
    category: "correct-paraphrase",
    answer:
      "After Caesar was assassinated in 44 BC, Augustus consolidated power, ending the Republic and becoming the first Roman emperor.",
  },
  {
    id: "interest-paraphrase",
    passage: INTEREST,
    category: "correct-paraphrase",
    answer:
      "Higher interest rates make borrowing expensive, so consumer spending decreases and inflation slows down.",
  },
  {
    id: "schedule-paraphrase",
    passage: SCHEDULE,
    category: "correct-paraphrase",
    answer:
      "New staff do safety training first, then shadow a mentor, and by day 25 they lead a supervised shift.",
  },
  // Accurate, but in the reader's own words, sharing little wording with the passage.
  {
    id: "photo-own-words",
    passage: PHOTOSYNTHESIS,
    category: "correct-paraphrase",
    ownWords: true,
    answer:
      "Green plants use the sun's rays to make their own food, sugar, out of water and CO2, and they give off O2.",
  },
  {
    id: "sleep-own-words",
    passage: SLEEP,
    category: "correct-paraphrase",
    ownWords: true,
    answer:
      "If grown-ups get less than seven hours of rest, they react more slowly and remember things worse.",
  },
  {
    id: "interest-own-words",
    passage: INTEREST,
    category: "correct-paraphrase",
    ownWords: true,
    answer: "Rate hikes make loans pricier, so people buy fewer things and prices climb more slowly.",
  },
  // Right main idea, a minor detail left out.
  {
    id: "photo-mostly",
    passage: PHOTOSYNTHESIS,
    category: "mostly-correct",
    answer:
      "Plants use chlorophyll to absorb sunlight and convert it into chemical energy stored as glucose.",
  },
  {
    id: "sleep-mostly",
    passage: SLEEP,
    category: "mostly-correct",
    answer: "Sleeping fewer than 7 hours slows reaction times and weakens memory consolidation in adults.",
  },
  {
    id: "interest-mostly",
    passage: INTEREST,
    category: "mostly-correct",
    answer: "Raising interest rates makes borrowing more expensive and consumer spending decrease.",
  },
  // Some of it, with the main idea incomplete.
  {
    id: "photo-partial",
    passage: PHOTOSYNTHESIS,
    category: "partially-correct",
    answer: "It is about plants and how leaves take in light during the day.",
  },
  {
    id: "rome-partial",
    passage: ROME,
    category: "partially-correct",
    answer: "Julius Caesar was an important Roman leader who was killed.",
  },
  {
    id: "schedule-partial",
    passage: SCHEDULE,
    category: "partially-correct",
    answer: "New staff have to do safety training at the start.",
  },
  // States the opposite of the passage.
  {
    id: "photo-contradiction",
    passage: PHOTOSYNTHESIS,
    category: "contradiction",
    answer: "Chlorophyll reflects light, so plants turn glucose and oxygen into water and carbon dioxide.",
  },
  {
    id: "interest-contradiction",
    passage: INTEREST,
    category: "contradiction",
    answer:
      "When the central bank raises interest rates, consumer spending tends to increase and inflation speeds up.",
  },
  {
    id: "sleep-contradiction",
    passage: SLEEP,
    category: "contradiction",
    answer: "Adults who sleep fewer than 7 hours do not show slower reaction times or weaker memory.",
  },
  // Adds claims the passage does not make.
  {
    id: "sleep-unsupported",
    passage: SLEEP,
    category: "unsupported",
    answer: "Adults who sleep fewer than 5 hours show slower reaction times and weaker memory consolidation.",
  },
  {
    id: "rome-unsupported",
    passage: ROME,
    category: "unsupported",
    answer:
      "Augustus consolidated power in 27 BC after Julius Caesar's assassination and became the first emperor.",
  },
  {
    id: "schedule-unsupported",
    passage: SCHEDULE,
    category: "unsupported",
    answer:
      "New staff complete safety training and lead a supervised shift by day 30 after shadowing a mentor.",
  },
  // Too little to grade.
  { id: "photo-short", passage: PHOTOSYNTHESIS, category: "insufficient", answer: "plants" },
  { id: "rome-short", passage: ROME, category: "insufficient", answer: "Rome stuff." },
  { id: "interest-short", passage: INTEREST, category: "insufficient", answer: "rates and money" },
];

/**
 * What the on-device check may say for each category. It reads wording, not meaning, so a correct paraphrase may be
 * "unconfirmed", but it must never be told it is wrong or only partly right, and a contradiction or unsupported claim
 * must never be told it matches.
 */
export const ALLOWED_LOCAL_LEVELS: Record<GradedCategory, AnswerCheckLevel[]> = {
  "correct-paraphrase": ["matches", "unconfirmed"],
  "mostly-correct": ["matches", "partial", "unconfirmed"],
  "partially-correct": ["partial", "unconfirmed"],
  contradiction: ["check-detail"],
  unsupported: ["check-detail"],
  insufficient: ["insufficient"],
};
