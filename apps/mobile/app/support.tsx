import { SettingsPage } from "../src/settings/SettingsNavigation";
import { SupportSettings } from "../src/settings/SupportSettings";

export default function Support() {
  return (
    <SettingsPage title="Contact support" backLabel="Back" backHint="Returns to the previous screen">
      <SupportSettings />
    </SettingsPage>
  );
}
