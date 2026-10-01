import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
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
import { VoticLogo } from "../src/components/VoticLogo";
import { controlSizes, radii, spacing, typography } from "../src/design/tokens";
import { useDocumentLibrary } from "../src/documents/DocumentLibraryProvider";
import { documentTimeSpent } from "../src/documents/insights";
import { splitPassages } from "../src/documents/passages";
import { createThrottledSaver } from "../src/documents/throttledSaver";
import { useDocumentTransition } from "../src/navigation/DocumentTransitionProvider";
import { readerSourceTransform } from "../src/navigation/readerTransform";
import { cleanTags } from "../src/notes/noteMetadata";
import { formatPlaybackRate, normalizePlaybackRate } from "../src/playback/rates";
import { CompletionModal } from "../src/reader/components/CompletionModal";
import { SeekableProgress, ToolButton } from "../src/reader/components/ReaderControls";
import { ReaderSettingsSheet, ReaderSheet } from "../src/reader/components/ReaderSettingsSheet";
import { PassageDraft, SavePassageSheet } from "../src/reader/components/SavePassageSheet";
import { sheetStyles } from "../src/reader/components/sheetStyles";
import {
  clockLabel,
  locationForProgress,
  passageTokens,
  progressForLocation,
  readerType,
  speechSegment,
  wordAtSpeechOffset,
  wordMatches,
} from "../src/reader/readerText";
import { DeviceVoice, uniqueEnglishVoices, voticVoicePreview } from "../src/reader/voices";
import { useVoticTheme } from "../src/theme/ThemeProvider";
import { explanationStyleArgs } from "../src/personalization/suggestions";
import { usePersonalization } from "../src/personalization/usePersonalization";
import { WalkthroughOverlay } from "../src/walkthrough/WalkthroughOverlay";
import {
  useWalkthrough,
  useWalkthroughTarget,
  useWalkthroughTrigger,
} from "../src/walkthrough/WalkthroughProvider";

const PROGRESS_SYNC_INTERVAL_MS = 2000;
// Ask Votic replaces the Reader dock with a compact composer and closes along the same curve.
const ASK_TRANSITION_MS = 320;
const ASK_OPEN_EASING = Easing.out(Easing.cubic);
const ASK_CLOSE_EASING = Easing.in(Easing.cubic);
const ASK_COMPOSER_HEIGHT = 72;
const ASK_CONVERSATION_MAX_HEIGHT = 320;
const ASK_CONVERSATION_MAX_SHARE = 0.4;
const READING_BOTTOM_PADDING = 190;

/** closed → opening → open → closing → closed; askProgress runs 0 (panel hidden) → 1 (panel up) and back. */
type AskPhase = "closed" | "opening" | "open" | "closing";

