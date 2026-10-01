import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useAuth } from "../../src/auth/AuthProvider";
import { authErrorMessage } from "../../src/auth/authErrors";
import { OptionRow } from "../../src/onboarding/components";
import { useOnboarding } from "../../src/onboarding/OnboardingProvider";
import { EXPLANATION_STYLES, PURPOSES, useVoticPurpose } from "../../src/personalization/PurposeProvider";
import { Screen } from "../../src/components/Screen";
import { spacing, typography } from "../../src/design/tokens";
import {
  TextSize,
  ReadingSpacing,
  useAccessibilityPreferences,
} from "../../src/accessibility/AccessibilityProvider";
import { accentColors, AccentName, AppearanceMode, useVoticTheme } from "../../src/theme/ThemeProvider";
const colors: AccentName[] = [
  "orange",
  "blue",
  "purple",
  "red",
  "teal",
  "emerald",
  "indigo",
  "rose",
  "amber",
];
const appearances: AppearanceMode[] = ["light", "dark", "system"];
const textSizes: TextSize[] = ["default", "large", "extra-large"];
const spacings: ReadingSpacing[] = ["compact", "default", "extra"];
export default function Settings() {
  const { accentName, setAccentName, appearanceMode, setAppearanceMode, theme } = useVoticTheme();
  const a = useAccessibilityPreferences();
  const onboarding = useOnboarding();
  const personalization = useVoticPurpose();
  const auth = useAuth();
  const [tipsReset, setTipsReset] = useState(false);
  function confirmSignOut() {
    Alert.alert("Sign out of Votic?", "Your documents and notes stay on this device.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", onPress: () => void auth.signOut() },
    ]);
  }
  function confirmDelete() {
    Alert.alert(
      "Delete your Votic account?",
      "This permanently deletes your account. Documents and notes on this device are not removed. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () =>
            void auth
              .deleteAccount()
              .catch((error) => Alert.alert("Couldn't delete account", authErrorMessage(error))),
        },
      ],
    );
  }
  const segmented = (
    values: string[],
    selected: string,
    onSelect: (v: any) => void,
    label: (v: string) => string = (v) => v,
  ) => (
    <View style={[s.segmented, { backgroundColor: theme.surfaceMuted }]}>
      {values.map((v) => (
        <Pressable
          key={v}
          accessibilityRole="radio"
          accessibilityState={{ checked: selected === v }}
          onPress={() => onSelect(v)}
          style={[s.segment, selected === v && { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Text style={[s.segmentText, { color: selected === v ? theme.text : theme.mutedText }]}>
            {label(v)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
  return (
    <Screen title="Settings">
      <View style={s.section}>
        <Text style={[s.h, { color: theme.text }]}>Appearance</Text>
        <Text style={[s.label, { color: theme.mutedText }]}>MODE</Text>
        {segmented(appearances, appearanceMode, setAppearanceMode, (v) => v[0].toUpperCase() + v.slice(1))}
      </View>
      <View style={[s.divider, { backgroundColor: theme.border }]} />
      <View style={s.section}>
        <Text style={[s.h, { color: theme.text }]}>Accent</Text>
        <Text style={[s.body, { color: theme.mutedText }]}>
          Used for active controls, progress, and reading highlights.
        </Text>
        <View style={s.swatches}>
          {colors.map((v) => (
            <Pressable
              key={v}
              accessibilityRole="radio"
              accessibilityState={{ checked: accentName === v }}
              accessibilityLabel={v + " accent color"}
              onPress={() => setAccentName(v)}
              style={[s.swatchTouch, accentName === v && { borderColor: theme.text }]}
            >
              <View style={[s.swatch, { backgroundColor: accentColors[v], borderColor: accentColors[v] }]}>
                {accentName === v ? <Text style={s.swatchCheck}>✓</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={[s.divider, { backgroundColor: theme.border }]} />
      <View style={s.section}>
        <Text style={[s.h, { color: theme.text }]}>Reading</Text>
        <Text style={[s.label, { color: theme.mutedText }]}>TEXT SIZE</Text>
        {segmented(textSizes, a.textSize, a.setTextSize, (v) =>
          v === "extra-large" ? "Extra large" : v[0].toUpperCase() + v.slice(1),
        )}
        <Text style={[s.label, { color: theme.mutedText }]}>SPACING</Text>
        {segmented(spacings, a.readingSpacing, a.setReadingSpacing, (v) =>
          v === "extra" ? "Extra" : v === "compact" ? "Compact" : "Default",
        )}
        <View style={[s.settingRow, { borderTopColor: theme.border }]}>
          <View style={s.settingCopy}>
            <Text style={[s.settingTitle, { color: theme.text }]}>Reduce motion</Text>
            <Text style={[s.settingDetail, { color: theme.mutedText }]}>
              Minimize Reader and sheet animations.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Reduce motion"
            value={a.reduceMotion}
            onValueChange={a.setReduceMotion}
          />
        </View>
        <View style={[s.settingRow, { borderTopColor: theme.border }]}>
          <View style={s.settingCopy}>
            <Text style={[s.settingTitle, { color: theme.text }]}>Emphasize current word</Text>
            <Text style={[s.settingDetail, { color: theme.mutedText }]}>
              Make the spoken word slightly larger and bolder.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Emphasize current word"
            value={a.wordEmphasis}
            onValueChange={a.setWordEmphasis}
          />
        </View>
      </View>
      <View style={[s.divider, { backgroundColor: theme.border }]} />
      <View style={s.section}>
        <Text style={[s.h, { color: theme.text }]}>Personalization</Text>
        <Text style={[s.label, { color: theme.mutedText }]}>VOTIC HELPS YOU WITH</Text>
        <View accessibilityRole="radiogroup" style={s.purposes}>
          {PURPOSES.map((item) => (
            <OptionRow
              key={item.value}
              label={item.label}
              detail={item.detail}
              icon={item.icon}
              selected={personalization.purpose === item.value}
              onPress={() => personalization.setPurpose(item.value)}
            />
          ))}
        </View>
        <Text style={[s.label, { color: theme.mutedText }]}>EXPLANATIONS</Text>
        {segmented(
          EXPLANATION_STYLES.map((item) => item.value),
          personalization.explanationStyle,
          personalization.setExplanationStyle,
          (v) => (v === "adaptive" ? "Adapt" : v[0].toUpperCase() + v.slice(1)),
        )}
      </View>
      <View style={[s.divider, { backgroundColor: theme.border }]} />
      <View style={s.section}>
        <Text style={[s.h, { color: theme.text }]}>Help</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show tips again"
          accessibilityHint="Brings back the Getting Started checklist and the Reader tips"
          onPress={() => {
            onboarding.showTipsAgain();
            setTipsReset(true);
          }}
          style={[s.tourButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
        >
          <Ionicons name="bulb-outline" size={22} color={theme.accent} />
          <View style={s.settingCopy}>
            <Text style={[s.settingTitle, { color: theme.text }]}>Show tips again</Text>
            <Text accessibilityLiveRegion="polite" style={[s.settingDetail, { color: theme.mutedText }]}>
              {tipsReset
                ? "Done. Tips will appear on Home and in the Reader."
                : "Bring back the Getting Started checklist and Reader tips."}
            </Text>
          </View>
        </Pressable>
      </View>
      <View style={[s.divider, { backgroundColor: theme.border }]} />
      <View style={s.section}>
        <Text style={[s.h, { color: theme.text }]}>Account</Text>
        {auth.user?.email ? (
          <Text style={[s.body, { color: theme.mutedText }]}>Signed in as {auth.user.email}</Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={confirmSignOut}
          style={[s.accountButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
        >
          <Ionicons name="log-out-outline" size={22} color={theme.text} />
          <Text style={[s.settingTitle, { color: theme.text }]}>Sign out</Text>
        </Pressable>
        {auth.configured ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete account"
            onPress={confirmDelete}
            style={[s.accountButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
          >
            <Ionicons name="trash-outline" size={22} color="#DC2626" />
            <Text style={[s.settingTitle, { color: "#DC2626" }]}>Delete account</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}
const s = StyleSheet.create({
  section: { gap: spacing.md },
  h: { ...typography.sectionTitle },
  body: { ...typography.body },
  label: { ...typography.eyebrow, marginTop: spacing.xs },
  divider: { height: 1, marginVertical: spacing.xs },
  segmented: { flexDirection: "row", padding: 3, borderRadius: 12, gap: 2 },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  segmentText: { fontSize: 14, fontWeight: "700", textTransform: "capitalize" },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  swatchTouch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchCheck: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", lineHeight: 18 },
  settingRow: {
    minHeight: 68,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  tourButton: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  purposes: { gap: spacing.sm },
  accountButton: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  settingCopy: { flex: 1, gap: 3 },
  settingTitle: { fontSize: 16, fontWeight: "700" },
  settingDetail: { fontSize: 13, lineHeight: 18 },
});
