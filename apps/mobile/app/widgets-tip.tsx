import { router } from "expo-router";
import { useAccountSetup } from "../src/onboarding/AccountSetupProvider";
import { HomeScreenWidgetsIntro } from "../src/onboarding/HomeScreenWidgetsIntro";

/** Shown once after the first document (no longer during setup): the Home Screen widgets, then back to the app. */
export default function WidgetsTip() {
  const { complete_widgets_intro } = useAccountSetup();
  return (
    <HomeScreenWidgetsIntro
      mode="later"
      onDone={() => {
        complete_widgets_intro();
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)");
      }}
    />
  );
}
