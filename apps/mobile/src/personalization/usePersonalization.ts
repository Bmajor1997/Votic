import { useAccountSetup } from "../onboarding/AccountSetupProvider";
import { useVoticPurpose } from "./PurposeProvider";

/**
 * The personalization answers of the signed-in account, plus the purpose chosen in earlier versions.
 * Suggestions use the answers first and fall back to the purpose (see suggestions.ts).
 */
export function usePersonalization() {
  const { setup } = useAccountSetup();
  const { purpose } = useVoticPurpose();
  return { answers: setup?.answers ?? null, purpose };
}
