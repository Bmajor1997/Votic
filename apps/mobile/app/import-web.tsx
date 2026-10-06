import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { importWebPage } from "../src/api/voticApi";
import { useDocumentLibrary } from "../src/documents/DocumentLibraryProvider";
import { useVoticPurpose } from "../src/personalization/PurposeProvider";
import { useVoticTheme } from "../src/theme/ThemeProvider";

export default function ImportWebScreen() {
  const { theme } = useVoticTheme();
  const { addTextDocument } = useDocumentLibrary();
  const { defaultPlaybackRate } = useVoticPurpose();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      const page = await importWebPage(url);
      addTextDocument(page.title + ".txt", page.text, { playbackRate: defaultPlaybackRate });
      router.replace("/reader");
    } catch (error) {
      Alert.alert("Could not import webpage", error instanceof Error ? error.message : "Try another link.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={s.icon}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
        <Text style={[s.title, { color: theme.text }]}>Import webpage</Text>
        <View style={s.icon} />
      </View>
      <View style={s.content}>
        <View style={[s.hero, { backgroundColor: theme.surfaceMuted }]}>
          <Ionicons name="link-outline" size={30} color={theme.accent} />
          <Text style={[s.heroTitle, { color: theme.text }]}>Turn a webpage into a clean Votic document</Text>
          <Text style={[s.copy, { color: theme.mutedText }]}>
            Paste a public article or webpage link. Votic removes navigation, scripts, repeated clutter, and
            common page chrome before saving the readable text.
          </Text>
        </View>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          accessibilityLabel="Webpage address"
          value={url}
          onChangeText={setUrl}
          placeholder="https://example.com/article"
          placeholderTextColor={theme.mutedText}
          style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
        />
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
  header: {
    height: 64,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  icon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800" },
  content: { padding: 20, gap: 16 },
  hero: { padding: 18, borderRadius: 16, gap: 10 },
  heroTitle: { fontSize: 20, fontWeight: "800", lineHeight: 27 },
  copy: { fontSize: 15, lineHeight: 22 },
  input: { minHeight: 54, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 16 },
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
