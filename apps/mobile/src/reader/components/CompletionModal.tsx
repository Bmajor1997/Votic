import { Ionicons } from "@expo/vector-icons";
import { ComponentProps, useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAccessibilityPreferences } from "../../accessibility/AccessibilityProvider";
import { AIStatus } from "../../components/AIResponse";
import { controlSizes, radii, spacing, typography } from "../../design/tokens";
import { useVoticTheme } from "../../theme/ThemeProvider";
import { time_spent_label } from "../readerText";

export type FinishSummary =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; text: string; saved: boolean }
  | { status: "error"; message: string };

/** Where the bar starts before it fills to the end, so the last stretch is what you see completing. */
const FILL_FROM = 0.85;
const FILL_MS = 600;
const STROKE_MS = 180;
const CONTENT_MS = 260;

/**
 * Shown when someone finishes a document. The progress bar fills to the end and glows, a checkmark draws itself,
 * then the card offers a summary (the same request as Ask Votic's "Summarize this document"), a follow-up question,
 * and the next document. With Less motion everything appears at once.
 */
export function CompletionModal({
  visible,
  onClose,
  title,
  timeSpentSeconds,
  passageCount,
  canSummarize,
  summary,
  onSummarize,
  summaryListen,
  onSaveSummary,
  onAskFollowUp,
  nextUpTitle,
  onNextUp,
  onAddDocument,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  timeSpentSeconds: number;
  passageCount: number;
  canSummarize: boolean;
  summary: FinishSummary;
  onSummarize: () => void;
  summaryListen: { playing: boolean; failed: boolean; onPress: () => void };
  onSaveSummary: () => void;
  onAskFollowUp: () => void;
  nextUpTitle: string | null;
  onNextUp: () => void;
  onAddDocument: () => void;
}) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const motion = useFinishMotion(visible, reduceMotion);

  useEffect(() => {
    if (visible)
      AccessibilityInfo.announceForAccessibility(`Finished${title ? ` ${title}` : ""}. Nicely done.`);
  }, [visible, title]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={onClose}
    >
      <View style={s.backdrop}>
        <View
          accessibilityViewIsModal
          style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close completion experience"
            onPress={onClose}
            style={s.close}
          >
            <Ionicons name="close" size={23} color={theme.mutedText} />
          </Pressable>
          <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            <FinishMark motion={motion} />
            <Animated.View
              style={[
                s.body,
                {
                  opacity: motion.content,
                  transform: [
                    { translateY: motion.content.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
                  ],
                },
              ]}
            >
              <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
                Nicely done.
              </Text>
              <Text numberOfLines={2} style={[s.document, { color: theme.mutedText }]}>
                {title}
              </Text>
              <View style={s.stats}>
                <View style={s.stat}>
                  <Text style={[s.value, { color: theme.text }]}>{time_spent_label(timeSpentSeconds)}</Text>
                  <Text style={[s.label, { color: theme.mutedText }]}>Time spent</Text>
                </View>
                <View style={[s.divider, { backgroundColor: theme.border }]} />
                <View style={s.stat}>
                  <Text style={[s.value, { color: theme.text }]}>{passageCount}</Text>
                  <Text style={[s.label, { color: theme.mutedText }]}>Passages</Text>
                </View>
              </View>
              {canSummarize ? (
                <SummarySection
                  summary={summary}
                  onSummarize={onSummarize}
                  listen={summaryListen}
                  onSave={onSaveSummary}
                />
              ) : null}
              <View style={s.actions}>
                <CompletionAction
                  icon="chatbubble-ellipses-outline"
                  label="Ask a follow-up"
                  onPress={onAskFollowUp}
                />
                {nextUpTitle ? (
                  <CompletionAction
                    icon="arrow-forward-circle-outline"
                    label="Next up"
                    detail={nextUpTitle}
                    accessibilityLabel={`Next up: ${nextUpTitle}`}
                    onPress={onNextUp}
                  />
                ) : (
                  <CompletionAction
                    icon="add-circle-outline"
                    label="Add a document"
                    onPress={onAddDocument}
                  />
                )}
              </View>
            </Animated.View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

type FinishMotion = {
  fill: Animated.Value;
  glow: Animated.Value;
  short: Animated.Value;
  long: Animated.Value;
  content: Animated.Value;
};

/** Plays the finish once each time the card opens; with Less motion it starts at the end. */
function useFinishMotion(visible: boolean, reduceMotion: boolean): FinishMotion {
  const [motion] = useState<FinishMotion>(() => ({
    fill: new Animated.Value(1),
    glow: new Animated.Value(0),
    short: new Animated.Value(1),
    long: new Animated.Value(1),
    content: new Animated.Value(1),
  }));
  useEffect(() => {
    const values = Object.values(motion);
    values.forEach((value) => value.stopAnimation());
    if (!visible || reduceMotion) {
      motion.fill.setValue(1);
      motion.glow.setValue(0);
      motion.short.setValue(1);
      motion.long.setValue(1);
      motion.content.setValue(1);
      return;
    }
    motion.fill.setValue(0);
    motion.glow.setValue(0);
    motion.short.setValue(0);
    motion.long.setValue(0);
    motion.content.setValue(0);
    const settings = { useNativeDriver: true, isInteraction: false };
    const sequence = Animated.sequence([
      Animated.timing(motion.fill, {
        ...settings,
        toValue: 1,
        duration: FILL_MS,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(motion.glow, { ...settings, toValue: 1, duration: 220 }),
          Animated.timing(motion.glow, { ...settings, toValue: 0, duration: 420 }),
        ]),
        Animated.sequence([
          Animated.timing(motion.short, {
            ...settings,
            toValue: 1,
            duration: STROKE_MS,
            easing: Easing.out(Easing.quad),
          }),
          Animated.timing(motion.long, {
            ...settings,
            toValue: 1,
            duration: STROKE_MS + 60,
            easing: Easing.out(Easing.quad),
          }),
          Animated.timing(motion.content, { ...settings, toValue: 1, duration: CONTENT_MS }),
        ]),
      ]),
    ]);
    sequence.start();
    return () => sequence.stop();
  }, [visible, reduceMotion, motion]);
  return motion;
}

