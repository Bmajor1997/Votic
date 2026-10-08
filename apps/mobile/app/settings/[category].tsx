import { useLocalSearchParams } from "expo-router";
import { SettingsDetailScreen } from "../../src/settings/SettingsDetails";
import { isSettingsCategory } from "../../src/settings/SettingsNavigation";

export default function SettingsDetailRoute() {
  const { category } = useLocalSearchParams<{ category: string }>();
  return <SettingsDetailScreen category={isSettingsCategory(category) ? category : null} />;
}
