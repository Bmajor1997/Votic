import { Ionicons } from "@expo/vector-icons";
import { PropsWithChildren, ReactNode, forwardRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { VoticLogo } from "../../components/VoticLogo";
import { controlSizes, radii, spacing, typography } from "../../design/tokens";
import { useVoticTheme } from "../../theme/ThemeProvider";

/** The frame every account and setup screen shares: safe areas, keyboard avoidance, and scrolling on small phones. */
export function OnboardingScreen({
  children,
  onBack,
  backLabel = "Back",
  headerAction,
  footer,
  showLogo = true,
}: PropsWithChildren<{
  onBack?: () => void;
  backLabel?: string;
  headerAction?: ReactNode;
  footer?: ReactNode;
  showLogo?: boolean;
}>) {
  const { theme } = useVoticTheme();
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={s.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.header}>
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={backLabel}
              onPress={onBack}
              hitSlop={8}
              style={s.headerButton}
            >
              <Ionicons name="chevron-back" size={26} color={theme.text} />
            </Pressable>
          ) : (
            <View style={s.headerButton} />
          )}
          {showLogo ? <VoticLogo /> : <View />}
          <View style={[s.headerButton, s.headerEnd]}>{headerAction}</View>
        </View>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {footer ? <View style={[s.footer, { borderTopColor: theme.border }]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Title({ children, subtitle }: { children: string; subtitle?: string }) {
  const { theme } = useVoticTheme();
  return (
    <View style={s.titleBlock}>
      <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
        {children}
      </Text>
      {subtitle ? <Text style={[s.subtitle, { color: theme.mutedText }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
}) {
  const { theme } = useVoticTheme();
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        s.primary,
        { backgroundColor: theme.accent, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator color={theme.playIcon} /> : null}
      <Text style={[s.primaryText, { color: theme.playIcon }]}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.secondary,
        { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceMuted : theme.surface },
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={[s.secondaryText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

/** A quiet text action such as "Forgot password?" that still meets the minimum touch size. */
export function TextLink({
  label,
  onPress,
  prefix,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  prefix?: string;
  disabled?: boolean;
}) {
  const { theme } = useVoticTheme();
  return (
    <View style={s.linkRow}>
      {prefix ? <Text style={[s.linkPrefix, { color: theme.mutedText }]}>{prefix} </Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={prefix ? `${prefix} ${label}` : label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        hitSlop={8}
        style={s.link}
      >
        <Text style={[s.linkText, { color: disabled ? theme.mutedText : theme.accent }]}>{label}</Text>
      </Pressable>
    </View>
  );
}

type FieldProps = TextInputProps & { label: string; error?: string; secure?: boolean };

/** A labeled input. Errors are announced and linked to the field; passwords get a show/hide control. */
export const TextField = forwardRef<TextInput, FieldProps>(function TextField(
  { label, error, secure = false, ...input },
  ref,
) {
  const { theme } = useVoticTheme();
  const [visible, setVisible] = useState(false);
  return (
    <View style={s.field}>
      <Text style={[s.fieldLabel, { color: theme.text }]}>{label}</Text>
      <View
        style={[
          s.inputRow,
          { borderColor: error ? "#B91C1C" : theme.border, backgroundColor: theme.surface },
        ]}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error}
          placeholderTextColor={theme.mutedText}
          secureTextEntry={secure && !visible}
          autoCorrect={false}
          style={[s.input, { color: theme.text }]}
          {...input}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            onPress={() => setVisible((value) => !value)}
            hitSlop={8}
            style={s.eye}
          >
            <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={22} color={theme.mutedText} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[s.fieldError, { color: theme.isDark ? "#FCA5A5" : "#B91C1C" }]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
});

/** A message box. "error" is announced to screen readers as soon as it appears. */
export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success";
  children: string;
}) {
  const { theme } = useVoticTheme();
  const icon =
    tone === "error"
      ? "alert-circle-outline"
      : tone === "success"
        ? "checkmark-circle-outline"
        : "information-circle-outline";
  return (
    <View
      accessible
      accessibilityRole={tone === "error" ? "alert" : "text"}
      accessibilityLiveRegion="polite"
      style={[s.notice, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={tone === "error" ? (theme.isDark ? "#FCA5A5" : "#B91C1C") : theme.accent}
      />
      <Text style={[s.noticeText, { color: theme.text }]}>{children}</Text>
    </View>
  );
}

/** A large, easy-to-tap choice. Checkbox semantics for multiple choice, radio semantics for single choice. */
export function ChoiceCard({
  label,
  detail,
  selected,
  kind,
  onPress,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  kind: "multiple" | "single";
  onPress: () => void;
}) {
  const { theme } = useVoticTheme();
  const icon =
    kind === "multiple"
      ? selected
        ? "checkbox"
        : "square-outline"
      : selected
        ? "radio-button-on"
        : "radio-button-off";
  return (
    <Pressable
      accessibilityRole={kind === "multiple" ? "checkbox" : "radio"}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      onPress={onPress}
      style={({ pressed }) => [
        s.choice,
        {
          borderColor: selected ? theme.accent : theme.border,
          backgroundColor: selected ? theme.sentenceHighlight : pressed ? theme.surfaceMuted : theme.surface,
        },
      ]}
    >
      <View style={s.choiceCopy}>
        <Text style={[s.choiceLabel, { color: theme.text }]}>{label}</Text>
        {detail ? <Text style={[s.choiceDetail, { color: theme.mutedText }]}>{detail}</Text> : null}
      </View>
      <Ionicons name={icon} size={24} color={selected ? theme.accent : theme.mutedText} />
    </Pressable>
  );
}

/** A subtle five-dot indicator; screen readers hear "Step 2 of 5". */
export function StepDots({ step, total }: { step: number; total: number }) {
  const { theme } = useVoticTheme();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step + 1} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: step + 1 }}
      style={s.dots}
    >
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[
            s.dot,
            {
              backgroundColor: index <= step ? theme.accent : theme.border,
              width: index === step ? 22 : 8,
            },
          ]}
        />
      ))}
    </View>
  );
}

export const onboardingStyles = StyleSheet.create({
  stack: { gap: spacing.md },
  center: { alignItems: "center" },
  body: { ...typography.body },
});

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  headerButton: {
    minWidth: controlSizes.minimumTouch,
    minHeight: controlSizes.minimumTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  headerEnd: { alignItems: "flex-end" },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  footer: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.sm, borderTopWidth: 1 },
  titleBlock: { gap: spacing.sm },
  title: { ...typography.screenTitle, fontSize: 28 },
  subtitle: { ...typography.body },
  primary: {
    minHeight: 54,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  primaryText: { ...typography.control, fontSize: 17 },
  secondary: {
    minHeight: 54,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { ...typography.control, fontSize: 17 },
  linkRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center" },
  linkPrefix: { fontSize: 15 },
  link: { minHeight: controlSizes.minimumTouch, justifyContent: "center" },
  linkText: { fontSize: 15, fontWeight: "700" },
  field: { gap: spacing.xs },
  fieldLabel: { fontSize: 15, fontWeight: "700" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radii.md,
    minHeight: 52,
  },
  input: { flex: 1, fontSize: 17, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  eye: {
    minWidth: controlSizes.minimumTouch,
    minHeight: controlSizes.minimumTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldError: { fontSize: 14, lineHeight: 20 },
  notice: {
    flexDirection: "row",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: "flex-start",
  },
  noticeText: { flex: 1, fontSize: 15, lineHeight: 22 },
  choice: {
    minHeight: 60,
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  choiceCopy: { flex: 1, gap: 2 },
  choiceLabel: { fontSize: 17, fontWeight: "600", lineHeight: 23 },
  choiceDetail: { fontSize: 15, lineHeight: 21 },
  dots: { flexDirection: "row", gap: 6, alignItems: "center", minHeight: 20 },
  dot: { height: 8, borderRadius: 4 },
});
