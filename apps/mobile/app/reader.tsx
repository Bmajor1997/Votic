import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Speech from "expo-speech";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAccessibilityPreferences } from "../src/accessibility/AccessibilityProvider";
import { useActivity } from "../src/activity/ActivityProvider";
import { askEventFor } from "../src/activity/askCategories";
import { useReaderActivity } from "../src/activity/useReaderActivity";
import { askVotic } from "../src/api/voticApi";
import {
  answeredFromContext,
  answerLink,
  answerNoteForSource,
  AskAnswerSource,
  conversationMessages,
  FULL_HISTORY,
  prepareAskRequest,
  resolveAskVoticContext,
} from "../src/ask/askVoticContext";
import { AskLink } from "../src/ask/documentSections";
import { RevealingText } from "../src/components/RevealingText";
import type { TextRevealFrame } from "../src/components/textReveal";
import { VoiceRecordingArea } from "../src/components/VoiceRecordingArea";
import { KeyboardDictationButton, type VoiceInputPhase } from "../src/components/KeyboardDictationButton";
import { AIResponse, AIThinking } from "../src/components/AIResponse";
import { VoticLogo } from "../src/components/VoticLogo";
import { controlSizes, radii, spacing, typography } from "../src/design/tokens";
import { useDocumentLibrary } from "../src/documents/DocumentLibraryProvider";
import { documentTimeSpent } from "../src/documents/insights";
import { splitPassages } from "../src/documents/passages";
import { catchUpContext, catchUpPrompt } from "../src/documents/catchUp";
import { createThrottledSaver } from "../src/documents/throttledSaver";
import { useDocumentTransition } from "../src/navigation/DocumentTransitionProvider";
import { CoachMark } from "../src/onboarding/components";
import { TipId, nextTip, useOnboarding } from "../src/onboarding/OnboardingProvider";
import { VoticPurpose, useVoticPurpose } from "../src/personalization/PurposeProvider";
import { readerSourceTransform } from "../src/navigation/readerTransform";
import { cleanTags } from "../src/notes/noteMetadata";
import { formatPlaybackRate, normalizePlaybackRate } from "../src/playback/rates";
import { CompletionModal } from "../src/reader/components/CompletionModal";
import { ReadingPages } from "../src/reader/components/ReadingPages";
import { SeekableProgress, ToolButton } from "../src/reader/components/ReaderControls";
import { ReaderSettingsSheet, ReaderSheet } from "../src/reader/components/ReaderSettingsSheet";
import { PassageDraft, SavePassageSheet } from "../src/reader/components/SavePassageSheet";
import { sheetStyles } from "../src/reader/components/sheetStyles";
import {
  clockLabel,
  locationAtScroll,
  locationForProgress,
  passageTokens,
  progressForLocation,
  readerType,
  speechSegment,
  wordAtSpeechOffset,
  wordMatches,
} from "../src/reader/readerText";
import { DeviceVoice, uniqueEnglishVoices, voticVoicePreview } from "../src/reader/voices";
import {
  applyPronunciations,
  loadPronunciations,
  PronunciationEntry,
  sourceWordAtSpokenOffset,
} from "../src/reader/pronunciationDictionary";
import { ReaderThemeProvider, useVoticTheme } from "../src/theme/ThemeProvider";

/** Read: the document without audio controls. Listen: the document with narration controls. */
type ReaderMode = "read" | "listen";

const PROGRESS_SYNC_INTERVAL_MS = 2000;
// Ask Votic replaces the Reader dock with a compact composer and closes along the same curve.
const ASK_TRANSITION_MS = 320;
const ASK_OPEN_EASING = Easing.out(Easing.cubic);
const ASK_CLOSE_EASING = Easing.in(Easing.cubic);
const ASK_COMPOSER_HEIGHT = 72;
const ASK_CONVERSATION_MAX_HEIGHT = 720;
const ASK_CONVERSATION_MAX_SHARE = 0.85;
const READING_BOTTOM_PADDING = 190;

/** closed → opening → open → closing → closed; askProgress runs 0 (panel hidden) → 1 (panel up) and back. */
type AskPhase = "closed" | "opening" | "open" | "closing";

type ReaderAskMessage = {
  revealed?: boolean;
  role: "user" | "votic";
  text: string;
  saved?: boolean;
  source?: AskAnswerSource;
  link?: AskLink;
  /** A notice (such as a daily limit) rather than an answer: not saved to Notes or sent as history. */
  fallback?: boolean;
};
/** `partial` when the conversation was longer than the server accepts, so only its latest part was summarized. */
type ConversationSummary = { text: string; source?: AskAnswerSource; saved?: boolean; partial?: boolean };

const CONVERSATION_SUMMARY_PROMPT =
  "Create a quick summary of our conversation. Start with one short main-idea sentence, then list the essential answers and key takeaways as clear bullet points. Include important terms only when they help understanding. Keep it concise, accurate, and supported by the document.";

export default function Reader() {
  return (
    <ReaderThemeProvider>
      <ReaderContent />
    </ReaderThemeProvider>
  );
}

