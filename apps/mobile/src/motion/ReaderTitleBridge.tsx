import { RefObject, useEffect, useState } from "react";
import { Animated, Text, View } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { DocumentSourceRect, useDocumentTransition } from "../navigation/DocumentTransitionProvider";
import { useVoticTheme } from "../theme/ThemeProvider";

/** An unscaled title travels independently above the expanding reader surface. */
export function ReaderTitleBridge({
  rootNode,
  titleNode,
  title,
}: {
  rootNode: RefObject<View | null>;
  titleNode: RefObject<Text | null>;
  title: string;
}) {
  const { sourceRect, progress, transitioning } = useDocumentTransition();
  const { reduceMotion } = useAccessibilityPreferences();
  const { theme } = useVoticTheme();
  const [destination, setDestination] = useState<DocumentSourceRect | null>(null);
  useEffect(() => {
    if (!transitioning || !sourceRect?.heading || reduceMotion) return;
    const frame = requestAnimationFrame(() => {
      const root = rootNode.current;
      if (!root) return;
      // Yoga coordinates relative to the untransformed root avoid measuring the expanding surface.
      titleNode.current?.measureLayout(
        root,
        (x, y, width, height) => {
          if (width > 0 && height > 0) setDestination({ x, y, width, height });
        },
        () => {},
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [transitioning, sourceRect, reduceMotion, titleNode, rootNode]);
  const source = sourceRect?.heading;
  if (reduceMotion || !transitioning || !source || !destination || source.text !== title) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: destination.width,
        opacity: progress.interpolate({
          inputRange: [0, 0.75, 1],
          outputRange: [1, 1, 0],
          extrapolate: "clamp",
        }),
        transform: [
          {
            translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [source.x, destination.x] }),
          },
          {
            translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [source.y, destination.y] }),
          },
        ],
      }}
    >
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={1.2}
        style={{ color: theme.text, fontSize: 19, lineHeight: 24, fontWeight: "800" }}
      >
        {title}
      </Text>
    </Animated.View>
  );
}
