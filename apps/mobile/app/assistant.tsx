import { UsageLimitNotice } from "../src/subscription/UsageLimitNotice";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ask_votic } from "../src/api/voticApi";
import { spacing, typography } from "../src/design/tokens";
import { useDocumentLibrary } from "../src/documents/DocumentLibraryProvider";
import { readable_title } from "../src/documents/documentDisplay";
import { useVoticTheme } from "../src/theme/ThemeProvider";
import { RevealingText } from "../src/components/RevealingText";
import { useWebAutoGrow } from "../src/components/useWebAutoGrow";
import type { TextRevealFrame } from "../src/components/textReveal";
import { VoiceRecordingArea } from "../src/components/VoiceRecordingArea";
import { KeyboardDictationButton, type VoiceInputPhase } from "../src/components/KeyboardDictationButton";
import { voice_error_text } from "../src/voice/voiceErrorText";
import { AIResponse, AIThinking } from "../src/components/AIResponse";
import { VoticLogo } from "../src/components/VoticLogo";
import { useAccessibilityPreferences } from "../src/accessibility/AccessibilityProvider";
import { AskVoticEmptyAnimation } from "../src/components/EmptyStateIllustrations";
import { FadingScrollView } from "../src/components/FadingScrollView";
import {
  answered_from_context,
  answer_link,
  answer_note_for_source,
  AskAnswerSource,
  ask_votic_context_key,
  AskVoticParams,
  initial_question_from_params,
  MISSING_NOTES_MESSAGE,
  prepare_ask_request,
  resolve_ask_votic_context,
} from "../src/ask/askVoticContext";
import { AskLink } from "../src/ask/documentSections";
import { useAnswerListening } from "../src/ask/useAnswerListening";
import { AskAnswerFooter } from "../src/ask/AskAnswerFooter";
import { AskAnswerSourceChip } from "../src/ask/AskAnswerSourceChip";
import { answer_passage } from "../src/ask/answerPassage";
import { useActivity } from "../src/activity/ActivityProvider";
import { ask_event_for } from "../src/activity/askCategories";
import { useOnboarding } from "../src/onboarding/OnboardingProvider";
import { useVoticPurpose } from "../src/personalization/PurposeProvider";
import { ask_suggestions } from "../src/personalization/suggestions";
import { usePersonalization } from "../src/personalization/usePersonalization";
import { AskConversationMenu } from "../src/ask/AskConversationMenu";
import { conversation_summary_request, CONVERSATION_SUMMARY_PROMPT } from "../src/ask/conversationSummary";
import { useQuickNoteEditor } from "../src/notes/useQuickNoteEditor";

type Message = {
  role: "user" | "votic";
  text: string;
  saved?: boolean;
  source?: AskAnswerSource;
  link?: AskLink;
  /** The heading of the linked passage's part of the document, shown on the passage chip. */
  sectionTitle?: string;
  /** A notice (such as a daily limit) rather than an answer: not saved to Notes or sent as history. */
  fallback?: boolean;
  summary?: boolean;
};
type PromptFlight = { label: string; x: number; y: number; dx: number; dy: number };
/** Timestamp and unique id for a note saved from an answer (called only from the Save button). */
function answer_note_stamp() {
  const now = Date.now();
  return { now, id: "votic-note-" + now + "-" + Math.random().toString(36).slice(2, 7) };
}
/** How high a suggestion jumps on its way into the question box. */
const JUMP_HEIGHT = 72;

