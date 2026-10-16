import { useLocalSearchParams } from "expo-router";
import { SettingsDetailScreen } from "../../src/settings/SettingsDetails";
import { is_settings_category } from "../../src/settings/SettingsNavigation";

export default function SettingsDetailRoute() {
  const { category } = useLocalSearchParams<{ category: string }>();
  return <SettingsDetailScreen category={is_settings_category(category) ? category : null} />;
}
