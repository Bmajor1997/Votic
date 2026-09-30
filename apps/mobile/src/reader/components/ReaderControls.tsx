import { Ionicons } from "@expo/vector-icons";
import { ComponentProps, ReactNode, useRef, useState } from "react";
import { GestureResponderEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { radii, spacing, typography } from "../../design/tokens";
import { useVoticTheme } from "../../theme/ThemeProvider";
import { sheetStyles } from "./sheetStyles";

type IconName = ComponentProps<typeof Ionicons>["name"];

export function Choice<T extends string>({
  label,
  value,
  current,
  onChange,
}: {
  label: string;
  value: T;
  current: T;
  onChange: (value: T) => void;
}) {
  const { theme } = useVoticTheme();
  const selected = value === current;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={() => onChange(value)}
      style={({ pressed }) => [
        s.choice,
        {
          borderColor: selected ? theme.accent : theme.border,
          backgroundColor: selected ? theme.sentenceHighlight : theme.surface,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[s.choiceText, { color: selected ? theme.accent : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Setting({ label, children }: { label: string; children: ReactNode }) {
  const { theme } = useVoticTheme();
  return (
    <View style={s.setting}>
      <Text style={[sheetStyles.settingLabel, { color: theme.mutedText }]}>{label}</Text>
      <View style={s.choiceRow}>{children}</View>
    </View>
  );
}

/** A progress bar that can be dragged or tapped, and adjusted with screen-reader actions. */
export function SeekableProgress({
  value,
  compact = false,
  onSeekStart,
  onSeek,
}: {
  value: number;
  compact?: boolean;
  onSeekStart: () => void;
  onSeek: (value: number) => void;
}) {
  const { theme } = useVoticTheme();
  const [draft, setDraft] = useState<number | null>(null);
  const width = useRef(1);
  const shown = draft ?? value;
  function valueFromEvent(event: GestureResponderEvent) {
    return Math.max(0, Math.min(1, event.nativeEvent.locationX / width.current));
  }
  function begin(event: GestureResponderEvent) {
    const next = valueFromEvent(event);
    onSeekStart();
    setDraft(next);
  }
  function move(event: GestureResponderEvent) {
    setDraft(valueFromEvent(event));
  }
  function finish(event: GestureResponderEvent) {
    const next = valueFromEvent(event);
    setDraft(null);
    onSeek(next);
  }
  function adjust(direction: "increment" | "decrement") {
    onSeekStart();
    onSeek(Math.max(0, Math.min(1, value + (direction === "increment" ? 0.05 : -0.05))));
  }
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Document playback position"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(shown * 100),
        text: `${Math.round(shown * 100)} percent`,
      }}
      accessibilityActions={[
        { name: "increment", label: "Move forward" },
        { name: "decrement", label: "Move backward" },
      ]}
      onAccessibilityAction={(event) => {
        const name = event.nativeEvent.actionName;
        if (name === "increment" || name === "decrement") adjust(name);
      }}
      onLayout={(event) => {
        width.current = Math.max(1, event.nativeEvent.layout.width);
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={begin}
      onResponderMove={move}
      onResponderRelease={finish}
      onResponderTerminate={finish}
      onResponderTerminationRequest={() => false}
      style={[s.seekTarget, compact && s.seekTargetCompact]}
    >
      <View style={[compact ? s.dockTrack : s.track, { backgroundColor: theme.border }]}>
        <View style={[s.fill, { backgroundColor: theme.accent, width: `${shown * 100}%` as `${number}%` }]} />
        <View
          style={[s.seekThumb, { backgroundColor: theme.accent, left: `${shown * 100}%` as `${number}%` }]}
        />
      </View>
    </View>
  );
}

export function VoiceChoice({
  name,
  selected,
  previewing,
  onPreview,
  onSelect,
}: {
  name: string;
  selected: boolean;
  previewing: boolean;
  onPreview: () => void;
  onSelect: () => void;
}) {
  const { theme } = useVoticTheme();
  return (
    <View
      style={[
        s.voiceChoice,
        {
          borderColor: selected ? theme.accent : theme.border,
          backgroundColor: selected ? theme.sentenceHighlight : theme.surface,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={previewing ? `Stop ${name} voice preview` : `Preview ${name} voice`}
        onPress={onPreview}
        style={({ pressed }) => [
          s.voicePreview,
          { backgroundColor: selected ? theme.accent : theme.surfaceMuted, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Ionicons name={previewing ? "stop" : "play"} size={18} color={selected ? "#FFF" : theme.accent} />
      </Pressable>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`Select ${name} voice`}
        onPress={onSelect}
        style={({ pressed }) => [s.voiceSelect, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={[s.voiceName, { color: selected ? theme.accent : theme.text }]}>{name}</Text>
        {selected ? <Ionicons name="checkmark-circle" size={19} color={theme.accent} /> : null}
      </Pressable>
    </View>
  );
}

export function ToolButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: IconName;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: active }}
      onPress={onPress}
      style={({ pressed }) => [
        s.tool,
        { backgroundColor: active ? theme.sentenceHighlight : "transparent", opacity: pressed ? 0.65 : 1 },
      ]}
    >
      <Ionicons name={icon} size={19} color={active ? theme.accent : theme.text} />
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={1.1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        style={[s.toolLabel, { color: active ? theme.accent : theme.text }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  setting: { gap: spacing.sm },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  choice: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1,
  },
  choiceText: { ...typography.control },
  seekTarget: { minHeight: 36, justifyContent: "center" },
  seekTargetCompact: { minHeight: 28, marginHorizontal: spacing.md, marginBottom: 0 },
  track: { height: 4, borderRadius: 2, overflow: "hidden" },
  dockTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: "100%" },
  seekThumb: { position: "absolute", top: -3, width: 10, height: 10, borderRadius: 5, marginLeft: -5 },
  voiceChoice: {
    width: "100%",
    minHeight: 54,
    borderWidth: 1,
    borderRadius: radii.md,
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.xs,
  },
  voicePreview: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  voiceSelect: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  voiceName: { ...typography.control, fontSize: 15 },
  tool: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  toolLabel: { fontSize: 10, fontWeight: "700", maxWidth: "100%" },
});
