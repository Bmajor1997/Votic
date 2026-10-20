import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVoticTheme } from "../theme/ThemeProvider";

export function ActivityLoadState({ error, retry }: { error: string | null; retry: () => void }) {
  const { theme } = useVoticTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ padding: 24, gap: 16 }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ minHeight: 48 }}>
          <Text style={{ color: theme.text }}>Back</Text>
        </Pressable>
        <Text accessibilityRole="alert" style={{ color: theme.text }}>
          {error ?? "Loading your activity…"}
        </Text>
        {error ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading activity"
            onPress={retry}
            style={{ minHeight: 48 }}
          >
            <Text style={{ color: theme.accentText }}>Retry</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
