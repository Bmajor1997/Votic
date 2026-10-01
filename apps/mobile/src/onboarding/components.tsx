import { Ionicons } from "@expo/vector-icons";
import { ReactNode, useEffect } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { controlSizes, radii, spacing, typography } from "../design/tokens";
import { useVoticTheme } from "../theme/ThemeProvider";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  busy = false,
  icon,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  icon?: IconName;
  accessibilityHint?: string;
}) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        s.primary,
        // Disabled uses a muted fill and text, not just transparency, so it reads as unavailable.
        { backgroundColor: disabled ? theme.surfaceMuted : theme.accent },
        !reduceMotion && pressed && { transform: [{ scale: 0.98 }] },
        pressed && { opacity: 0.88 },
      ]}
    >
      {busy ? <ActivityIndicator color={theme.onAccent} /> : null}
      {!busy && icon ? (
        <Ionicons name={icon} size={20} color={disabled ? theme.mutedText : theme.onAccent} />
      ) : null}
      <Text style={[s.primaryText, { color: disabled ? theme.mutedText : theme.onAccent }]}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  icon,
  disabled = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  busy?: boolean;
}) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.secondary,
        {
          borderColor: theme.border,
          backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
    >
      {busy ? <ActivityIndicator color={theme.text} /> : icon}
      <Text style={[s.secondaryText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

export function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [s.textButton, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={[s.textButtonLabel, { color: theme.accentText }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * One choice in a list. Single choices use a round marker and multiple choices a square one,
 * so the shape (not only the color) says how many can be picked.
 */
export function OptionRow({
  label,
  detail,
  icon,
  selected,
  multiple = false,
  onPress,
}: {
  label: string;
  detail?: string;
  icon?: IconName;
  selected: boolean;
  multiple?: boolean;
  onPress: () => void;
}) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole={multiple ? "checkbox" : "radio"}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      onPress={onPress}
      style={({ pressed }) => [
        s.option,
        {
          borderColor: selected ? theme.accent : theme.border,
          backgroundColor: selected ? theme.sentenceHighlight : pressed ? theme.surfaceMuted : theme.surface,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={22} color={selected ? theme.accentText : theme.mutedText} /> : null}
      <View style={s.optionCopy}>
        <Text style={[s.optionLabel, { color: theme.text }]}>{label}</Text>
        {detail ? <Text style={[s.optionDetail, { color: theme.mutedText }]}>{detail}</Text> : null}
      </View>
      <View
        style={[
          multiple ? s.checkbox : s.radio,
          {
            borderColor: selected ? theme.accent : theme.border,
            backgroundColor: selected ? theme.accent : "transparent",
          },
        ]}
      >
        {selected ? <Ionicons name="checkmark" size={15} color={theme.onAccent} /> : null}
      </View>
    </Pressable>
  );
}

export function ProgressSegments({ step, total }: { step: number; total: number }) {
  const { theme } = useVoticTheme();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step + 1} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: step + 1 }}
      style={s.segments}
    >
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[s.segment, { backgroundColor: index <= step ? theme.accent : theme.border }]}
        />
      ))}
    </View>
  );
}

