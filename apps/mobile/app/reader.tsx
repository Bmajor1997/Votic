import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Speech from "expo-speech";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAccessibilityPreferences } from "../src/accessibility/AccessibilityProvider";
import { VoticLogo } from "../src/components/VoticLogo";
import { controlSizes, radii, spacing, typography } from "../src/design/tokens";
import { useDocumentLibrary } from "../src/documents/DocumentLibraryProvider";
import { documentTimeSpent } from "../src/documents/insights";
import { splitPassages } from "../src/documents/passages";
import { createThrottledSaver } from "../src/documents/throttledSaver";
import { useDocumentTransition } from "../src/navigation/DocumentTransitionProvider";
import { readerSourceTransform } from "../src/navigation/readerTransform";
import { cleanTags } from "../src/notes/noteMetadata";
import { useVoticPurpose } from "../src/personalization/PurposeProvider";
import { formatPlaybackRate, normalizePlaybackRate } from "../src/playback/rates";
import { CompletionModal } from "../src/reader/components/CompletionModal";
import { SeekableProgress, ToolButton } from "../src/reader/components/ReaderControls";
import { ReaderSettingsSheet, ReaderSheet } from "../src/reader/components/ReaderSettingsSheet";
import { PassageDraft, SavePassageSheet } from "../src/reader/components/SavePassageSheet";
import { sheetStyles } from "../src/reader/components/sheetStyles";
import {
  clockLabel,
  locationForProgress,
  progressForLocation,
  readerType,
  speechSegment,
  wordMatches,
} from "../src/reader/readerText";
import { DeviceVoice, uniqueEnglishVoices, voticVoicePreview } from "../src/reader/voices";
import { useVoticTheme } from "../src/theme/ThemeProvider";

const PROGRESS_SYNC_INTERVAL_MS = 2000;

