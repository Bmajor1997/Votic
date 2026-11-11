import { DEFAULT_ACCENT, make_theme } from "../theme/ThemeProvider";
import { useCallback, useMemo, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { MOTION } from "../motion/motionSpec";
import { split_passages } from "../documents/passages";
import { VoticDocument } from "../documents/types";
import { darkCards } from "../design/cardPalette";
import { editorial } from "../design/editorial";
import { saved_excerpt } from "./savedExcerpt";

// Preview paper stays light independently of the surrounding app or reader appearance.
const paper = make_theme(DEFAULT_ACCENT, "light", true);

/**
 * The paper slides in from the left each time Home comes into view (from another tab or screen), fading in over the
 * first part so it never jumps from its place to the start. Rerenders and progress updates don't replay it; leaving
 * Home stops it with the paper at rest; with Less motion it's simply at rest. 0 = arriving, 1 = in place.
 */
function usePaperEntrance() {
  const { reduceMotion, motionReady } = useAccessibilityPreferences();
  // Starts out of place, so the first frame never shows the paper at rest before it slides in.
  const [arrival] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) {
        arrival.setValue(1);
        return;
      }
      // Until the motion preference is known, keep waiting out of view; this reruns once it is.
      if (!motionReady) return;
      arrival.setValue(0);
      const animation = Animated.timing(arrival, {
        toValue: 1,
        duration: MOTION.papers.duration,
        delay: MOTION.papers.delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
        isInteraction: false,
      });
      // Stopped early (leaving Home, Less motion): rest the paper once the stop has reported where it was.
      animation.start(({ finished }) => {
        if (!finished) arrival.setValue(1);
      });
      return () => {
        animation.stop();
        arrival.setValue(1);
      };
    }, [arrival, reduceMotion, motionReady]),
  );
  return arrival;
}

/** Text already stored on device, using the same passage boundaries as Reader and speech. */
export function ContinuePreview({ document }: { document: VoticDocument }) {
  const { width, fontScale } = useWindowDimensions();
  const arrival = usePaperEntrance();
  const { travel, fadeUntil } = MOTION.papers;
  const passages = useMemo(() => split_passages(document.plainText), [document.plainText]);
  const excerpt = useMemo(
    () => saved_excerpt(passages, document.sentenceIndex, document.wordIndex),
    [passages, document.sentenceIndex, document.wordIndex],
  );
  return (
    <View testID="home-position-preview" style={[s.preview, { width: width <= 350 ? 104 : 132 }]}>
      <Text style={s.label}>{excerpt ? "AT YOUR SAVED POSITION" : "DOCUMENT PREVIEW"}</Text>
      <View style={s.sheets}>
        <Animated.View
          testID="home-preview-paper"
          style={[
            s.page,
            {
              backgroundColor: paper.background,
              borderColor: paper.border,
              opacity: arrival.interpolate({
                inputRange: [0, fadeUntil],
                outputRange: [0, 1],
                extrapolate: "clamp",
              }),
              transform: [
                { translateX: arrival.interpolate({ inputRange: [0, 1], outputRange: [-travel, 0] }) },
              ],
            },
          ]}
        >
          <Text numberOfLines={fontScale > 1.3 ? 5 : 7} style={[s.excerpt, { color: paper.text }]}>
            {excerpt || "Open this document to pick up where you left off."}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  preview: { flexShrink: 0, gap: 8 },
  label: { color: darkCards.chapter.detail, fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  sheets: { paddingRight: 4, paddingBottom: 5 },
  page: {
    minHeight: 184,
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 15,
    gap: 9,
    shadowColor: "#060F20",
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  excerpt: { ...editorial, fontSize: 12, lineHeight: 18, letterSpacing: 0 },
});