/** The progress bar completing, then a checkmark drawn in two strokes. Decorative: the header says it in words. */
function FinishMark({ motion }: { motion: FinishMotion }) {
  const { theme } = useVoticTheme();
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="finish-mark"
      style={s.mark}
    >
      <View style={s.checkCircle}>
        <View style={[StyleSheet.absoluteFill, s.checkCircleFill, { backgroundColor: theme.accent }]} />
        <View style={s.check}>
          <Animated.View
            style={[
              s.strokeShort,
              { backgroundColor: theme.onAccent, transform: [{ rotate: "45deg" }, { scaleX: motion.short }] },
            ]}
          />
          <Animated.View
            style={[
              s.strokeLong,
              { backgroundColor: theme.onAccent, transform: [{ rotate: "-45deg" }, { scaleX: motion.long }] },
            ]}
          />
        </View>
      </View>
      <View style={[s.track, { backgroundColor: theme.border }]}>
        <Animated.View
          style={[
            s.fill,
            {
              backgroundColor: theme.accent,
              transform: [
                { scaleX: motion.fill.interpolate({ inputRange: [0, 1], outputRange: [FILL_FROM, 1] }) },
              ],
            },
          ]}
        />
        <Animated.View
          style={[s.glow, { backgroundColor: theme.accent, shadowColor: theme.accent, opacity: motion.glow }]}
        />
      </View>
      <Text style={[s.complete, { color: theme.accentText }]}>100% read</Text>
    </View>
  );
}

