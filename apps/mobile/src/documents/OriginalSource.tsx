import { Alert, Linking, Pressable, Text } from "react-native";
import { useVoticTheme } from "../theme/ThemeProvider";
import { safe_source_url } from "./sourceInformation";

export function OriginalSource({ url }: { url?: string }) {
  const { theme } = useVoticTheme();
  const source = safe_source_url(url);
  if (!source)
    return (
      <Text style={{ color: theme.mutedText }}>
        Original link unavailable. Imported text remains saved on this device. Original files are not
        retained.
      </Text>
    );
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Open original webpage in browser"
      accessibilityHint={source}
      style={{ minHeight: 48, justifyContent: "center" }}
      onPress={() =>
        Alert.alert("Open original webpage?", source, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open",
            onPress: () =>
              void Linking.openURL(source).catch(() =>
                Alert.alert(
                  "Could not open original",
                  "The original website may be unavailable. Your imported document is still saved.",
                ),
              ),
          },
        ])
      }
    >
      <Text style={{ color: theme.accentText }}>Open original</Text>
    </Pressable>
  );
}
