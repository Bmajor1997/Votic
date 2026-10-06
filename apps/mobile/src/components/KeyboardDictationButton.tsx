import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, StyleSheet } from "react-native";
import { useVoticTheme } from "../theme/ThemeProvider";

/** Uses OS keyboard dictation without adding a native recorder to the installed build. */
export function KeyboardDictationButton({
  onFocus,
  disabled = false,
}: {
  onFocus: () => void;
  disabled?: boolean;
}) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Use keyboard dictation"
      accessibilityHint="Shows how to dictate with your phone keyboard’s microphone"
      disabled={disabled}
      onPress={() =>
        Alert.alert(
          "Keyboard dictation",
          "Tap the microphone on your phone’s keyboard to speak your question. You can edit the words before sending. If your keyboard has no microphone, enable dictation in its settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open keyboard", onPress: onFocus },
          ],
        )
      }
      style={({ pressed }) => [s.button, { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}
    >
      <Ionicons name="mic-outline" size={22} color={theme.accentText} />
    </Pressable>
  );
}
const s = StyleSheet.create({
  button: { width: 44, minHeight: 48, alignItems: "center", justifyContent: "center" },
});
