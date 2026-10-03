import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { clearSharedPayloads, useIncomingShare } from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { extractDocument } from "../src/api/voticApi";
import { spacing, radii } from "../src/design/tokens";
import { useDocumentLibrary } from "../src/documents/DocumentLibraryProvider";
import {
  canReadLocally,
  cleanLocalDocumentText,
  supportedDocument,
  validateImport,
  validateLoadedBytes,
} from "../src/documents/importDocument";
import { useVoticPurpose } from "../src/personalization/PurposeProvider";
import { useVoticTheme } from "../src/theme/ThemeProvider";

function fallbackName(mimeType: string | null) {
  const extension: Record<string, string> = {
    "application/pdf": "pdf",
    "text/plain": "txt",
    "text/markdown": "md",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/epub+zip": "epub",
  };
  return `Shared document.${extension[mimeType || ""] || "file"}`;
}

export default function HandleShare() {
  const { theme } = useVoticTheme();
  const { addTextDocument } = useDocumentLibrary();
  const { defaultPlaybackRate } = useVoticPurpose();
  const { resolvedSharedPayloads, isResolving, error } = useIncomingShare();
  const started = useRef(false);
  const [status, setStatus] = useState("Preparing your document…");
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (isResolving || started.current || error) return;
    if (!resolvedSharedPayloads.length) {
      setFailure("Votic did not receive a document to import.");
      return;
    }
    started.current = true;
    void importSharedDocument();
  }, [error, isResolving, resolvedSharedPayloads]);

  async function importSharedDocument() {
    try {
      if (resolvedSharedPayloads.length !== 1)
        throw new Error("Share one document at a time with Votic.");

      const payload = resolvedSharedPayloads[0];
      const uri = payload.contentUri;
      const name = payload.originalName || fallbackName(payload.contentMimeType);

      if (!uri) throw new Error("Votic could not access the shared document.");
      if (!supportedDocument(name))
        throw new Error("Share a TXT, Markdown, PDF, Word, PowerPoint, or EPUB document.");

      setStatus(`Importing ${name}…`);
      validateImport({
        name,
        size: payload.contentSize,
        uri,
        mimeType: payload.contentMimeType,
      });

      const response = await fetch(uri);
      if (!response.ok) throw new Error("Votic could not access the shared document.");
      const bytes = await response.arrayBuffer();
      validateLoadedBytes(bytes.byteLength);

      setStatus(`Reading ${name}…`);
      const text = canReadLocally(name)
        ? cleanLocalDocumentText(new TextDecoder().decode(bytes))
        : await extractDocument(name, bytes);

      if (!text.trim()) throw new Error("This document does not contain readable text.");

      addTextDocument(name, text, { playbackRate: defaultPlaybackRate });
      clearSharedPayloads();
      router.replace("/reader");
    } catch (caught) {
      clearSharedPayloads();
      setFailure(caught instanceof Error ? caught.message : "Votic could not import this shared document.");
    }
  }

  const problem = failure || error?.message || null;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <View style={s.content}>
        <View style={[s.icon, { backgroundColor: theme.surfaceMuted }]}>
          <Ionicons
            name={problem ? "alert-circle-outline" : "document-text-outline"}
            size={32}
            color={theme.accent}
          />
        </View>
        <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
          {problem ? "Couldn't add that document" : "Adding to Votic"}
        </Text>
        {problem ? (
          <>
            <Text accessibilityRole="alert" style={[s.copy, { color: theme.mutedText }]}>
              {problem}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace("/(tabs)/documents")}
              style={[s.button, { backgroundColor: theme.accent }]}
            >
              <Text style={s.buttonText}>Back to Documents</Text>
            </Pressable>
          </>
        ) : (
          <View accessibilityLiveRegion="polite" style={s.progress}>
            <ActivityIndicator color={theme.accent} />
            <Text style={[s.copy, { color: theme.mutedText }]}>{status}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flex: 1,
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "800", textAlign: "center" },
  copy: { fontSize: 16, lineHeight: 23, textAlign: "center" },
  progress: { alignItems: "center", gap: spacing.md },
  button: {
    minHeight: 52,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
});
