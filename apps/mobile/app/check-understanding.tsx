import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { check_understanding, UnderstandingCheck, UnderstandingVerdict } from "../src/api/voticApi";
import { useDocumentLibrary } from "../src/documents/DocumentLibraryProvider";
import { document_heading } from "../src/documents/documentDisplay";
import {
  COMPREHENSION_QUESTIONS,
  ComprehensionQuestion,
  understanding_source,
} from "../src/reader/comprehension";
import { useVoticTheme } from "../src/theme/ThemeProvider";
import { BackHeader } from "../src/components/BackHeader";

/** How each verdict is named. None of them claims more than the check established. */
export const VERDICT_TITLES: Record<UnderstandingVerdict, string> = {
  supported: "Your answer matches the passage",
  partially_supported: "Partly right",
  contradicted: "This conflicts with the passage",
  unrelated: "This doesn't seem to be about this part",
  insufficient: "Add a little more",
};

export default function CheckUnderstandingScreen() {
  const { theme } = useVoticTheme();
  const { activeDocument } = useDocumentLibrary();
  const source = useMemo(
    () => understanding_source(activeDocument?.plainText || "", activeDocument?.progress || 1),
    [activeDocument?.plainText, activeDocument?.progress],
  );
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <BackHeader title="Check my understanding" subtitle={document_heading(activeDocument, "Document")} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={[s.copy, { color: theme.mutedText }]}>
          Answer from memory. Votic uses only the part of the document you have reached, so it will not spoil
          what comes next.
        </Text>
        {source ? (
          <>
            <Text style={[s.note, { color: theme.mutedText }]}>
              Checking an answer sends it, with the part of the document you have read, to Votic&apos;s AI
              service.
            </Text>
            {COMPREHENSION_QUESTIONS.map((question, index) => (
              <QuestionCard key={question.id} question={question} number={index + 1} source={source} />
            ))}
          </>
        ) : (
          <Text style={[s.copy, { color: theme.mutedText }]}>
            Read a little more of this document first, then come back to check your understanding.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type CheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "result"; result: UnderstandingCheck }
  | { status: "empty" }
  | { status: "error"; message: string };

/** One question: its answer, the request in flight, and the verdict or the reason there isn't one. */
function QuestionCard({
  question,
  number,
  source,
}: {
  question: ComprehensionQuestion;
  number: number;
  source: string;
}) {
  const { theme } = useVoticTheme();
  const [answer, setAnswer] = useState("");
  const [state, setState] = useState<CheckState>({ status: "idle" });
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function check() {
    if (state.status === "checking") return;
    // Nothing to grade yet: say so here instead of sending an empty answer.
    if (!answer.trim()) return setState({ status: "empty" });
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState({ status: "checking" });
    try {
      const result = await check_understanding(question.id, answer, source, controller.signal);
      if (!controller.signal.aborted) setState({ status: "result", result });
    } catch (error) {
      if (controller.signal.aborted) return;
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Votic couldn't check this answer right now.",
      });
    }
  }
  const checking = state.status === "checking";
  return (
    <View style={[s.card, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <Text style={[s.number, { color: theme.accent }]}>QUESTION {number}</Text>
      <Text style={[s.prompt, { color: theme.text }]}>{question.prompt}</Text>
      <TextInput
        accessibilityLabel={`Your answer to question ${number}`}
        multiline
        maxLength={1200}
        value={answer}
        editable={!checking}
        onChangeText={setAnswer}
        placeholder="Write what you remember…"
        placeholderTextColor={theme.mutedText}
        style={[
          s.input,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceMuted },
        ]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Check answer to question ${number}`}
        accessibilityState={{ busy: checking, disabled: checking }}
        disabled={checking}
        onPress={() => void check()}
        style={[s.check, { backgroundColor: theme.accent, opacity: checking ? 0.6 : 1 }]}
      >
        {checking ? <ActivityIndicator color="#FFF" /> : <Text style={s.checkText}>Check answer</Text>}
      </Pressable>
      <CheckFeedback state={state} onRetry={() => void check()} />
    </View>
  );
}

function CheckFeedback({ state, onRetry }: { state: CheckState; onRetry: () => void }) {
  const { theme } = useVoticTheme();
  if (state.status === "idle" || state.status === "checking") return null;
  if (state.status === "empty")
    return (
      <Text accessibilityRole="alert" style={[s.feedbackText, { color: theme.text }]}>
        Write an answer first, then check it.
      </Text>
    );
  if (state.status === "error")
    return (
      <View accessibilityLiveRegion="polite" style={[s.feedback, { backgroundColor: theme.surfaceMuted }]}>
        <Text accessibilityRole="header" style={[s.feedbackTitle, { color: theme.text }]}>
          Couldn&apos;t check your answer
        </Text>
        <Text style={[s.feedbackText, { color: theme.text }]}>{state.message}</Text>
        <Pressable accessibilityRole="button" onPress={onRetry} style={s.retry}>
          <Text style={[s.retryText, { color: theme.accentText }]}>Try again</Text>
        </Pressable>
      </View>
    );
  const { result } = state;
  return (
    <View accessibilityLiveRegion="polite" style={[s.feedback, { backgroundColor: theme.surfaceMuted }]}>
      <Text accessibilityRole="header" style={[s.feedbackTitle, { color: theme.text }]}>
        {VERDICT_TITLES[result.verdict]}
      </Text>
      <Text style={[s.feedbackText, { color: theme.text }]}>{result.feedback}</Text>
      {result.missing ? (
        <Text style={[s.feedbackText, { color: theme.text }]}>Also worth including: {result.missing}</Text>
      ) : null}
      {result.evidence.map((quote) => (
        <Text key={quote} style={[s.source, { color: theme.mutedText }]}>
          From the passage: “{quote}”
        </Text>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 50 },
  copy: { fontSize: 15, lineHeight: 22 },
  note: { fontSize: 13, lineHeight: 19 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  number: { fontSize: 12, fontWeight: "900", letterSpacing: 0.8 },
  prompt: { fontSize: 18, fontWeight: "800", lineHeight: 25 },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    textAlignVertical: "top",
  },
  check: { minHeight: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  checkText: { color: "#FFF", fontWeight: "800" },
  feedback: { padding: 13, borderRadius: 12, gap: 7 },
  feedbackTitle: { fontSize: 15, fontWeight: "800", lineHeight: 21 },
  feedbackText: { fontSize: 15, lineHeight: 21 },
  source: { fontSize: 13, lineHeight: 19 },
  retry: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  retryText: { fontSize: 15, fontWeight: "800" },
});
