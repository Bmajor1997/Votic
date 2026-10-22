import type { VoticPurpose } from "../personalization/PurposeProvider";
import type { SubscriptionPlan } from "./subscriptionTypes";

export const PAYWALL_GOALS: Record<VoticPurpose | "default", { title: string; detail: string }> = {
  default: {
    title: "Make more of\nwhat you read.",
    detail: "Turn your documents into listening, answers, and ideas that stay with you.",
  },
  learning: {
    title: "Make your next\nstudy session click.",
    detail: "Listen to your material, ask questions, and revisit the ideas that matter.",
  },
  work: {
    title: "Less reading backlog.\nMore clarity.",
    detail: "Listen to reports and find the answers you need in your documents.",
  },
  research: {
    title: "Go deeper.\nFind the thread.",
    detail: "Read papers your way and ask questions grounded in your documents.",
  },
  personal: {
    title: "Your reading.\nAt your rhythm.",
    detail: "Make room for your articles and books, with listening that fits your day.",
  },
  accessibility: {
    title: "Let reading\nwork for you.",
    detail: "Hear the words, follow the highlights, and make the page comfortable.",
  },
};

/**
 * The preview's sample page, matched to what the visitor said Votic should help with. These are written
 * examples, never generated answers or claims about the visitor's own documents.
 */
export type PreviewSample = { title: string; question: string; text: string; answer: string };
export const PREVIEW_SAMPLES: Record<VoticPurpose | "default", PreviewSample> = {
  default: {
    title: "Room for new ideas",
    question: "What's the key idea?",
    text: "Big ideas start with small steps. Read a little, listen a little, and make room for something new.",
    answer: "Small, regular moments of reading and listening can help you explore new ideas.",
  },
  learning: {
    title: "Biology notes: photosynthesis",
    question: "What do plants make in photosynthesis?",
    text: "Plants turn sunlight, water, and carbon dioxide into sugar. They release oxygen as they do it.",
    answer: "Plants make sugar from sunlight, water, and carbon dioxide, and give off oxygen.",
  },
  work: {
    title: "Weekly team update",
    question: "What needs a decision?",
    text: "Sign-ups grew this month, but support replies are slower. We need to decide on extra help by Friday.",
    answer: "The team needs to decide on extra support help by Friday.",
  },
  research: {
    title: "Study summary: sleep and memory",
    question: "What did the study find?",
    text: "People who slept after learning new words remembered more of them the next day than people who stayed awake.",
    answer: "Sleeping after learning helped people remember more new words the next day.",
  },
  personal: {
    title: "The lighthouse",
    question: "What is this passage about?",
    text: "Every night the old lighthouse blinked across the bay, and every night Mara counted the flashes until she fell asleep.",
    answer: "A girl named Mara falls asleep each night counting the lighthouse's flashes.",
  },
  accessibility: {
    title: "A page that fits you",
    question: "What does this page say?",
    text: "Make the words bigger, give them room, and hear them read aloud. Reading can fit the way you read.",
    answer: "You can enlarge text, add spacing, and listen, so reading fits you.",
  },
};

/** Longest text a visitor can paste into the preview: about a paragraph, enough to hear the difference. */
export const MAX_TRY_TEXT = 500;

export type PreviewWord = { text: string; start: number };
export function preview_words(text: string): PreviewWord[] {
  return Array.from(text.matchAll(/\S+/g), (match) => ({ text: match[0], start: match.index }));
}

/** The word a speech-engine boundary (a character offset into the spoken text) falls in. */
export function preview_word_at(words: PreviewWord[], charIndex: number) {
  if (!Number.isFinite(charIndex) || charIndex < 0) return -1;
  return words.findLastIndex((word) => word.start <= charIndex);
}

/** No parsing "$9.99": localized display strings are not safe arithmetic inputs. */
export function annual_value(plan: SubscriptionPlan, plans: SubscriptionPlan[]) {
  if (plan.billingPeriod?.unit !== "year" || plan.billingPeriod.count !== 1) return null;
  const monthly = plans.filter(
    (candidate) => candidate.billingPeriod?.unit === "month" && candidate.billingPeriod.count === 1,
  );
  // Ambiguous product families/tier comparisons must not create a made-up savings badge.
  if (
    monthly.length !== 1 ||
    plans.filter((candidate) => candidate.billingPeriod?.unit === "year").length !== 1
  )
    return null;
  const other = monthly[0];
  if (
    !plan.priceAmount ||
    !other.priceAmount ||
    !Number.isFinite(plan.priceAmount) ||
    !Number.isFinite(other.priceAmount) ||
    plan.priceAmount < 0 ||
    other.priceAmount < 0 ||
    !plan.currencyCode ||
    plan.currencyCode !== other.currencyCode
  )
    return null;
  const savings = Math.floor((1 - plan.priceAmount / (other.priceAmount * 12)) * 100);
  if (savings <= 0 || savings >= 100) return null;
  try {
    const equivalent = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: plan.currencyCode,
    }).format(plan.priceAmount / 12);
    return {
      savings,
      equivalent,
      comparison: `Save ${savings}% compared with 12 monthly payments at regular prices`,
    };
  } catch {
    return null;
  }
}
