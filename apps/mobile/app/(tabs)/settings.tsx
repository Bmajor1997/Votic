import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { spacing, typography } from "../../src/design/tokens";
import {
  TextSize,
  ReadingSpacing,
  useAccessibilityPreferences,
} from "../../src/accessibility/AccessibilityProvider";
import { accentColors, AccentName, AppearanceMode, useVoticTheme } from "../../src/theme/ThemeProvider";
import { AccountSettings } from "../../src/onboarding/components/AccountSettings";
import { useAccount } from "../../src/onboarding/AccountProvider";
import { LearnVoticSettings } from "../../src/walkthrough/LearnVoticSettings";
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
  const { user } = useAccount();
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
      {user ? (
        <>
          <AccountSettings />
          <View style={[s.divider, { backgroundColor: theme.border }]} />
        </>
      ) : null}
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
        <Text style={[s.h, { color: theme.text }]}>Help</Text>
        <LearnVoticSettings />
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
  settingCopy: { flex: 1, gap: 3 },
  settingTitle: { fontSize: 16, fontWeight: "700" },
  settingDetail: { fontSize: 13, lineHeight: 18 },
});
