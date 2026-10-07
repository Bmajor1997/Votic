import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { useVoticTheme } from "../theme/ThemeProvider";

const BAR_HEIGHTS = [10, 18, 13, 21, 15];

/**
 * Compact Votic voice control.
 *
 * V1 still relies on the phone keyboard's dictation service for speech-to-text,
 * so activating voice mode focuses the composer instead of pretending Votic is
 * recording audio itself. The mic morphs into a waveform to make the active
 * voice-input state clear while the transcript arrives in the text field.
 */
export function KeyboardDictationButton({
  onFocus,
  disabled = false,
}: {
  onFocus: () => void;
  disabled?: boolean;
}) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const [listening, setListening] = useState(false);
  const pulse = useRef(BAR_HEIGHTS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!listening || reduceMotion) {
      pulse.forEach((value) => {
        value.stopAnimation();
        value.setValue(0);
      });
      return;
    }

    const animations = pulse.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 55),
          Animated.timing(value, {
            toValue: 1,
            duration: 260,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
            isInteraction: false,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 300,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
            isInteraction: false,
          }),
        ]),
      ),
    );
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [listening, pulse, reduceMotion]);

  function toggleVoiceInput() {
    if (disabled) return;
    setListening((active) => !active);
    onFocus();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={listening ? "Stop voice input" : "Start voice input"}
      accessibilityHint={
        listening
          ? "Stops the Votic voice input animation. Your dictated text stays editable."
          : "Opens the keyboard so you can dictate your question with your phone microphone."
      }
      accessibilityState={{ disabled, selected: listening }}
      disabled={disabled}
      onPress={toggleVoiceInput}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: listening ? theme.sentenceHighlight : "transparent",
          opacity: disabled ? 0.4 : pressed ? 0.72 : 1,
        },
      ]}
    >
      {listening ? (
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={s.waveform}
          testID="voice-waveform"
        >
          {BAR_HEIGHTS.map((height, index) => (
            <Animated.View
              key={height + "-" + index}
              style={[
                s.bar,
                {
                  backgroundColor: theme.accentText,
                  height,
                  transform: [
                    {
                      scaleY: reduceMotion
                        ? 0.72
                        : pulse[index].interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.48, 1],
                          }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
      ) : (
        <Ionicons name="mic-outline" size={22} color={theme.accentText} />
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  button: {
    width: 44,
    minHeight: 48,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  waveform: {
    width: 28,
    height: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  bar: {
    width: 3,
    borderRadius: 2,
  },
});
