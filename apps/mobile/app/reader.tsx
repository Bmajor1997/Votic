import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Speech from "expo-speech";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
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
import { ask_event_for } from "../src/activity/askCategories";
import { useAccountData } from "../src/storage/AccountDataProvider";
import {
  notification_player,
  notification_payload,
  valid_playback_state,
} from "../src/playback/notificationPlayback";
import { useReaderActivity } from "../src/activity/useReaderActivity";
import { ask_votic } from "../src/api/voticApi";
import {
  answered_from_context,
  answer_link,
  answer_note_for_source,
  AskAnswerSource,
  conversation_messages,
  FULL_HISTORY,
  prepare_ask_request,
  resolve_ask_votic_context,
} from "../src/ask/askVoticContext";
import { AskLink } from "../src/ask/documentSections";
import { RevealingText } from "../src/components/RevealingText";
import { useWebAutoGrow } from "../src/components/useWebAutoGrow";
import type { TextRevealFrame } from "../src/components/textReveal";
import { VoiceRecordingArea } from "../src/components/VoiceRecordingArea";
import { KeyboardDictationButton, type VoiceInputPhase } from "../src/components/KeyboardDictationButton";
import { AIResponse, AIThinking } from "../src/components/AIResponse";
import { useAnswerListening } from "../src/ask/useAnswerListening";
import { AskAnswerFooter } from "../src/ask/AskAnswerFooter";
import { AskConversationMenu, type AskConversationAction } from "../src/ask/AskConversationMenu";
import { VoticLogo } from "../src/components/VoticLogo";
import { controlSizes, radii, spacing, typography } from "../src/design/tokens";
import { useDocumentLibrary } from "../src/documents/DocumentLibraryProvider";
import { document_time_spent } from "../src/documents/insights";
import { split_passages } from "../src/documents/passages";
import { catch_up_context, catch_up_prompt } from "../src/documents/catchUp";
import { create_throttled_saver } from "../src/documents/throttledSaver";
import { useDocumentTransition } from "../src/navigation/DocumentTransitionProvider";
import { useOnboarding } from "../src/onboarding/OnboardingProvider";
import { useVoticPurpose } from "../src/personalization/PurposeProvider";
import { reader_source_transform } from "../src/navigation/readerTransform";
import { clean_tags } from "../src/notes/noteMetadata";
import { format_playback_rate, normalize_playback_rate } from "../src/playback/rates";
import { CompletionModal } from "../src/reader/components/CompletionModal";
import { ReadingPages } from "../src/reader/components/ReadingPages";
import { SeekableProgress, ToolButton } from "../src/reader/components/ReaderControls";
import { ReaderSettingsSheet, ReaderSheet } from "../src/reader/components/ReaderSettingsSheet";
import { PassageDraft, SavePassageSheet } from "../src/reader/components/SavePassageSheet";
import { sheetStyles } from "../src/reader/components/sheetStyles";
import {
  clock_label,
  location_at_scroll,
  location_for_progress,
  passage_tokens,
  progress_for_location,
  reader_type,
  speech_segment,
  word_at_speech_offset,
  word_matches,
} from "../src/reader/readerText";
import { DeviceVoice, unique_english_voices, votic_voice_preview } from "../src/reader/voices";
import {
  apply_pronunciations,
  load_pronunciations,
  PronunciationEntry,
  source_word_at_spoken_offset,
} from "../src/reader/pronunciationDictionary";
import { ReaderThemeProvider, useVoticTheme } from "../src/theme/ThemeProvider";
import { WalkthroughOverlay } from "../src/walkthrough/WalkthroughOverlay";
import {
  useWalkthrough,
  useWalkthroughTarget,
  useWalkthroughTrigger,
} from "../src/walkthrough/WalkthroughProvider";

/** Read: the document without audio controls. Listen: the document with narration controls. */
type ReaderMode = "read" | "listen";

