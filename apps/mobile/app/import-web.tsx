import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { import_web_page } from "../src/api/voticApi";
import { useDocumentLibrary } from "../src/documents/DocumentLibraryProvider";
import { useVoticPurpose } from "../src/personalization/PurposeProvider";
import { useVoticTheme } from "../src/theme/ThemeProvider";
import { useImportSession } from "../src/documents/useImportSession";
import { BackHeader } from "../src/components/BackHeader";

export default function ImportWebScreen() {
  const { theme } = useVoticTheme();
  const { addTextDocumentDurably } = useDocumentLibrary();
  const session = useImportSession();
  const { defaultPlaybackRate } = useVoticPurpose();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (busy) return;
    const job = session.start();
    if (!job) return;
    setBusy(true);
    try {
      const page = await import_web_page(url, job.signal);
      if (!job.current()) return;
      await addTextDocumentDurably(page.title + ".txt", page.text, {
        playbackRate: defaultPlaybackRate,
        origin: "webpage",
      });
      if (job.current()) router.replace("/reader");
    } catch (error) {
      if (!job.current()) return;
      Alert.alert("Could not import webpage", error instanceof Error ? error.message : "Try another link.");
    } finally {
      job.finish();
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <BackHeader title="Import webpage" />
      <View style={s.content}>
        <View style={[s.hero, { backgroundColor: theme.surfaceMuted }]}>
          <Ionicons name="link-outline" size={30} color={theme.accent} />
          <Text style={[s.heroTitle, { color: theme.text }]}>Turn a webpage into a clean Votic document</Text>
          <Text style={[s.copy, { color: theme.mutedText }]}>
            Paste a public article or webpage link. Votic removes navigation, scripts, repeated clutter, and
            common page chrome before saving the readable text.
          </Text>
        </View>
        <View style={[s.field, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel="Webpage address"
            value={url}
            onChangeText={setUrl}
            placeholder="https://example.com/article"
            placeholderTextColor={theme.mutedText}
            style={[s.input, { color: theme.text }]}
          />
          {/* Pasting into a box that still holds an old link adds to it, so emptying it takes one tap. */}
          {url ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear webpage address"
              disabled={busy}
              onPress={() => setUrl("")}
              hitSlop={8}
              style={s.clear}
            >
              <Ionicons name="close-circle" size={22} color={theme.mutedText} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          disabled={busy || !url.trim()}
          onPress={() => void submit()}
          style={[s.button, { backgroundColor: theme.accent, opacity: busy || !url.trim() ? 0.5 : 1 }]}
        >
          {busy ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="download-outline" size={20} color="#FFF" />
              <Text style={s.buttonText}>Import and clean</Text>
            </>
          )}
        </Pressable>
        <Text style={[s.note, { color: theme.mutedText }]}>
          Only public HTTP/HTTPS pages are allowed. Private-network and local addresses are blocked by the
          Votic server.
        </Text>
      </View>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 16 },
  hero: { padding: 18, borderRadius: 16, gap: 10 },
  heroTitle: { fontSize: 20, fontWeight: "800", lineHeight: 27 },
  copy: { fontSize: 15, lineHeight: 22 },
  field: { minHeight: 54, borderWidth: 1, borderRadius: 14, flexDirection: "row", alignItems: "center" },
  input: { flex: 1, minHeight: 52, paddingHorizontal: 14, fontSize: 16 },
  clear: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  button: {
    minHeight: 52,
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
  note: { fontSize: 13, lineHeight: 19 },
});
