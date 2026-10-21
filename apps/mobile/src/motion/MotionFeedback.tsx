import { Ionicons } from "@expo/vector-icons";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AccessibilityInfo, Animated, AppState, StyleSheet, Text, View } from "react-native";
import { useAccountData } from "../storage/AccountDataProvider";
import { useVoticTheme } from "../theme/ThemeProvider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MOTION } from "./motionSpec";
import { useMotionValue } from "./useMotionValue";

export type SavedEvent = {
  kind: "import" | "note" | "bookmark";
  title: string;
  id: number;
  uid: string;
  target?: string;
};
type Feedback = {
  event: SavedEvent | null;
  show: (kind: SavedEvent["kind"], title: string, target?: string) => void;
};
const Context = createContext<Feedback>({ event: null, show: () => {} });

/** Ephemeral account-scoped confirmation; never persists a filename or changes navigation. */
export function MotionFeedbackProvider({ children }: PropsWithChildren) {
  const { uid } = useAccountData();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const sequence = useRef(0);
  const [event, setEvent] = useState<SavedEvent | null>(null);
  const show = useCallback(
    (kind: SavedEvent["kind"], title: string, target?: string) => {
      if (mounted.current && uid) setEvent({ kind, title, uid, target, id: ++sequence.current });
    },
    [uid],
  );
  useEffect(() => {
    if (event) AccessibilityInfo.announceForAccessibility(`${saved_label(event.kind)}. ${event.title}`);
    const timer = setTimeout(() => setEvent(null), MOTION.saved.hold);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") setEvent(null);
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [event]);
  return (
    <Context.Provider value={{ event: event?.uid === uid ? event : null, show }}>{children}</Context.Provider>
  );
}
export const useMotionFeedback = () => useContext(Context);

export function MotionFeedbackNotice({ bottom = 80 }: { bottom?: number }) {
  const { event } = useMotionFeedback();
  return event ? <SavedNotice key={event.id} event={event} bottom={bottom} /> : null;
}
function SavedNotice({ event, bottom }: { event: SavedEvent; bottom: number }) {
  const insets = useSafeAreaInsets();
  const { theme } = useVoticTheme();
  const progress = useMotionValue(1, MOTION.saved.duration, 0);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.notice,
        {
          bottom: bottom + insets.bottom,
          backgroundColor: theme.surface,
          borderColor: theme.accent,
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
          ],
        },
      ]}
    >
      <View style={[s.icon, { backgroundColor: theme.sentenceHighlight }]} accessible={false}>
        <Animated.View
          style={{
            position: "absolute",
            opacity: progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0, 0] }),
            transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.65] }) }],
          }}
        >
          <Ionicons
            name={event.kind === "import" ? "document-outline" : "create-outline"}
            size={24}
            color={theme.accentText}
          />
        </Animated.View>
        <Animated.View
          style={{
            opacity: progress,
            transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
          }}
        >
          <Ionicons name="checkmark" size={24} color={theme.accentText} />
        </Animated.View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontWeight: "700" }}>{saved_label(event.kind)}</Text>
        <Text numberOfLines={1} style={{ color: theme.mutedText }}>
          {event.title}
        </Text>
      </View>
    </Animated.View>
  );
}
const s = StyleSheet.create({
  notice: {
    position: "absolute",
    left: 16,
    right: 16,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    zIndex: 20,
  },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});

/** Match a confirmed save to one control or note row. */
export function saved_motion_trigger(event: SavedEvent | null, kind: SavedEvent["kind"], target?: string) {
  return event?.kind === kind && (!target || event.target === target) ? event.id : undefined;
}

function saved_label(kind: SavedEvent["kind"]) {
  if (kind === "import") return "Added to your library";
  return kind === "note" ? "Note saved" : "Passage saved";
}
