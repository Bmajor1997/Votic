import { Text } from "react-native";
import { DiagnosticsSettings } from "./DiagnosticsSettings";
import { PolicyLinks } from "./PolicyLinks";
import { useVoticTheme } from "../theme/ThemeProvider";

export function PrivacySettings() {
  const { theme } = useVoticTheme();
  return (
    <>
      <Text style={{ color: theme.mutedText, fontSize: 15, lineHeight: 23 }}>
        Read Votic&apos;s policies and choose whether to share optional failure counts. Account deletion is
        available in Account &amp; Membership.
      </Text>
      <PolicyLinks />
      <DiagnosticsSettings />
    </>
  );
}
