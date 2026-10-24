import { router } from "expo-router";
import { Screen } from "../src/components/Screen";
import { SecondaryButton } from "../src/onboarding/components";
import { UpgradeOptions } from "../src/subscription/UpgradeOptions";

export default function SubscriptionScreen() {
  return (
    <Screen title="Subscription options">
      <SecondaryButton label="Back" onPress={() => router.back()} />
      <UpgradeOptions />
    </Screen>
  );
}