export default function Reader() {
  const { theme } = useVoticTheme();
  const accessibility = useAccessibilityPreferences();
  const transition = useDocumentTransition();
  const window = useWindowDimensions();
  const {
    activeDocument,
    savePassage,
    removePassage,
    updateProgress,
    recordActivity,
    completeDocument,
    updatePlaybackRate,
  } = useDocumentLibrary();
  const { purpose } = useVoticPurpose();
  const activeId = activeDocument?.id;
  const passages = useMemo(() => splitPassages(activeDocument?.plainText || ""), [activeDocument?.plainText]);
  const [index, setIndex] = useState(activeDocument?.sentenceIndex || 0);
  const [wordIndex, setWordIndex] = useState(activeDocument?.wordIndex || 0);
  const [rate, setRate] = useState(normalizePlaybackRate(activeDocument?.playbackRate || 1));
  const [playing, setPlaying] = useState(false);
  const [sheet, setSheet] = useState<ReaderSheet>(null);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [voices, setVoices] = useState<DeviceVoice[]>([]);
  const [previewVoiceIdentifier, setPreviewVoiceIdentifier] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const speechSession = useRef(0);
  const seekWasPlaying = useRef(false);
  const sentenceLayout = useRef<Record<number, { y: number; height: number }>>({});
  const scrollOffset = useRef(0);
  const viewportHeight = useRef(0);
  const manuallyScrolling = useRef(false);
  const closing = useRef(false);
  const readerPrepared = useRef(false);
  const [readerReady, setReaderReady] = useState(false);
  const completedRef = useRef(activeDocument?.progress === 1);
  // Word-by-word progress stays local; the library (and storage) hears about it every couple of seconds and on pause/close.
  const [progressSync] = useState(() =>
    createThrottledSaver<{ id: string; progress: number; index: number; wordIndex: number }>((value) => {
      if (!completedRef.current) updateProgress(value.id, value.progress, value.index, value.wordIndex);
    }, PROGRESS_SYNC_INTERVAL_MS),
  );
  const readingType = readerType(
    accessibility.textSize,
    accessibility.readingSpacing,
    accessibility.readerFont,
    accessibility.textSpacing,
  );
  const progress = useMemo(
    () => progressForLocation(passages, index, wordIndex),
    [passages, index, wordIndex],
  );

  // Effect events read the latest render's functions without restarting the effects that call them.
  const onHardwareBack = useEffectEvent(() => {
    void closeReader();
    return true;
  });
  const onPositionChange = useEffectEvent(() => followActiveWord());
  const recordElapsed = useEffectEvent((documentId: string, seconds: number, listening: boolean) =>
    recordActivity(documentId, seconds, listening ? seconds : 0),
  );

  useEffect(() => {
    void Speech.getAvailableVoicesAsync()
      .then((available) => setVoices(uniqueEnglishVoices(available)))
      .catch(() => setVoices([]));
  }, []);
  useEffect(
    () => () => {
      speechSession.current += 1;
      void Speech.stop();
    },
    [],
  );
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => onHardwareBack());
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!activeId || !passages.length || completedRef.current) return;
    progressSync.schedule({ id: activeId, progress, index, wordIndex });
  }, [activeId, passages.length, progress, index, wordIndex, progressSync]);
  useEffect(
    () => () => {
      void progressSync.flush();
    },
    [progressSync],
  );
  useEffect(() => {
    onPositionChange();
  }, [index, wordIndex, accessibility.reduceMotion]);
  // Restarts when playback starts or stops, so time before the change is counted with the right mode.
  useEffect(() => {
    if (!activeId) return;
    let lastSavedAt = Date.now();
    function saveElapsed() {
      if (!activeId) return;
      const seconds = Math.floor((Date.now() - lastSavedAt) / 1000);
      if (seconds < 1) return;
      lastSavedAt += seconds * 1000;
      recordElapsed(activeId, seconds, playing);
    }
    const interval = setInterval(saveElapsed, 10000);
    return () => {
      clearInterval(interval);
      saveElapsed();
    };
  }, [activeId, playing]);

  async function closeReader() {
    if (closing.current) return;
    closing.current = true;
    await stop();
    transition.closeReader(() => router.back());
  }
  function prepareReader() {
    if (readerPrepared.current || !viewportHeight.current) return;
    if (passages.length && sentenceLayout.current[index] === undefined) return;
    readerPrepared.current = true;
    followActiveWord(true, false);
    requestAnimationFrame(() => {
      setReaderReady(true);
      transition.beginReader();
    });
  }
  function followActiveWord(force = false, animated = !accessibility.reduceMotion) {
    if (manuallyScrolling.current && !force) return;
    const layout = sentenceLayout.current[index];
    if (!layout || !viewportHeight.current) return;
    const words = Math.max(1, wordMatches(passages[index] || "").length);
    const wordFraction = Math.max(0, Math.min(1, wordIndex / words));
    const estimatedY = layout.y + layout.height * wordFraction;
    const top = scrollOffset.current + 24;
    const bottom = scrollOffset.current + viewportHeight.current * 0.7;
    if (force || estimatedY < top || estimatedY > bottom)
      scrollRef.current?.scrollTo({ y: Math.max(0, estimatedY - viewportHeight.current * 0.45), animated });
  }
  function measureSentence(sentenceIndex: number, event: LayoutChangeEvent) {
    const { y, height } = event.nativeEvent.layout;
    sentenceLayout.current[sentenceIndex] = { y, height };
    if (sentenceIndex === index) prepareReader();
  }
  function trackScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    scrollOffset.current = event.nativeEvent.contentOffset.y;
  }
  async function stop() {
    void progressSync.flush();
    speechSession.current += 1;
    setPlaying(false);
    setPreviewVoiceIdentifier(null);
    await Speech.stop();
  }
  async function previewVoice(voice: DeviceVoice, voiceIndex: number) {
    speechSession.current += 1;
    setPlaying(false);
    await Speech.stop();
    setPreviewVoiceIdentifier(voice.identifier);
    const clearPreview = () =>
      setPreviewVoiceIdentifier((current) => (current === voice.identifier ? null : current));
    Speech.speak(voticVoicePreview(voiceIndex), {
      voice: voice.identifier,
      rate: 1,
      onDone: clearPreview,
      onStopped: clearPreview,
      onError: clearPreview,
    });
  }
  function speak(at = index, startWord = at === index ? wordIndex : 0) {
    const session = speechSession.current + 1;
    speechSession.current = session;
    void beginSpeech(at, startWord, session, true);
  }
  async function beginSpeech(at: number, startWord: number, session: number, clearQueue: boolean) {
    if (!activeDocument || !passages[at] || session !== speechSession.current) return;
    if (clearQueue) await Speech.stop();
    if (session !== speechSession.current) return;
    const passage = passages[at];
    const segment = speechSegment(passage, startWord);
    setIndex(at);
    setWordIndex(segment.startWord);
    setPlaying(true);
    Speech.speak(segment.text, {
      rate,
      voice: accessibility.voiceIdentifier || undefined,
      onBoundary: (event: any) => {
        if (session !== speechSession.current || (event?.name && event.name !== "word")) return;
        const relativeOffset = Number(event?.charIndex);
        if (!Number.isFinite(relativeOffset)) return;
        const sourceOffset = segment.startChar + relativeOffset;
        let next = segment.words.findIndex(
          (match, i) =>
            sourceOffset >= (match.index ?? 0) && sourceOffset < (segment.words[i + 1]?.index ?? Infinity),
        );
        if (next < 0) next = segment.startWord;
        if (next >= 0) setWordIndex(next);
      },
      onDone: () => {
        if (session !== speechSession.current) return;
        if (at < passages.length - 1) void beginSpeech(at + 1, 0, session, false);
        else finishDocument(false);
      },
      onStopped: () => {
        if (session === speechSession.current) setPlaying(false);
      },
      onError: () => {
        if (session === speechSession.current) setPlaying(false);
      },
    });
  }
  function toggle() {
    if (playing) void stop();
    else speak();
  }
  function jump(delta: number) {
    void stop();
    setWordIndex(0);
    setIndex((current) => Math.max(0, Math.min(passages.length - 1, current + delta)));
  }
  function beginSeek() {
    seekWasPlaying.current = playing;
    speechSession.current += 1;
    setPlaying(false);
    void Speech.stop();
  }
  async function seekTo(value: number) {
    if (!activeDocument || !passages.length) return;
    const resume = seekWasPlaying.current;
    seekWasPlaying.current = false;
    const location = locationForProgress(passages, value);
    speechSession.current += 1;
    await Speech.stop();
    setIndex(location.sentenceIndex);
    setWordIndex(location.wordIndex);
    completedRef.current = false;
    updateProgress(activeDocument.id, value, location.sentenceIndex, location.wordIndex);
    if (resume) {
      const session = speechSession.current + 1;
      speechSession.current = session;
      void beginSpeech(location.sentenceIndex, location.wordIndex, session, false);
    }
  }
  function changeRate(value: number) {
    setRate(value);
    if (activeDocument) updatePlaybackRate(activeDocument.id, value);
  }
  function finishDocument(stopSpeech = true) {
    if (!activeDocument || !passages.length) return;
    if (stopSpeech) void stop();
    const finalIndex = passages.length - 1;
    const finalWord = Math.max(0, wordMatches(passages[finalIndex]).length - 1);
    completedRef.current = true;
    setPlaying(false);
    setIndex(finalIndex);
    setWordIndex(finalWord);
    completeDocument(activeDocument.id, finalIndex, finalWord);
    setCompletionOpen(true);
  }
  const totalWords = useMemo(
    () => wordMatches(activeDocument?.plainText || "").length,
    [activeDocument?.plainText],
  );
  const totalSeconds = totalWords / Math.max(0.1, 2.6 * rate);
  const elapsedSeconds = totalSeconds * progress;
  const sentenceHighlight =
    accessibility.highlightMode === "sentence" || accessibility.highlightMode === "both";
  const wordHighlight = accessibility.highlightMode === "word" || accessibility.highlightMode === "both";
  const passageId = "passage-" + index;
  const savedPassage = activeDocument?.savedPassages?.find((saved) => saved.id === passageId);
  function openSavePassage() {
    void stop();
    setSaveOpen(true);
  }
  function confirmSavePassage(draft: PassageDraft) {
    if (!activeDocument || !passages[index]) return;
    const now = Date.now();
    savePassage(activeDocument.id, {
      id: passageId,
      sentenceIndex: index,
      text: passages[index],
      note: draft.note.trim(),
      title: draft.title.trim() || undefined,
      noteType: draft.noteType,
      tags: cleanTags(draft.tags),
      pinned: savedPassage?.pinned,
      createdAt: savedPassage?.createdAt || now,
      updatedAt: now,
    });
    setSaveOpen(false);
  }
  function confirmRemovePassage() {
    if (!activeDocument || !savedPassage) return;
    removePassage(activeDocument.id, savedPassage.id);
    setSaveOpen(false);
  }

  const {
    scaleX: sourceScaleX,
    scaleY: sourceScaleY,
    translateX: sourceTranslateX,
    translateY: sourceTranslateY,
  } = readerSourceTransform(transition.sourceRect, window);
  const readerOpacity = readerReady
    ? transition.progress.interpolate({
        inputRange: [0, 0.62, 1],
        outputRange: [0, 0, 1],
        extrapolate: "clamp",
      })
    : 0;

  return (
    <View style={s.safe}>
      <Animated.View
        style={[
          s.safe,
          {
            backgroundColor: theme.background,
            transform: [
              {
                translateX: transition.progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [sourceTranslateX, 0],
                }),
              },
              {
                translateY: transition.progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [sourceTranslateY, 0],
                }),
              },
              {
                scaleX: transition.progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [sourceScaleX, 1],
                }),
              },
              {
                scaleY: transition.progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [sourceScaleY, 1],
                }),
              },
            ],
          },
        ]}
      >
        <Animated.View style={[s.safe, { opacity: readerOpacity }]}>
          <SafeAreaView edges={["top", "bottom", "left", "right"]} style={s.safe}>
            <View style={s.content}>
              <View style={s.topBar}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close reader"
                  onPress={() => {
                    void closeReader();
                  }}
                  style={({ pressed }) => [sheetStyles.iconButton, { opacity: pressed ? 0.55 : 1 }]}
                >
                  <Ionicons name="chevron-down" size={27} color={theme.text} />
                </Pressable>
                <VoticLogo compact />
                <View style={s.headerActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={savedPassage ? "Edit saved passage" : "Save current passage"}
                    accessibilityState={{ selected: Boolean(savedPassage) }}
                    onPress={openSavePassage}
                    style={({ pressed }) => [sheetStyles.iconButton, { opacity: pressed ? 0.55 : 1 }]}
                  >
                    <Ionicons
                      name={savedPassage ? "bookmark" : "bookmark-outline"}
                      size={22}
                      color={savedPassage ? theme.accent : theme.text}
                    />
                  </Pressable>
                </View>
              </View>
              <View style={s.documentHeader}>
                <Text
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}
                  style={[s.title, s.compactTitle, { color: theme.text }]}
                >
                  {activeDocument?.title || "Document reader"}
                </Text>
                <View style={s.progressCopy}>
                  <Text maxFontSizeMultiplier={1.2} style={[s.progressText, { color: theme.mutedText }]}>
                    {Math.round(progress * 100)}% read
                  </Text>
                  <Text maxFontSizeMultiplier={1.2} style={[s.progressText, { color: theme.mutedText }]}>
                    {Math.max(0, passages.length - index - 1)} passages left
                  </Text>
                </View>
                <SeekableProgress
                  value={progress}
                  onSeekStart={beginSeek}
                  onSeek={(value) => void seekTo(value)}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ask Votic about this document"
                  onPress={() => {
                    void stop();
                    router.push("/assistant");
                  }}
                  style={({ pressed }) => [
                    s.readingAsk,
                    {
                      borderColor: theme.border,
                      backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
                    },
                  ]}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.accent} />
                  <Text numberOfLines={1} style={[s.readingAskText, { color: theme.accent }]}>
                    {purpose === "learning"
                      ? "Ask Votic · Learn"
                      : purpose === "work"
                        ? "Ask Votic · Work"
                        : purpose === "research"
                          ? "Ask Votic · Research"
                          : "Ask Votic"}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color={theme.accent} />
                </Pressable>
              </View>
              <ScrollView
                ref={scrollRef}
                style={s.textArea}
                contentContainerStyle={s.readingContent}
                scrollEventThrottle={16}
                onLayout={(event) => {
                  viewportHeight.current = event.nativeEvent.layout.height;
                  prepareReader();
                }}
                onScroll={trackScroll}
                onScrollBeginDrag={() => {
                  manuallyScrolling.current = true;
                }}
                onMomentumScrollBegin={() => {
                  manuallyScrolling.current = true;
                }}
                onScrollEndDrag={() => {
                  manuallyScrolling.current = false;
                }}
                onMomentumScrollEnd={() => {
                  manuallyScrolling.current = false;
                }}
              >
                {passages.map((passage, passageIndex) => {
                  const current = passageIndex === index;
                  const tokens = current ? passage.split(/(\s+)/) : [];
                  return (
                    <Text
                      key={passageIndex}
                      onLayout={(event) => measureSentence(passageIndex, event)}
                      style={[
                        s.sentence,
                        readingType,
                        { color: theme.text },
                        current && sentenceHighlight && { backgroundColor: theme.sentenceHighlight },
                      ]}
                    >
                      {current
                        ? tokens.map((token, tokenIndex) => {
                            if (/^\s+$/.test(token)) return token;
                            const before = tokens.slice(0, tokenIndex).join("");
                            const spokenIndex = before.match(/\S+/g)?.length || 0;
                            const active = spokenIndex === wordIndex;
                            return (
                              <Text
                                key={tokenIndex}
                                style={
                                  active && wordHighlight
                                    ? {
                                        color: theme.text,
                                        fontWeight: "900",
                                        fontSize: (readingType.fontSize as number) + 2,
                                      }
                                    : undefined
                                }
                              >
                                {token}
                              </Text>
                            );
                          })
                        : passage}
                    </Text>
                  );
                })}
              </ScrollView>

              <View style={[s.dock, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                <View style={[s.nowListeningHeader, s.compactListeningHeader]}>
                  <VoticLogo compact markOnly progress={progress} />
                  <View style={s.nowListeningCopy}>
                    <Text maxFontSizeMultiplier={1.15} style={[s.nowListeningLabel, { color: theme.text }]}>
                      {playing ? "Now Listening" : "Listen"}
                    </Text>
                    <Text
                      numberOfLines={1}
                      maxFontSizeMultiplier={1.15}
                      style={[s.nowListeningTitle, { color: theme.mutedText }]}
                    >
                      {activeDocument?.title || "Document"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-up" size={18} color={theme.mutedText} />
                </View>
                <View style={[s.controls, s.compactControls]}>
                  <Pressable
                    disabled={index === 0}
                    accessibilityRole="button"
                    accessibilityLabel="Previous passage"
                    onPress={() => jump(-1)}
                    style={({ pressed }) => [s.control, { opacity: index === 0 ? 0.3 : pressed ? 0.55 : 1 }]}
                  >
                    <Ionicons
                      name="play-skip-back"
                      size={25}
                      color={index === 0 ? theme.mutedText : theme.text}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={playing ? "Pause" : "Play"}
                    onPress={toggle}
                    style={({ pressed }) => [
                      s.play,
                      { backgroundColor: theme.playButton },
                      !accessibility.reduceMotion && { transform: [{ scale: pressed ? 0.96 : 1 }] },
                    ]}
                  >
                    <Ionicons name={playing ? "pause" : "play"} size={30} color={theme.playIcon} />
                  </Pressable>
                  <Pressable
                    disabled={!passages.length}
                    accessibilityRole="button"
                    accessibilityLabel={index >= passages.length - 1 ? "Finish document" : "Next passage"}
                    onPress={() => (index >= passages.length - 1 ? finishDocument() : jump(1))}
                    style={({ pressed }) => [
                      s.control,
                      { opacity: !passages.length ? 0.3 : pressed ? 0.55 : 1 },
                    ]}
                  >
                    <Ionicons
                      name={index >= passages.length - 1 ? "checkmark" : "play-skip-forward"}
                      size={index >= passages.length - 1 ? 29 : 25}
                      color={theme.text}
                    />
                  </Pressable>
                </View>
                <View style={s.playbackMeta}>
                  <Text maxFontSizeMultiplier={1.15} style={[s.timeText, { color: theme.mutedText }]}>
                    {clockLabel(elapsedSeconds)} / {clockLabel(totalSeconds)}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Playback speed ${formatPlaybackRate(rate)}`}
                    onPress={() => setSheet("listen")}
                    style={s.rateButton}
                  >
                    <Text maxFontSizeMultiplier={1.15} style={[s.rateText, { color: theme.mutedText }]}>
                      {formatPlaybackRate(rate)}
                    </Text>
                    <Ionicons name="speedometer-outline" size={15} color={theme.mutedText} />
                  </Pressable>
                </View>
                <SeekableProgress
                  compact
                  value={progress}
                  onSeekStart={beginSeek}
                  onSeek={(value) => void seekTo(value)}
                />
                <View style={[s.toolRow, { borderTopColor: theme.border }]}>
                  <ToolButton
                    icon="text-outline"
                    label="Text"
                    active={sheet === "appearance"}
                    onPress={() => setSheet("appearance")}
                  />
                  <ToolButton
                    icon="color-palette-outline"
                    label="Color"
                    active={sheet === "appearance"}
                    onPress={() => setSheet("appearance")}
                  />
                  <ToolButton
                    icon="headset-outline"
                    label="Listen"
                    active={sheet === "listen" || playing}
                    onPress={() => setSheet("listen")}
                  />
                  <ToolButton
                    icon={savedPassage ? "bookmark" : "bookmark-outline"}
                    label="Bookmark"
                    active={saveOpen}
                    onPress={openSavePassage}
                  />
                  <ToolButton
                    icon="ellipsis-horizontal"
                    label="More"
                    active={sheet === "focus"}
                    onPress={() => setSheet("focus")}
                  />
                </View>
              </View>
            </View>

            <ReaderSettingsSheet
              sheet={sheet}
              onClose={() => setSheet(null)}
              rate={rate}
              onRateChange={changeRate}
              voices={voices}
              previewVoiceIdentifier={previewVoiceIdentifier}
              onPreviewVoice={(voice, voiceIndex) => {
                if (previewVoiceIdentifier === voice.identifier) void stop();
                else void previewVoice(voice, voiceIndex);
              }}
              onSelectVoice={(voice) => {
                void stop();
                accessibility.setVoiceIdentifier(voice.identifier);
              }}
            />
            <CompletionModal
              visible={completionOpen}
              onClose={() => setCompletionOpen(false)}
              title={activeDocument?.title}
              timeSpentSeconds={documentTimeSpent(activeDocument)}
              passageCount={passages.length}
            />
            <SavePassageSheet
              visible={saveOpen}
              passageText={passages[index] || ""}
              savedPassage={savedPassage}
              onClose={() => setSaveOpen(false)}
              onSave={confirmSavePassage}
              onRemove={confirmRemovePassage}
            />
          </SafeAreaView>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, paddingHorizontal: spacing.lg },
  topBar: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerActions: { flexDirection: "row" },
  documentHeader: { gap: spacing.xs, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  title: { ...typography.screenTitle, fontSize: 25 },
  compactTitle: { fontSize: 19, lineHeight: 24 },
  progressCopy: { flexDirection: "row", justifyContent: "space-between" },
  progressText: { fontSize: 12, fontWeight: "600" },
  textArea: { flex: 1 },
  readingContent: { paddingTop: spacing.sm, paddingBottom: 190 },
  sentence: { marginBottom: spacing.sm, paddingHorizontal: 2, borderRadius: 4 },
  readingAsk: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    marginTop: 0,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: spacing.xs,
  },
  readingAskText: { ...typography.control },
  dock: {
    borderWidth: 1,
    borderRadius: radii.lg,
    overflow: "hidden",
    marginBottom: spacing.sm,
    paddingTop: spacing.xs,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  nowListeningHeader: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  compactListeningHeader: { minHeight: 40 },
  nowListeningCopy: { flex: 1 },
  nowListeningLabel: { fontSize: 13, fontWeight: "800" },
  nowListeningTitle: { fontSize: 12, marginTop: 1 },
  controls: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
  },
  compactControls: { height: 50 },
  control: {
    width: controlSizes.minimumTouch,
    height: controlSizes.minimumTouch,
    justifyContent: "center",
    alignItems: "center",
  },
  play: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  playbackMeta: {
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 0,
  },
  timeText: { fontSize: 11, fontWeight: "600" },
  rateButton: { minHeight: 28, flexDirection: "row", alignItems: "center", gap: 4 },
  rateText: { fontSize: 11, fontWeight: "700" },
  toolRow: { borderTopWidth: 1, flexDirection: "row", padding: 2 },
});
