import { router } from "expo-router";
import { HomeScreenWidgetsIntro } from "../src/onboarding/HomeScreenWidgetsIntro";

/** Settings → Help → Home Screen widgets: the same explanation as during setup, any time. */
export default function HomeScreenWidgets() {
  return (
    <HomeScreenWidgetsIntro
      mode="settings"
      onDone={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/settings"))}
    />
  );
}
