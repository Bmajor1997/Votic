import { MotionFeedbackNotice } from "../motion/MotionFeedback";
import { PropsWithChildren, ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Animated, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVoticTheme } from "../theme/ThemeProvider";
import { FadingScrollView } from "./FadingScrollView";
import { VoticLogo } from "./VoticLogo";
import { useDocumentLibrary } from "../documents/DocumentLibraryProvider";
import { useDocumentTransition } from "../navigation/DocumentTransitionProvider";

export function Screen({
  title,
  children,
  hideTitle = false,
  titleAction,
}: PropsWithChildren<{ title: string; hideTitle?: boolean; titleAction?: ReactNode }>) {
  const { theme } = useVoticTheme();
  const { persistenceError } = useDocumentLibrary();
  const transition = useDocumentTransition();
  const screenOpacity = transition.progress.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 0.88, 0.04],
    extrapolate: "clamp",
  });
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[s.safe, { backgroundColor: theme.background }]}>
      <Animated.View style={[s.safe, { opacity: transition.transitioning ? screenOpacity : 1 }]}>
        <FadingScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[s.brandBar, { borderBottomColor: theme.border }]} accessibilityRole="header">
            <VoticLogo />
            <View style={s.headerIcon} />
          </View>
          {persistenceError ? (
            <View
              accessible
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={[s.warning, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}
            >
              <Ionicons name="warning-outline" size={20} color={theme.accent} />
              <Text style={[s.warningText, { color: theme.text }]}>{persistenceError}</Text>
            </View>
          ) : null}
          {!hideTitle ? (
            <View style={s.titleRow}>
              <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
                {title}
              </Text>
              {titleAction}
            </View>
          ) : null}
          {children}
        </FadingScrollView>
      </Animated.View>
      <MotionFeedbackNotice />
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 36, gap: 20 },
  brandBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 4,
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5, flexShrink: 1 },
  warning: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  warningText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: "600" },
});
