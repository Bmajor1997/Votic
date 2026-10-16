import { PersonalizationQuestions } from "../src/onboarding/PersonalizationQuestions";

/**
 * First-time setup: four quick questions, one per screen. Choices apply straight away and are saved with this
 * account's setup, so closing Votic mid-way resumes on the same question. Finishing (or skipping) leads on to
 * Votic Premium, then the Home Screen widgets and "Votic is ready for you".
 */
export default function Personalize() {
  return <PersonalizationQuestions mode="setup" />;
}
