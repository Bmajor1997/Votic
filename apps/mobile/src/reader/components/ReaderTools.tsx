import { Ionicons } from "@expo/vector-icons";
import { useMotionValue } from "../../motion/useMotionValue";
import { MOTION } from "../../motion/motionSpec";
import { router } from "expo-router";
import { Animated, Pressable, Text, TextInput, View } from "react-native";
import { useVoticTheme } from "../../theme/ThemeProvider";
import type { useReaderFind } from "../useReaderFind";
import { SleepTimerControl } from "./SleepTimerControl";

export function ReaderTools({
  listening,
  stop,
  find,
  voiceName,
  onVoice,
}: {
  listening: boolean;
  stop: () => Promise<void>;
  find: ReturnType<typeof useReaderFind>;
  /** The voice reading this document, always shown while listening so people know they can change it. */
  voiceName: string;
  onVoice: () => void;
}) {
  const { theme } = useVoticTheme();
  const modeProgress = useMotionValue(listening ? 1 : 0, MOTION.mode.duration);
  const button = { minHeight: 48, paddingHorizontal: 12, justifyContent: "center" as const };
  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
        <View style={{ flexDirection: "row", borderRadius: 24, backgroundColor: theme.surfaceMuted }}>
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 3,
              bottom: 3,
              left: 3,
              width: MOTION.mode.pillWidth - 6,
              borderRadius: 22,
              backgroundColor: theme.sentenceHighlight,
              transform: [
                {
                  translateX: modeProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, MOTION.mode.pillWidth],
                  }),
                },
              ],
            }}
          />
          {(["read", "listen"] as const).map((mode) => (
            <Pressable
              key={mode}
              accessibilityRole="tab"
              accessibilityState={{ selected: listening === (mode === "listen") }}
              style={[button, { width: MOTION.mode.pillWidth, alignItems: "center" }]}
              onPress={() => {
                if (listening === (mode === "listen")) return;
                find.close();
                void stop().then(() => router.setParams({ mode, autoplay: "0" }));
              }}
            >
              <Text
                style={{
                  color: listening === (mode === "listen") ? theme.accentText : theme.mutedText,
                  fontWeight: "700",
                }}
              >
                {mode === "read" ? "Read" : "Listen"}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Find within document"
          onPress={find.show}
          style={button}
        >
          <Text style={{ color: theme.accentText }}>Find</Text>
        </Pressable>
        {listening ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Voice: ${voiceName}. Change voice`}
            onPress={onVoice}
            style={[button, { flexDirection: "row", alignItems: "center", gap: 6 }]}
          >
            <Ionicons name="person-circle-outline" size={18} color={theme.accentText} />
            <Text numberOfLines={1} style={{ color: theme.accentText, fontWeight: "600" }}>
              Voice: {voiceName}
            </Text>
          </Pressable>
        ) : null}
        {listening ? <SleepTimerControl /> : null}
      </View>
      {find.open ? (
        <View style={{ paddingHorizontal: 12, gap: 4 }}>
          <TextInput
            autoFocus
            accessibilityLabel="Search document text"
            placeholder="Find in this document"
            placeholderTextColor={theme.mutedText}
            value={find.query}
            maxLength={120}
            onChangeText={find.setQuery}
            style={{
              minHeight: 48,
              color: theme.text,
              borderColor: theme.border,
              borderWidth: 1,
              padding: 8,
              borderRadius: 8,
            }}
          />
          <Text accessibilityLiveRegion="polite" style={{ color: theme.mutedText }}>
            {find.busy
              ? "Searching…"
              : !find.query.trim()
                ? "Enter text to find"
                : !find.matches.length
                  ? "No results"
                  : `${find.selected + 1} of ${Math.min(find.matches.length, 1000)}${find.matches.length > 1000 ? "+ (first 1,000 shown)" : ""}${find.context ? `: ${find.context}` : ""}`}
          </Text>
          <View style={{ flexDirection: "row" }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous match"
              disabled={!find.matches.length}
              onPress={() => find.move(-1)}
              style={button}
            >
              <Text style={{ color: theme.accentText }}>Previous</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next match"
              disabled={!find.matches.length}
              onPress={() => find.move(1)}
              style={button}
            >
              <Text style={{ color: theme.accentText }}>Next</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close document search"
              onPress={find.close}
              style={button}
            >
              <Text style={{ color: theme.accentText }}>Close</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
