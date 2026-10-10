import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  loadPronunciations,
  normalizePronunciationEntry,
  PronunciationEntry,
  savePronunciations,
} from "../src/reader/pronunciationDictionary";
import { useVoticTheme } from "../src/theme/ThemeProvider";

export default function PronunciationDictionaryScreen() {
  const { theme } = useVoticTheme();
  const [entries, setEntries] = useState<PronunciationEntry[]>([]);
  const [term, setTerm] = useState("");
  const [pronunciation, setPronunciation] = useState("");
  useEffect(() => {
    void loadPronunciations().then(setEntries);
  }, []);
  async function add() {
    try {
      const entry = normalizePronunciationEntry(term, pronunciation);
      const next = [entry, ...entries.filter((item) => item.id !== entry.id)];
      await savePronunciations(next);
      setEntries(next);
      setTerm("");
      setPronunciation("");
    } catch (error) {
      Alert.alert("Could not save pronunciation", error instanceof Error ? error.message : "Try again.");
    }
  }
  async function remove(id: string) {
    const next = entries.filter((item) => item.id !== id);
    await savePronunciations(next);
    setEntries(next);
  }
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={s.icon}
        >
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
        <Text accessibilityRole="header" style={[s.headerTitle, { color: theme.text }]}>
          Pronunciation dictionary
        </Text>
        <View style={s.icon} />
      </View>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={[s.copy, { color: theme.mutedText }]}>
          Teach Votic how to say names, acronyms, and technical terms. These replacements apply only to spoken
          narration; your document text stays unchanged.
        </Text>
        <TextInput
          accessibilityLabel="Word or phrase"
          value={term}
          onChangeText={setTerm}
          placeholder="Word or phrase"
          placeholderTextColor={theme.mutedText}
          style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
        />
        <TextInput
          accessibilityLabel="How Votic should say it"
          value={pronunciation}
          onChangeText={setPronunciation}
          placeholder="How Votic should say it"
          placeholderTextColor={theme.mutedText}
          style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => void add()}
          style={[s.add, { backgroundColor: theme.accent }]}
        >
          <Text style={s.addText}>Save pronunciation</Text>
        </Pressable>
        <View style={s.list}>
          {entries.map((entry) => (
            <View
              key={entry.id}
              style={[s.row, { borderColor: theme.border, backgroundColor: theme.surface }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.term, { color: theme.text }]}>{entry.term}</Text>
                <Text style={[s.say, { color: theme.mutedText }]}>Say as: {entry.pronunciation}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={"Delete pronunciation for " + entry.term}
                onPress={() => void remove(entry.id)}
                style={s.delete}
              >
                <Ionicons name="trash-outline" size={20} color={theme.mutedText} />
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    height: 64,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  icon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800" },
  content: { padding: 20, gap: 12, paddingBottom: 50 },
  copy: { fontSize: 15, lineHeight: 22, marginBottom: 6 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 16 },
  add: { minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  addText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
  list: { gap: 10, marginTop: 10 },
  row: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center" },
  term: { fontSize: 16, fontWeight: "800" },
  say: { fontSize: 14, marginTop: 3 },
  delete: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
