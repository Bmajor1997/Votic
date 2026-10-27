import { AiUsageSettings } from "../src/settings/AiUsageSettings";
import { SettingsPage } from "../src/settings/SettingsNavigation";

export default function AiUsageScreen() {
  return (
    <SettingsPage title="AI Credits & Usage">
      <AiUsageSettings />
    </SettingsPage>
  );
}