/** The frame shared by every personalization step: back, progress and skip on top, one action at the bottom. */
export function StepScaffold({
  step,
  total,
  onBack,
  onSkip,
  title,
  subtitle,
  children,
  footer,
}: {
  step: number;
  total: number;
  onBack?: () => void;
  onSkip: () => void;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const { theme } = useVoticTheme();
  // Screen readers hear the new step's title when it changes.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(`Step ${step + 1} of ${total}. ${title}`);
  }, [step, total, title]);
  return (
    <SafeAreaView style={[s.fill, { backgroundColor: theme.background }]}>
      <View style={s.topBar}>
        <View style={s.topSide}>
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={onBack}
              style={({ pressed }) => [s.iconButton, { opacity: pressed ? 0.55 : 1 }]}
            >
              <Ionicons name="chevron-back" size={26} color={theme.text} />
            </Pressable>
          ) : null}
        </View>
        <ProgressSegments step={step} total={total} />
        <View style={[s.topSide, s.topRight]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip this step"
            onPress={onSkip}
            style={({ pressed }) => [s.skip, { opacity: pressed ? 0.55 : 1 }]}
          >
            <Text style={[s.skipText, { color: theme.mutedText }]}>Skip</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={s.stepContent} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
          {title}
        </Text>
        <Text style={[s.subtitle, { color: theme.mutedText }]}>{subtitle}</Text>
        <View style={s.stepBody}>{children}</View>
      </ScrollView>
      <View style={[s.footer, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
        {footer}
      </View>
    </SafeAreaView>
  );
}

/**
 * A one-time tip shown beside the control it explains. It never blocks the screen:
 * people can keep using Votic, and "Got it" or using the control dismisses it.
 */
export function CoachMark({
  title,
  body,
  arrow,
  onDismiss,
  style,
}: {
  title: string;
  body: string;
  arrow: { edge: "top" | "bottom"; align: "left" | "center" | "right"; inset?: number };
  onDismiss: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useVoticTheme();
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(`Tip: ${title}. ${body}`);
  }, [title, body]);
  const arrowPosition: ViewStyle =
    arrow.align === "left"
      ? { alignSelf: "flex-start", marginLeft: arrow.inset ?? 28 }
      : arrow.align === "right"
        ? { alignSelf: "flex-end", marginRight: arrow.inset ?? 28 }
        : { alignSelf: "center" };
  return (
    <View pointerEvents="box-none" style={style}>
      {arrow.edge === "top" ? (
        <View style={[s.arrow, s.arrowUp, arrowPosition, { borderBottomColor: theme.text }]} />
      ) : null}
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[s.coach, { backgroundColor: theme.text }]}
      >
        <View style={s.coachCopy}>
          <Text style={[s.coachTitle, { color: theme.background }]}>{title}</Text>
          <Text style={[s.coachBody, { color: theme.background }]}>{body}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Got it. Dismiss tip: ${title}`}
          onPress={onDismiss}
          style={({ pressed }) => [
            s.coachButton,
            { borderColor: theme.background, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[s.coachButtonText, { color: theme.background }]}>Got it</Text>
        </Pressable>
      </View>
      {arrow.edge === "bottom" ? (
        <View style={[s.arrow, s.arrowDown, arrowPosition, { borderTopColor: theme.text }]} />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  primary: {
    minHeight: 54,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  primaryText: { ...typography.control, fontSize: 17, fontWeight: "800" },
  secondary: {
    minHeight: 54,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  secondaryText: { ...typography.control, fontSize: 17 },
  textButton: { minHeight: controlSizes.minimumTouch, justifyContent: "center", alignSelf: "center" },
  textButtonLabel: { fontSize: 15, fontWeight: "800" },
  option: {
    minHeight: 60,
    borderWidth: 2,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  optionCopy: { flex: 1, gap: 2 },
  optionLabel: { fontSize: 16, fontWeight: "700" },
  optionDetail: { fontSize: 14, lineHeight: 19 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  segments: { flex: 1, flexDirection: "row", gap: 6, paddingHorizontal: spacing.sm },
  segment: { flex: 1, height: 5, borderRadius: radii.pill },
  topBar: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  topSide: { width: 64, justifyContent: "center" },
  topRight: { alignItems: "flex-end" },
  iconButton: {
    width: controlSizes.minimumTouch,
    height: controlSizes.minimumTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  skip: {
    minHeight: controlSizes.minimumTouch,
    minWidth: controlSizes.minimumTouch,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: { fontSize: 15, fontWeight: "700" },
  stepContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  title: { ...typography.screenTitle, fontSize: 28, lineHeight: 34 },
  subtitle: { fontSize: 16, lineHeight: 23 },
  stepBody: { marginTop: spacing.xl, gap: spacing.md },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
  },
  coach: {
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  coachCopy: { flex: 1, gap: 3 },
  coachTitle: { fontSize: 15, fontWeight: "800" },
  coachBody: { fontSize: 14, lineHeight: 19 },
  coachButton: {
    minHeight: 44,
    minWidth: 72,
    borderWidth: 1.5,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  coachButtonText: { fontSize: 14, fontWeight: "800" },
  arrow: { width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderColor: "transparent" },
  arrowUp: { borderBottomWidth: 9 },
  arrowDown: { borderTopWidth: 9 },
});
