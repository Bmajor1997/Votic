import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDocumentLibrary } from "../src/documents/DocumentLibraryProvider";
import { readable_title } from "../src/documents/documentDisplay";
import { check_answer } from "../src/reader/answerCheck";
import { build_comprehension_questions } from "../src/reader/comprehension";
import { useVoticTheme } from "../src/theme/ThemeProvider";
import { BackHeader } from "../src/components/BackHeader";

export default function CheckUnderstandingScreen() {
  const { theme } = useVoticTheme();
  const { activeDocument } = useDocumentLibrary();
  const questions = useMemo(
    () => build_comprehension_questions(activeDocument?.plainText || "", activeDocument?.progress || 1),
    [activeDocument?.plainText, activeDocument?.progress],
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <BackHeader
        title="Check my understanding"
        subtitle={activeDocument ? readable_title(activeDocument.title) : "Document"}
      />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={[s.copy, { color: theme.mutedText }]}>
          Answer from memory. Votic uses only the part of the document you have reached, so it will not spoil
          what comes next.
        </Text>
        {questions.length ? (
          questions.map((q, i) => (
            <View key={q.id} style={[s.card, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <Text style={[s.number, { color: theme.accent }]}>QUESTION {i + 1}</Text>
              <Text style={[s.prompt, { color: theme.text }]}>{q.prompt}</Text>
              <TextInput
                accessibilityLabel={`Your answer to question ${i + 1}`}
                multiline
                maxLength={1200}
                value={answers[q.id] || ""}
                onChangeText={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
                placeholder="Write what you remember…"
                placeholderTextColor={theme.mutedText}
                style={[
                  s.input,
                  { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceMuted },
                ]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Check answer to question ${i + 1}`}
                onPress={() => setChecked((c) => ({ ...c, [q.id]: true }))}
                style={[s.check, { backgroundColor: theme.accent }]}
              >
                <Text style={s.checkText}>Check answer</Text>
              </Pressable>
              {checked[q.id]
                ? (() => {
                    const result = check_answer(answers[q.id] || "", q.answerHint);
                    return (
                      <View
                        accessibilityLiveRegion="polite"
                        style={[s.feedback, { backgroundColor: theme.surfaceMuted }]}
                      >
                        <Text accessibilityRole="header" style={[s.feedbackTitle, { color: theme.text }]}>
                          {result.title}
                        </Text>
                        <Text style={[s.feedbackText, { color: theme.text }]}>{result.feedback}</Text>
                        <Text style={[s.source, { color: theme.mutedText }]}>
                          Compare with the passage: “{q.answerHint.slice(0, 360)}
                          {q.answerHint.length > 360 ? "…" : ""}”
                        </Text>
                      </View>
                    );
                  })()
                : null}
            </View>
          ))
        ) : (
          <Text style={[s.copy, { color: theme.mutedText }]}>
            Read a little more of this document first, then come back to check your understanding.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 50 },
  copy: { fontSize: 15, lineHeight: 22 },
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
});