function ReaderContent() {
  const { theme } = useVoticTheme();
  const accessibility = useAccessibilityPreferences();
  const transition = useDocumentTransition();
  const onboarding = useOnboarding();
  const { purpose, explanationStyle } = useVoticPurpose();
  const window = useWindowDimensions();
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);
  const {
    activeDocument,
    documents,
    openDocument,
    savePassage,
    removePassage,
    updateProgress,
    completeDocument,
    updatePlaybackRate,
  } = useDocumentLibrary();
  const activeId = activeDocument?.id;
  const passages = useMemo(() => splitPassages(activeDocument?.plainText || ""), [activeDocument?.plainText]);
  const [index, setIndex] = useState(activeDocument?.sentenceIndex || 0);
  const [wordIndex, setWordIndex] = useState(activeDocument?.wordIndex || 0);
  const [rate, setRate] = useState(normalizePlaybackRate(activeDocument?.playbackRate || 1));
  const [playing, setPlaying] = useState(false);
  // Tips after the first one wait until people have heard Votic read in this visit.
  const [heardAudio, setHeardAudio] = useState(false);
  const [sheet, setSheet] = useState<ReaderSheet>(null);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [listenExpanded, setListenExpanded] = useState(false);
  const [dockHeight, setDockHeight] = useState(ASK_COMPOSER_HEIGHT);
  const [askComposerHeight, setAskComposerHeight] = useState(50);
  const [askVoiceErrorHeight, setAskVoiceErrorHeight] = useState(76);
  const [askPhase, setAskPhase] = useState<AskPhase>("closed");
  const askOpen = askPhase !== "closed";
  const askClosing = askPhase === "closing";
  // Ask Votic replaces the listening dock while it is (or is becoming) open.
  const dockCovered = askPhase === "opening" || askPhase === "open";
  // 0 is the Reader alone, 1 is the panel fully up; opening and closing are the same animation reversed.
  const [askProgress] = useState(() => new Animated.Value(0));
  const [askQuestion, setAskQuestion] = useState("");
  const [askVoiceReveal, setAskVoiceReveal] = useState<TextRevealFrame | null>(null);
  const [askVoicePhase, setAskVoicePhase] = useState<VoiceInputPhase>("idle");
  const [askVoiceLevel, setAskVoiceLevel] = useState({ value: 0, at: 0 });
  const [askVoiceError, setAskVoiceError] = useState("");
  const askVoiceBusy = !["idle", "error"].includes(askVoicePhase);
  const showAskRecording = askVoiceBusy && askVoicePhase !== "reviewing";
  const [askMessages, setAskMessages] = useState<ReaderAskMessage[]>([]);
  const [askSending, setAskSending] = useState(false);
  const askInputRef = useRef<TextInput>(null);
  const [askError, setAskError] = useState("");
  const [conversationSummary, setConversationSummary] = useState<ConversationSummary | null>(null);
  const [conversationSaved, setConversationSaved] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [voices, setVoices] = useState<DeviceVoice[]>([]);
  const [pronunciations, setPronunciations] = useState<PronunciationEntry[]>([]);
  const [previewVoiceIdentifier, setPreviewVoiceIdentifier] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const askScrollRef = useRef<ScrollView>(null);
  const speechSession = useRef(0);
  const speechUtterance = useRef(0);
  const seekWasPlaying = useRef(false);
  const sentenceLayout = useRef<Record<number, { y: number; height: number }>>({});
  const scrollOffset = useRef(0);
  const viewportHeight = useRef(0);
  const manuallyScrolling = useRef(false);
  const closing = useRef(false);
  const readerPrepared = useRef(false);
  const [readerReady, setReaderReady] = useState(false);
  const completedRef = useRef(activeDocument?.progress === 1);
  const askGeneration = useRef(0);
  const params = useLocalSearchParams<{ autoplay?: string; mode?: ReaderMode }>();
  // How someone opened the document decides the controls: Read has no audio controls, Listen does.
  // An explicit Read request takes precedence over a stale autoplay parameter.
  const mode: ReaderMode =
    params.mode === "read" ? "read" : params.mode === "listen" || params.autoplay === "1" ? "listen" : "read";
  const listening = mode === "listen";
  const contentHeight = useRef(0);
  // Set when the position jumps (seek, prev/next) so Read mode scrolls there once.
  const scrollToPosition = useRef(false);
  // Reading counts only while someone is engaged with the page; listening counts while narration plays.
  const engaged = useReaderActivity(activeId, playing);
  const { recordAsk } = useActivity();
  const hasAskConversation =
    askMessages.length > 0 || askSending || Boolean(askError) || Boolean(conversationSummary) || summarizing;
  // Keep the empty composer compact, with room for the recording waveform when active.
  const minimumAskHeight = askComposerHeight + 22 + (askVoiceError ? askVoiceErrorHeight : 0);
  const askPanelHeight = hasAskConversation
    ? Math.max(
        minimumAskHeight + 48,
        Math.min(
          ASK_CONVERSATION_MAX_HEIGHT,
          Math.floor((availableHeight ?? window.height) * ASK_CONVERSATION_MAX_SHARE),
        ),
      )
    : Math.max(showAskRecording ? ASK_COMPOSER_HEIGHT + 100 : ASK_COMPOSER_HEIGHT, minimumAskHeight);
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
    // With Ask Votic open, Back closes it (the same way as its X) and the Reader stays open.
    if (askOpen) closeAskVotic();
    else void closeReader();
    return true;
  });
  const onAskSettled = useEffectEvent((opened: boolean) => {
    if (opened) setAskPhase("open");
    else finishAskClose();
  });
  const onAskClosed = useEffectEvent(() => finishAskClose());
  // Listen mode keeps the spoken word in view. In Read mode the reader's own scrolling sets the
  // position, so the page only moves for an explicit jump such as a seek.
  const onPositionChange = useEffectEvent(() => {
    if (listening) followActiveWord();
    else if (scrollToPosition.current) {
      scrollToPosition.current = false;
      followActiveWord(true);
    }
  });

  useEffect(() => {
    void Speech.getAvailableVoicesAsync()
      .then((available) => setVoices(uniqueEnglishVoices(available)))
      .catch(() => setVoices([]));
    void loadPronunciations().then(setPronunciations);
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
  // Read entry cancels queued utterances and voice previews without moving the saved position.
  const onReadEntry = useEffectEvent(() => {
    void progressSync.flush();
    setPlaying(false);
    setPreviewVoiceIdentifier(null);
    setListenExpanded(false);
    setSheet((current) => (current === "listen" ? null : current));
  });
  useEffect(() => {
    if (listening) return;
    speechSession.current += 1;
    void Speech.stop();
    const frame = requestAnimationFrame(() => onReadEntry());
    return () => cancelAnimationFrame(frame);
  }, [listening]);
  // Continue Listening from Home starts narration once it is ready.
  const autoplayed = useRef(false);
  const onReadyToAutoplay = useEffectEvent(() => speak());
  useEffect(() => {
    if (!listening || !readerReady || autoplayed.current || params.autoplay !== "1" || !passages.length)
      return;
    autoplayed.current = true;
    onReadyToAutoplay();
  }, [listening, readerReady, params.autoplay, passages.length]);
  useEffect(() => {
    askGeneration.current += 1;
    const frame = requestAnimationFrame(() => {
      onAskClosed();
      setAskQuestion("");
      setAskMessages([]);
      setAskSending(false);
      setAskError("");
      setConversationSummary(null);
      setConversationSaved(false);
      setSummarizing(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [activeId]);
  useEffect(() => {
    if (!askOpen) return;
    const frame = requestAnimationFrame(() =>
      askScrollRef.current?.scrollToEnd({ animated: !accessibility.reduceMotion }),
    );
    return () => cancelAnimationFrame(frame);
  }, [
    askMessages,
    askOpen,
    askSending,
    conversationSummary,
    summarizing,
    askError,
    accessibility.reduceMotion,
  ]);
  // One animation for both directions: the panel slides up over the lower part of the Reader, and back down.
  // A reversal mid-way (Ask tapped while closing, or the X while opening) continues from wherever the
  // progress is. The panel unmounts only once closing has finished.
  useEffect(() => {
    if (askPhase !== "opening" && askPhase !== "closing") return;
    const opening = askPhase === "opening";
    const animation = Animated.timing(askProgress, {
      toValue: opening ? 1 : 0,
      duration: ASK_TRANSITION_MS,
      easing: opening ? ASK_OPEN_EASING : ASK_CLOSE_EASING,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) onAskSettled(opening);
    });
    return () => animation.stop();
  }, [askPhase, askProgress]);

  function openAskVotic() {
    if (askPhase === "opening" || askPhase === "open") return;
    onboarding.markTipSeen("reader-ask");
    void stop();
    if (accessibility.reduceMotion) {
      askProgress.stopAnimation();
      askProgress.setValue(1);
      setAskPhase("open");
      return;
    }
    setAskPhase("opening");
  }
  /** The X, Android Back, and answer links all close Ask Votic here. Narration and position are left alone. */
  function closeAskVotic() {
    setAskMessages((messages) => messages.map((message) => ({ ...message, revealed: true })));
    if (!askOpen || askClosing) return;
    Keyboard.dismiss();
    if (accessibility.reduceMotion) {
      finishAskClose();
      return;
    }
    setAskPhase("closing");
  }
  function finishAskClose() {
    askProgress.stopAnimation();
    askProgress.setValue(0);
    setAskPhase("closed");
    setAskVoicePhase("idle");
    setAskVoiceReveal(null);
    setAskVoiceError("");
  }

  async function sendAskVotic() {
    const clean = askQuestion.trim();
    if (!clean || askSending || askVoiceBusy || !activeDocument) return;
    Keyboard.dismiss();
    const generation = askGeneration.current;
    const context = resolveAskVoticContext(documents, activeDocument, {});
    const history = askMessages;
    recordAsk(askEventFor(clean, { newConversation: history.length === 0 }));
    setAskQuestion("");
    setAskError("");
    setAskMessages((current) => [...current, { role: "user", text: clean }]);
    setAskSending(true);
    try {
      const request = prepareAskRequest(context, clean, history);
      const answer = await askVotic(clean, request.document, request.history, explanationStyle);
      onboarding.recordAskedVotic();
      if (generation !== askGeneration.current) return;
      const grounded = answeredFromContext(request, answer);
      setAskMessages((current) => [
        ...current,
        grounded
          ? {
              role: "votic",
              text: answer.answer,
              source:
                context.kind === "document" || context.kind === "notes"
                  ? (context.saveSource ?? undefined)
                  : undefined,
              link: answerLink(request, answer.sectionIndex) ?? undefined,
            }
          : { role: "votic", text: answer.answer, fallback: true },
      ]);
    } catch (error) {
      if (generation === askGeneration.current)
        setAskError(error instanceof Error ? error.message : "Votic could not answer right now.");
    } finally {
      if (generation === askGeneration.current) setAskSending(false);
    }
  }

  async function sendCatchUp() {
    if (!activeDocument || askSending || activeDocument.progress <= 0) return;
    Keyboard.dismiss();
    const question = catchUpPrompt(activeDocument);
    const covered = catchUpContext(activeDocument);
    openAskVotic();
    setAskError("");
    setAskMessages((current) => [...current, { role: "user", text: "Catch me up" }]);
    setAskSending(true);
    try {
      const answer = await askVotic(
        question,
        {
          title: activeDocument.title,
          sections: [{ heading: "What you have covered so far", text: covered }],
        },
        [],
        explanationStyle,
        "catch-me-up",
      );
      setAskMessages((current) => [...current, { role: "votic", text: answer.answer }]);
    } catch (error) {
      setAskError(error instanceof Error ? error.message : "Votic could not catch you up right now.");
    } finally {
      setAskSending(false);
    }
  }

  function saveAskAnswer(messageIndex: number) {
    const message = askMessages[messageIndex];
    if (!message?.source || message.role !== "votic" || message.saved) return;
    const now = Date.now();
    const note = answerNoteForSource(
      documents,
      message.source,
      message.text,
      now,
      `votic-note-${now}-${Math.random().toString(36).slice(2, 7)}`,
    );
    if (!note) return;
    savePassage(note.documentId, note.passage);
    setAskMessages((current) =>
      current.map((item, index) => (index === messageIndex ? { ...item, saved: true } : item)),
    );
  }

  async function summarizeConversation() {
    if (
      !activeDocument ||
      summarizing ||
      askSending ||
      !askMessages.some((message) => message.role === "votic" && !message.fallback)
    )
      return;
    const generation = askGeneration.current;
    const context = resolveAskVoticContext(documents, activeDocument, {});
    setSummarizing(true);
    setAskError("");
    try {
      const request = prepareAskRequest(context, CONVERSATION_SUMMARY_PROMPT, askMessages, FULL_HISTORY);
      const answer = await askVotic(CONVERSATION_SUMMARY_PROMPT, request.document, request.history);
      if (generation !== askGeneration.current) return;
      // A notice (such as a daily limit) is not a summary, so it is shown as an error instead of as notes.
      if (!answeredFromContext(request, answer)) {
        setAskError(answer.answer);
        return;
      }
      setConversationSummary({
        partial: conversationMessages(askMessages).length > FULL_HISTORY.messages,
        text: answer.answer,
        source:
          context.kind === "document" || context.kind === "notes"
            ? (context.saveSource ?? undefined)
            : undefined,
      });
    } catch (error) {
      if (generation === askGeneration.current)
        setAskError(error instanceof Error ? error.message : "Votic could not summarize this conversation.");
    } finally {
      if (generation === askGeneration.current) setSummarizing(false);
    }
  }

  function saveConversationSummary() {
    if (!conversationSummary?.source || conversationSummary.saved) return;
    const now = Date.now();
    const note = answerNoteForSource(
      documents,
      conversationSummary.source,
      conversationSummary.text,
      now,
      `votic-summary-${now}-${Math.random().toString(36).slice(2, 7)}`,
    );
    if (!note) return;
    savePassage(note.documentId, {
      ...note.passage,
      title: "Ask Votic quick summary",
      noteType: "key-point",
      tags: ["votic", "summary"],
    });
    setConversationSummary((current) => (current ? { ...current, saved: true } : current));
  }

  function saveConversationToNotes() {
    if (conversationSaved || !activeDocument) return;
    const messages = conversationMessages(askMessages);
    if (!messages.some((message) => message.role === "votic")) return;
    const context = resolveAskVoticContext(documents, activeDocument, {});
    if ((context.kind !== "document" && context.kind !== "notes") || !context.saveSource) return;
    const now = Date.now();
    const transcript = messages
      .map((message) => `${message.role === "user" ? "You" : "Votic"}: ${message.text}`)
      .join("\n\n");
    const note = answerNoteForSource(
      documents,
      context.saveSource,
      transcript,
      now,
      `votic-conversation-${now}-${Math.random().toString(36).slice(2, 7)}`,
    );
    if (!note) return;
    savePassage(note.documentId, {
      ...note.passage,
      title: "Ask Votic conversation",
      noteType: "note",
      tags: ["votic", "conversation"],
    });
    setConversationSaved(true);
  }

  function openAskAnswerLink(link: AskLink) {
    if (!documents.some((document) => document.id === link.documentId)) return;
    openDocument(link.documentId, link.sentenceIndex);
    // The Reader keeps its own position, so a link into the open document has to move it here too.
    if (link.documentId === activeId && passages[link.sentenceIndex] !== undefined) {
      setIndex(link.sentenceIndex);
      setWordIndex(0);
    }
    closeAskVotic();
  }

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
  /** Keeps narration focused without changing the Reader's layout when its dock changes mode. */
  function followActiveWord(
    force = false,
    animated = !accessibility.reduceMotion,
    viewport = viewportHeight.current,
  ) {
    if (manuallyScrolling.current && !force) return;
    const layout = sentenceLayout.current[index];
    if (!layout || !viewport) return;
    const words = Math.max(1, wordMatches(passages[index] || "").length);
    const wordFraction = Math.max(0, Math.min(1, wordIndex / words));
    const estimatedY = layout.y + layout.height * wordFraction;
    const top = scrollOffset.current + 24;
    const bottom = scrollOffset.current + viewport * 0.7;
    if (force || estimatedY < top || estimatedY > bottom)
      scrollRef.current?.scrollTo({ y: Math.max(0, estimatedY - viewport * 0.45), animated });
  }
  function measureSentence(sentenceIndex: number, event: LayoutChangeEvent) {
    const { y, height } = event.nativeEvent.layout;
    sentenceLayout.current[sentenceIndex] = { y, height };
    if (sentenceIndex === index) prepareReader();
  }
  function trackScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    engaged();
    scrollOffset.current = event.nativeEvent.contentOffset.y;
    if (event.nativeEvent.contentSize?.height) contentHeight.current = event.nativeEvent.contentSize.height;
    // Only the reader's own scrolling moves the reading position, never the Reader's programmatic scrolls.
    if (manuallyScrolling.current) syncReadingPosition();
  }
  /** Read mode: the document position follows the reading line as the person scrolls. */
  function syncReadingPosition() {
    if (listening || completedRef.current) return;
    const location = locationAtScroll(passages, sentenceLayout.current, {
      offset: scrollOffset.current,
      viewport: viewportHeight.current,
      contentHeight: contentHeight.current,
    });
    if (!location) return;
    // React skips the render when the passage and word have not changed, so small scrolls stay quiet.
    setIndex(location.sentenceIndex);
    setWordIndex(location.wordIndex);
  }
  async function stop() {
    void progressSync.flush();
    speechSession.current += 1;
    setPlaying(false);
    setPreviewVoiceIdentifier(null);
    await Speech.stop();
  }
  async function previewVoice(voice: DeviceVoice, name: string) {
    if (!listening) return;
    const session = ++speechSession.current;
    setPlaying(false);
    await Speech.stop();
    if (session !== speechSession.current) return;
    setPreviewVoiceIdentifier(voice.identifier);
    const clearPreview = () =>
      setPreviewVoiceIdentifier((current) => (current === voice.identifier ? null : current));
    Speech.speak(voticVoicePreview(name), {
      voice: voice.identifier,
      rate: 1,
      onDone: clearPreview,
      onStopped: clearPreview,
      onError: clearPreview,
    });
  }
  function speak(at = index, startWord = at === index ? wordIndex : 0) {
    if (!listening) return;
    const session = speechSession.current + 1;
    speechSession.current = session;
    void beginSpeech(at, startWord, session, true);
  }
  async function beginSpeech(
    at: number,
    startWord: number,
    session: number,
    clearQueue: boolean,
    playbackRate = rate,
  ) {
    if (!listening || !activeDocument || !passages[at] || session !== speechSession.current) return;
    if (clearQueue) await Speech.stop();
    if (session !== speechSession.current) return;
    const passage = passages[at];
    const segment = speechSegment(passage, startWord);
    const spokenText = applyPronunciations(segment.text, pronunciations);
    // Keep each passage continuous so the voice retains sentence rhythm and pronunciation.
    // Each utterance has its own token: late callbacks from a finished passage are stale.
    const utterance = ++speechUtterance.current;
    const isCurrent = () => session === speechSession.current && utterance === speechUtterance.current;
    setIndex(at);
    setWordIndex(segment.startWord);
    setPlaying(true);
    setHeardAudio(true);
    onboarding.markTipSeen("reader-listen");
    Speech.speak(spokenText, {
      rate: playbackRate,
      voice: accessibility.voiceIdentifier || undefined,
      onStart: () => {
        if (!isCurrent()) return;
        setIndex(at);
        setWordIndex(segment.startWord);
      },
      onBoundary: (event: any) => {
        if (!isCurrent() || (event?.name && event.name !== "word")) return;
        // Follow the native boundary directly: it fires as the word is spoken, so the highlight stays with the audio.
        const boundary = Number(event?.charIndex);
        const next =
          spokenText === segment.text
            ? wordAtSpeechOffset(segment, boundary)
            : segment.startWord + sourceWordAtSpokenOffset(segment.text, spokenText, boundary);
        if (next !== null) setWordIndex(next);
      },
      onDone: () => {
        if (!isCurrent()) return;
        if (at < passages.length - 1) void beginSpeech(at + 1, 0, session, false, playbackRate);
        else finishDocument(false);
      },
      onStopped: () => {
        if (isCurrent()) setPlaying(false);
      },
      onError: () => {
        if (isCurrent()) setPlaying(false);
      },
    });
  }
  function toggle() {
    if (playing) void stop();
    else speak();
  }
  async function jump(delta: number) {
    const resume = playing;
    const target = Math.max(0, Math.min(passages.length - 1, index + delta));
    await stop();
    setWordIndex(0);
    setIndex(target);
    if (resume && target !== index) speak(target, 0);
  }
  function beginSeek() {
    engaged();
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
    scrollToPosition.current = true;
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
  async function changeRate(value: number) {
    const nextRate = normalizePlaybackRate(value);
    const resume = playing;
    const resumeAt = { index, wordIndex };
    if (resume) await stop();
    setRate(nextRate);
    if (activeDocument) updatePlaybackRate(activeDocument.id, nextRate);
    if (resume) {
      const session = speechSession.current + 1;
      speechSession.current = session;
      void beginSpeech(resumeAt.index, resumeAt.wordIndex, session, false, nextRate);
    }
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
    onboarding.markTipSeen("reader-bookmark");
    void stop();
    setSaveOpen(true);
  }
  const tipsBlocked = !readerReady || playing || askOpen || sheet !== null || saveOpen || completionOpen;
  // The Listen tip points at Play, which only Listen mode has; Read mode starts with Bookmark.
  const tip = nextTip(
    listening
      ? [
          { id: "reader-listen", ready: !tipsBlocked },
          { id: "reader-bookmark", ready: !tipsBlocked && heardAudio },
          { id: "reader-ask", ready: !tipsBlocked && (heardAudio || progress > 0.15) },
        ]
      : [
          { id: "reader-bookmark", ready: !tipsBlocked },
          { id: "reader-ask", ready: !tipsBlocked && progress > 0.15 },
        ],
    onboarding.tipsSeen,
  );
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
  // The panel starts just below the screen and slides up into place.
  const askPanelSlide = askProgress.interpolate({ inputRange: [0, 1], outputRange: [askPanelHeight, 0] });
  // The Reader dock follows the inverse path, leaving and returning on the same curve as Ask Votic.
  const dockSlide = askProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, dockHeight + spacing.sm],
  });
  const dockOpacity = askProgress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 0, 0] });
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
        <Animated.View onTouchStart={engaged} style={[s.safe, { opacity: readerOpacity }]}>
          <SafeAreaView edges={["top", "bottom", "left", "right"]} style={s.safe}>
            <KeyboardAvoidingView style={s.content} behavior={Platform.OS === "ios" ? "padding" : "height"}>
              <View
                testID="reader-available-space"
                style={{ flex: 1 }}
                onLayout={({ nativeEvent }) => setAvailableHeight(nativeEvent.layout.height)}
              >
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
                  {listening ? (
                    <VoticLogo compact />
                  ) : (
                    <Text style={[s.progressText, { color: theme.mutedText, letterSpacing: 2 }]}>
                      READING
                    </Text>
                  )}
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
                </View>
                {!listening ? (
                  <ReadingPages
                    passages={passages}
                    index={index}
                    wordIndex={wordIndex}
                    textStyle={readingType}
                    onReady={() => {
                      if (!readerPrepared.current) {
                        readerPrepared.current = true;
                        setReaderReady(true);
                        transition.beginReader();
                      }
                    }}
                    onLocation={(at, word) => {
                      engaged();
                      setIndex(at);
                      setWordIndex(word);
                      if (activeId)
                        updateProgress(activeId, progressForLocation(passages, at, word), at, word);
                    }}
                  />
                ) : (
                  <ScrollView
                    ref={scrollRef}
                    testID="reader-scroll"
                    style={s.textArea}
                    contentContainerStyle={s.readingContent}
                    scrollEventThrottle={16}
                    onLayout={(event) => {
                      viewportHeight.current = event.nativeEvent.layout.height;
                      prepareReader();
                    }}
                    onScroll={trackScroll}
                    onContentSizeChange={(_width, height) => {
                      contentHeight.current = height;
                    }}
                    onScrollBeginDrag={() => {
                      manuallyScrolling.current = true;
                    }}
                    onMomentumScrollBegin={() => {
                      manuallyScrolling.current = true;
                    }}
                    onScrollEndDrag={() => {
                      syncReadingPosition();
                      manuallyScrolling.current = false;
                    }}
                    onMomentumScrollEnd={() => {
                      syncReadingPosition();
                      manuallyScrolling.current = false;
                    }}
                  >
                    <View testID="reader-document" style={s.passages}>
                      {passages.map((passage, passageIndex) => {
                        const current = passageIndex === index;
                        const tokens = current && listening ? passageTokens(passage) : [];
                        return (
                          <Text
                            key={passageIndex}
                            onLayout={(event) => measureSentence(passageIndex, event)}
                            style={[
                              s.sentence,
                              readingType,
                              { color: theme.text },
                              // Highlighting follows narration, so Read mode keeps the page plain.
                              listening &&
                                current &&
                                sentenceHighlight && { backgroundColor: theme.sentenceHighlight },
                            ]}
                          >
                            {current && listening
                              ? tokens.map((token, tokenIndex) => {
                                  if (token.word === null) return token.text;
                                  const active = token.word === wordIndex;
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
                                      {token.text}
                                    </Text>
                                  );
                                })
                              : passage}
                          </Text>
                        );
                      })}
                    </View>
                  </ScrollView>
                )}
                {tip ? (
                  <ReaderTip
                    tip={tip}
                    purpose={purpose}
                    dockHeight={dockHeight}
                    onDismiss={() => onboarding.markTipSeen(tip)}
                  />
                ) : null}
                <Animated.View
                  testID="reader-dock-container"
                  onLayout={(event) => {
                    const measured = Math.ceil(event.nativeEvent.layout.height);
                    if (measured > 0 && measured !== dockHeight) setDockHeight(measured);
                  }}
                  style={{ opacity: dockOpacity, transform: [{ translateY: dockSlide }] }}
                  pointerEvents={dockCovered ? "none" : "auto"}
                  accessibilityElementsHidden={dockCovered}
                  importantForAccessibility={dockCovered ? "no-hide-descendants" : "auto"}
                >
                  <View style={[s.dock, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                    <View style={s.compactDockActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Ask Votic about this page"
                        onPress={openAskVotic}
                        style={({ pressed }) => [
                          s.readingAsk,
                          { backgroundColor: pressed ? theme.surfaceMuted : theme.surface },
                        ]}
                      >
                        <VoticLogo compact markOnly progress={progress} />
                        <Text numberOfLines={1} style={[s.readingAskText, { color: theme.text }]}>
                          Ask Votic
                        </Text>
                      </Pressable>
                      {listening && !listenExpanded ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={playing ? "Pause" : "Play"}
                          onPress={toggle}
                          style={({ pressed }) => [
                            s.compactPlay,
                            { backgroundColor: theme.playButton },
                            !accessibility.reduceMotion && { transform: [{ scale: pressed ? 0.95 : 1 }] },
                          ]}
                        >
                          <Ionicons name={playing ? "pause" : "play"} size={20} color={theme.playIcon} />
                        </Pressable>
                      ) : null}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          listening
                            ? listenExpanded
                              ? "Collapse listening controls"
                              : "Expand listening controls"
                            : listenExpanded
                              ? "Hide reading tools"
                              : "Show reading tools"
                        }
                        accessibilityState={{ expanded: listenExpanded }}
                        onPress={() => setListenExpanded((expanded) => !expanded)}
                        style={({ pressed }) => [s.expandButton, { opacity: pressed ? 0.62 : 1 }]}
                      >
                        <Text style={[s.expandLabel, { color: theme.mutedText }]}>
                          {listenExpanded ? "Less" : "More"}
                        </Text>
                        <Ionicons
                          name={listenExpanded ? "chevron-down" : "chevron-up"}
                          size={18}
                          color={theme.mutedText}
                        />
                      </Pressable>
                    </View>
                    {listening && listenExpanded ? (
                      <View style={[s.controls, s.compactControls]}>
                        <Pressable
                          disabled={index === 0}
                          accessibilityRole="button"
                          accessibilityLabel="Previous passage"
                          onPress={() => jump(-1)}
                          style={({ pressed }) => [
                            s.control,
                            { opacity: index === 0 ? 0.3 : pressed ? 0.55 : 1 },
                          ]}
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
                          accessibilityLabel={
                            index >= passages.length - 1 ? "Finish document" : "Next passage"
                          }
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
                    ) : null}
                    {listening && listenExpanded ? (
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
                    ) : null}
                    {/* Progress lives once, under the document title. */}
                    {listenExpanded ? (
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
                        {listening ? (
                          <ToolButton
                            icon="headset-outline"
                            label="Listen"
                            active={sheet === "listen" || playing}
                            onPress={() => setSheet("listen")}
                          />
                        ) : null}
                        {activeDocument && activeDocument.progress > 0 ? (
                          <ToolButton
                            icon="sparkles-outline"
                            label="Catch up"
                            active={askOpen}
                            onPress={() => void sendCatchUp()}
                          />
                        ) : null}
                        <ToolButton
                          icon={savedPassage ? "bookmark" : "bookmark-outline"}
                          label="Bookmark"
                          active={saveOpen}
                          onPress={openSavePassage}
                        />
                        {listening ? (
                          // Reading focus only adjusts the spoken-text highlight, so it belongs to Listen mode.
                          <ToolButton
                            icon="ellipsis-horizontal"
                            label="More"
                            active={sheet === "focus"}
                            onPress={() => setSheet("focus")}
                          />
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </Animated.View>
                {askOpen ? (
                  <Animated.View
                    accessibilityLabel="Ask Votic conversation"
                    testID="ask-votic-panel"
                    pointerEvents={askClosing ? "none" : "auto"}
                    style={[
                      s.askPanel,
                      {
                        height: askPanelHeight,
                        borderColor: theme.border,
                        backgroundColor: theme.background,
                        transform: [{ translateY: askPanelSlide }],
                      },
                    ]}
                  >
                    {hasAskConversation ? (
                      <View style={s.askHeader}>
                        <View style={s.askBrand}>
                          <VoticLogo compact markOnly />
                          <Text style={[s.askTitle, { color: theme.text }]}>Ask Votic</Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Close Ask Votic"
                          onPress={closeAskVotic}
                          style={({ pressed }) => [sheetStyles.iconButton, { opacity: pressed ? 0.55 : 1 }]}
                        >
                          <Ionicons name="close" size={24} color={theme.text} />
                        </Pressable>
                      </View>
                    ) : null}
                    {hasAskConversation ? (
                      <ScrollView
                        ref={askScrollRef}
                        style={s.askConversation}
                        contentContainerStyle={s.askConversationContent}
                        keyboardShouldPersistTaps="handled"
                        onLayout={() => askScrollRef.current?.scrollToEnd({ animated: false })}
                        onContentSizeChange={() => askScrollRef.current?.scrollToEnd({ animated: false })}
                      >
                        {askMessages.length === 0 && !askSending && !askError ? (
                          <Text style={[s.askStatus, { color: theme.mutedText }]}>
                            Ask a question about {activeDocument?.title || "this document"}.
                          </Text>
                        ) : null}
                        {askMessages.map((message, messageIndex) =>
                          message.role === "user" ? (
                            <View key={messageIndex} style={s.askUserMessage}>
                              <Text style={s.askUserText}>{message.text}</Text>
                            </View>
                          ) : (
                            <View
                              key={messageIndex}
                              style={[
                                s.askAnswer,
                                { borderColor: theme.border, backgroundColor: theme.surface },
                              ]}
                            >
                              <View style={s.askAnswerLabel}>
                                <VoticLogo compact markOnly />
                                <Text style={[s.askAnswerName, { color: theme.text }]}>Votic</Text>
                                {message.fallback ? null : (
                                  <Text style={[s.askAnswerSource, { color: theme.mutedText }]}>
                                    · From this document
                                  </Text>
                                )}
                              </View>
                              <AIResponse
                                text={message.text}
                                animate={!message.fallback && !message.revealed}
                                style={[s.askAnswerText, { color: theme.text }]}
                              />
                              <View style={s.askAnswerActions}>
                                {message.link ? (
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Open ${activeDocument?.title || "document"} at passage ${message.link.sentenceIndex + 1} in Reader`}
                                    onPress={() => openAskAnswerLink(message.link!)}
                                    style={[s.askSourcePill, { backgroundColor: `${theme.accent}1F` }]}
                                  >
                                    <Text
                                      style={[s.askSourceText, { color: theme.accent }]}
                                      numberOfLines={1}
                                    >
                                      p. {message.link.sentenceIndex + 1} · {activeDocument?.title}
                                    </Text>
                                  </Pressable>
                                ) : null}
                                {message.source ? (
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={
                                      message.saved ? "Saved to Notes" : "Save answer to Notes"
                                    }
                                    disabled={message.saved}
                                    onPress={() => saveAskAnswer(messageIndex)}
                                    style={[s.askSave, { borderColor: theme.text }]}
                                  >
                                    <Text style={[s.askSaveText, { color: theme.text }]}>
                                      {message.saved ? "✓ Saved to Notes" : "+ Save to Notes"}
                                    </Text>
                                  </Pressable>
                                ) : null}
                              </View>
                            </View>
                          ),
                        )}
                        {askMessages.some((message) => message.role === "votic" && !message.fallback) ? (
                          <View style={s.conversationNoteActions}>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={
                                conversationSaved
                                  ? "Conversation saved to Notes"
                                  : "Save conversation to Notes"
                              }
                              disabled={conversationSaved}
                              onPress={saveConversationToNotes}
                              style={[s.askSave, { borderColor: theme.text }]}
                            >
                              <Text style={[s.askSaveText, { color: theme.text }]}>
                                {conversationSaved ? "✓ Saved to Notes" : "+ Save conversation to Notes"}
                              </Text>
                            </Pressable>
                            {!conversationSummary ? (
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Create a quick summary"
                                disabled={summarizing || askSending}
                                onPress={() => void summarizeConversation()}
                                style={({ pressed }) => [
                                  s.summarizeButton,
                                  {
                                    borderColor: theme.accent,
                                    opacity: summarizing || askSending ? 0.5 : pressed ? 0.7 : 1,
                                  },
                                ]}
                              >
                                {summarizing ? (
                                  <ActivityIndicator size="small" color={theme.accent} />
                                ) : (
                                  <Ionicons name="sparkles-outline" size={17} color={theme.accent} />
                                )}
                                <Text style={[s.summarizeButtonText, { color: theme.accent }]}>
                                  {summarizing ? "Creating summary…" : "Quick summary"}
                                </Text>
                              </Pressable>
                            ) : null}
                          </View>
                        ) : null}
                        {conversationSummary ? (
                          <View
                            accessibilityLabel="Conversation notes preview"
                            style={[
                              s.summaryCard,
                              { borderColor: theme.border, backgroundColor: theme.surface },
                            ]}
                          >
                            <View style={s.summaryTitleRow}>
                              <Ionicons name="sparkles" size={17} color={theme.accent} />
                              <Text style={[s.summaryTitle, { color: theme.text }]}>Quick summary</Text>
                            </View>
                            {conversationSummary.partial ? (
                              <Text style={[s.askStatus, { color: theme.mutedText }]}>
                                Covers the most recent part of this conversation.
                              </Text>
                            ) : null}
                            <AIResponse
                              key={conversationSummary.text}
                              text={conversationSummary.text}
                              style={[s.askAnswerText, { color: theme.text }]}
                            />
                            {conversationSummary.source ? (
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={
                                  conversationSummary.saved
                                    ? "Conversation notes saved"
                                    : "Save conversation notes"
                                }
                                disabled={conversationSummary.saved}
                                onPress={saveConversationSummary}
                                style={[s.askSave, { borderColor: theme.text }]}
                              >
                                <Text style={[s.askSaveText, { color: theme.text }]}>
                                  {conversationSummary.saved ? "✓ Saved to Notes" : "+ Save to Notes"}
                                </Text>
                              </Pressable>
                            ) : null}
                          </View>
                        ) : null}
                        {askSending || summarizing ? <AIThinking summary={summarizing} /> : null}
                        {askError ? (
                          <Text accessibilityLiveRegion="polite" style={[s.askError, { color: theme.text }]}>
                            {askError}
                          </Text>
                        ) : null}
                      </ScrollView>
                    ) : null}
                    {askVoiceError ? (
                      <Text
                        onLayout={(event) => setAskVoiceErrorHeight(event.nativeEvent.layout.height)}
                        style={[s.askError, { color: theme.text }]}
                      >
                        {askVoiceError}{" "}
                        {askVoicePhase === "error"
                          ? "Retry transcription or discard the recording."
                          : "You can still type your question."}
                      </Text>
                    ) : null}
                    <View
                      testID="voice-composer"
                      onLayout={(event) => setAskComposerHeight(event.nativeEvent.layout.height)}
                      style={[
                        s.askComposer,
                        (showAskRecording || askVoicePhase === "error") && s.askRecordingComposer,
                        { borderColor: theme.accent, backgroundColor: theme.surface },
                      ]}
                    >
                      {!hasAskConversation && !showAskRecording && askVoicePhase !== "error" ? (
                        <VoticLogo compact markOnly progress={progress} />
                      ) : null}
                      {showAskRecording ? (
                        <View style={s.askRecordingInput}>
                          <VoiceRecordingArea
                            phase={askVoicePhase}
                            level={askVoiceLevel.value}
                            sampleTime={askVoiceLevel.at}
                          />
                        </View>
                      ) : askVoiceReveal && askVoicePhase === "reviewing" ? (
                        <View style={{ flex: 1 }}>
                          <RevealingText
                            frame={askVoiceReveal}
                            style={[
                              s.askInput,
                              !hasAskConversation && s.compactAskInput,
                              { color: theme.text },
                            ]}
                          />
                        </View>
                      ) : (
                        <TextInput
                          ref={askInputRef}
                          accessibilityLabel="Ask Votic a question"
                          value={askQuestion}
                          editable={!askVoiceBusy}
                          onChangeText={setAskQuestion}
                          placeholder="Ask Votic about this document…"
                          placeholderTextColor={theme.mutedText}
                          multiline={hasAskConversation}
                          numberOfLines={hasAskConversation ? undefined : 1}
                          maxLength={1000}
                          style={[
                            s.askInput,
                            askVoicePhase === "error" && s.askRecordingText,
                            !hasAskConversation && s.compactAskInput,
                            { color: theme.text },
                          ]}
                          onSubmitEditing={() => void sendAskVotic()}
                        />
                      )}
                      <KeyboardDictationButton
                        key={activeId}
                        active={!askClosing}
                        value={askQuestion}
                        onPhaseChange={setAskVoicePhase}
                        onLevelChange={(value) => setAskVoiceLevel({ value, at: Date.now() })}
                        onErrorChange={setAskVoiceError}
                        onRevealChange={setAskVoiceReveal}
                        onChangeText={setAskQuestion}
                        onFocus={() => askInputRef.current?.focus()}
                        disabled={askSending || summarizing}
                      />
                      {!showAskRecording && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Send question"
                          disabled={!askQuestion.trim() || askSending || askVoiceBusy}
                          accessibilityState={{ disabled: !askQuestion.trim() || askSending || askVoiceBusy }}
                          onPress={() => void sendAskVotic()}
                          style={[
                            s.askSend,
                            {
                              backgroundColor: theme.accent,
                              opacity: !askQuestion.trim() || askSending || askVoiceBusy ? 0.45 : 1,
                            },
                          ]}
                        >
                          {askSending ? (
                            <ActivityIndicator size="small" color="#FFF" />
                          ) : (
                            <Ionicons name="arrow-up" size={21} color="#FFF" />
                          )}
                        </Pressable>
                      )}
                      {!hasAskConversation ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Close Ask Votic"
                          onPress={closeAskVotic}
                          style={({ pressed }) => [s.askComposerClose, { opacity: pressed ? 0.55 : 1 }]}
                        >
                          <Ionicons name="close" size={22} color={theme.text} />
                        </Pressable>
                      ) : null}
                    </View>
                  </Animated.View>
                ) : null}
              </View>
            </KeyboardAvoidingView>

            <ReaderSettingsSheet
              sheet={sheet}
              onClose={() => setSheet(null)}
              rate={rate}
              onRateChange={changeRate}
              voices={voices}
              previewVoiceIdentifier={previewVoiceIdentifier}
              onPreviewVoice={(voice, name) => {
                if (previewVoiceIdentifier === voice.identifier) void stop();
                else void previewVoice(voice, name);
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

const ASK_TIP_BODY: Record<VoticPurpose | "default", string> = {
  learning: "Ask Votic to explain a passage or quiz you on it.",
  work: "Ask Votic to pull out decisions and action items.",
  research: "Ask Votic to compare findings or explain the evidence.",
  accessibility: "Ask Votic to explain any passage in simpler words.",
  personal: "Ask Votic about anything in this document.",
  default: "Ask Votic about anything in this document.",
};

/** The Reader's one-time tips, each placed beside the control it explains. */
function ReaderTip({
  tip,
  purpose,
  dockHeight,
  onDismiss,
}: {
  tip: TipId;
  purpose: VoticPurpose | null;
  dockHeight: number;
  onDismiss: () => void;
}) {
  if (tip === "reader-bookmark")
    return (
      <CoachMark
        title="Save what matters"
        body="Tap the bookmark to keep this passage in Notes."
        arrow={{ edge: "top", align: "right", inset: 10 }}
        onDismiss={onDismiss}
        style={[s.tip, { top: 50 }]}
      />
    );
  const listen = tip === "reader-listen";
  return (
    <CoachMark
      title={listen ? "Listen along" : "Ask about this document"}
      body={listen ? "Tap play. Votic highlights each word as it reads." : ASK_TIP_BODY[purpose ?? "default"]}
      arrow={{ edge: "bottom", align: listen ? "center" : "left" }}
      onDismiss={onDismiss}
      style={[s.tip, { bottom: dockHeight + spacing.sm + 2 }]}
    />
  );
}

const s = StyleSheet.create({
  tip: { position: "absolute", left: spacing.lg, right: spacing.lg, zIndex: 5 },
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
  readingContent: { paddingBottom: READING_BOTTOM_PADDING },
  passages: { paddingTop: spacing.sm },
  sentence: { marginBottom: spacing.sm, paddingHorizontal: 2, borderRadius: 4 },
  readingAsk: {
    minHeight: 44,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  readingAskText: { ...typography.control, fontSize: 12 },
  // Occupies the dock's footprint until there is conversation content, then grows into a bounded tray.
  askPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    gap: spacing.xs,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
  },
  askConversation: { flex: 1 },
  askConversationContent: { gap: spacing.md, paddingBottom: spacing.sm },
  askHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  askBrand: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  askTitle: { fontSize: 16, fontWeight: "800" },
  askUserMessage: {
    alignSelf: "flex-end",
    maxWidth: "88%",
    backgroundColor: "#2B211E",
    borderRadius: 13,
    borderTopRightRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  askUserText: { color: "#FFF", fontSize: 14, lineHeight: 20 },
  askAnswer: { borderWidth: 1, borderRadius: 16, padding: spacing.md, gap: spacing.sm },
  askAnswerLabel: { flexDirection: "row", alignItems: "center", gap: 4 },
  askAnswerName: { fontSize: 12, fontWeight: "800" },
  askAnswerSource: { fontSize: 11 },
  askAnswerText: { fontSize: 15, lineHeight: 22 },
  askAnswerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  askSourcePill: { flexShrink: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  askSourceText: { fontSize: 11, fontWeight: "700" },
  askSave: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  askSaveText: { fontSize: 11, fontWeight: "800" },
  askThinking: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  askStatus: { fontSize: 13 },
  askError: { borderRadius: radii.md, fontSize: 13, lineHeight: 19 },
  summarizeButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  conversationNoteActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  summarizeButtonText: { fontSize: 13, fontWeight: "800" },
  summaryCard: { borderWidth: 1, borderRadius: 16, padding: spacing.md, gap: spacing.md },
  summaryTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  summaryTitle: { fontSize: 14, fontWeight: "800" },
  askComposer: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 999,
    marginBottom: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  askRecordingComposer: {
    borderRadius: radii.lg,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    padding: spacing.sm,
  },
  askRecordingText: { flexBasis: "100%" },
  askRecordingInput: { width: "100%", minWidth: 0 },
  askInput: { flex: 1, minWidth: 0, minHeight: 46, maxHeight: 100, paddingVertical: 10, fontSize: 14 },
  compactAskInput: { height: 46, paddingVertical: 0 },
  askSend: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  askComposerClose: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
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
  compactDockActions: {
    minHeight: 52,
    paddingHorizontal: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  compactPlay: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  expandButton: {
    minHeight: 44,
    paddingHorizontal: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
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
  expandLabel: { fontSize: 11, fontWeight: "700" },
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