export function AskVotic({ embedded = false }: { embedded?: boolean }) {
  const quickNote = useQuickNoteEditor();
  const { theme } = useVoticTheme();
  const { explanationStyle } = useVoticPurpose();
  const personalization = usePersonalization();
  const onboarding = useOnboarding();
  const { recordAsk } = useActivity();
  const { activeDocument, documents, savePassage, openDocument, addQuickNote } = useDocumentLibrary();
  const params = useLocalSearchParams<AskVoticParams>();
  const context = resolve_ask_votic_context(documents, activeDocument, params);
  const contextKey = ask_votic_context_key(activeDocument?.id, params);
  const initialQuestion = initial_question_from_params(params);
  const notesScopeLabel = context.kind === "notes" || context.kind === "notes-missing" ? context.label : "";
  const { reduceMotion } = useAccessibilityPreferences();
  // Chosen from the person's personalization answers, or the purpose chosen in earlier versions.
  const suggestedPrompts = ask_suggestions(personalization.answers, personalization.purpose);
  const [question, setQuestion] = useState(initialQuestion);
  const [voiceReveal, setVoiceReveal] = useState<TextRevealFrame | null>(null);
  const [voicePhase, setVoicePhase] = useState<VoiceInputPhase>("idle");
  const [voiceLevel, setVoiceLevel] = useState({ value: 0, at: 0 });
  const [voiceError, setVoiceError] = useState("");
  const voiceBusy = !["idle", "error"].includes(voicePhase);
  const answerListening = useAnswerListening(contextKey, !voiceBusy, activeDocument?.playbackRate);
  const showRecording = voiceBusy && voicePhase !== "reviewing";
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  useWebAutoGrow(inputRef, question, INPUT_MIN_HEIGHT, INPUT_MAX_HEIGHT);
  const lastQuestion = useRef("");
  const [flight, setFlight] = useState<PromptFlight | null>(null);
  const rootRef = useRef<View>(null);
  const composerTargetRef = useRef<View>(null);
  const promptRefs = useRef<Record<string, View | null>>({});
  const promptEntry = useState(() => new Animated.Value(1))[0];
  const sendBounce = useState(() => new Animated.Value(0))[0];
  const sendSpin = useState(() => new Animated.Value(0))[0];
  const sendLaunch = useState(() => new Animated.Value(0))[0];
  const sendOpacity = useState(() => new Animated.Value(1))[0];
  const flightProgress = useState(() => new Animated.Value(0))[0];
  const retryScale = useState(() => new Animated.Value(1))[0];
  // The Ask tab stays mounted, so start a fresh conversation whenever its document or notes context changes.
  const contextKeyRef = useRef(contextKey);
  const generation = useRef(0);
  useEffect(() => {
    if (contextKeyRef.current === contextKey) return;
    contextKeyRef.current = contextKey;
    generation.current += 1;
    lastQuestion.current = "";
    setMessages([]);
    setQuestion(initialQuestion);
    setVoicePhase("idle");
    setVoiceReveal(null);
    setVoiceError("");
    setError("");
    setSending(false);
    setSummarizing(false);
    setRetrying(false);
    setLaunching(false);
    setFlight(null);
  }, [contextKey, initialQuestion]);
  function settle_prompt(label: string) {
    setQuestion(label);
    promptEntry.setValue(0);
    sendBounce.setValue(0);
    Animated.parallel([
      Animated.timing(promptEntry, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(sendBounce, {
          toValue: 8,
          duration: 120,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(sendBounce, {
          toValue: 0,
          damping: 7,
          stiffness: 210,
          mass: 0.65,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }
  function choose_prompt(label: string) {
    if (reduceMotion) {
      setQuestion(label);
      return;
    }
    const source = promptRefs.current[label];
    const target = composerTargetRef.current;
    const root = rootRef.current;
    if (!source || !target || !root) {
      settle_prompt(label);
      return;
    }
    root.measureInWindow((rootX, rootY) =>
      source.measureInWindow((sourceX, sourceY, _sourceWidth, sourceHeight) =>
        target.measureInWindow((targetX, targetY) => {
          const x = sourceX - rootX + 16;
          const y = sourceY - rootY + sourceHeight / 2 - 10;
          setFlight({ label, x, y, dx: targetX - rootX + 16 - x, dy: targetY - rootY + 12 - y });
          flightProgress.setValue(0);
          requestAnimationFrame(() =>
            Animated.timing(flightProgress, {
              toValue: 1,
              duration: 620,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }).start(() => {
              setFlight(null);
              settle_prompt(label);
            }),
          );
        }),
      ),
    );
  }
  function launch_arrow() {
    if (reduceMotion) return Promise.resolve();
    sendSpin.setValue(0);
    sendLaunch.setValue(0);
    sendOpacity.setValue(1);
    return new Promise<void>((resolve) =>
      Animated.sequence([
        Animated.timing(sendSpin, {
          toValue: 1,
          duration: 380,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(sendLaunch, {
            toValue: -24,
            duration: 190,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(sendOpacity, { toValue: 0, duration: 190, useNativeDriver: true }),
        ]),
      ]).start(() => {
        sendSpin.setValue(0);
        sendLaunch.setValue(0);
        sendOpacity.setValue(1);
        resolve();
      }),
    );
  }
  // Android can deliver Return twice before React re-renders, so a ref (not state) blocks a second send at once.
  const sendLock = useRef(false);
  async function send(retryQuestion?: string) {
    if (sendLock.current) return;
    sendLock.current = true;
    try {
      await submit_question(retryQuestion);
    } finally {
      sendLock.current = false;
    }
  }
  async function submit_question(retryQuestion?: string) {
    const retry = typeof retryQuestion === "string";
    const clean = (retryQuestion ?? question).trim();
    if (!clean || sending || launching || voiceBusy) return;
    Keyboard.dismiss();
    const askContext = context;
    const askGeneration = generation.current;
    const current = () => askGeneration === generation.current;
    if (retry) setRetrying(true);
    else {
      setLaunching(true);
      await launch_arrow();
      if (!current()) return;
      setLaunching(false);
      setQuestion("");
      setMessages((v) => [...v, { role: "user", text: clean }]);
      lastQuestion.current = clean;
      // Retries resend the same question, so only first attempts are counted.
      recordAsk(
        ask_event_for(clean, {
          newConversation: messages.length === 0,
          builtInPrompts: [...suggestedPrompts, initialQuestion].filter(Boolean),
        }),
      );
    }
    if (askContext.kind === "notes-missing") {
      setRetrying(false);
      setError(MISSING_NOTES_MESSAGE);
      return;
    }
    if (!retry) setError("");
    setSending(true);
    try {
      const request = prepare_ask_request(askContext, clean, messages);
      const answer = await ask_votic(clean, request.document, request.history, explanationStyle);
      const grounded = answered_from_context(request, answer);
      const { link, sectionTitle } = answer_passage(
        answer_link(request, answer.sectionIndex),
        answer.quote,
        documents,
      );
      // Only a real answer counts toward "Ask Votic a question"; a notice (such as a limit) doesn't.
      if (grounded && answer.mode !== "built-in") onboarding.recordAskedVotic();
      if (!current()) return;
      setError("");
      setMessages((v) => [
        ...v,
        grounded
          ? {
              role: "votic",
              text: answer.answer,
              source: askContext.kind === "general" ? undefined : (askContext.saveSource ?? undefined),
              link,
              sectionTitle,
            }
          : { role: "votic", text: answer.answer, fallback: true },
      ]);
    } catch (e) {
      if (current()) setError(e instanceof Error ? e.message : "Votic could not answer right now.");
    } finally {
      if (current()) {
        setSending(false);
        setRetrying(false);
      }
    }
  }
  async function summarize_conversation() {
    if (
      sendLock.current ||
      sending ||
      launching ||
      voiceBusy ||
      !messages.some((message) => message.role === "votic" && !message.fallback)
    )
      return;
    sendLock.current = true;
    const askGeneration = generation.current;
    setSending(true);
    setSummarizing(true);
    setError("");
    try {
      const request = conversation_summary_request(messages, explanationStyle);
      const answer = await ask_votic(
        CONVERSATION_SUMMARY_PROMPT,
        request.document,
        request.history,
        explanationStyle,
      );
      if (askGeneration !== generation.current) return;
      if (!answered_from_context(request, answer)) {
        setError(answer.answer);
        return;
      }
      setMessages((current) => [
        ...current,
        {
          role: "votic",
          text: answer.answer,
          summary: true,
          source:
            context.kind === "document" || context.kind === "notes"
              ? (context.saveSource ?? undefined)
              : undefined,
        },
      ]);
    } catch (error) {
      if (askGeneration === generation.current)
        setError(error instanceof Error ? error.message : "Votic could not summarize this conversation.");
    } finally {
      sendLock.current = false;
      if (askGeneration === generation.current) {
        setSending(false);
        setSummarizing(false);
      }
    }
  }
  function open_answer_link(link: AskLink) {
    if (!documents.some((document) => document.id === link.documentId)) return;
    openDocument(link.documentId, link.sentenceIndex);
    router.push("/reader");
  }
  function can_save_answer(message: Message) {
    return Boolean(
      message.summary ||
      (message.source && documents.some((document) => document.id === message.source?.documentId)),
    );
  }
  function save_answer_to_notes(index: number) {
    const message = messages[index];
    if (!message || message.role !== "votic" || message.saved) return;
    const { now, id } = answer_note_stamp();
    if (message.summary && !message.source) {
      addQuickNote({
        id,
        sentenceIndex: 0,
        text: "",
        note: message.text,
        title: "Ask Votic conversation summary",
        noteType: "key-point",
        tags: ["votic", "summary"],
        createdAt: now,
        updatedAt: now,
      });
      setMessages((current) => current.map((item, i) => (i === index ? { ...item, saved: true } : item)));
      return;
    }
    if (!message.source) return;
    const note = answer_note_for_source(documents, message.source, message.text, now, id);
    if (!note) return;
    savePassage(note.documentId, note.passage);
    setMessages((current) => current.map((item, i) => (i === index ? { ...item, saved: true } : item)));
  }
  function animate_retry(toValue: number) {
    if (reduceMotion) {
      retryScale.setValue(1);
      return;
    }
    Animated.spring(retryScale, {
      toValue,
      useNativeDriver: true,
      damping: 18,
      stiffness: 260,
      mass: 0.55,
    }).start();
  }
  return (
    <SafeAreaView
      edges={embedded ? ["top", "left", "right"] : ["top", "bottom", "left", "right"]}
      style={[s.safe, { backgroundColor: theme.background }]}
    >
      <KeyboardAvoidingView style={s.safe} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View ref={rootRef} style={s.safe}>
          <View style={[s.header, { borderBottomColor: theme.border }]}>
            {embedded ? (
              <VoticLogo compact />
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close Ask Votic"
                onPress={() => router.back()}
                style={s.icon}
              >
                <Ionicons name="chevron-down" size={27} color={theme.text} />
              </Pressable>
            )}
            <View style={s.headerCopy}>
              <Text style={[s.title, { color: theme.text }]}>Ask Votic</Text>
              <Text numberOfLines={1} style={[s.context, { color: theme.mutedText }]}>
                {context.label}
              </Text>
            </View>
            <AskConversationMenu
              actions={[
                { label: "Quick notes", icon: "create-outline", onPress: quickNote.open_quick_note },
                {
                  label: "Summarize",
                  icon: "sparkles-outline",
                  disabled:
                    sending ||
                    launching ||
                    voiceBusy ||
                    !messages.some((message) => message.role === "votic" && !message.fallback),
                  onPress: () => void summarize_conversation(),
                },
              ]}
            />
          </View>
          <FadingScrollView
            ref={scrollRef}
            contentContainerStyle={s.messages}
            keyboardShouldPersistTaps="handled"
            onLayout={() => scrollRef.current?.scrollToEnd({ animated: false })}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.length === 0 ? (
              <View style={s.welcome}>
                <AskVoticEmptyAnimation />
                <Text style={[s.welcomeTitle, { color: theme.text }]}>What can I help you with?</Text>
                <Text style={[s.body, s.welcomeBody, { color: theme.mutedText }]}>
                  {activeDocument
                    ? "Ask about this document, clarify a passage, or find an idea you heard."
                    : "Open a document or ask a question about reading with Votic."}
                </Text>
                <View style={s.prompts}>
                  {suggestedPrompts.map((label, i) => (
                    <Pressable
                      ref={(node) => {
                        promptRefs.current[label] = node;
                      }}
                      key={label}
                      onPress={() => choose_prompt(label)}
                      style={({ pressed }) => [
                        s.prompt,
                        { backgroundColor: theme.surfaceMuted, opacity: pressed ? 0.68 : 1 },
                      ]}
                    >
                      <Ionicons
                        name={
                          i === 0
                            ? "sparkles-outline"
                            : i === 1
                              ? "bulb-outline"
                              : i === 2
                                ? "school-outline"
                                : "search-outline"
                        }
                        size={17}
                        color={theme.accent}
                      />
                      <Text style={[s.promptText, { color: theme.accent }]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              messages.map((m, i) => (
                <View
                  key={i}
                  style={[
                    s.message,
                    m.role === "user" ? s.userMessage : s.voticMessage,
                    m.role === "user" && { backgroundColor: theme.accent },
                  ]}
                >
                  {m.role === "votic" ? (
                    <View>
                      {(() => {
                        // The same passage chip as the Reader's Ask panel, leading the answer it supports.
                        const link = m.link;
                        const target = link && documents.find((document) => document.id === link.documentId);
                        return link && target ? (
                          <View style={s.answerSource}>
                            <AskAnswerSourceChip
                              kind="passage"
                              passage={link.sentenceIndex + 1}
                              section={m.sectionTitle}
                              documentTitle={readable_title(target.title)}
                              filename={target.sourceName}
                              onPress={() => open_answer_link(link)}
                            />
                          </View>
                        ) : null;
                      })()}
                      {m.summary ? (
                        <Text style={[s.body, { color: theme.text, fontWeight: "700" }]}>
                          Conversation summary
                        </Text>
                      ) : null}
                      <AIResponse
                        text={m.text}
                        animate={!m.fallback}
                        style={[s.body, { color: theme.text }]}
                      />
                    </View>
                  ) : (
                    <Text style={[s.body, { color: "#FFF" }]}>{m.text}</Text>
                  )}
                  {m.role === "votic" ? (
                    <AskAnswerFooter
                      reportText={!m.fallback ? m.text : undefined}
                      style={s.answerFooter}
                      listen={{
                        playing: answerListening.playingKey === String(i),
                        failed: answerListening.errorKey === String(i),
                        disabled: voiceBusy,
                        onPress: () => void answerListening.toggle(String(i), m.text),
                      }}
                      save={
                        can_save_answer(m)
                          ? { saved: Boolean(m.saved), onPress: () => save_answer_to_notes(i) }
                          : null
                      }
                    />
                  ) : null}
                </View>
              ))
            )}
            {sending ? (
              <AIThinking
                summary={summarizing}
                question={messages.filter((message) => message.role === "user").at(-1)?.text}
                grounded={context.kind === "document" || context.kind === "notes"}
              />
            ) : null}
            {error || retrying ? (
              <View accessibilityLiveRegion="polite" style={[s.error, { borderColor: theme.border }]}>
                {error ? <Text style={[s.body, { color: theme.text }]}>{error}</Text> : null}
                <Animated.View style={{ alignSelf: "flex-start", transform: [{ scale: retryScale }] }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Retry question"
                    accessibilityState={{ busy: retrying, disabled: sending }}
                    disabled={sending}
                    onPressIn={() => animate_retry(0.97)}
                    onPressOut={() => animate_retry(1)}
                    onPress={() => void send(lastQuestion.current)}
                    style={({ pressed }) => [s.retry, { opacity: sending ? 0.55 : pressed ? 0.72 : 1 }]}
                  >
                    {retrying ? (
                      <ActivityIndicator size="small" color={theme.accent} />
                    ) : (
                      <Ionicons name="refresh" size={18} color={theme.accent} />
                    )}
                    <Text style={[s.retryText, { color: theme.accent }]}>
                      {retrying ? "Trying again…" : "Try again"}
                    </Text>
                  </Pressable>
                </Animated.View>
              </View>
            ) : null}
            <UsageLimitNotice />
          </FadingScrollView>
          <View>
            {voiceError ? (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={[s.voiceError, { color: theme.text }]}
              >
                {voice_error_text(voiceError, voicePhase)}
              </Text>
            ) : null}
            <View
              testID="voice-composer"
              style={[
                s.composer,
                voicePhase === "error" && s.recordingComposer,
                { borderTopColor: theme.border, backgroundColor: theme.background },
              ]}
            >
              <View
                ref={composerTargetRef}
                style={[s.inputMotion, voicePhase === "error" && s.recordingInput]}
              >
                <Animated.View
                  style={{
                    opacity: promptEntry,
                    transform: [
                      { translateY: promptEntry.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
                    ],
                  }}
                >
                  {showRecording ? (
                    // Recording takes the question box's place, at the same size.
                    <View style={[s.input, s.recording, { backgroundColor: theme.surfaceMuted }]}>
                      <VoiceRecordingArea
                        phase={voicePhase}
                        level={voiceLevel.value}
                        sampleTime={voiceLevel.at}
                      />
                    </View>
                  ) : voiceReveal && voicePhase === "reviewing" ? (
                    // One line while your words appear; the box grows to fit once they're all there.
                    <RevealingText
                      frame={voiceReveal}
                      singleLine
                      style={[s.input, { color: theme.text, backgroundColor: theme.surfaceMuted }]}
                    />
                  ) : (
                    <TextInput
                      ref={inputRef}
                      accessibilityLabel="Ask Votic a question"
                      value={question}
                      editable={!voiceBusy}
                      onChangeText={setQuestion}
                      placeholder={
                        notesScopeLabel
                          ? "Ask about these notes"
                          : activeDocument
                            ? "Ask about this document"
                            : "Ask Votic"
                      }
                      placeholderTextColor={theme.mutedText}
                      multiline
                      maxLength={1000}
                      style={[s.input, { color: theme.text, backgroundColor: theme.surfaceMuted }]}
                      onSubmitEditing={() => void send()}
                    />
                  )}
                </Animated.View>
              </View>
              <KeyboardDictationButton
                key={contextKey}
                value={question}
                onPhaseChange={(phase) => {
                  if (phase === "starting") void answerListening.stop();
                  setVoicePhase(phase);
                }}
                onLevelChange={(value) => setVoiceLevel({ value, at: Date.now() })}
                onErrorChange={setVoiceError}
                onRevealChange={setVoiceReveal}
                onChangeText={setQuestion}
                onFocus={() => inputRef.current?.focus()}
                disabled={sending || launching}
              />
              {!showRecording && (
                <Animated.View style={{ transform: [{ translateY: sendBounce }] }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Send question"
                    disabled={!question.trim() || sending || launching || voiceBusy}
                    accessibilityState={{ disabled: !question.trim() || sending || launching || voiceBusy }}
                    onPress={() => void send()}
                    style={[
                      s.send,
                      {
                        backgroundColor: theme.accent,
                        opacity: !question.trim() || sending || voiceBusy ? 0.4 : 1,
                      },
                    ]}
                  >
                    {sending ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Animated.View
                        style={{
                          opacity: sendOpacity,
                          transform: [
                            {
                              rotate: sendSpin.interpolate({
                                inputRange: [0, 1],
                                outputRange: ["0deg", "360deg"],
                              }),
                            },
                            { translateY: sendLaunch },
                          ],
                        }}
                      >
                        <Ionicons name="arrow-up" size={22} color="#FFF" />
                      </Animated.View>
                    )}
                  </Pressable>
                </Animated.View>
              )}
            </View>
          </View>
          {flight ? (
            <Animated.View
              pointerEvents="none"
              style={[
                s.flyingWords,
                {
                  left: flight.x,
                  top: flight.y,
                  opacity: flightProgress.interpolate({
                    inputRange: [0, 0.92, 1],
                    outputRange: [1, 1, 0.4],
                  }),
                  // One jump: a quick crouch, an arc up and over, and a small landing squash in the box.
                  transform: [
                    {
                      translateX: flightProgress.interpolate({
                        inputRange: [0, 0.12, 1],
                        outputRange: [0, 0, flight.dx],
                      }),
                    },
                    {
                      translateY: flightProgress.interpolate({
                        inputRange: [0, 0.12, 0.34, 0.56, 0.78, 1],
                        outputRange: [
                          0,
                          4,
                          flight.dy * 0.25 - JUMP_HEIGHT * 0.75,
                          flight.dy * 0.5 - JUMP_HEIGHT,
                          flight.dy * 0.75 - JUMP_HEIGHT * 0.75,
                          flight.dy,
                        ],
                      }),
                    },
                    {
                      rotate: flightProgress.interpolate({
                        inputRange: [0, 0.12, 0.5, 1],
                        outputRange: ["0deg", "0deg", "-5deg", "0deg"],
                      }),
                    },
                    {
                      scaleY: flightProgress.interpolate({
                        inputRange: [0, 0.12, 0.3, 0.92, 1],
                        outputRange: [1, 0.85, 1.06, 1, 0.88],
                      }),
                    },
                    {
                      scaleX: flightProgress.interpolate({
                        inputRange: [0, 0.12, 0.3, 0.92, 1],
                        outputRange: [1, 1.08, 0.96, 1, 1.06],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text numberOfLines={1} style={[s.flightText, { color: theme.accentText }]}>
                {flight.label}
              </Text>
            </Animated.View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
      {quickNote.editor}
    </SafeAreaView>
  );
}
export default function Assistant() {
  return <AskVotic />;
}
/** The question box: one 24-point line to start, growing a line at a time up to six, then scrolling. */
const INPUT_LINE = 24;
const INPUT_PADDING = 12;
const INPUT_MIN_HEIGHT = INPUT_LINE + INPUT_PADDING * 2;
const INPUT_MAX_HEIGHT = INPUT_LINE * 6 + INPUT_PADDING * 2;

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    minHeight: 68,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  icon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, alignItems: "center" },
  title: { ...typography.sectionTitle },
  context: { fontSize: 12, maxWidth: "90%" },
  messages: { padding: spacing.xl, gap: spacing.lg, flexGrow: 1 },
  welcome: { marginTop: spacing.md, gap: spacing.sm, alignItems: "center" },
  searchMascot: { width: 150, height: 126, marginBottom: spacing.sm },
  welcomeTitle: { ...typography.screenTitle, fontSize: 26, textAlign: "center" },
  welcomeBody: { textAlign: "center" },
  prompts: { width: "100%", gap: 8, marginTop: 12 },
  prompt: {
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  promptText: { fontSize: 15, fontWeight: "600" },
  body: { ...typography.body },
  message: { maxWidth: "92%", paddingVertical: spacing.sm },
  userMessage: { alignSelf: "flex-end", borderRadius: 16, paddingHorizontal: spacing.md },
  voticMessage: { alignSelf: "flex-start" },
  answerFooter: { marginTop: spacing.sm },
  answerSource: { marginBottom: spacing.sm },
  status: { fontSize: 14 },
  error: { borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: spacing.sm },
  retry: {
    minHeight: 48,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  retryText: { ...typography.control },
  composer: {
    borderTopWidth: 1,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  inputMotion: { flex: 1, minWidth: 0 },
  recordingInput: { flexBasis: "100%", flexGrow: 0 },
  recordingComposer: { flexWrap: "wrap", justifyContent: "flex-end" },
  voiceError: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, fontSize: 13, lineHeight: 19 },
  // Grows with each line of the question, up to six lines, then scrolls (as in the Reader).
  input: {
    width: "100%",
    minHeight: INPUT_MIN_HEIGHT,
    maxHeight: INPUT_MAX_HEIGHT,
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    paddingTop: INPUT_PADDING,
    paddingBottom: INPUT_PADDING,
    lineHeight: INPUT_LINE,
    fontSize: 16,
  },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  recording: { flexDirection: "row", alignItems: "center", paddingVertical: 0 },
  flyingWords: { position: "absolute", zIndex: 20, maxWidth: 230 },
  flightText: { fontSize: 14, fontWeight: "700", maxWidth: 220 },
});
