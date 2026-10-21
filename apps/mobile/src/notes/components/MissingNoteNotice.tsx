import { Text } from "react-native";
import { useVoticTheme } from "../../theme/ThemeProvider";

/** Shown when a link asked for a note that has since been deleted, instead of opening something else. */
export function MissingNoteNotice({ visible }: { visible: boolean }) {
  const { theme } = useVoticTheme();
  if (!visible) return null;
  return (
    <Text accessibilityRole="alert" style={{ color: theme.text, fontSize: 15, lineHeight: 22 }}>
      That note is no longer available. It may have been deleted.
    </Text>
  );
}
