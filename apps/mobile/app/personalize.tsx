import { PersonalizationFlow } from "../src/onboarding/PersonalizationFlow";

/** First-time setup: the five personalization questions. Finishing or skipping them leads to the paywall. */
export default function Personalize() {
  return <PersonalizationFlow mode="onboarding" />;
}
