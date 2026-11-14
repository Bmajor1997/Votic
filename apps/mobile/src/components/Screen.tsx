import { editorial } from "../design/editorial";
import { UsageLimitNotice } from "../subscription/UsageLimitNotice";
import { MotionFeedbackNotice } from "../motion/MotionFeedback";
import { PropsWithChildren, ReactNode, useCallback, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useOptionalWalkthrough } from "../walkthrough/WalkthroughProvider";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVoticTheme } from "../theme/ThemeProvider";
import { FadingScrollView } from "./FadingScrollView";
import { PageWordmark } from "./PageWordmark";
import { useDocumentLibrary } from "../documents/DocumentLibraryProvider";
import { useDocumentTransition } from "../navigation/DocumentTransitionProvider";

export function Screen({
  title,
  children,
  hideTitle = false,
  titleAction,
  brand,
  floatingAction,
}: PropsWithChildren<{
  title: string;
  hideTitle?: boolean;
  titleAction?: ReactNode;
  brand?: ReactNode;
  floatingAction?: ReactNode;
}>) {
  const { theme } = useVoticTheme();
  const { persistenceError } = useDocumentLibrary();
  const transition = useDocumentTransition();
  const scrollRef = useRef<ScrollView>(null);
  const offset = useRef(0);
  // While this screen is showing, the walkthrough can scroll it to bring a control below the fold into view.
  const register_scroller = useOptionalWalkthrough()?.register_scroller;
  useFocusEffect(
    useCallback(() => {
      if (!register_scroller) return;
      register_scroller((by) =>
        scrollRef.current?.scrollTo({ y: Math.max(0, offset.current + by), animated: false }),
      );
      return () => register_scroller(null);
    }, [register_scroller]),
  );
  const screenOpacity = transition.progress.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 0.88, 0.04],
    extrapolate: "clamp",
  });
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[s.safe, { backgroundColor: theme.background }]}>
      <Animated.View style={[s.safe, { opacity: transition.transitioning ? screenOpacity : 1 }]}>
        <FadingScrollView
          ref={scrollRef}
          on_offset={(y) => {
            offset.current = y;
          }}
          contentContainerStyle={[s.content, floatingAction ? s.contentWithFloatingAction : null]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[s.brandBar, { borderBottomColor: theme.border }]} accessibilityRole="header">
            {brand ?? <PageWordmark />}
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
          <UsageLimitNotice />
        </FadingScrollView>
        {floatingAction}
      </Animated.View>
      <MotionFeedbackNotice />
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1 },
  contentWithFloatingAction: { paddingBottom: 110 },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    gap: 24,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  brandBar: {
    borderBottomWidth: 0,
    paddingBottom: 4,
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { ...editorial, fontSize: 34, lineHeight: 42, flexShrink: 1 },
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