const PROGRESS_SYNC_INTERVAL_MS = 2000;
// Ask Votic replaces the Reader dock with a compact composer and closes along the same curve.
const ASK_TRANSITION_MS = 320;
const ASK_OPEN_EASING = Easing.out(Easing.cubic);
const ASK_CLOSE_EASING = Easing.in(Easing.cubic);
const ASK_COMPOSER_HEIGHT = 72;
/** The question box: one 20-point line to start, growing a line at a time up to six, then scrolling. */
const ASK_INPUT_LINE = 20;
const ASK_INPUT_PADDING = 13;
const ASK_INPUT_MIN_HEIGHT = ASK_INPUT_LINE + ASK_INPUT_PADDING * 2;
const ASK_INPUT_MAX_HEIGHT = ASK_INPUT_LINE * 6 + ASK_INPUT_PADDING * 2;
// Ask Votic never covers more than half the Reader, so the document stays in view; answers scroll inside.
const ASK_CONVERSATION_MAX_HEIGHT = 460;
const ASK_CONVERSATION_MAX_SHARE = 0.5;
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
  const { uid } = useAccountData();
  const [nativePlayer] = useState(notification_player);
  const accessibility = useAccessibilityPreferences();
  const transition = useDocumentTransition();
  const onboarding = useOnboarding();
  const { explanationStyle } = useVoticPurpose();
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
  const passages = useMemo(
    () => split_passages(activeDocument?.plainText || ""),
    [activeDocument?.plainText],
  );
  const [index, setIndex] = useState(activeDocument?.sentenceIndex || 0);
  const [wordIndex, setWordIndex] = useState(activeDocument?.wordIndex || 0);
  const [rate, setRate] = useState(normalize_playback_rate(activeDocument?.playbackRate || 1));
  const [playing, setPlaying] = useState(false);
  const walkthrough = useWalkthrough();
  const documentTarget = useWalkthroughTarget("reader.document");
  const progressTarget = useWalkthroughTarget("reader.progress");
  const askTarget = useWalkthroughTarget("reader.ask");
  const playTarget = useWalkthroughTarget("reader.play");
  const moreTarget = useWalkthroughTarget("reader.more");
  const toolsTarget = useWalkthroughTarget("reader.tools");
  const closeTarget = useWalkthroughTarget("reader.close");
  const bookmarkTarget = useWalkthroughTarget("reader.bookmark");
  const askComposerTarget = useWalkthroughTarget("reader.askComposer");
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
  const answerListening = useAnswerListening(
    activeId || "",
    askOpen && !askClosing && !askVoiceBusy,
    activeDocument?.playbackRate,
  );
  const showAskRecording = askVoiceBusy && askVoicePhase !== "reviewing";
  const [askMessages, setAskMessages] = useState<ReaderAskMessage[]>([]);
  const [askSending, setAskSending] = useState(false);
  const askInputRef = useRef<TextInput>(null);
  useWebAutoGrow(askInputRef, askQuestion, ASK_INPUT_MIN_HEIGHT, ASK_INPUT_MAX_HEIGHT);
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
  // Answers drawn from the document (not notices such as a daily limit) can be saved and summarized.
  const documentAnswers = askMessages.filter(
    (message) => message.role === "votic" && !message.fallback,
  ).length;
  // What applies to the whole conversation sits in the header's menu rather than under the answers.
  // Summarizing is offered once there's more than one answer to sum up.
  const conversationActions: AskConversationAction[] = documentAnswers
    ? [
        {
          label: conversationSaved ? "Conversation saved to Notes" : "Save conversation to Notes",
          icon: "bookmark-outline",
          done: conversationSaved,
          onPress: save_conversation_to_notes,
        },
        ...(documentAnswers >= 2 && !conversationSummary && !summarizing && !askSending
          ? [
              {
                label: "Summarize conversation",
                icon: "sparkles-outline" as const,
                onPress: () => void summarize_conversation(),
              },
            ]
          : []),
      ]
    : [];
  // Keep the empty composer compact; recording happens inside the same one-line bar.
  const minimumAskHeight = askComposerHeight + 22 + (askVoiceError ? askVoiceErrorHeight : 0);
  const askPanelHeight = hasAskConversation
    ? Math.max(
        minimumAskHeight + 48,
        Math.min(
          ASK_CONVERSATION_MAX_HEIGHT,
          Math.floor((availableHeight ?? window.height) * ASK_CONVERSATION_MAX_SHARE),
        ),
      )
    : Math.max(ASK_COMPOSER_HEIGHT, minimumAskHeight);
  // Word-by-word progress stays local; the library (and storage) hears about it every couple of seconds and on pause/close.
  const [progressSync] = useState(() =>
    create_throttled_saver<{ id: string; progress: number; index: number; wordIndex: number }>((value) => {
      if (!completedRef.current) updateProgress(value.id, value.progress, value.index, value.wordIndex);
    }, PROGRESS_SYNC_INTERVAL_MS),
  );
  const readingType = reader_type(
    accessibility.textSize,
    accessibility.readingSpacing,
    accessibility.readerFont,
    accessibility.textSpacing,
  );
  const progress = useMemo(
    () => progress_for_location(passages, index, wordIndex),
    [passages, index, wordIndex],
  );

  // Android's service keeps owning narration after this screen or the JS runtime is suspended.
  const nativeError = useRef<string | null>(null);
  const receive_native_playback = useEffectEvent(
    (state: ReturnType<NonNullable<typeof nativePlayer>["get_state"]>) => {
      if (!valid_playback_state(state, uid) || state.documentId !== activeId || !listening) return;
      setIndex(state.passageIndex);
      setWordIndex(state.wordIndex);
      setPlaying(state.playing);
      if (state.error && state.error !== nativeError.current) {
        nativeError.current = state.error;
        Alert.alert("Listening paused", state.error);
      } else if (!state.error) nativeError.current = null;
      if (state.completed) {
        completedRef.current = true;
        setCompletionOpen(true);
      }
    },
  );
  useEffect(() => {
    if (!nativePlayer) return;
    const frame = requestAnimationFrame(() => receive_native_playback(nativePlayer.get_state()));
    const listener = nativePlayer.addListener("state", (state) => receive_native_playback(state));
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") receive_native_playback(nativePlayer.get_state());
    });
    return () => {
      cancelAnimationFrame(frame);
      listener.remove();
      appState.remove();
    };
  }, [nativePlayer, activeId, listening]);

  // Effect events read the latest render's functions without restarting the effects that call them.
  const onHardwareBack = useEffectEvent(() => {
    // With Ask Votic open, Back closes it (the same way as its X) and the Reader stays open.
    if (askOpen) close_ask_votic();
    else void close_reader();
    return true;
  });
  const onAskSettled = useEffectEvent((opened: boolean) => {
    if (opened) setAskPhase("open");
    else finish_ask_close();
  });
  const onAskClosed = useEffectEvent(() => finish_ask_close());
  // Listen mode keeps the spoken word in view. In Read mode the reader's own scrolling sets the
  // position, so the page only moves for an explicit jump such as a seek.
  const onPositionChange = useEffectEvent(() => {
    if (listening) follow_active_word();
    else if (scrollToPosition.current) {
      scrollToPosition.current = false;
      follow_active_word(true);
    }
  });

  useEffect(() => {
    void Speech.getAvailableVoicesAsync()
      .then((available) => setVoices(unique_english_voices(available)))
      .catch(() => setVoices([]));
    void load_pronunciations().then(setPronunciations);
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
    void nativePlayer?.pause().catch(() => {});
    const frame = requestAnimationFrame(() => onReadEntry());
    return () => cancelAnimationFrame(frame);
  }, [listening, nativePlayer]);
  // Continue Listening from Home starts narration once it is ready.
  const autoplayed = useRef(false);
  const onReadyToAutoplay = useEffectEvent(() => {
    const state = nativePlayer?.get_state();
    if (state && valid_playback_state(state, uid) && state.documentId === activeId && state.playing) return;
    speak();
  });
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

  function open_ask_votic() {
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
  function close_ask_votic() {
    void answerListening.stop();
    setAskMessages((messages) => messages.map((message) => ({ ...message, revealed: true })));
    if (!askOpen || askClosing) return;
    Keyboard.dismiss();
    if (accessibility.reduceMotion) {
      finish_ask_close();
      return;
    }
    setAskPhase("closing");
  }
  function finish_ask_close() {
    askProgress.stopAnimation();
    askProgress.setValue(0);
    setAskPhase("closed");
    setAskVoicePhase("idle");
    setAskVoiceReveal(null);
    setAskVoiceError("");
  }

  async function send_ask_votic() {
    const clean = askQuestion.trim();
    if (!clean || askSending || askVoiceBusy || !activeDocument) return;
    Keyboard.dismiss();
    const generation = askGeneration.current;
    const context = resolve_ask_votic_context(documents, activeDocument, {});
    const history = askMessages;
    recordAsk(ask_event_for(clean, { newConversation: history.length === 0 }));
    setAskQuestion("");
    setAskError("");
    setAskMessages((current) => [...current, { role: "user", text: clean }]);
    setAskSending(true);
    try {
      const request = prepare_ask_request(context, clean, history);
      const answer = await ask_votic(clean, request.document, request.history, explanationStyle);
      const grounded = answered_from_context(request, answer);
      // Only a real answer counts toward "Ask Votic a question"; a notice (such as a limit) doesn't.
      if (grounded && answer.mode !== "built-in") onboarding.recordAskedVotic();
      if (generation !== askGeneration.current) return;
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
              link: answer_link(request, answer.sectionIndex) ?? undefined,
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

  async function send_catch_up() {
    if (!activeDocument || askSending || activeDocument.progress <= 0) return;
    Keyboard.dismiss();
    const question = catch_up_prompt(activeDocument);
    const covered = catch_up_context(activeDocument);
    open_ask_votic();
    setAskError("");
    setAskMessages((current) => [...current, { role: "user", text: "Catch me up" }]);
    setAskSending(true);
    try {
      const answer = await ask_votic(
        question,
        {
          title: activeDocument.title,
          sections: [{ heading: "What you have covered so far", text: covered }],
        },
        [],
        explanationStyle,
        "catch-me-up",
      );
      // A notice (such as a daily limit) did not come from the document, so it isn't labeled as if it did.
      setAskMessages((current) => [
        ...current,
        answer.mode === "document-ai"
          ? { role: "votic", text: answer.answer }
          : { role: "votic", text: answer.answer, fallback: true },
      ]);
    } catch (error) {
      setAskError(error instanceof Error ? error.message : "Votic could not catch you up right now.");
    } finally {
      setAskSending(false);
    }
  }

  function save_ask_answer(messageIndex: number) {
    const message = askMessages[messageIndex];
    if (!message?.source || message.role !== "votic" || message.saved) return;
    const now = Date.now();
    const note = answer_note_for_source(
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

  async function summarize_conversation() {
    if (
      !activeDocument ||
      summarizing ||
      askSending ||
      !askMessages.some((message) => message.role === "votic" && !message.fallback)
    )
      return;
    const generation = askGeneration.current;
    const context = resolve_ask_votic_context(documents, activeDocument, {});
    setSummarizing(true);
    setAskError("");
    try {
      const request = prepare_ask_request(context, CONVERSATION_SUMMARY_PROMPT, askMessages, FULL_HISTORY);
      const answer = await ask_votic(CONVERSATION_SUMMARY_PROMPT, request.document, request.history);
      if (generation !== askGeneration.current) return;
      // A notice (such as a daily limit) is not a summary, so it is shown as an error instead of as notes.
      if (!answered_from_context(request, answer)) {
        setAskError(answer.answer);
        return;
      }
      setConversationSummary({
        partial: conversation_messages(askMessages).length > FULL_HISTORY.messages,
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

  function save_conversation_summary() {
    if (!conversationSummary?.source || conversationSummary.saved) return;
    const now = Date.now();
    const note = answer_note_for_source(
      documents,
      conversationSummary.source,
      conversationSummary.text,
      now,
      `votic-summary-${now}-${Math.random().toString(36).slice(2, 7)}`,
    );
    if (!note) return;
    savePassage(note.documentId, {
      ...note.passage,
      title: "Ask Votic conversation summary",
      noteType: "key-point",
      tags: ["votic", "summary"],
    });
    setConversationSummary((current) => (current ? { ...current, saved: true } : current));
  }

  function save_conversation_to_notes() {
    if (conversationSaved || !activeDocument) return;
    const messages = conversation_messages(askMessages);
    if (!messages.some((message) => message.role === "votic")) return;
    const context = resolve_ask_votic_context(documents, activeDocument, {});
    if ((context.kind !== "document" && context.kind !== "notes") || !context.saveSource) return;
    const now = Date.now();
    const transcript = messages
      .map((message) => `${message.role === "user" ? "You" : "Votic"}: ${message.text}`)
      .join("\n\n");
    const note = answer_note_for_source(
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

  function open_ask_answer_link(link: AskLink) {
    if (!documents.some((document) => document.id === link.documentId)) return;
    openDocument(link.documentId, link.sentenceIndex);
    // The Reader keeps its own position, so a link into the open document has to move it here too.
    if (link.documentId === activeId && passages[link.sentenceIndex] !== undefined) {
      setIndex(link.sentenceIndex);
      setWordIndex(0);
    }
    close_ask_votic();
  }

  async function close_reader() {
    if (closing.current) return;
    closing.current = true;
    if (nativePlayer) {
      void progressSync.flush();
      await answerListening.stop();
      await Speech.stop();
    } else await stop();
    transition.closeReader(() => router.back());
  }
  function prepare_reader() {
    if (readerPrepared.current || !viewportHeight.current) return;
    if (passages.length && sentenceLayout.current[index] === undefined) return;
    readerPrepared.current = true;
    follow_active_word(true, false);
    requestAnimationFrame(() => {
      setReaderReady(true);
      transition.beginReader();
    });
  }
  /** Keeps narration focused without changing the Reader's layout when its dock changes mode. */
  function follow_active_word(
    force = false,
    animated = !accessibility.reduceMotion,
    viewport = viewportHeight.current,
  ) {
    if (manuallyScrolling.current && !force) return;
    const layout = sentenceLayout.current[index];
    if (!layout || !viewport) return;
    const words = Math.max(1, word_matches(passages[index] || "").length);
    const wordFraction = Math.max(0, Math.min(1, wordIndex / words));
    const estimatedY = layout.y + layout.height * wordFraction;
    const top = scrollOffset.current + 24;
    const bottom = scrollOffset.current + viewport * 0.7;
    if (force || estimatedY < top || estimatedY > bottom)
      scrollRef.current?.scrollTo({ y: Math.max(0, estimatedY - viewport * 0.45), animated });
  }
  function measure_sentence(sentenceIndex: number, event: LayoutChangeEvent) {
    const { y, height } = event.nativeEvent.layout;
    sentenceLayout.current[sentenceIndex] = { y, height };
    if (sentenceIndex === index) prepare_reader();
  }
  function track_scroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    engaged();
    scrollOffset.current = event.nativeEvent.contentOffset.y;
    if (event.nativeEvent.contentSize?.height) contentHeight.current = event.nativeEvent.contentSize.height;
    // Only the reader's own scrolling moves the reading position, never the Reader's programmatic scrolls.
    if (manuallyScrolling.current) sync_reading_position();
  }
  /** Read mode: the document position follows the reading line as the person scrolls. */
  function sync_reading_position() {
    if (listening || completedRef.current) return;
    const location = location_at_scroll(passages, sentenceLayout.current, {
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
    await nativePlayer?.pause();
  }
  async function preview_voice(voice: DeviceVoice, name: string) {
    await answerListening.stop();
    if (!listening) return;
    const session = ++speechSession.current;
    setPlaying(false);
    await Speech.stop();
    await nativePlayer?.pause();
    if (session !== speechSession.current) return;
    setPreviewVoiceIdentifier(voice.identifier);
    const clear_preview = () =>
      setPreviewVoiceIdentifier((current) => (current === voice.identifier ? null : current));
    Speech.speak(votic_voice_preview(name), {
      voice: voice.identifier,
      rate: 1,
      onDone: clear_preview,
      onStopped: clear_preview,
      onError: clear_preview,
    });
  }
  function speak(at = index, startWord = at === index ? wordIndex : 0) {
    void answerListening.stop();
    if (!listening) return;
    const session = speechSession.current + 1;
    speechSession.current = session;
    if (nativePlayer) void begin_native_speech(at, startWord, session);
    else void begin_speech(at, startWord, session, true);
  }
  async function begin_native_speech(at: number, startWord: number, session: number, playbackRate = rate) {
    if (!nativePlayer || !uid || !activeDocument || !passages[at]) return;
    try {
      await Speech.stop();
      if (session !== speechSession.current) return;
      const payload = notification_payload(
        uid,
        activeDocument,
        passages,
        pronunciations,
        at,
        startWord,
        playbackRate,
        accessibility.voiceIdentifier,
      );
      await nativePlayer.start(payload);
      if (session !== speechSession.current) return;
      completedRef.current = false;
      setIndex(at);
      setWordIndex(startWord);
      onboarding.markTipSeen("reader-listen");
      // The service's state event sets playing after TTS is ready, rather than pretending audio started.
    } catch {
      if (session !== speechSession.current) return;
      setPlaying(false);
      Alert.alert(
        "Could not start listening",
        "Votic could not start background listening. Check your device's reading voices and try again.",
      );
    }
  }
  async function begin_speech(
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
    const segment = speech_segment(passage, startWord);
    const spokenText = apply_pronunciations(segment.text, pronunciations);
    // Keep each passage continuous so the voice retains sentence rhythm and pronunciation.
    // Each utterance has its own token: late callbacks from a finished passage are stale.
    const utterance = ++speechUtterance.current;
    const is_current = () => session === speechSession.current && utterance === speechUtterance.current;
    setIndex(at);
    setWordIndex(segment.startWord);
    setPlaying(true);
    onboarding.markTipSeen("reader-listen");
    Speech.speak(spokenText, {
      rate: playbackRate,
      voice: accessibility.voiceIdentifier || undefined,
      onStart: () => {
        if (!is_current()) return;
        setIndex(at);
        setWordIndex(segment.startWord);
      },
      onBoundary: (event: any) => {
        if (!is_current() || (event?.name && event.name !== "word")) return;
        // Follow the native boundary directly: it fires as the word is spoken, so the highlight stays with the audio.
        const boundary = Number(event?.charIndex);
        const next =
          spokenText === segment.text
            ? word_at_speech_offset(segment, boundary)
            : segment.startWord + source_word_at_spoken_offset(segment.text, spokenText, boundary);
        if (next !== null) setWordIndex(next);
      },
      onDone: () => {
        if (!is_current()) return;
        if (at < passages.length - 1) void begin_speech(at + 1, 0, session, false, playbackRate);
        else finish_document(false);
      },
      onStopped: () => {
        if (is_current()) setPlaying(false);
      },
      onError: () => {
        if (is_current()) setPlaying(false);
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
  function begin_seek() {
    engaged();
    seekWasPlaying.current = playing;
    speechSession.current += 1;
    setPlaying(false);
    void Speech.stop();
    void nativePlayer?.pause().catch(() => {});
  }
  async function seek_to(value: number) {
    if (!activeDocument || !passages.length) return;
    const resume = seekWasPlaying.current;
    seekWasPlaying.current = false;
    const location = location_for_progress(passages, value);
    speechSession.current += 1;
    await Speech.stop();
    await nativePlayer?.pause();
    scrollToPosition.current = true;
    setIndex(location.sentenceIndex);
    setWordIndex(location.wordIndex);
    completedRef.current = false;
    updateProgress(activeDocument.id, value, location.sentenceIndex, location.wordIndex);
    if (resume) {
      const session = speechSession.current + 1;
      speechSession.current = session;
      if (nativePlayer) void begin_native_speech(location.sentenceIndex, location.wordIndex, session);
      else void begin_speech(location.sentenceIndex, location.wordIndex, session, false);
    }
  }
  async function change_rate(value: number) {
    const nextRate = normalize_playback_rate(value);
    const resume = playing;
    const resumeAt = { index, wordIndex };
    if (resume) await stop();
    setRate(nextRate);
    if (activeDocument) updatePlaybackRate(activeDocument.id, nextRate);
    if (resume) {
      const session = speechSession.current + 1;
      speechSession.current = session;
      if (nativePlayer) void begin_native_speech(resumeAt.index, resumeAt.wordIndex, session, nextRate);
      else void begin_speech(resumeAt.index, resumeAt.wordIndex, session, false, nextRate);
    }
  }
  function finish_document(stopSpeech = true) {
    if (!activeDocument || !passages.length) return;
    if (stopSpeech) {
      void stop();
      void nativePlayer?.stop().catch(() => {});
    }
    const finalIndex = passages.length - 1;
    const finalWord = Math.max(0, word_matches(passages[finalIndex]).length - 1);
    completedRef.current = true;
    setPlaying(false);
    setIndex(finalIndex);
    setWordIndex(finalWord);
    completeDocument(activeDocument.id, finalIndex, finalWord);
    setCompletionOpen(true);
  }
  const totalWords = useMemo(
    () => word_matches(activeDocument?.plainText || "").length,
    [activeDocument?.plainText],
  );
  const totalSeconds = totalWords / Math.max(0.1, 2.6 * rate);
  const elapsedSeconds = totalSeconds * progress;
  const sentenceHighlight =
    accessibility.highlightMode === "sentence" || accessibility.highlightMode === "both";
  const wordHighlight = accessibility.highlightMode === "word" || accessibility.highlightMode === "both";
  const passageId = "passage-" + index;
  const savedPassage = activeDocument?.savedPassages?.find((saved) => saved.id === passageId);
  function open_save_passage() {
    onboarding.markTipSeen("reader-bookmark");
    void stop();
    setSaveOpen(true);
  }
  // The Reader walkthrough waits until the document has finished opening.
  const flows = walkthrough.state.flows;
  const opened = readerReady && !transition.transitioning;
  useWalkthroughTrigger(
    [
      { id: "reader", when: opened },
      // "You're all set" waits until both Home and the Reader have been covered, whichever came first.
      { id: "allSet", when: opened && flows.reader?.status === "completed" && Boolean(flows.home) },
    ],
    { listening },
  );
  const { request: requestWalkthrough } = walkthrough;
  useEffect(() => {
    if (askPhase === "open") requestWalkthrough("reader.ask");
  }, [askPhase, requestWalkthrough]);
  function confirm_save_passage(draft: PassageDraft) {
    if (!activeDocument || !passages[index]) return;
    const now = Date.now();
    savePassage(activeDocument.id, {
      id: passageId,
      sentenceIndex: index,
      text: passages[index],
      note: draft.note.trim(),
      title: draft.title.trim() || undefined,
      noteType: draft.noteType,
      tags: clean_tags(draft.tags),
      pinned: savedPassage?.pinned,
      createdAt: savedPassage?.createdAt || now,
      updatedAt: now,
    });
    setSaveOpen(false);
    // After the save sheet has closed, the first time a passage is saved from the Reader.
    if (!savedPassage) setTimeout(() => walkthrough.request("reader.saved"), 400);
  }
  function confirm_remove_passage() {
    if (!activeDocument || !savedPassage) return;
    removePassage(activeDocument.id, savedPassage.id);
    setSaveOpen(false);
  }

  const {
    scaleX: sourceScaleX,
    scaleY: sourceScaleY,
    translateX: sourceTranslateX,
    translateY: sourceTranslateY,
  } = reader_source_transform(transition.sourceRect, window);
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
                    ref={closeTarget}
                    accessibilityRole="button"
                    accessibilityLabel="Close reader"
                    onPress={() => {
                      void close_reader();
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
                      ref={bookmarkTarget}
                      accessibilityRole="button"
                      accessibilityLabel={savedPassage ? "Edit saved passage" : "Save current passage"}
                      accessibilityState={{ selected: Boolean(savedPassage) }}
                      onPress={open_save_passage}
                      style={({ pressed }) => [sheetStyles.iconButton, { opacity: pressed ? 0.55 : 1 }]}
                    >
                      <Ionicons
                        name={savedPassage ? "bookmark" : "bookmark-outline"}
                        size={22}
                        color={savedPassage ? theme.accentText : theme.text}
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
                    onSeekStart={begin_seek}
                    onSeek={(value) => void seek_to(value)}
                  />
                </View>
                {!listening ? (
                  <View ref={documentTarget} collapsable={false} style={s.textArea}>
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
                          updateProgress(activeId, progress_for_location(passages, at, word), at, word);
                      }}
                    />
                  </View>
                ) : (
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
                      prepare_reader();
                    }}
                    onScroll={track_scroll}
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
                      sync_reading_position();
                      manuallyScrolling.current = false;
                    }}
                    onMomentumScrollEnd={() => {
                      sync_reading_position();
                      manuallyScrolling.current = false;
                    }}
                  >
                    <View testID="reader-document" style={s.passages}>
                      {passages.map((passage, passageIndex) => {
                        const current = passageIndex === index;
                        const tokens = current && listening ? passage_tokens(passage) : [];
                        return (
                          <Text
                            key={passageIndex}
                            onLayout={(event) => measure_sentence(passageIndex, event)}
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
                        onPress={open_ask_votic}
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
                        ref={moreTarget}
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
                          onPress={() => (index >= passages.length - 1 ? finish_document() : jump(1))}
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
                          {clock_label(elapsedSeconds)} / {clock_label(totalSeconds)}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Playback speed ${format_playback_rate(rate)}`}
                          onPress={() => setSheet("listen")}
                          style={s.rateButton}
                        >
                          <Text maxFontSizeMultiplier={1.15} style={[s.rateText, { color: theme.mutedText }]}>
                            {format_playback_rate(rate)}
                          </Text>
                          <Ionicons name="speedometer-outline" size={15} color={theme.mutedText} />
                        </Pressable>
                      </View>
                    ) : null}
                    {/* Progress lives once, under the document title. */}
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
                            onPress={() => void send_catch_up()}
                          />
                        ) : null}
                        <ToolButton
                          icon={savedPassage ? "bookmark" : "bookmark-outline"}
                          label="Bookmark"
                          active={saveOpen}
                          onPress={open_save_passage}
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
                        <View style={s.askHeaderActions}>
                          <AskConversationMenu actions={conversationActions} />
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Close Ask Votic"
                            onPress={close_ask_votic}
                            style={({ pressed }) => [sheetStyles.iconButton, { opacity: pressed ? 0.55 : 1 }]}
                          >
                            <Ionicons name="close" size={24} color={theme.text} />
                          </Pressable>
                        </View>
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
                            <View
                              key={messageIndex}
                              style={[s.askUserMessage, theme.isDark && { backgroundColor: theme.accent }]}
                            >
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
                              <AskAnswerFooter
                                listen={{
                                  playing: answerListening.playingKey === String(messageIndex),
                                  failed: answerListening.errorKey === String(messageIndex),
                                  disabled: askVoiceBusy,
                                  onPress: () =>
                                    void answerListening.toggle(String(messageIndex), message.text, stop),
                                }}
                                source={
                                  message.link
                                    ? {
                                        label: `Passage ${message.link.sentenceIndex + 1} · ${activeDocument?.title || "this document"}`,
                                        accessibilityLabel: `Open ${activeDocument?.title || "document"} at passage ${message.link.sentenceIndex + 1} in Reader`,
                                        onPress: () => open_ask_answer_link(message.link!),
                                      }
                                    : null
                                }
                                save={
                                  message.source
                                    ? {
                                        saved: Boolean(message.saved),
                                        onPress: () => save_ask_answer(messageIndex),
                                      }
                                    : null
                                }
                              />
                            </View>
                          ),
                        )}
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
                              <Text style={[s.summaryTitle, { color: theme.text }]}>
                                Conversation summary
                              </Text>
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
                            <AskAnswerFooter
                              listen={{
                                playing: answerListening.playingKey === "summary",
                                failed: answerListening.errorKey === "summary",
                                disabled: askVoiceBusy,
                                onPress: () =>
                                  void answerListening.toggle("summary", conversationSummary.text, stop),
                              }}
                              save={
                                conversationSummary.source
                                  ? {
                                      saved: Boolean(conversationSummary.saved),
                                      onPress: save_conversation_summary,
                                      label: "Save conversation summary to Notes",
                                      savedLabel: "Conversation summary saved to Notes",
                                    }
                                  : null
                              }
                            />
                          </View>
                        ) : null}
                        {askSending || summarizing ? <AIThinking summary={summarizing} /> : null}
                        {askError ? (
                          <Text
                            accessibilityLiveRegion="polite"
                            style={[s.askError, { color: theme.text, backgroundColor: theme.surfaceMuted }]}
                          >
                            {askError}
                          </Text>
                        ) : null}
                      </ScrollView>
                    ) : null}
                    {askVoiceError ? (
                      <Text
                        onLayout={(event) => setAskVoiceErrorHeight(event.nativeEvent.layout.height)}
                        style={[s.askError, { color: theme.text, backgroundColor: theme.surfaceMuted }]}
                      >
                        {askVoiceError}{" "}
                        {askVoicePhase === "error"
                          ? "Retry transcription or discard the recording."
                          : "You can still type your question."}
                      </Text>
                    ) : null}
                    <View
                      ref={askComposerTarget}
                      collapsable={false}
                      testID="voice-composer"
                      onLayout={(event) => setAskComposerHeight(event.nativeEvent.layout.height)}
                      style={[
                        s.askComposer,
                        // Recording stays in the one-line bar; only a failed transcription needs more room.
                        askVoicePhase === "error" && s.askRecordingComposer,
                        // Once the question wraps, the pill rounds into a box with the buttons along the bottom.
                        askComposerHeight > ASK_INPUT_MIN_HEIGHT + 12 && s.askComposerTall,
                        { borderColor: theme.accent, backgroundColor: theme.surface },
                      ]}
                    >
                      {/* The logo steps aside once there's a question, so the words get the room. */}
                      {!hasAskConversation &&
                      !showAskRecording &&
                      askVoicePhase !== "error" &&
                      !askQuestion ? (
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
                          {/* Before a conversation starts, the box stays one line while your words appear and
                              grows to fit them once they're all there. */}
                          <RevealingText
                            frame={askVoiceReveal}
                            singleLine={!hasAskConversation}
                            style={[s.askInput, { color: theme.text }]}
                          />
                        </View>
                      ) : (
                        <TextInput
                          ref={askInputRef}
                          accessibilityLabel="Ask Votic a question"
                          value={askQuestion}
                          editable={!askVoiceBusy}
                          onChangeText={setAskQuestion}
                          // Short enough to fit on one line beside the buttons before a conversation starts.
                          placeholder={
                            hasAskConversation ? "Ask Votic about this document…" : "Ask a question…"
                          }
                          placeholderTextColor={theme.mutedText}
                          multiline
                          // Before a conversation starts, Return still sends, as it did when the box was one line.
                          submitBehavior={hasAskConversation ? undefined : "submit"}
                          returnKeyType={hasAskConversation ? undefined : "send"}
                          maxLength={1000}
                          style={[
                            s.askInput,
                            askVoicePhase === "error" && s.askRecordingText,
                            { color: theme.text },
                          ]}
                          onSubmitEditing={() => void send_ask_votic()}
                        />
                      )}
                      <KeyboardDictationButton
                        key={activeId}
                        active={!askClosing}
                        value={askQuestion}
                        onPhaseChange={(phase) => {
                          if (phase === "starting") {
                            void answerListening.stop();
                            void stop();
                          }
                          setAskVoicePhase(phase);
                        }}
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
                          onPress={() => void send_ask_votic()}
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
                          onPress={close_ask_votic}
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
              onRateChange={change_rate}
              voices={voices}
              previewVoiceIdentifier={previewVoiceIdentifier}
              onPreviewVoice={(voice, name) => {
                if (previewVoiceIdentifier === voice.identifier) void stop();
                else void preview_voice(voice, name);
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
              timeSpentSeconds={document_time_spent(activeDocument)}
              passageCount={passages.length}
            />
            <SavePassageSheet
              visible={saveOpen}
              passageText={passages[index] || ""}
              savedPassage={savedPassage}
              onClose={() => setSaveOpen(false)}
              onSave={confirm_save_passage}
              onRemove={confirm_remove_passage}
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
  askHeaderActions: { flexDirection: "row", alignItems: "center" },
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
  askThinking: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  askStatus: { fontSize: 13 },
  askError: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13,
    lineHeight: 19,
  },
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
  askRecordingInput: { flex: 1, minWidth: 0 },
  // Grows with each line of the question, up to six lines, then scrolls.
  askInput: {
    flex: 1,
    minWidth: 0,
    minHeight: ASK_INPUT_MIN_HEIGHT,
    maxHeight: ASK_INPUT_MAX_HEIGHT,
    paddingTop: ASK_INPUT_PADDING,
    paddingBottom: ASK_INPUT_PADDING,
    lineHeight: ASK_INPUT_LINE,
    fontSize: 14,
  },
  askComposerTall: { borderRadius: 24, alignItems: "flex-end", paddingVertical: 2 },
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
