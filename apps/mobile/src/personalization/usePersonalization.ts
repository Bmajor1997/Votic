import { useAccount } from "../onboarding/AccountProvider";
import { useVoticPurpose } from "./PurposeProvider";

/**
 * The personalization answers of the signed-in account, plus the legacy purpose from before accounts.
 * Suggestions use the answers first and fall back to the purpose (see suggestions.ts).
 */
export function usePersonalization() {
  const { onboarding } = useAccount();
  const { purpose } = useVoticPurpose();
  return { answers: onboarding?.answers ?? null, purpose };
}