type ReaderAskMessage = {
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
  const { theme } = useVoticTheme();
  const accessibility = useAccessibilityPreferences();
  const transition = useDocumentTransition();
  const window = useWindowDimensions();
  const {
    activeDocument,
    documents,
    openDocument,
    savePassage,
    removePassage,
    updateProgress,
    recordActivity,
    completeDocument,
    updatePlaybackRate,
  } = useDocumentLibrary();
  const activeId = activeDocument?.id;
  const passages = useMemo(() => splitPassages(activeDocument?.plainText || ""), [activeDocument?.plainText]);
  const [index, setIndex] = useState(activeDocument?.sentenceIndex || 0);
  const [wordIndex, setWordIndex] = useState(activeDocument?.wordIndex || 0);
  const [rate, setRate] = useState(normalizePlaybackRate(activeDocument?.playbackRate || 1));
  const [playing, setPlaying] = useState(false);
  const [sheet, setSheet] = useState<ReaderSheet>(null);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [listenExpanded, setListenExpanded] = useState(false);
  const [dockHeight, setDockHeight] = useState(ASK_COMPOSER_HEIGHT);
  const [askPhase, setAskPhase] = useState<AskPhase>("closed");
  const askOpen = askPhase !== "closed";
  const askClosing = askPhase === "closing";
  // Ask Votic replaces the listening dock while it is (or is becoming) open.
  const dockCovered = askPhase === "opening" || askPhase === "open";
  // 0 is the Reader alone, 1 is the panel fully up; opening and closing are the same animation reversed.
  const [askProgress] = useState(() => new Animated.Value(0));
  const [askQuestion, setAskQuestion] = useState("");
  const [askMessages, setAskMessages] = useState<ReaderAskMessage[]>([]);
  const [askSending, setAskSending] = useState(false);
  const [askError, setAskError] = useState("");
  const [conversationSummary, setConversationSummary] = useState<ConversationSummary | null>(null);
  const [conversationSaved, setConversationSaved] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [voices, setVoices] = useState<DeviceVoice[]>([]);
  const [previewVoiceIdentifier, setPreviewVoiceIdentifier] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const askScrollRef = useRef<ScrollView>(null);
  const speechSession = useRef(0);
  const seekWasPlaying = useRef(false);
  const sentenceLayout = useRef<Record<number, { y: number; height: number }>>({});
  const scrollOffset = useRef(0);
  const viewportHeight = useRef(0);
  const manuallyScrolling = useRef(false);
  const closing = useRef(false);
  const readerPrepared = useRef(false);
  const [readerReady, setReaderReady] = useState(false);
  const walkthrough = useWalkthrough();
  const explanationStyle = explanationStyleArgs(usePersonalization().answers);
  const documentTarget = useWalkthroughTarget("reader.document");
  const progressTarget = useWalkthroughTarget("reader.progress");
  const askTarget = useWalkthroughTarget("reader.ask");
  const playTarget = useWalkthroughTarget("reader.play");
  const moreTarget = useWalkthroughTarget("reader.more");
  const toolsTarget = useWalkthroughTarget("reader.tools");
  const closeTarget = useWalkthroughTarget("reader.close");
  const bookmarkTarget = useWalkthroughTarget("reader.bookmark");
  const askComposerTarget = useWalkthroughTarget("reader.askComposer");
  const completedRef = useRef(activeDocument?.progress === 1);
  const askGeneration = useRef(0);
  const hasAskConversation =
    askMessages.length > 0 || askSending || Boolean(askError) || Boolean(conversationSummary) || summarizing;
  // The empty state is dock-sized. Only a real conversation gets a bounded, scrollable tray.
  const askPanelHeight = hasAskConversation
    ? Math.min(ASK_CONVERSATION_MAX_HEIGHT, Math.round(window.height * ASK_CONVERSATION_MAX_SHARE))
    : ASK_COMPOSER_HEIGHT;
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
  }

  async function sendAskVotic() {
    const clean = askQuestion.trim();
    if (!clean || askSending || !activeDocument) return;
    const generation = askGeneration.current;
    const context = resolveAskVoticContext(documents, activeDocument, {});
    const history = askMessages;
    setAskQuestion("");
    setAskError("");
    setAskMessages((current) => [...current, { role: "user", text: clean }]);
    setAskSending(true);
    try {
      const request = prepareAskRequest(context, clean, history);
      const answer = await askVotic(clean, request.document, request.history, ...explanationStyle);
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
      const answer = await askVotic(
        CONVERSATION_SUMMARY_PROMPT,
        request.document,
        request.history,
        ...explanationStyle,
      );
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
        // Follow the native boundary directly: it fires as the word is spoken, so the highlight stays with the audio.
        const next = wordAtSpeechOffset(segment, Number(event?.charIndex));
        if (next !== null) setWordIndex(next);
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
  // The Reader walkthrough waits until the document has finished opening.
  useWalkthroughTrigger([{ id: "reader", when: readerReady && !transition.transitioning }]);
  const { request: requestWalkthrough } = walkthrough;
  useEffect(() => {
    if (askPhase === "open") requestWalkthrough("reader.ask");
  }, [askPhase, requestWalkthrough]);
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
    // After the save sheet has closed, the first time a passage is saved from the Reader.
    if (!savedPassage) setTimeout(() => walkthrough.request("reader.saved"), 400);
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
        <Animated.View style={[s.safe, { opacity: readerOpacity }]}>
          <SafeAreaView edges={["top", "bottom", "left", "right"]} style={s.safe}>
            <KeyboardAvoidingView style={s.content} behavior={Platform.OS === "ios" ? "padding" : "height"}>
              <View style={s.topBar}>
                <Pressable
                  ref={closeTarget}
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
                    ref={bookmarkTarget}
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
              <View ref={progressTarget} collapsable={false} style={s.documentHeader}>
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
              <ScrollView
                ref={(node) => {
                  scrollRef.current = node;
                  documentTarget(node);
                }}
                testID="reader-scroll"
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
                <View testID="reader-document" style={s.passages}>
                  {passages.map((passage, passageIndex) => {
                    const current = passageIndex === index;
                    const tokens = current ? passageTokens(passage) : [];
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
                      ref={askTarget}
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
                    {!listenExpanded ? (
                      <Pressable
                        ref={playTarget}
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
                      ref={moreTarget}
                      accessibilityRole="button"
                      accessibilityLabel={
                        listenExpanded ? "Collapse listening controls" : "Expand listening controls"
                      }
                      accessibilityState={{ expanded: listenExpanded }}
                      onPress={() => {
                        if (!listenExpanded) walkthrough.pressed("reader.more");
                        setListenExpanded((expanded) => !expanded);
                      }}
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
                  {listenExpanded ? (
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
                  ) : null}
                  {listenExpanded ? (
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
                  <SeekableProgress
                    compact
                    value={progress}
                    onSeekStart={beginSeek}
                    onSeek={(value) => void seekTo(value)}
                  />
                  {listenExpanded ? (
                    <View
                      ref={toolsTarget}
                      collapsable={false}
                      style={[s.toolRow, { borderTopColor: theme.border }]}
                    >
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
                            <Text style={[s.askAnswerText, { color: theme.text }]}>{message.text}</Text>
                            <View style={s.askAnswerActions}>
                              {message.link ? (
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel={`Open ${activeDocument?.title || "document"} at passage ${message.link.sentenceIndex + 1} in Reader`}
                                  onPress={() => openAskAnswerLink(message.link!)}
                                  style={[s.askSourcePill, { backgroundColor: `${theme.accent}1F` }]}
                                >
                                  <Text style={[s.askSourceText, { color: theme.accent }]} numberOfLines={1}>
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
                              conversationSaved ? "Conversation saved to Notes" : "Save conversation to Notes"
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
                          <Text style={[s.askAnswerText, { color: theme.text }]}>
                            {conversationSummary.text}
                          </Text>
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
                      {askSending ? (
                        <View accessibilityLiveRegion="polite" style={s.askThinking}>
                          <ActivityIndicator size="small" color={theme.accent} />
                          <Text style={[s.askStatus, { color: theme.mutedText }]}>Votic is thinking…</Text>
                        </View>
                      ) : null}
                      {askError ? (
                        <Text accessibilityLiveRegion="polite" style={[s.askError, { color: theme.text }]}>
                          {askError}
                        </Text>
                      ) : null}
                    </ScrollView>
                  ) : null}
                  <View
                    ref={askComposerTarget}
                    collapsable={false}
                    style={[s.askComposer, { borderColor: theme.accent, backgroundColor: theme.surface }]}
                  >
                    {!hasAskConversation ? <VoticLogo compact markOnly progress={progress} /> : null}
                    <TextInput
                      accessibilityLabel="Ask Votic a question"
                      value={askQuestion}
                      onChangeText={setAskQuestion}
                      placeholder="Ask Votic about this document…"
                      placeholderTextColor={theme.mutedText}
                      multiline={hasAskConversation}
                      numberOfLines={hasAskConversation ? undefined : 1}
                      maxLength={1000}
                      style={[s.askInput, !hasAskConversation && s.compactAskInput, { color: theme.text }]}
                      onSubmitEditing={() => void sendAskVotic()}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Send question"
                      disabled={!askQuestion.trim() || askSending}
                      onPress={() => void sendAskVotic()}
                      style={[
                        s.askSend,
                        {
                          backgroundColor: theme.accent,
                          opacity: !askQuestion.trim() || askSending ? 0.45 : 1,
                        },
                      ]}
                    >
                      {askSending ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Ionicons name="arrow-up" size={21} color="#FFF" />
                      )}
                    </Pressable>
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
            </KeyboardAvoidingView>

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
      <WalkthroughOverlay host="reader" />
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
  askInput: { flex: 1, minHeight: 46, maxHeight: 100, paddingVertical: 10, fontSize: 14 },
  compactAskInput: { height: 46, paddingVertical: 0 },
  askSend: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  askComposerClose: { width: 36, height: 40, alignItems: "center", justifyContent: "center" },
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
