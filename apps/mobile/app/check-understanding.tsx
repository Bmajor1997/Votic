import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDocumentLibrary } from "../src/documents/DocumentLibraryProvider";
import { buildComprehensionQuestions, selfCheckFeedback } from "../src/reader/comprehension";
import { useVoticTheme } from "../src/theme/ThemeProvider";

export default function CheckUnderstandingScreen() {
  const { theme } = useVoticTheme();
  const { activeDocument } = useDocumentLibrary();
  const questions = useMemo(
    () => buildComprehensionQuestions(activeDocument?.plainText || "", activeDocument?.progress || 1),
    [activeDocument?.plainText, activeDocument?.progress],
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={s.icon}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: theme.text }]}>Check my understanding</Text>
          <Text numberOfLines={1} style={[s.subtitle, { color: theme.mutedText }]}>
            {activeDocument?.title || "Document"}
          </Text>
        </View>
        <View style={s.icon} />
      </View>
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
                onPress={() => setChecked((c) => ({ ...c, [q.id]: true }))}
                style={[s.check, { backgroundColor: theme.accent }]}
              >
                <Text style={s.checkText}>Check answer</Text>
              </Pressable>
              {checked[q.id] ? (
                <View style={[s.feedback, { backgroundColor: theme.surfaceMuted }]}>
                  <Text style={[s.feedbackTitle, { color: theme.text }]}>
                    {selfCheckFeedback(answers[q.id] || "", q.answerHint)}
                  </Text>
                  <Text style={[s.source, { color: theme.mutedText }]}>
                    Compare with the passage: “{q.answerHint.slice(0, 360)}
                    {q.answerHint.length > 360 ? "…" : ""}”
                  </Text>
                </View>
              ) : null}
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
  header: {
    minHeight: 66,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  icon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  subtitle: { fontSize: 12, textAlign: "center" },
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
  feedbackTitle: { fontSize: 15, fontWeight: "700", lineHeight: 21 },
  source: { fontSize: 13, lineHeight: 19 },
});
