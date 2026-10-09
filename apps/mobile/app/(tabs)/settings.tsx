import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ComponentProps } from "react";
import { StyleSheet, Text } from "react-native";
import { useAccessibilityPreferences } from "../../src/accessibility/AccessibilityProvider";
import { useAuth } from "../../src/auth/AuthProvider";
import { Screen } from "../../src/components/Screen";
import { typography } from "../../src/design/tokens";
import { EXPLANATION_STYLES, PURPOSES, useVoticPurpose } from "../../src/personalization/PurposeProvider";
import {
  SETTINGS_CATEGORIES,
  SettingsCategory,
  SettingsGroup,
  SettingsRow,
} from "../../src/settings/SettingsNavigation";
import { useVoticTheme } from "../../src/theme/ThemeProvider";

export default function Settings() {
  const { theme, appearanceMode, accentName } = useVoticTheme();
  const preferences = useAccessibilityPreferences();
  const personalization = useVoticPurpose();
  const auth = useAuth();
  const purpose =
    PURPOSES.find((item) => item.value === personalization.purpose)?.label ?? "Choose your focus";
  const explanation = EXPLANATION_STYLES.find(
    (item) => item.value === personalization.explanationStyle,
  )?.label;
  function category(
    key: SettingsCategory,
    detail: string,
    icon: ComponentProps<typeof Ionicons>["name"],
    separated = false,
  ) {
    return (
      <SettingsRow
        label={SETTINGS_CATEGORIES[key]}
        detail={detail}
        icon={icon}
        separated={separated}
        hint={`Opens ${SETTINGS_CATEGORIES[key]} settings`}
        onPress={() => router.push({ pathname: "/settings/[category]", params: { category: key } })}
      />
    );
  }
  return (
    <Screen title="Settings">
      <Text style={[s.intro, { color: theme.mutedText }]}>Make Votic feel right for you.</Text>
      <SettingsGroup>
        {category(
          "account",
          auth.user?.email ??
            auth.user?.displayName ??
            (auth.user ? "Your session and membership options" : "Membership and account access"),
          "person-outline",
        )}
      </SettingsGroup>
      <SettingsGroup title="YOUR PREFERENCES">
        {category(
          "appearance",
          `${appearanceMode[0].toUpperCase() + appearanceMode.slice(1)} mode · ${accentName[0].toUpperCase() + accentName.slice(1)} accent`,
          "color-palette-outline",
        )}
        {category(
          "reading",
          `${preferences.textSize === "extra-large" ? "Extra large" : preferences.textSize[0].toUpperCase() + preferences.textSize.slice(1)} text · Reading layout and spoken words`,
          "book-outline",
          true,
        )}
        {category(
          "accessibility",
          preferences.reduceMotion ? "Reduce motion is on" : "Motion preferences",
          "accessibility-outline",
          true,
        )}
        {category("personalization", `${purpose} · ${explanation}`, "options-outline", true)}
      </SettingsGroup>
      <SettingsGroup title="SUPPORT & ACTIVITY">
        {category("help", "Getting started tips and activity insights", "help-circle-outline")}
      </SettingsGroup>
    </Screen>
  );
}
const s = StyleSheet.create({ intro: { ...typography.body, fontSize: 16 } });
