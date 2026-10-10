import { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { useVoticTheme } from "../theme/ThemeProvider";
export function Card({ children }: PropsWithChildren) {
  const { theme } = useVoticTheme();
  return (
    <View style={[s.card, theme.elevation, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {children}
    </View>
  );
}
const s = StyleSheet.create({ card: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 10 } });
