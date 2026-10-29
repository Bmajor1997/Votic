import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { HighlightMode, useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { radii, spacing } from "../design/tokens";
import { useVoticPurpose } from "../personalization/PurposeProvider";
import { format_playback_rate } from "../playback/rates";
import { ACCESSIBLE_FONT_BOLD } from "../reader/readerFontNames";
import { reader_type } from "../reader/readerText";
import { useVoticTheme } from "../theme/ThemeProvider";
import { useDeviceVoices } from "../voices/useDeviceVoices";
import { featured_voices, is_high_quality, voice_accent } from "../voices/voiceDetails";
import { PrimaryButton, StepScaffold } from "./components";
import { ListeningPreference, PersonalizationAnswers } from "./onboardingModel";
import { PREVIEW_SAMPLES } from "./sampleDocument";

/** Each speed with a word for how it feels, so the choice is about pace rather than a number. */
export const LISTENING_SPEEDS = [
  { rate: 0.8, feel: "Relaxed" },
  { rate: 1, feel: "Natural" },
  { rate: 1.2, feel: "Brisk" },
  { rate: 1.5, feel: "Fast" },
  { rate: 2, feel: "Skim" },
];
const HIGHLIGHTS: { value: HighlightMode; label: string; short: string; detail: string }[] = [
  {
    value: "both",
    label: "Words and sentences",
    short: "Words + sentences",
    detail: "Follow every word as it's read",
  },
  { value: "sentence", label: "Sentences only", short: "Sentences", detail: "A calmer highlight" },
  { value: "off", label: "No highlighting", short: "None", detail: "Just listen" },
];
/** The listening answers saved with this account for each highlight choice. */
const LISTENING_FOR: Record<HighlightMode, ListeningPreference[]> = {
  both: ["highlight-words", "highlight-sentence"],
  word: ["highlight-words"],
  sentence: ["highlight-sentence"],
  off: [],
};
/** The sample always sits on white paper with dark ink, in every theme, like the Home preview. */
const PAPER = "#FFFCF7";
const INK = "#1F2937";
const AVATAR_COLORS = ["#2563EB", "#1F5C4D", "#9333EA", "#C2410C"];
/** Where Android keeps its text-to-speech engine and voice downloads. */
const ANDROID_TTS_SETTINGS = "com.android.settings.TTS_SETTINGS";

export type ListeningStepProps = {
  access: ReturnType<typeof useAccessibilityPreferences>;
  personalization: ReturnType<typeof useVoticPurpose>;
  step: number;
  total: number;
  onBack?: () => void;
  onNext: () => void;
  answers: PersonalizationAnswers;
  setAnswers: (answers: PersonalizationAnswers) => void;
  finishLabel: string;
};

/**
 * The last setup step: one sample page in a player, then voice, speed and highlighting. Every choice is heard or
 * seen on the same page straight away. Uses the phone's own voices only.
 */
export function ListeningStep({
  step,
  total,
  onBack,
  onNext,
  answers,
  setAnswers,
  finishLabel,
  access: a,
  personalization,
}: ListeningStepProps) {
  const { theme } = useVoticTheme();
  const { width, fontScale } = useWindowDimensions();
  // Large text or a narrow screen stacks the cards so nothing is squeezed.
  const roomy = width >= 360 && fontScale < 1.3;
  const { defaultPlaybackRate, setDefaultPlaybackRate } = personalization;
  const sample = PREVIEW_SAMPLES[personalization.purpose ?? "default"];
  const listenWords = sample.text.split(" ");
  const [playing, setPlaying] = useState(false);
  const [word, setWord] = useState(-1);
  const session = useRef(0);
  const highlightMode = a.highlightMode === "word" ? "both" : a.highlightMode;
  const { voices, loaded, names } = useDeviceVoices();
  // A few voices to try here, ordered once so choosing one doesn't reshuffle them; the full list is in
  // Settings › Reading & Listening › Voice.
  const [initialVoice] = useState(a.voiceIdentifier);
  const shownVoices = featured_voices(voices, initialVoice, 4);
  const current = voices.find((voice) => voice.identifier === a.voiceIdentifier) ?? shownVoices[0];
  const currentName = current ? names[current.identifier] : "Device voice";
  // Only suggest better voices when the phone has none: most people never see this.
  const suggestBetterVoices = loaded && voices.length > 0 && !voices.some(is_high_quality);

  function stop() {
    session.current += 1;
    setPlaying(false);
    setWord(-1);
    void Speech.stop();
  }
  function play(rate = defaultPlaybackRate, voice = a.voiceIdentifier) {
    const id = session.current + 1;
    session.current = id;
    setPlaying(true);
    setWord(0);
    const done = () => {
      if (session.current !== id) return;
      setPlaying(false);
      setWord(-1);
    };
    void Speech.stop()
      .then(() => {
        if (session.current !== id) return;
        Speech.speak(sample.text, {
          rate,
          voice: voice || undefined,
          onBoundary: (event: { charIndex?: number }) => {
            if (session.current !== id) return;
            const offset = Number(event?.charIndex);
            if (!Number.isFinite(offset)) return;
            setWord(sample.text.slice(0, offset).split(" ").length - 1);
          },
          onDone: done,
          onStopped: done,
          onError: done,
        });
      })
      .catch(done);
  }
  // Leaving this step (or setup) always stops the sample.
  useEffect(
    () => () => {
      session.current += 1;
      void Speech.stop();
    },
    [],
  );

  /** Choosing a voice saves it for every document and plays the sample in it, so it can be heard at once. */
  function choose_voice(identifier: string) {
    a.setVoiceIdentifier(identifier);
    play(defaultPlaybackRate, identifier);
  }
  /** Choosing a speed always replays the sample at that speed: pace is easier to judge by ear. */
  function choose_speed(rate: number) {
    setDefaultPlaybackRate(rate);
    play(rate);
  }
  function choose_highlight(mode: HighlightMode) {
    a.setHighlightMode(mode);
    setAnswers({ ...answers, listening: LISTENING_FOR[mode] });
  }
  function open_voice_settings() {
    void Linking.sendIntent(ANDROID_TTS_SETTINGS).catch(() => Linking.openSettings().catch(() => {}));
  }

  const progress = playing && word >= 0 ? Math.min(1, (word + 1) / listenWords.length) : 0;

  return (
    <StepScaffold
      step={step}
      total={total}
      onBack={() => {
        stop();
        onBack?.();
      }}
      onSkip={() => {
        stop();
        onNext();
      }}
      title="Find your listening rhythm."
      footer={
        <PrimaryButton
          label={finishLabel}
          onPress={() => {
            stop();
            onNext();
          }}
        />
      }
    >
      <ListeningPlayer
        access={a}
        sample={sample}
        playing={playing}
        word={word}
        highlightMode={highlightMode}
        currentName={currentName}
        current={current}
        rate={defaultPlaybackRate}
        progress={progress}
        onStop={stop}
        onPlay={play}
      />

      {shownVoices.length > 1 ? (
        <>
          <Text style={[s.groupLabel, { color: theme.text }]}>Voice</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Voice" style={[s.grid, !roomy && s.stack]}>
            {shownVoices.map((voice, index) => {
              const selected = a.voiceIdentifier === voice.identifier;
              const name = names[voice.identifier];
              const quality = is_high_quality(voice);
              return (
                <Pressable
                  key={voice.identifier}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${name} voice, ${voice_accent(voice)}${quality ? ", high quality" : ""}`}
                  accessibilityHint="Chooses this voice and plays the sample"
                  onPress={() => choose_voice(voice.identifier)}
                  style={({ pressed }) => [
                    s.voice,
                    roomy && s.half,
                    {
                      borderColor: selected ? theme.accent : theme.border,
                      backgroundColor: selected
                        ? theme.sentenceHighlight
                        : pressed
                          ? theme.surfaceMuted
                          : theme.surface,
                    },
                  ]}
                >
                  <View style={[s.avatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
                    <Text style={s.avatarText}>{name?.charAt(0) ?? "V"}</Text>
                  </View>
                  <View style={s.voiceCopy}>
                    <View style={s.voiceNameRow}>
                      <Text numberOfLines={1} style={[s.voiceName, { color: theme.text }]}>
                        {name}
                      </Text>
                      {quality ? (
                        <View style={[s.badge, { backgroundColor: theme.accent }]}>
                          <Text style={[s.badgeText, { color: theme.onAccent }]}>HQ</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text numberOfLines={1} style={[s.voiceDetail, { color: theme.mutedText }]}>
                      {voice_accent(voice)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Text style={[s.note, { color: theme.mutedText }]}>
            More voices are in Settings › Reading & Listening › Voice.
          </Text>
        </>
      ) : null}

      {suggestBetterVoices ? <BetterVoicesNotice onOpenSettings={open_voice_settings} /> : null}

      <Text style={[s.groupLabel, { color: theme.text }]}>Speed</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Speed"
        style={[s.segmented, { backgroundColor: theme.surfaceMuted }]}
      >
        {LISTENING_SPEEDS.map(({ rate, feel }) => {
          const selected = defaultPlaybackRate === rate;
          return (
            <Pressable
              key={rate}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${format_playback_rate(rate)} speed`}
              accessibilityHint={`${feel}. Plays the sample at this speed`}
              onPress={() => choose_speed(rate)}
              style={[s.segment, selected && [s.segmentOn, { backgroundColor: theme.surface }]]}
            >
              <Text style={[s.segmentRate, { color: selected ? theme.accentText : theme.text }]}>
                {format_playback_rate(rate)}
              </Text>
              <Text style={[s.segmentFeel, { color: theme.mutedText }]}>{feel}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[s.groupLabel, { color: theme.text }]}>Follow along</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Follow along"
        style={[s.grid, !roomy && s.stack]}
      >
        {HIGHLIGHTS.map((item) => {
          const selected = highlightMode === item.value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${item.label}. ${item.detail}`}
              onPress={() => choose_highlight(item.value)}
              style={({ pressed }) => [
                s.follow,
                roomy && s.third,
                {
                  borderColor: selected ? theme.accent : theme.border,
                  backgroundColor: selected
                    ? theme.sentenceHighlight
                    : pressed
                      ? theme.surfaceMuted
                      : theme.surface,
                },
              ]}
            >
              <View style={[s.mini, { backgroundColor: PAPER }]}>
                <Text
                  style={[
                    s.miniText,
                    { color: INK },
                    item.value !== "off" && { backgroundColor: theme.sentenceHighlight },
                  ]}
                >
                  {item.value === "both" ? (
                    <>
                      Read{" "}
                      <Text style={{ backgroundColor: theme.wordHighlight, fontWeight: "900" }}>along</Text>{" "}
                      with me
                    </>
                  ) : (
                    "Read along with me"
                  )}
                </Text>
              </View>
              <Text style={[s.followLabel, { color: theme.text }]}>{item.short}</Text>
            </Pressable>
          );
        })}
      </View>
    </StepScaffold>
  );
}

/** Sample rendering stays separate from the step's voice, speed and preference controls. */
function ListeningPlayer({
  access: a,
  sample,
  playing,
  word,
  highlightMode,
  currentName,
  current,
  rate,
  progress,
  onStop,
  onPlay,
}: {
  access: ListeningStepProps["access"];
  sample: (typeof PREVIEW_SAMPLES)[keyof typeof PREVIEW_SAMPLES];
  playing: boolean;
  word: number;
  highlightMode: HighlightMode;
  currentName: string;
  current: ReturnType<typeof useDeviceVoices>["voices"][number] | undefined;
  rate: number;
  progress: number;
  onStop: () => void;
  onPlay: () => void;
}) {
  const { theme } = useVoticTheme();
  const type = reader_type(a.textSize, a.readingSpacing, a.readerFont, a.textSpacing);
  const listenWords = sample.text.split(" ");
  return (
    <View testID="listening-player" style={[s.player, { backgroundColor: theme.spotlight }]}>
      <View style={s.playerHead}>
        <Text numberOfLines={1} style={[s.eyebrow, s.playerTitle, { color: theme.spotlightMuted }]}>
          {sample.title.toUpperCase()} · SAMPLE
        </Text>
        <View accessible accessibilityLabel={playing ? "Playing" : "Ready to play"} style={s.status}>
          <Ionicons
            name={playing ? "volume-high" : "volume-medium-outline"}
            size={14}
            color={theme.spotlightMuted}
          />
          <Text style={[s.eyebrow, { color: theme.spotlightMuted }]}>{playing ? "PLAYING" : "READY"}</Text>
        </View>
      </View>
      <View style={[s.paper, { backgroundColor: PAPER }]}>
        <Text
          style={[
            type,
            s.paperText,
            { color: INK },
            playing && highlightMode !== "off" && { backgroundColor: theme.sentenceHighlight },
          ]}
        >
          {listenWords.map((value, index) => (
            <Text
              key={index}
              testID={playing && highlightMode === "both" && index === word ? "listening-word" : undefined}
              style={
                playing && highlightMode === "both" && index === word
                  ? {
                      // The spoken word, as in the Reader: its own highlight, bold, and a little larger.
                      backgroundColor: theme.wordHighlight,
                      fontWeight: "900",
                      fontSize: (type.fontSize as number) + 2,
                      ...(a.readerFont === "accessible" && { fontFamily: ACCESSIBLE_FONT_BOLD }),
                    }
                  : undefined
              }
            >
              {value}
              {index < listenWords.length - 1 ? " " : ""}
            </Text>
          ))}
        </Text>
      </View>
      <View style={s.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? "Stop sample" : "Play sample"}
          onPress={() => (playing ? onStop() : onPlay())}
          style={({ pressed }) => [s.play, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Ionicons name={playing ? "pause" : "play"} size={26} color={theme.spotlight} />
        </Pressable>
        <View style={s.meta}>
          <Text numberOfLines={1} style={[s.metaTitle, { color: theme.spotlightText }]}>
            {currentName} · {format_playback_rate(rate)}
          </Text>
          <Text numberOfLines={1} style={[s.metaDetail, { color: theme.spotlightMuted }]}>
            {current ? voice_accent(current) : "Your phone's voice"}
            {current && is_high_quality(current) ? " · High quality" : ""}
          </Text>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Sample progress"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
            style={s.track}
          >
            <View style={[s.trackFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Play the sample from the start"
          onPress={onPlay}
          hitSlop={6}
          style={({ pressed }) => [s.replay, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="refresh" size={20} color={theme.spotlightText} />
        </Pressable>
      </View>
    </View>
  );
}

function BetterVoicesNotice({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { theme } = useVoticTheme();
  return (
    <View
      testID="better-voices"
      style={[s.nudge, { borderColor: theme.accent, backgroundColor: theme.brandTint }]}
    >
      <Ionicons name="sparkles-outline" size={22} color={theme.accentText} />
      <View style={s.nudgeCopy}>
        <Text style={[s.nudgeTitle, { color: theme.text }]}>Want a more natural voice?</Text>
        <Text style={[s.voiceDetail, { color: theme.mutedText }]}>
          {Platform.OS === "android"
            ? "Your phone can download better voices for free."
            : "Download better voices for free in Settings › Accessibility › Spoken Content › Voices."}
        </Text>
      </View>
      {Platform.OS === "android" ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Get more natural voices"
          accessibilityHint="Opens your phone's text-to-speech settings"
          onPress={onOpenSettings}
          hitSlop={8}
          style={({ pressed }) => [s.nudgeAction, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[s.nudgeActionText, { color: theme.accentText }]}>Get voices</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  player: { borderRadius: 24, padding: spacing.md, gap: spacing.md },
  playerHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  playerTitle: { flex: 1 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  status: { flexDirection: "row", alignItems: "center", gap: 4 },
  paper: { borderRadius: 16, padding: spacing.md },
  paperText: { borderRadius: 4 },
  controls: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  play: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  meta: { flex: 1, gap: 2 },
  metaTitle: { fontSize: 16, fontWeight: "800" },
  metaDetail: { fontSize: 13 },
  track: {
    height: 4,
    borderRadius: 2,
    marginTop: 6,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  trackFill: { height: "100%", borderRadius: 2, backgroundColor: "#93C5FD" },
  replay: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  groupLabel: { fontSize: 17, fontWeight: "800", marginTop: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  stack: { flexDirection: "column" },
  half: { flexBasis: "47%", flexGrow: 1 },
  third: { flexBasis: "30%", flexGrow: 1 },
  voice: {
    minHeight: 60,
    borderWidth: 2,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  voiceCopy: { flex: 1, gap: 2 },
  voiceNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  voiceName: { fontSize: 16, fontWeight: "700", flexShrink: 1 },
  voiceDetail: { fontSize: 13, lineHeight: 18 },
  badge: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  note: { fontSize: 14, lineHeight: 20 },
  nudge: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  nudgeCopy: { flex: 1, gap: 2 },
  nudgeTitle: { fontSize: 15, fontWeight: "800" },
  nudgeAction: { minHeight: 44, justifyContent: "center" },
  nudgeActionText: { fontSize: 15, fontWeight: "800" },
  segmented: { borderRadius: radii.md, padding: 4, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  segment: {
    flexGrow: 1,
    minWidth: 58,
    minHeight: 52,
    borderRadius: radii.md - 2,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  segmentOn: {
    shadowColor: "#071A38",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segmentRate: { fontSize: 16, fontWeight: "800" },
  segmentFeel: { fontSize: 11, marginTop: 1 },
  follow: {
    borderWidth: 2,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.sm,
    alignItems: "center",
  },
  mini: { alignSelf: "stretch", borderRadius: 8, padding: 6 },
  miniText: { fontSize: 13, lineHeight: 19 },
  followLabel: { fontSize: 14, fontWeight: "700", textAlign: "center" },
});
