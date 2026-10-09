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
import { askVotic } from "../src/api/voticApi";
import { spacing, typography } from "../src/design/tokens";
import { useDocumentLibrary } from "../src/documents/DocumentLibraryProvider";
import { useVoticTheme } from "../src/theme/ThemeProvider";
import { RevealingText } from "../src/components/RevealingText";
import type { TextRevealFrame } from "../src/components/textReveal";
import { VoiceRecordingArea } from "../src/components/VoiceRecordingArea";
import { KeyboardDictationButton, type VoiceInputPhase } from "../src/components/KeyboardDictationButton";
import { AIResponse, AIThinking } from "../src/components/AIResponse";
import { VoticLogo } from "../src/components/VoticLogo";
import { useAccessibilityPreferences } from "../src/accessibility/AccessibilityProvider";
import { AskVoticEmptyAnimation } from "../src/components/EmptyStateIllustrations";
import {
  answeredFromContext,
  answerLink,
  answerNoteForSource,
  AskAnswerSource,
  askVoticContextKey,
  AskVoticParams,
  initialQuestionFromParams,
  MISSING_NOTES_MESSAGE,
  prepareAskRequest,
  resolveAskVoticContext,
} from "../src/ask/askVoticContext";
import { AskLink } from "../src/ask/documentSections";
import { useActivity } from "../src/activity/ActivityProvider";
import { askEventFor } from "../src/activity/askCategories";
import { useOnboarding } from "../src/onboarding/OnboardingProvider";
import { useVoticPurpose } from "../src/personalization/PurposeProvider";

