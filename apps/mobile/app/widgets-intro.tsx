import { useAccountSetup } from "../src/onboarding/AccountSetupProvider";
import { HomeScreenWidgetsIntro } from "../src/onboarding/HomeScreenWidgetsIntro";

/** Setup: tells people about the Home Screen widgets, then moves on to "Votic is ready for you". */
export default function WidgetsIntro() {
  const { complete_widgets_intro } = useAccountSetup();
  return <HomeScreenWidgetsIntro mode="setup" onDone={complete_widgets_intro} />;
}
