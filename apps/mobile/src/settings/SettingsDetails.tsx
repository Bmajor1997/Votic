import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { PropsWithChildren, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import {
  useAccessibilityPreferences,
  ReadingSpacing,
  TextSize,
} from "../accessibility/AccessibilityProvider";
import { controlSizes, radii, spacing, typography } from "../design/tokens";
import { OptionRow } from "../onboarding/components";
import { useOnboarding } from "../onboarding/OnboardingProvider";
import { EXPLANATION_STYLES, PURPOSES, useVoticPurpose } from "../personalization/PurposeProvider";
import { accentColors, AccentName, AppearanceMode, useVoticTheme } from "../theme/ThemeProvider";
import { AccountSettings } from "./AccountSettings";
import {
  SETTINGS_CATEGORIES,
  SettingsCategory,
  SettingsGroup,
  SettingsPage,
  SettingsRow,
} from "./SettingsNavigation";

function Section({ title, detail, children }: PropsWithChildren<{ title: string; detail?: string }>) {
  const { theme } = useVoticTheme();
  return (
    <View style={s.section}>
      <Text accessibilityRole="header" style={[s.heading, { color: theme.text }]}>
        {title}
      </Text>
      {detail ? <Text style={[s.detail, { color: theme.mutedText }]}>{detail}</Text> : null}
      {children}
    </View>
  );
}

function Choices<T extends string>({
  title,
  options,
  selected,
  onSelect,
}: {
  title: string;
  options: { value: T; label: string; accessibleLabel?: string }[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  const { theme } = useVoticTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={title}
      style={[s.choices, { borderColor: theme.border }]}
    >
      {options.map((item, index) => (
        <Pressable
          key={item.value}
          accessibilityRole="radio"
          accessibilityLabel={item.accessibleLabel ?? item.label}
          accessibilityState={{ checked: selected === item.value }}
          onPress={() => {
            onSelect(item.value);
            AccessibilityInfo.announceForAccessibility(`${item.label} selected for ${title.toLowerCase()}.`);
          }}
          style={({ pressed }) => [
            s.choice,
            {
              backgroundColor:
                selected === item.value ? theme.brandTint : pressed ? theme.surfaceMuted : theme.surface,
              borderTopColor: theme.border,
              borderTopWidth: index ? StyleSheet.hairlineWidth : 0,
            },
          ]}
        >
          <Text style={[s.control, { color: theme.text }]}>{item.label}</Text>
          <Ionicons
            name={selected === item.value ? "checkmark-circle" : "ellipse-outline"}
            size={23}
            color={selected === item.value ? theme.accentText : theme.mutedText}
            accessible={false}
          />
        </Pressable>
      ))}
    </View>
  );
}

function Toggle({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { theme } = useVoticTheme();
  return (
    <View style={[s.toggle, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={s.copy}>
        <Text style={[s.control, { color: theme.text }]}>{label}</Text>
        <Text style={[s.detail, { color: theme.mutedText }]}>{detail}</Text>
      </View>
      <Switch
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityHint={detail}
        accessibilityState={{ checked: value }}
        value={value}
        onValueChange={(next) => {
          onChange(next);
          AccessibilityInfo.announceForAccessibility(`${label} ${next ? "on" : "off"}.`);
        }}
        style={s.switch}
      />
    </View>
  );
}

function AppearanceSettings() {
  const { theme, accentName, setAccentName, appearanceMode, setAppearanceMode } = useVoticTheme();
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
  return (
    <>
      <Section
        title="App appearance"
        detail="Choose how Votic looks. Reader page colors, including Sepia, are set inside the Reader."
      >
        <Choices<AppearanceMode>
          title="App appearance"
          selected={appearanceMode}
          onSelect={setAppearanceMode}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "System" },
          ]}
        />
      </Section>
      <Section title="Accent color" detail="Used for active controls, progress, and reading highlights.">
        <View accessibilityRole="radiogroup" accessibilityLabel="Accent color" style={s.swatches}>
          {colors.map((color) => (
            <Pressable
              key={color}
              accessibilityRole="radio"
              accessibilityLabel={`${color} accent color`}
              accessibilityState={{ checked: accentName === color }}
              onPress={() => {
                setAccentName(color);
                AccessibilityInfo.announceForAccessibility(`${color} accent color selected.`);
              }}
              style={({ pressed }) => [
                s.swatchTouch,
                {
                  backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
                  borderColor: accentName === color ? theme.accentText : theme.border,
                },
              ]}
            >
              <View style={[s.swatch, { backgroundColor: accentColors[color] }]}>
                {accentName === color ? (
                  <Ionicons name="checkmark" size={19} color="#FFFFFF" accessible={false} />
                ) : null}
              </View>
              <Text style={[s.colorName, { color: theme.text }]}>
                {color[0].toUpperCase() + color.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </Section>
    </>
  );
}

function ReadingSettings() {
  const a = useAccessibilityPreferences();
  return (
    <>
      <Section title="Text size" detail="Set a comfortable size for reading.">
        <Choices<TextSize>
          title="Text size"
          selected={a.textSize}
          onSelect={a.setTextSize}
          options={[
            { value: "default", label: "Default", accessibleLabel: "Default text size" },
            { value: "large", label: "Large", accessibleLabel: "Large text size" },
            { value: "extra-large", label: "Extra large", accessibleLabel: "Extra large text size" },
          ]}
        />
      </Section>
      <Section title="Reading spacing" detail="Give passages more room or keep them compact.">
        <Choices<ReadingSpacing>
          title="Reading spacing"
          selected={a.readingSpacing}
          onSelect={a.setReadingSpacing}
          options={[
            { value: "compact", label: "Compact" },
            { value: "default", label: "Default", accessibleLabel: "Default reading spacing" },
            { value: "extra", label: "Extra" },
          ]}
        />
      </Section>
      <Section title="Listening">
        <Toggle
          label="Emphasize current word"
          detail="Make the spoken word slightly larger and bolder."
          value={a.wordEmphasis}
          onChange={a.setWordEmphasis}
        />
        <SettingsGroup>
          <SettingsRow
            label="Pronunciation dictionary"
            detail="Teach Votic how to say names, acronyms, and technical terms."
            hint="Teach Votic how to pronounce words and names"
            icon="language-outline"
            onPress={() => router.push("/pronunciations")}
          />
        </SettingsGroup>
      </Section>
    </>
  );
}

function AccessibilitySettings() {
  const a = useAccessibilityPreferences();
  const { theme } = useVoticTheme();
  return (
    <Section title="Motion" detail="Keep navigation and reading comfortable.">
      <Toggle
        label="Reduce motion"
        detail="Minimize Reader and sheet animations."
        value={a.reduceMotion}
        onChange={a.setReduceMotion}
      />
      <Text style={[s.detail, { color: theme.mutedText }]}>
        Your device&apos;s Reduce Motion setting also applies. Text size and spacing are in Reading &amp;
        Listening.
      </Text>
    </Section>
  );
}

function PersonalizationSettings() {
  const personalization = useVoticPurpose();
  return (
    <>
      <Section title="Votic helps you with">
        <View accessibilityRole="radiogroup" accessibilityLabel="Your focus" style={s.section}>
          {PURPOSES.map((item) => (
            <OptionRow
              key={item.value}
              label={item.label}
              detail={item.detail}
              icon={item.icon}
              selected={personalization.purpose === item.value}
              onPress={() => {
                personalization.setPurpose(item.value);
                AccessibilityInfo.announceForAccessibility(`${item.label} selected as your focus.`);
              }}
            />
          ))}
        </View>
      </Section>
      <Section title="Explanations">
        <Choices
          title="Explanation style"
          selected={personalization.explanationStyle}
          onSelect={personalization.setExplanationStyle}
          options={EXPLANATION_STYLES.map((item) => ({
            value: item.value,
            label: item.value === "adaptive" ? "Adapt" : item.label,
          }))}
        />
      </Section>
    </>
  );
}

function HelpSettings() {
  const onboarding = useOnboarding();
  const [tipsReset, setTipsReset] = useState(false);
  return (
    <SettingsGroup>
      <SettingsRow
        label="Show tips again"
        detail={
          tipsReset
            ? "Done. Tips will appear on Home and in the Reader."
            : "Bring back the Getting Started checklist and Reader tips."
        }
        hint="Brings back the Getting Started checklist and the Reader tips"
        icon="bulb-outline"
        onPress={() => {
          onboarding.showTipsAgain();
          setTipsReset(true);
          AccessibilityInfo.announceForAccessibility("Done. Tips will appear on Home and in the Reader.");
        }}
      />
      <SettingsRow
        label="Statistics"
        detail="Reading and listening time, activity, and insights."
        hint="Reading and listening time, activity, and insights"
        icon="stats-chart-outline"
        separated
        onPress={() => router.push("/statistics")}
      />
    </SettingsGroup>
  );
}

export function SettingsDetailScreen({ category }: { category: SettingsCategory | null }) {
  const { theme } = useVoticTheme();
  return (
    <SettingsPage title={category ? SETTINGS_CATEGORIES[category] : "Settings"}>
      {category === "appearance" ? (
        <AppearanceSettings />
      ) : category === "reading" ? (
        <ReadingSettings />
      ) : category === "accessibility" ? (
        <AccessibilitySettings />
      ) : category === "personalization" ? (
        <PersonalizationSettings />
      ) : category === "account" ? (
        <AccountSettings />
      ) : category === "help" ? (
        <HelpSettings />
      ) : (
        <Text style={[s.detail, { color: theme.mutedText }]}>
          This settings category is unavailable. Return to Settings to choose another category.
        </Text>
      )}
    </SettingsPage>
  );
}

const s = StyleSheet.create({
  section: { gap: spacing.md },
  heading: { ...typography.sectionTitle },
  detail: { fontSize: 14, lineHeight: 21 },
  choices: { borderWidth: 1, borderRadius: radii.md, overflow: "hidden" },
  choice: { minHeight: 56, padding: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md },
  control: { ...typography.control, flex: 1 },
  toggle: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  copy: { flex: 1, gap: spacing.xs },
  switch: { minWidth: controlSizes.minimumTouch, minHeight: controlSizes.minimumTouch },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  swatchTouch: {
    minWidth: 86,
    minHeight: 80,
    flexGrow: 1,
    flexBasis: "28%",
    padding: spacing.md,
    borderWidth: 2,
    borderRadius: radii.md,
    alignItems: "center",
    gap: spacing.sm,
  },
  swatch: { width: 28, height: 28, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  colorName: { fontSize: 14, fontWeight: "600" },
});
