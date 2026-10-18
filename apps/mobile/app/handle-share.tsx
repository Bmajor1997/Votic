import { FileTypeIcon } from "../src/components/FileTypeIcon";
import { router } from "expo-router";
import { clearSharedPayloads, useIncomingShare } from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { spacing, radii } from "../src/design/tokens";
import { useDocumentLibrary } from "../src/documents/DocumentLibraryProvider";
import {
  IMPORT_TYPES,
  import_origin,
  supported_document,
  UNSUPPORTED_TYPE_MESSAGE,
  validate_import,
} from "../src/documents/importDocument";
import { read_imported_text } from "../src/documents/readImportedText";
import { useImportSession } from "../src/documents/useImportSession";
import { remove_import_temp } from "../src/documents/importCache";
import { useVoticPurpose } from "../src/personalization/PurposeProvider";
import { useVoticTheme } from "../src/theme/ThemeProvider";

function fallback_name(mimeType: string | null) {
  return `Shared document.${IMPORT_TYPES[mimeType || ""] || "file"}`;
}

export default function HandleShare() {
  const { theme } = useVoticTheme();
  const { addTextDocumentDurably } = useDocumentLibrary();
  const session = useImportSession();
  const { defaultPlaybackRate } = useVoticPurpose();
  const { resolvedSharedPayloads, isResolving, error } = useIncomingShare();
  const started = useRef(false);
  const [status, setStatus] = useState("Preparing your document…");
  const [fileIdentity, setFileIdentity] = useState<{ filename?: string; mimeType?: string | null }>({});
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (isResolving || started.current || error || !resolvedSharedPayloads.length) return;
    started.current = true;

    const import_shared_document = async () => {
      const job = session.start();
      if (!job) return;
      let temporaryUri: string | undefined;
      try {
        if (resolvedSharedPayloads.length !== 1) throw new Error("Share one document at a time with Votic.");

        const payload = resolvedSharedPayloads[0];
        const uri = payload.contentUri;
        const name = payload.originalName || fallback_name(payload.contentMimeType);

        setFileIdentity({ filename: name, mimeType: payload.contentMimeType });

        if (!uri) throw new Error("Votic could not access the shared document.");
        if (!supported_document(name)) throw new Error(UNSUPPORTED_TYPE_MESSAGE);

        setStatus(`Importing ${name}…`);
        validate_import({
          name,
          size: payload.contentSize,
          uri,
          mimeType: payload.contentMimeType,
        });

        const response = await fetch(uri);
        temporaryUri = uri;
        if (!response.ok) throw new Error("Votic could not access the shared document.");
        const bytes = await response.arrayBuffer();

        setStatus(`Reading ${name}…`);
        const text = await read_imported_text(name, bytes, job.signal);
        if (!job.current()) return;

        if (!text.trim()) throw new Error("This document does not contain readable text.");

        await addTextDocumentDurably(name, text, {
          playbackRate: defaultPlaybackRate,
          origin: import_origin(name),
        });
        clearSharedPayloads();
        if (job.current()) router.replace("/reader");
      } catch (caught) {
        if (!job.current()) return;
        clearSharedPayloads();
        setFailure(caught instanceof Error ? caught.message : "Votic could not import this shared document.");
      } finally {
        try {
          remove_import_temp(temporaryUri);
        } catch {
          /* Account cleanup retries cached-file removal. */
        }
        if (!job.current() && session.active())
          setFailure("Import canceled. Share the document again to retry.");
        job.finish();
      }
    };

    void import_shared_document();
  }, [addTextDocumentDurably, defaultPlaybackRate, error, isResolving, resolvedSharedPayloads, session]);

  const problem = failure || error?.message || null;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <View style={s.content}>
        <FileTypeIcon {...fileIdentity} size={64} status={problem ? "failed" : "processing"} />
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
