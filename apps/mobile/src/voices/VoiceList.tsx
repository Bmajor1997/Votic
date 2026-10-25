import { StyleSheet, Text, View } from "react-native";
import { spacing } from "../design/tokens";
import { VoiceChoice } from "../reader/components/ReaderControls";
import type { DeviceVoice } from "../reader/voices";
import { useVoticTheme } from "../theme/ThemeProvider";
import { voice_detail } from "./voiceDetails";

/** Every voice with a preview button and its accent, shared by the Reader, Settings and setup. */
export function VoiceList({
  voices,
  names,
  selected,
  previewing,
  onPreview,
  onSelect,
  loaded = true,
}: {
  voices: DeviceVoice[];
  names: Record<string, string>;
  selected: string | null;
  previewing: string | null;
  onPreview: (voice: DeviceVoice, name: string) => void;
  onSelect: (voice: DeviceVoice) => void;
  loaded?: boolean;
}) {
  const { theme } = useVoticTheme();
  if (!voices.length)
    return (
      <Text style={[s.empty, { color: theme.mutedText }]}>
        {loaded ? "Your device voice will be used." : "Loading voices…"}
      </Text>
    );
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Voices" style={s.list}>
      {voices.map((voice) => {
        const name = names[voice.identifier];
        return (
          <VoiceChoice
            key={voice.identifier}
            name={name}
            detail={voice_detail(voice)}
            selected={selected === voice.identifier}
            previewing={previewing === voice.identifier}
            onPreview={() => onPreview(voice, name)}
            onSelect={() => onSelect(voice)}
          />
        );
      })}
    </View>
  );
}
const s = StyleSheet.create({
  list: { gap: spacing.sm },
  empty: { fontSize: 14, paddingVertical: spacing.sm },
});
