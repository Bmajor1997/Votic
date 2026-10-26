import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { reader_type } from "../reader/readerText";
import { format_playback_rate } from "../playback/rates";
import { useVoticTheme } from "../theme/ThemeProvider";
import { useVoticPurpose } from "../personalization/PurposeProvider";
import { MAX_TRY_TEXT, PREVIEW_SAMPLES } from "./paywallPresentation";
import { usePaywallPreview } from "./usePaywallPreview";

const MODES = [
  { id: "read", label: "Read", icon: "document-text-outline" },
  { id: "listen", label: "Listen", icon: "headset-outline" },
  { id: "understand", label: "Understand", icon: "sparkles-outline" },
] as const;
type Mode = (typeof MODES)[number]["id"];
const INK = "#11213D",
  MUTED = "#BACBE6",
  LIME = "#DDE7FF";

type Preview = ReturnType<typeof usePaywallPreview>;
type Sample = (typeof PREVIEW_SAMPLES)[keyof typeof PREVIEW_SAMPLES];

/** A gentle pulse for the sample waveform, only while the sample is playing. */
function useActivityPulse(playing: boolean, reduceMotion: boolean) {
  const [activity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    activity.setValue(0);
    if (!playing || reduceMotion) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(activity, {
          toValue: 1,
          duration: 480,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(activity, {
          toValue: 0,
          duration: 480,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [playing, reduceMotion, activity]);
  return activity;
}

/** The card's short entrance when the visitor switches between Read, Listen and Understand. */
function useCardEntrance(reduceMotion: boolean) {
  const [entrance] = useState(() => new Animated.Value(1));
  useEffect(() => () => entrance.stopAnimation(), [entrance]);
  useEffect(() => {
    if (reduceMotion) {
      entrance.stopAnimation();
      entrance.setValue(1);
    }
  }, [reduceMotion, entrance]);
  function replay() {
    entrance.stopAnimation();
    entrance.setValue(reduceMotion ? 1 : 0);
    if (!reduceMotion)
      Animated.timing(entrance, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
        isInteraction: false,
      }).start();
  }
  return { entrance, replay };
}

function PreviewPlayer({
  preview,
  reading,
  disabled,
  activity,
}: {
  preview: Preview;
  reading: string;
  disabled: boolean;
  activity: Animated.Value;
}) {
  return (
    <View style={s.player}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={preview.playing ? "Stop voice preview" : "Play voice preview"}
        accessibilityState={{ disabled: disabled || !reading.trim() }}
        disabled={disabled || !reading.trim()}
        onPress={() => (preview.playing ? preview.stop() : void preview.play())}
        style={({ pressed }) => [s.play, { opacity: pressed || disabled || !reading.trim() ? 0.5 : 1 }]}
      >
        <Ionicons name={preview.playing ? "stop" : "play"} size={23} color={INK} />
      </Pressable>
      <View style={s.playerCopy}>
        <Text style={s.playerTitle}>
          {preview.playing ? "Your page, brought to life" : "Hear your page come to life"}
        </Text>
        <Text style={s.caption}>A real preview using your device’s voice</Text>
      </View>
      <View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={s.wave}
      >
        {[10, 22, 32, 18, 28].map((height, index) => (
          <Animated.View
            key={index}
            style={[
              s.bar,
              {
                height,
                transform: [
                  {
                    scaleY: activity.interpolate({
                      inputRange: [0, 1],
                      outputRange: index % 2 ? [0.45, 1] : [1, 0.4],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function UnderstandPanel({
  sample,
  disabled,
  answer,
  setAnswer,
}: {
  sample: Sample;
  disabled: boolean;
  answer: boolean;
  setAnswer: (shown: boolean) => void;
}) {
  return (
    <View style={s.understand}>
      <Text style={s.question}>{sample.question}</Text>
      {answer ? (
        <View style={s.answer}>
          <Text style={s.answerLabel}>EXAMPLE ANSWER</Text>
          <Text style={s.answerText}>{sample.answer}</Text>
          <Text style={s.source}>From the sample document above</Text>
        </View>
      ) : (
        <>
          <Text style={s.paperHint}>Go from a page of text to a clearer takeaway.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show example answer"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => setAnswer(true)}
            style={s.answerButton}
          >
            <Ionicons name="sparkles-outline" size={18} color="#315DCF" />
            <Text style={s.answerButtonText}>Show the key idea</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function SamplePassage({ mode, preview, reading }: { mode: Mode; preview: Preview; reading: string }) {
  const { reduceMotion, wordEmphasis, textSize, readingSpacing, readerFont, textSpacing, highlightMode } =
    useAccessibilityPreferences();
  return (
    <View>
      <Text style={s.paperEyebrow}>
        {mode === "read" ? "A PAGE THAT FITS YOU" : "FOLLOW THE WORDS. FIND YOUR FLOW."}
      </Text>
      {reading.trim() ? null : (
        <Text style={s.paperHint}>Type or paste a paragraph below, then tap play.</Text>
      )}
      <Text
        accessible={Boolean(reading.trim())}
        accessibilityLabel={reading}
        style={[
          s.passage,
          reader_type(textSize, readingSpacing, readerFont, textSpacing),
          preview.playing &&
            highlightMode !== "off" &&
            highlightMode !== "word" && { backgroundColor: "#E2EAFF" },
        ]}
      >
        {preview.words.map((word, index) => {
          // Fixed font weight prevents the line layout jumping as highlighting advances.
          const active =
            !reduceMotion && (highlightMode === "both" || highlightMode === "word") && preview.word === index;
          const split = mode === "read" && wordEmphasis ? Math.ceil(word.text.length / 2) : 0;
          return (
            <Text key={word.start} style={active ? s.activeWord : undefined}>
              {split ? (
                <>
                  <Text style={s.emphasis}>{word.text.slice(0, split)}</Text>
                  {word.text.slice(split)}
                </>
              ) : (
                word.text
              )}{" "}
            </Text>
          );
        })}
      </Text>
      <View style={s.paperBottom}>
        <Text style={s.fileDetail}>
          {mode === "read"
            ? "Your saved reading settings, applied here."
            : preview.playing
              ? "Playing your voice preview"
              : "Tap play. Hear the difference."}
        </Text>
        <Ionicons
          name={mode === "read" ? "text-outline" : "volume-medium-outline"}
          size={18}
          color="#52627A"
        />
      </View>
    </View>
  );
}

function KeepIdea({
  sample,
  disabled,
  savedSample,
  setSavedSample,
}: {
  sample: Sample;
  disabled: boolean;
  savedSample: string | null;
  setSavedSample: (title: string) => void;
}) {
  return (
    <View style={s.keepIdea}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={savedSample === sample.title ? "Sample note saved" : "Save a sample note"}
        accessibilityState={{ disabled: disabled || savedSample === sample.title }}
        disabled={disabled || savedSample === sample.title}
        onPress={() => setSavedSample(sample.title)}
        style={s.answerButton}
      >
        <Ionicons
          name={savedSample === sample.title ? "checkmark-circle" : "bookmark-outline"}
          size={18}
          color="#315DCF"
        />
        <Text style={s.answerButtonText}>
          {savedSample === sample.title ? "Sample note saved" : "Keep this idea"}
        </Text>
      </Pressable>
      {savedSample === sample.title ? (
        <View accessibilityLiveRegion="polite" style={s.answer}>
          <Text style={s.answerLabel}>SAMPLE NOTE</Text>
          <Text style={s.answerText}>{sample.text}</Text>
          <Text style={s.source}>Preview only · Nothing added to your library</Text>
        </View>
      ) : (
        <Text style={s.source}>Try saving a passage as a sample note.</Text>
      )}
    </View>
  );
}

function ListenOptions({
  preview,
  disabled,
  source,
  setSource,
  ownText,
  setOwnText,
}: {
  preview: Preview;
  disabled: boolean;
  source: "sample" | "own";
  setSource: (source: "sample" | "own") => void;
  ownText: string;
  setOwnText: (text: string) => void;
}) {
  return (
    <>
      <View accessibilityRole="radiogroup" accessibilityLabel="What to read" style={s.options}>
        <Text style={s.caption}>READ</Text>
        {(
          [
            { id: "sample", label: "Sample page" },
            { id: "own", label: "Your text" },
          ] as const
        ).map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="radio"
            accessibilityLabel={item.label}
            accessibilityState={{ checked: source === item.id, disabled }}
            disabled={disabled}
            onPress={() => setSource(item.id)}
            style={[s.option, source === item.id && s.optionSelected]}
          >
            <Text style={s.optionText}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      {source === "own" ? (
        <View style={s.tryBox}>
          <Text importantForAccessibility="no" accessibilityElementsHidden style={s.tryLabel}>
            Paste or type a paragraph to hear it read aloud
          </Text>
          <TextInput
            accessibilityLabel="Paste or type a paragraph to hear it read aloud"
            value={ownText}
            onChangeText={(value) => setOwnText(value.slice(0, MAX_TRY_TEXT))}
            maxLength={MAX_TRY_TEXT}
            multiline
            editable={!disabled}
            placeholder="For example, a paragraph from your notes or an article"
            placeholderTextColor="#8FA3C4"
            style={s.tryInput}
          />
          <Text style={s.caption}>
            {`${ownText.length} of ${MAX_TRY_TEXT} characters. Stays on this phone; nothing is uploaded.`}
          </Text>
        </View>
      ) : null}
      <View accessibilityRole="radiogroup" accessibilityLabel="Preview speed" style={s.options}>
        <Text style={s.caption}>YOUR PACE</Text>
        {Array.from(new Set([1, 1.25, 1.5, preview.rate]))
          .sort((a, b) => a - b)
          .map((rate) => (
            <Pressable
              key={rate}
              accessibilityRole="radio"
              accessibilityLabel={`Preview speed ${rate}x`}
              accessibilityState={{ checked: preview.rate === rate, disabled }}
              disabled={disabled}
              onPress={() => preview.chooseRate(rate)}
              style={[s.option, preview.rate === rate && s.optionSelected]}
            >
              <Text style={s.optionText}>{format_playback_rate(rate)}</Text>
            </Pressable>
          ))}
      </View>
      {preview.voices.length > 1 ? (
        <View accessibilityRole="radiogroup" accessibilityLabel="Preview voice" style={s.options}>
          <Text style={s.caption}>YOUR VOICE</Text>
          {preview.voices.map((voice) => (
            <Pressable
              key={voice.identifier}
              accessibilityRole="radio"
              accessibilityLabel={`Preview voice ${preview.names[voice.identifier]}`}
              accessibilityState={{ checked: preview.voice === voice.identifier, disabled }}
              disabled={disabled}
              onPress={() => preview.chooseVoice(voice.identifier)}
              style={[s.option, preview.voice === voice.identifier && s.optionSelected]}
            >
              <Text style={s.optionText}>{preview.names[voice.identifier]}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {preview.error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {preview.error}
        </Text>
      ) : null}
    </>
  );
}

/** A finite card entrance, and audio activity only while the visitor plays the sample. */
export function PaywallPreview({ disabled = false }: { disabled?: boolean }) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const [mode, setMode] = useState<Mode>("listen");
  const [answer, setAnswer] = useState(false);
  const [savedSample, setSavedSample] = useState<string | null>(null);
  const { purpose } = useVoticPurpose();
  const sample = PREVIEW_SAMPLES[purpose ?? "default"];
  // "Your text" lets visitors hear their own words; it stays in this screen's memory and is never sent anywhere.
  const [source, setSource] = useState<"sample" | "own">("sample");
  const [ownText, setOwnText] = useState("");
  const showingOwn = mode === "listen" && source === "own";
  const reading = showingOwn ? ownText : sample.text;
  const preview = usePaywallPreview(disabled, reading);
  const { entrance, replay } = useCardEntrance(reduceMotion);
  const activity = useActivityPulse(preview.playing, reduceMotion);

  function changeMode(next: Mode) {
    preview.stop();
    setMode(next);
    replay();
  }
  return (
    <View style={s.stage}>
      <View pointerEvents="none" style={[s.orbit, { borderColor: theme.accent }]} />
      <View style={s.topline}>
        <View style={s.liveDot} />
        <Text style={s.eyebrow}>YOUR DOCUMENTS. YOUR WAY.</Text>
      </View>
      <View accessibilityRole="tablist" accessibilityLabel="Explore Votic" style={s.tabs}>
        {MODES.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: mode === item.id, disabled }}
            disabled={disabled}
            onPress={() => changeMode(item.id)}
            style={[s.tab, mode === item.id && s.tabActive]}
          >
            <Ionicons name={item.icon} size={17} color={mode === item.id ? INK : MUTED} />
            <Text style={[s.tabText, { color: mode === item.id ? INK : MUTED }]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {mode === "listen" ? (
        <PreviewPlayer preview={preview} reading={reading} disabled={disabled} activity={activity} />
      ) : null}

      <View style={s.deck}>
        <View pointerEvents="none" style={s.backPaper} />
        <Animated.View
          style={[
            s.paper,
            {
              opacity: entrance,
              transform: [
                { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
                { rotate: entrance.interpolate({ inputRange: [0, 1], outputRange: ["-2deg", "0deg"] }) },
              ],
            },
          ]}
        >
          <View style={s.paperHeader}>
            <View style={s.fileIcon}>
              <Ionicons name="document-text" size={19} color="#315DCF" />
            </View>
            <View style={s.fileTitle}>
              <Text style={s.fileName}>{showingOwn ? "Your text" : sample.title}</Text>
              <Text style={s.fileDetail}>
                {showingOwn ? "Stays on this phone" : "Sample document · 1 page"}
              </Text>
            </View>
            <Ionicons name="sparkles" size={19} color="#526AD0" />
          </View>
          {mode === "understand" ? (
            <UnderstandPanel sample={sample} disabled={disabled} answer={answer} setAnswer={setAnswer} />
          ) : (
            <SamplePassage mode={mode} preview={preview} reading={reading} />
          )}
          {mode === "read" ? (
            <KeepIdea
              sample={sample}
              disabled={disabled}
              savedSample={savedSample}
              setSavedSample={setSavedSample}
            />
          ) : null}
        </Animated.View>
        <View pointerEvents="none" style={s.cornerBadge}>
          <Ionicons
            name={mode === "understand" ? "sparkles" : mode === "read" ? "scan-outline" : "headset"}
            size={22}
            color={INK}
          />
        </View>
      </View>

      {mode === "listen" ? (
        <>
          <ListenOptions
            preview={preview}
            disabled={disabled}
            source={source}
            setSource={setSource}
            ownText={ownText}
            setOwnText={setOwnText}
          />
        </>
      ) : (
        <Text style={s.modeCaption}>
          {mode === "read"
            ? "Bring PDFs, books, articles, and scans into one reading space."
            : "A prepared answer from this sample. No AI credits used."}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  stage: { backgroundColor: "#11213D", borderRadius: 28, padding: 18, gap: 18, overflow: "hidden" },
  orbit: {
    position: "absolute",
    borderWidth: 1,
    opacity: 0.45,
    width: 340,
    height: 340,
    borderRadius: 170,
    right: -170,
    top: 40,
  },
  topline: { flexDirection: "row", alignItems: "center", gap: 7 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: LIME },
  eyebrow: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 1.2,
    fontWeight: "700",
    flexShrink: 1,
  },
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    backgroundColor: "#1E3254",
    borderRadius: 15,
    padding: 4,
  },
  tab: {
    flexGrow: 1,
    flexShrink: 0,
    minWidth: 76,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 6,
    borderRadius: 11,
  },
  tabActive: { backgroundColor: "#F0F5FF" },
  tabText: { fontWeight: "700", fontSize: 13, flexShrink: 1 },
  deck: { paddingTop: 8, paddingBottom: 12, paddingHorizontal: 3 },
  backPaper: {
    position: "absolute",
    top: 4,
    bottom: 13,
    left: 12,
    right: 8,
    borderRadius: 18,
    backgroundColor: "#7495EB",
    transform: [{ rotate: "-4deg" }],
  },
  paper: { backgroundColor: "#FFFCF7", borderRadius: 18, padding: 18, gap: 20, minHeight: 252 },
  paperHeader: { flexDirection: "row", alignItems: "center", gap: 9 },
  fileIcon: { backgroundColor: "#E2EAFF", padding: 8, borderRadius: 10 },
  fileTitle: { flex: 1, gap: 3 },
  fileName: { color: INK, fontSize: 13, fontWeight: "800" },
  fileDetail: { color: "#52627A", fontSize: 13, lineHeight: 19, flexShrink: 1 },
  paperEyebrow: {
    color: "#52627A",
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 1.2,
    fontWeight: "800",
    marginBottom: 10,
  },
  passage: { color: INK, fontSize: 22, lineHeight: 34, fontWeight: "500", letterSpacing: -0.35 },
  activeWord: { backgroundColor: LIME, color: INK },
  emphasis: { fontWeight: "900" },
  paperBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginTop: 18,
  },
  cornerBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: LIME,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "8deg" }],
  },
  player: { flexDirection: "row", alignItems: "center", gap: 10 },
  play: {
    minWidth: 52,
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: LIME,
    alignItems: "center",
    justifyContent: "center",
  },
  playerCopy: { flex: 1, gap: 4 },
  playerTitle: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  caption: { color: MUTED, fontSize: 12, lineHeight: 17, letterSpacing: 0.3 },
  wave: { flexDirection: "row", gap: 3, alignItems: "center", height: 34 },
  bar: { width: 3, borderRadius: 2, backgroundColor: LIME },
  options: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7 },
  option: {
    minHeight: 48,
    minWidth: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#496184",
  },
  optionSelected: { backgroundColor: "#314D77", borderColor: "#C0D2EE" },
  optionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  keepIdea: { gap: 8 },
  understand: { gap: 12 },
  question: { color: INK, fontSize: 20, fontWeight: "800" },
  paperHint: { color: "#52627A", fontSize: 16, lineHeight: 24 },
  answer: { gap: 8, backgroundColor: "#E9EEFF", borderRadius: 12, padding: 14 },
  answerLabel: { fontSize: 12, color: "#3B4E9D", fontWeight: "800", letterSpacing: 1 },
  answerText: { color: INK, fontSize: 17, lineHeight: 26 },
  source: { fontSize: 13, lineHeight: 19, color: "#52627A" },
  answerButton: { minHeight: 48, flexDirection: "row", gap: 8, alignItems: "center" },
  answerButtonText: { fontSize: 15, fontWeight: "700", color: "#315DCF" },
  modeCaption: { color: MUTED, fontSize: 14, lineHeight: 21 },
  error: { color: "#FFE6B8", fontSize: 13, lineHeight: 20 },
  tryBox: { gap: 8 },
  tryLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", lineHeight: 20 },
  tryInput: {
    minHeight: 96,
    maxHeight: 180,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#496184",
    backgroundColor: "#1E3254",
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 23,
    padding: 12,
    textAlignVertical: "top",
  },
});