type Message = {
  role: "user" | "votic";
  text: string;
  saved?: boolean;
  source?: AskAnswerSource;
  link?: AskLink;
  /** A notice (such as a daily limit) rather than an answer: not saved to Notes or sent as history. */
  fallback?: boolean;
};
type PromptFlight = { label: string; x: number; y: number; dx: number; dy: number };
/** Timestamp and unique id for a note saved from an answer (called only from the Save button). */
function answerNoteStamp() {
  const now = Date.now();
  return { now, id: "votic-note-" + now + "-" + Math.random().toString(36).slice(2, 7) };
}
export function AskVotic({ embedded = false }: { embedded?: boolean }) {
  const { theme } = useVoticTheme();
  const { purpose, explanationStyle } = useVoticPurpose();
  const onboarding = useOnboarding();
  const { recordAsk } = useActivity();
  const { activeDocument, documents, savePassage, openDocument } = useDocumentLibrary();
  const params = useLocalSearchParams<AskVoticParams>();
  const context = resolveAskVoticContext(documents, activeDocument, params);
  const contextKey = askVoticContextKey(activeDocument?.id, params);
  const initialQuestion = initialQuestionFromParams(params);
  const notesScopeLabel = context.kind === "notes" || context.kind === "notes-missing" ? context.label : "";
  const { reduceMotion } = useAccessibilityPreferences();
  const suggestedPrompts =
    purpose === "learning"
      ? [
          "Summarize this document",
          "Explain this section",
          "Quiz me on this document",
          "Help with my notes",
          "Compare key ideas",
          "Find information",
        ]
      : purpose === "work"
        ? [
            "Summarize this document",
            "Find action items",
            "Highlight key decisions",
            "Explain this section",
            "Compare key details",
            "Find information",
          ]
        : purpose === "research"
          ? [
              "Summarize this document",
              "Identify key findings",
              "Compare key ideas",
              "Explain the evidence",
              "Find information",
              "What should I investigate next?",
            ]
          : purpose === "accessibility"
            ? [
                "Summarize this document",
                "Explain this section simply",
                "Find key points",
                "Help me understand this passage",
                "Ask about my notes",
                "Find information",
              ]
            : [
                "Summarize this document",
                "Explain this section",
                "Find key points",
                "Help with my notes",
                "Compare key ideas",
                "Find information",
              ];
  const [question, setQuestion] = useState(initialQuestion);
  const [voiceReveal, setVoiceReveal] = useState<TextRevealFrame | null>(null);
  const [voicePhase, setVoicePhase] = useState<VoiceInputPhase>("idle");
  const [voiceLevel, setVoiceLevel] = useState(0.12);
  const voiceBusy = voicePhase !== "idle";
  const showRecording = voiceBusy && voicePhase !== "reviewing";
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
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
    setError("");
    setSending(false);
    setRetrying(false);
    setLaunching(false);
    setFlight(null);
  }, [contextKey, initialQuestion]);
  function settlePrompt(label: string) {
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
  function choosePrompt(label: string) {
    if (reduceMotion) {
      setQuestion(label);
      return;
    }
    const source = promptRefs.current[label];
    const target = composerTargetRef.current;
    const root = rootRef.current;
    if (!source || !target || !root) {
      settlePrompt(label);
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
              duration: 1050,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }).start(() => {
              setFlight(null);
              settlePrompt(label);
            }),
          );
        }),
      ),
    );
  }
  function launchArrow() {
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
  async function send(retryQuestion?: string) {
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
      await launchArrow();
      if (!current()) return;
      setLaunching(false);
      setQuestion("");
      setMessages((v) => [...v, { role: "user", text: clean }]);
      lastQuestion.current = clean;
      // Retries resend the same question, so only first attempts are counted.
      recordAsk(
        askEventFor(clean, {
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
      const request = prepareAskRequest(askContext, clean, messages);
      const answer = await askVotic(clean, request.document, request.history, explanationStyle);
      onboarding.recordAskedVotic();
      if (!current()) return;
      setError("");
      const grounded = answeredFromContext(request, answer);
      setMessages((v) => [
        ...v,
        grounded
          ? {
              role: "votic",
              text: answer.answer,
              source: askContext.kind === "general" ? undefined : (askContext.saveSource ?? undefined),
              link: answerLink(request, answer.sectionIndex) ?? undefined,
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
  function openAnswerLink(link: AskLink) {
    if (!documents.some((document) => document.id === link.documentId)) return;
    openDocument(link.documentId, link.sentenceIndex);
    router.push("/reader");
  }
  function canSaveAnswer(message: Message) {
    return Boolean(
      message.source && documents.some((document) => document.id === message.source?.documentId),
    );
  }
  function saveAnswerToNotes(index: number) {
    const message = messages[index];
    if (!message || message.role !== "votic" || message.saved || !message.source) return;
    const { now, id } = answerNoteStamp();
    const note = answerNoteForSource(documents, message.source, message.text, now, id);
    if (!note) return;
    savePassage(note.documentId, note.passage);
    setMessages((current) => current.map((item, i) => (i === index ? { ...item, saved: true } : item)));
  }
  function animateRetry(toValue: number) {
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
            <View style={s.icon} />
          </View>
          <ScrollView
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
                      onPress={() => choosePrompt(label)}
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
                    <AIResponse text={m.text} animate={!m.fallback} style={[s.body, { color: theme.text }]} />
                  ) : (
                    <Text style={[s.body, { color: "#FFF" }]}>{m.text}</Text>
                  )}
                  {m.role === "votic" && canSaveAnswer(m) ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={m.saved ? "Saved to Notes" : "Save answer to Notes"}
                      disabled={m.saved}
                      onPress={() => saveAnswerToNotes(i)}
                      style={s.saveNote}
                    >
                      <Ionicons
                        name={m.saved ? "checkmark-circle" : "bookmark-outline"}
                        size={17}
                        color={theme.accent}
                      />
                      <Text style={[s.saveNoteText, { color: theme.accent }]}>
                        {m.saved ? "Saved to Notes" : "Save to Notes"}
                      </Text>
                    </Pressable>
                  ) : null}
                  {m.role === "votic" && m.link
                    ? (() => {
                        const link = m.link;
                        const target = documents.find((document) => document.id === link.documentId);
                        return target ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Open ${target.title} at passage ${link.sentenceIndex + 1} in Reader`}
                            onPress={() => openAnswerLink(link)}
                            style={s.saveNote}
                          >
                            <Ionicons name="book-outline" size={17} color={theme.accent} />
                            <Text style={[s.saveNoteText, { color: theme.accent }]}>
                              Open in Reader · passage {link.sentenceIndex + 1}
                            </Text>
                          </Pressable>
                        ) : null;
                      })()
                    : null}
                </View>
              ))
            )}
            {sending ? <AIThinking /> : null}
            {error || retrying ? (
              <View accessibilityLiveRegion="polite" style={[s.error, { borderColor: theme.border }]}>
                {error ? <Text style={[s.body, { color: theme.text }]}>{error}</Text> : null}
                <Animated.View style={{ alignSelf: "flex-start", transform: [{ scale: retryScale }] }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Retry question"
                    accessibilityState={{ busy: retrying, disabled: sending }}
                    disabled={sending}
                    onPressIn={() => animateRetry(0.97)}
                    onPressOut={() => animateRetry(1)}
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
          </ScrollView>
          <View style={[s.composer, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
            <View ref={composerTargetRef} style={s.inputMotion}>
              <Animated.View
                style={{
                  opacity: promptEntry,
                  transform: [
                    { translateY: promptEntry.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
                  ],
                }}
              >
                {showRecording ? (
                  <VoiceRecordingArea phase={voicePhase} level={voiceLevel} />
                ) : voiceReveal && voicePhase === "reviewing" ? (
                  <RevealingText
                    frame={voiceReveal}
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
              onPhaseChange={setVoicePhase}
              onLevelChange={setVoiceLevel}
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
          {flight ? (
            <Animated.View
              pointerEvents="none"
              style={[
                s.flyingWords,
                {
                  left: flight.x,
                  top: flight.y,
                  opacity: flightProgress.interpolate({
                    inputRange: [0, 0.88, 1],
                    outputRange: [1, 1, 0.12],
                  }),
                  transform: [
                    {
                      translateX: flightProgress.interpolate({
                        inputRange: [0, 0.2, 0.45, 0.72, 1],
                        outputRange: [0, 64, -28, 52, flight.dx],
                      }),
                    },
                    {
                      translateY: flightProgress.interpolate({
                        inputRange: [0, 0.2, 0.45, 0.72, 1],
                        outputRange: [0, flight.dy * 0.16, flight.dy * 0.43, flight.dy * 0.72, flight.dy],
                      }),
                    },
                    {
                      rotate: flightProgress.interpolate({
                        inputRange: [0, 0.2, 0.45, 0.72, 1],
                        outputRange: ["0deg", "4deg", "-4deg", "3deg", "0deg"],
                      }),
                    },
                    {
                      scale: flightProgress.interpolate({
                        inputRange: [0, 0.75, 1],
                        outputRange: [1, 0.96, 0.9],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text numberOfLines={1} style={[s.flightText, { color: theme.accent }]}>
                {flight.label}
              </Text>
            </Animated.View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export default function Assistant() {
  return <AskVotic />;
}
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
  saveNote: {
    minHeight: 40,
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
  },
  saveNoteText: { fontSize: 13, fontWeight: "800" },
  thinking: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
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
  inputMotion: { flex: 1 },
  input: {
    width: "100%",
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    fontSize: 16,
  },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  flyingWords: { position: "absolute", zIndex: 20, maxWidth: 230 },
  flightText: { fontSize: 14, fontWeight: "700", maxWidth: 220 },
});
