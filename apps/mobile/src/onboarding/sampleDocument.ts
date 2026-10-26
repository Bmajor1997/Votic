import type { ExplanationStyle, VoticPurpose } from "../personalization/PurposeProvider";

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

/** Written examples of the same passage, never an AI request or a saved user document. */
const SIMPLE_ANSWERS: Record<VoticPurpose | "default", string> = {
  default: "A little reading or listening each day gives you space for new ideas.",
  learning:
    "Plants use sunlight, water, and a gas called carbon dioxide to make sugar. They also give off oxygen.",
  work: "The team needs to choose whether to get more help with support by Friday.",
  research: "The people who slept after learning remembered more words the next day.",
  personal: "Mara counts the lighthouse flashes each night to help her fall asleep.",
  accessibility: "Make the text bigger, spread it out, or listen to it. Choose what helps you read.",
};
export function sample_explanation(purpose: VoticPurpose | null, style: ExplanationStyle) {
  const sample = PREVIEW_SAMPLES[purpose ?? "default"];
  if (style === "simple") return SIMPLE_ANSWERS[purpose ?? "default"];
  if (style === "detailed") return `${sample.answer} The passage supports this with: “${sample.text}”`;
  return sample.answer;
}
