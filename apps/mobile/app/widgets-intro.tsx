import { useAccountSetup } from "../src/onboarding/AccountSetupProvider";
import { HomeScreenWidgetsIntro } from "../src/onboarding/HomeScreenWidgetsIntro";

/** Setup: tells people about the Home Screen widgets, then moves on to "Votic is ready for you". */
export default function WidgetsIntro() {
  const { completeWidgetsIntro } = useAccountSetup();
  return <HomeScreenWidgetsIntro mode="setup" onDone={completeWidgetsIntro} />;
}
