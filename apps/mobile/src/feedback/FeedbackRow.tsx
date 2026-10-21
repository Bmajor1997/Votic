import { router } from "expo-router";
import { SettingsRow } from "../settings/SettingsNavigation";

export function FeedbackRow({ separated = false }: { separated?: boolean }) {
  return (
    <SettingsRow
      label="Feedback"
      detail="Suggest a feature or report a bug privately."
      hint="Opens native Votic feedback options"
      icon="chatbubble-ellipses-outline"
      separated={separated}
      onPress={() => router.push("/feedback")}
    />
  );
}
