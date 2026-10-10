import { router } from "expo-router";
import { AccountSettings } from "../src/settings/AccountSettings";
import { SettingsPage } from "../src/settings/SettingsNavigation";

/** Account deletion and store membership management stay available regardless of Premium or setup. */
export default function AccountManagement() {
  return (
    <SettingsPage
      title="Account & Membership"
      backLabel="Back to Votic"
      backHint="Returns to Votic without changing your account"
      onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
    >
      <AccountSettings />
    </SettingsPage>
  );
}
