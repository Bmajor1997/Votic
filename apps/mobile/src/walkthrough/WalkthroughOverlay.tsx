import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
  findNodeHandle,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { controlSizes, radii, spacing } from "../design/tokens";
import { useVoticTheme } from "../theme/ThemeProvider";
import { Rect, card_placement, dim_regions, scroll_needed, spotlight_rect } from "./placement";
import { copy_for, FLOWS, WalkthroughHost } from "./walkthroughFlows";
import { useWalkthrough } from "./WalkthroughProvider";

const GUTTER = 16;
/** How long a scroll is given to land before measuring again. */
const SCROLL_SETTLE_MS = 250;

/**
 * Draws the current walkthrough step over its host screen: a dim layer with a clear "hole" around the
 * real control, and a small coaching card beside it. Only interactive steps let the control be used
 * through the hole. With a screen reader on, nothing is dimmed or blocked; the card is read aloud instead.
 */
export function WalkthroughOverlay({ host }: { host: WalkthroughHost }) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const walkthrough = useWalkthrough();
  const { active, measureTarget, measureNode, next, skip, scrollBy } = walkthrough;
  const window = useWindowDimensions();
  const rootRef = useRef<View>(null);
  const titleRef = useRef<Text>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [screenReader, setScreenReader] = useState(false);
  const entrance = useState(() => new Animated.Value(1))[0];
  const flow = active && FLOWS[active.id].host === host ? active : null;
  const step = flow?.steps[flow.index];
  const stepKey = flow ? `${flow.id}:${flow.index}` : null;

  useEffect(() => {
    void AccessibilityInfo.isScreenReaderEnabled()
      .then(setScreenReader)
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", setScreenReader);
    return () => subscription.remove();
  }, []);

  // Find the control on screen (relative to this overlay), and measure again once layout has settled.
  useEffect(() => {
    if (!step) return;
    let current = true;
    let scrolled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function locate() {
      if (!step?.target) return setRect(null);
      const [target, origin] = await Promise.all([measureTarget(step.target), measureNode(rootRef.current)]);
      if (!current) return;
      if (!target) return next();
      const local = { ...target, x: target.x - (origin?.x ?? 0), y: target.y - (origin?.y ?? 0) };
      const by = scroll_needed(local, window.height, host);
      if (by) {
        // Below (or above) the visible part of the screen: scroll it into view once, then measure again.
        // If the screen can't scroll, or it's still out of view, skip this step rather than dim the screen
        // around a card that can't be seen.
        if (scrolled || !scrollBy(by)) return next();
        scrolled = true;
        setRect(null);
        timer = setTimeout(() => void locate(), SCROLL_SETTLE_MS);
        return;
      }
      setRect(local);
    }
    void locate();
    timer = setTimeout(() => void locate(), 300);
    return () => {
      current = false;
      if (timer) clearTimeout(timer);
    };
    // Measure per step and when the screen size changes (rotation, split screen).
  }, [stepKey, window.width, window.height]); // eslint-disable-line react-hooks/exhaustive-deps

  // The card fades in when it's actually on screen. A step that first scrolls its control into view shows the
  // card only after the scroll; starting the fade while the card wasn't drawn left it stuck nearly invisible.
  const shownKey = step && (!step.target || rect) ? stepKey : null;
  useEffect(() => {
    if (!shownKey || !step || !flow) return;
    const copy = copy_for(step, flow.context);
    AccessibilityInfo.announceForAccessibility(`${copy.title}. ${copy.message}`);
    // Moves screen reader focus to the card. The web has no native view handles (and no setAccessibilityFocus).
    const node = Platform.OS === "web" ? null : findNodeHandle(titleRef.current);
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
    if (reduceMotion) return entrance.setValue(1);
    entrance.setValue(0);
    Animated.timing(entrance, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [shownKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Android's back button closes the walkthrough rather than the screen beneath it.
  useEffect(() => {
    if (!flow) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      skip();
      return true;
    });
    return () => subscription.remove();
  }, [flow, skip]);

  if (!flow || !step || (step.target && !rect)) return null;
  const copy = copy_for(step, flow.context);
  const screen = { width: window.width, height: window.height };
  const spotlight = rect ? spotlight_rect(rect, screen) : null;
  const placement = spotlight ? card_placement(spotlight, screen, GUTTER) : null;
  const last = flow.index === flow.steps.length - 1;
  const primaryLabel = step.primaryLabel ?? (last ? "Got it" : "Next");
  // Steps whose control isn't on this screen are skipped, so they aren't counted either: the count never jumps.
  const total = flow.steps.filter(walkthrough.canShow).length;
  const position = flow.steps.slice(0, flow.index + 1).filter(walkthrough.canShow).length;
  const dim = theme.isDark ? "rgba(0,0,0,0.55)" : "rgba(17,24,39,0.38)";
  const blocking = !screenReader;
  const cardPosition = placement
    ? placement.side === "below"
      ? { top: placement.top }
      : { bottom: placement.bottom }
    : { bottom: host === "reader" ? 170 : 110 };

  return (
    <View ref={rootRef} collapsable={false} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {blocking && !spotlight && step.secondaryLabel ? (
        <View
          testID="walkthrough-dim"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          onStartShouldSetResponder={() => true}
          style={[StyleSheet.absoluteFill, { backgroundColor: dim }]}
        />
      ) : null}
      {blocking && spotlight
        ? dim_regions(spotlight, screen).map((region, index) => (
            <View
              key={index}
              testID="walkthrough-dim"
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              onStartShouldSetResponder={() => true}
              style={[
                s.fill,
                {
                  left: region.x,
                  top: region.y,
                  width: region.width,
                  height: region.height,
                  backgroundColor: dim,
                },
              ]}
            />
          ))
        : null}
      {spotlight ? (
        <View
          testID="walkthrough-spotlight"
          pointerEvents={step.interactive || !blocking ? "none" : "auto"}
          onStartShouldSetResponder={() => true}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[
            s.fill,
            s.spotlight,
            {
              left: spotlight.x,
              top: spotlight.y,
              width: spotlight.width,
              height: spotlight.height,
              borderColor: theme.accent,
            },
          ]}
        />
      ) : null}
      <Animated.View
        testID="walkthrough-card"
        style={[
          s.card,
          cardPosition,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            opacity: entrance,
            transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
          },
        ]}
      >
        {placement ? (
          <View
            style={[
              s.pointer,
              placement.side === "below" ? { top: -7 } : { bottom: -7 },
              {
                left: placement.pointerX - GUTTER - 7,
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
              placement.side === "below" ? s.pointerUp : s.pointerDown,
            ]}
          />
        ) : null}
        <Text ref={titleRef} accessibilityRole="header" style={[s.title, { color: theme.text }]}>
          {copy.title}
        </Text>
        <Text style={[s.message, { color: theme.text }]}>{copy.message}</Text>
        <View style={s.footer}>
          {total > 1 ? (
            <Text
              accessibilityLabel={`Step ${position} of ${total}`}
              style={[s.count, { color: theme.mutedText }]}
            >
              {position} of {total}
            </Text>
          ) : null}
          <View style={s.spacer} />
          {!last && !step.secondaryLabel ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip walkthrough"
              onPress={skip}
              style={s.secondary}
            >
              <Text style={[s.secondaryText, { color: theme.mutedText }]}>Skip</Text>
            </Pressable>
          ) : null}
          {step.secondaryLabel ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={primaryLabel}
              onPress={next}
              style={({ pressed }) => [
                s.primary,
                { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[s.primaryText, { color: theme.playIcon }]}>{primaryLabel}</Text>
            </Pressable>
          )}
        </View>
        {step.secondaryLabel ? (
          <View style={s.choices}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={primaryLabel}
              onPress={next}
              style={({ pressed }) => [
                s.primary,
                { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[s.primaryText, { color: theme.playIcon }]}>{primaryLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={step.secondaryLabel}
              onPress={skip}
              style={s.secondary}
            >
              <Text style={[s.secondaryText, { color: theme.mutedText }]}>{step.secondaryLabel}</Text>
            </Pressable>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { position: "absolute" },
  spotlight: { borderWidth: 2, borderRadius: radii.md },
  card: {
    position: "absolute",
    left: GUTTER,
    right: GUTTER,
    maxWidth: 440,
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  pointer: { position: "absolute", width: 14, height: 14, borderWidth: 1, transform: [{ rotate: "45deg" }] },
  pointerUp: { borderBottomWidth: 0, borderRightWidth: 0 },
  pointerDown: { borderTopWidth: 0, borderLeftWidth: 0 },
  title: { fontSize: 17, fontWeight: "800", lineHeight: 23 },
  message: { fontSize: 15, lineHeight: 22 },
  footer: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm, gap: spacing.sm },
  count: { fontSize: 13, fontWeight: "600" },
  spacer: { flex: 1 },
  choices: { gap: spacing.xs, marginTop: spacing.xs },
  secondary: {
    minHeight: controlSizes.minimumTouch,
    minWidth: controlSizes.minimumTouch,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryText: { fontSize: 15, fontWeight: "700" },
  primary: {
    minHeight: 44,
    minWidth: 88,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontSize: 15, fontWeight: "800" },
});