function SummarySection({
  summary,
  onSummarize,
  listen,
  onSave,
}: {
  summary: FinishSummary;
  onSummarize: () => void;
  listen: { playing: boolean; failed: boolean; onPress: () => void };
  onSave: () => void;
}) {
  const { theme } = useVoticTheme();
  if (summary.status === "idle")
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Summarize this document"
        onPress={onSummarize}
        style={({ pressed }) => [s.summarize, { backgroundColor: pressed ? theme.accentText : theme.accent }]}
      >
        <Ionicons name="sparkles-outline" size={20} color={theme.onAccent} />
        <Text style={[s.summarizeText, { color: theme.onAccent }]}>Summarize this document</Text>
      </Pressable>
    );
  if (summary.status === "loading")
    return (
      <View style={[s.summaryBox, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
        <AIStatus label="Summarizing" />
      </View>
    );
  if (summary.status === "error")
    return (
      <View style={[s.summaryBox, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
        <Text accessibilityRole="alert" style={[s.summaryText, { color: theme.text }]}>
          {summary.message}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try summarizing again"
          onPress={onSummarize}
          style={s.link}
        >
          <Text style={[s.linkText, { color: theme.accentText }]}>Try again</Text>
        </Pressable>
      </View>
    );
  return (
    <View style={[s.summaryBox, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
      <Text style={[s.summaryLabel, { color: theme.accentText }]}>SUMMARY</Text>
      <Text selectable accessibilityLiveRegion="polite" style={[s.summaryText, { color: theme.text }]}>
        {summary.text}
      </Text>
      <View style={s.summaryActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={listen.playing ? "Stop reading summary" : "Read summary aloud"}
          accessibilityState={{ selected: listen.playing }}
          onPress={listen.onPress}
          style={[s.summaryButton, { borderColor: theme.border }]}
        >
          <Ionicons
            name={listen.playing ? "stop-circle-outline" : "volume-high-outline"}
            size={19}
            color={theme.accentText}
          />
          <Text style={[s.summaryButtonText, { color: theme.accentText }]}>
            {listen.playing ? "Stop" : "Listen"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={summary.saved ? "Summary saved to Notes" : "Save summary to Notes"}
          accessibilityState={{ disabled: summary.saved }}
          disabled={summary.saved}
          onPress={onSave}
          style={[s.summaryButton, { borderColor: theme.border, opacity: summary.saved ? 0.7 : 1 }]}
        >
          <Ionicons
            name={summary.saved ? "bookmark" : "bookmark-outline"}
            size={18}
            color={theme.accentText}
          />
          <Text style={[s.summaryButtonText, { color: theme.accentText }]}>
            {summary.saved ? "Saved to Notes" : "Save to Notes"}
          </Text>
        </Pressable>
      </View>
      {listen.failed ? (
        <Text accessibilityRole="alert" style={[s.label, { color: theme.text }]}>
          Couldn’t read the summary aloud. Tap Listen to try again.
        </Text>
      ) : null}
    </View>
  );
}

function CompletionAction({
  icon,
  label,
  detail,
  accessibilityLabel,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  detail?: string;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [
        s.action,
        { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceMuted : theme.surface },
      ]}
    >
      <Ionicons name={icon} size={22} color={theme.accent} />
      <Text style={[s.actionText, { color: theme.text }]}>{label}</Text>
      {detail ? (
        <Text numberOfLines={2} style={[s.actionDetail, { color: theme.mutedText }]}>
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "92%",
    borderWidth: 1,
    borderRadius: radii.sheet,
    overflow: "hidden",
  },
  content: { padding: spacing.xl, paddingTop: spacing.xxl, alignItems: "center", gap: spacing.md },
  body: { width: "100%", alignItems: "center", gap: spacing.md },
  close: {
    position: "absolute",
    right: spacing.sm,
    top: spacing.sm,
    width: controlSizes.minimumTouch,
    height: controlSizes.minimumTouch,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  mark: { width: "100%", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg },
  checkCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  checkCircleFill: { borderRadius: 28 },
  check: { width: 30, height: 30 },
  strokeShort: {
    position: "absolute",
    left: 2,
    top: 15,
    width: 11,
    height: 4,
    borderRadius: 2,
    transformOrigin: "left",
  },
  strokeLong: {
    position: "absolute",
    left: 9,
    top: 22,
    width: 21,
    height: 4,
    borderRadius: 2,
    transformOrigin: "left",
  },
  track: { width: "100%", height: 8, borderRadius: 4, overflow: "visible" },
  fill: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 4,
    transformOrigin: "left",
  },
  glow: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 4,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 6,
  },
  complete: { fontSize: 13, fontWeight: "700" },
  title: { ...typography.screenTitle, fontSize: 26, textAlign: "center" },
  document: { fontSize: 15, textAlign: "center" },
  stats: { width: "100%", flexDirection: "row", alignItems: "center", marginVertical: spacing.xs },
  stat: { flex: 1, alignItems: "center", gap: spacing.xs },
  value: { fontSize: 21, fontWeight: "800" },
  label: { fontSize: 13 },
  divider: { width: 1, height: 44 },
  summarize: {
    width: "100%",
    minHeight: controlSizes.minimumTouch + 4,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  summarizeText: { fontSize: 16, fontWeight: "800" },
  summaryBox: { width: "100%", borderWidth: 1, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm },
  summaryLabel: { ...typography.eyebrow },
  summaryText: { fontSize: 15, lineHeight: 22 },
  summaryActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  summaryButton: {
    minHeight: controlSizes.minimumTouch,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  summaryButtonText: { fontSize: 14, fontWeight: "700" },
  link: { minHeight: controlSizes.minimumTouch, justifyContent: "center", alignSelf: "flex-start" },
  linkText: { fontSize: 14, fontWeight: "700" },
  actions: { width: "100%", flexDirection: "row", gap: spacing.sm },
  action: {
    flex: 1,
    minHeight: 72,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  actionText: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  actionDetail: { fontSize: 12, textAlign: "center" },
});
