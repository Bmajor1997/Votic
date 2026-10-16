import { forwardRef, useState, type ComponentProps } from "react";
import { Animated, ScrollView, StyleSheet, View } from "react-native";
import { useVoticTheme } from "../theme/ThemeProvider";

// Content softly fades at the top and bottom edges while it scrolls, instead of being cut off by the screen edge.
const FADE_HEIGHT = 32;
const FADE_STEPS = 8;

/** A soft gradient from the screen's background to clear, made of thin bands (no extra native modules). */
function EdgeFade({
  edge,
  color,
  opacity,
}: {
  edge: "top" | "bottom";
  color: string;
  opacity: Animated.AnimatedInterpolation<number> | number;
}) {
  return (
    <Animated.View
      testID={`scroll-fade-${edge}`}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[s.fade, edge === "top" ? s.top : s.bottom, { opacity }]}
    >
      {Array.from({ length: FADE_STEPS }, (_, index) => {
        // Strongest at the screen edge, fading to clear toward the content.
        const fromEdge = edge === "top" ? index : FADE_STEPS - 1 - index;
        const strength = 1 - fromEdge / FADE_STEPS;
        return (
          <View
            key={index}
            style={{ height: FADE_HEIGHT / FADE_STEPS, backgroundColor: color, opacity: strength * strength }}
          />
        );
      })}
    </Animated.View>
  );
}

type Props = Omit<ComponentProps<typeof Animated.ScrollView>, "onScroll" | "scrollEventThrottle"> & {
  /** The color content fades into; the screen's background by default. */
  fadeColor?: string;
};

/**
 * A scroll view whose content fades at the edges: the top fade appears once something has scrolled under it,
 * and the bottom fade leaves at the end of the page. The fades follow the scroll on the native thread.
 */
export const FadingScrollView = forwardRef<ScrollView, Props>(function FadingScrollView(
  { fadeColor, onLayout, onContentSizeChange, style, children, ...props },
  ref,
) {
  const { theme } = useVoticTheme();
  const [scrollY] = useState(() => new Animated.Value(0));
  const [viewport, setViewport] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const maxScroll = Math.max(0, contentHeight - viewport);
  const topFade = scrollY.interpolate({
    inputRange: [0, FADE_HEIGHT],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const bottomFade =
    maxScroll > 0
      ? scrollY.interpolate({
          inputRange: [Math.max(0, maxScroll - FADE_HEIGHT), maxScroll],
          outputRange: [1, 0],
          extrapolate: "clamp",
        })
      : 0;
  const color = fadeColor ?? theme.background;
  return (
    <Animated.View style={[s.wrap, style]}>
      <Animated.ScrollView
        ref={ref}
        {...props}
        style={s.wrap}
        scrollEventThrottle={16}
        onLayout={(event) => {
          setViewport(event.nativeEvent.layout.height);
          onLayout?.(event);
        }}
        onContentSizeChange={(width, height) => {
          setContentHeight(height);
          onContentSizeChange?.(width, height);
        }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
      >
        {children}
      </Animated.ScrollView>
      <EdgeFade edge="top" color={color} opacity={topFade} />
      <EdgeFade edge="bottom" color={color} opacity={bottomFade} />
    </Animated.View>
  );
});

const s = StyleSheet.create({
  wrap: { flex: 1 },
  fade: { position: "absolute", left: 0, right: 0, height: FADE_HEIGHT },
  top: { top: 0 },
  bottom: { bottom: 0 },
});
