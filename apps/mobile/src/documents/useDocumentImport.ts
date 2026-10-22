import { useImportSave } from "./useImportSave";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { RefObject, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useDocumentTransition } from "../navigation/DocumentTransitionProvider";
import { useVoticPurpose } from "../personalization/PurposeProvider";
import { IMPORT_TYPES, is_page_photo, validate_import } from "./importDocument";
import { read_imported_text } from "./readImportedText";
import { UnfinishedScanError, useOcrReview } from "./OcrReviewProvider";
import { useImportSession } from "./useImportSession";
import { remove_import_temp } from "./importCache";

export type ImportFailure = { name: string | null; message: string };

/**
 * Picks a file, reads it, adds it to the library, and opens it in the Reader from `sourceRef`.
 * By default a failure shows an alert; screens that show failures inline pass `inlineErrors`.
 */
export function useDocumentImport(sourceRef: RefObject<View | null>, { inlineErrors = false } = {}) {
  const saveImported = useImportSave();
  const ocrReview = useOcrReview();
  const session = useImportSession();
  const { defaultPlaybackRate } = useVoticPurpose();
  const transition = useDocumentTransition();
  const [importing, setImporting] = useState(false);
  /** The file being read, shown while Votic extracts its text. */
  const [processingName, setProcessingName] = useState<string | null>(null);
  const [failure, setFailure] = useState<ImportFailure | null>(null);

  async function import_document() {
    const job = session.start();
    if (!job) return;
    setImporting(true);
    setFailure(null);
    let name: string | null = null;
    let temporaryUri: string | undefined;
    try {
      const result = await job.away(() =>
        DocumentPicker.getDocumentAsync({
          type: Object.keys(IMPORT_TYPES),
          copyToCacheDirectory: true,
          multiple: false,
        }),
      );
      if (result.canceled) return;
      const asset = result.assets[0];
      temporaryUri = asset.uri;
      if (!job.current()) return;
      name = asset.name;
      setProcessingName(asset.name);
      validate_import({ name: asset.name, size: asset.size, uri: asset.uri, mimeType: asset.mimeType });
      // A photo needs a text review afterwards; check that one can open before paying for text recognition.
      if (is_page_photo(asset.name)) ocrReview.ensureAvailable();
      const response = await fetch(asset.uri, { signal: job.signal });
      if (!response.ok)
        throw new Error("Votic could not access this file. Please choose it again from your device.");
      const text = await read_imported_text(asset.name, await response.arrayBuffer(), job.signal);
      if (!job.current()) return;
      const saved = await saveImported(asset.name, text, defaultPlaybackRate);
      if (saved && job.current()) open_from(sourceRef, transition);
    } catch (error) {
      if (!job.current()) return;
      const message = error instanceof Error ? error.message : "Votic could not read this document.";
      if (inlineErrors) setFailure({ name, message });
      else if (error instanceof UnfinishedScanError)
        Alert.alert("Finish your saved scan first", message, [
          { text: "Not now", style: "cancel" },
          { text: "Resume review", onPress: ocrReview.resume },
        ]);
      else Alert.alert("Could not import document", message);
    } finally {
      try {
        remove_import_temp(temporaryUri);
      } catch {
        /* Retried by account cache cleanup. */
      }
      job.finish();
      setImporting(false);
      setProcessingName(null);
    }
  }

  return {
    importing,
    processingName,
    failure,
    dismissFailure: () => setFailure(null),
    importDocument: import_document,
  };
}

/** Grows the Reader out of `sourceRef`, or opens it directly when there is nothing on screen to grow from. */
export function open_from(
  sourceRef: RefObject<View | null>,
  transition: ReturnType<typeof useDocumentTransition>,
  params?: Record<string, string>,
  heading?: { text: string; node: Text | null },
) {
  const target = params ? { pathname: "/reader" as const, params } : "/reader";
  const source = sourceRef.current;
  if (!source) {
    router.push(target);
    return;
  }
  source.measureInWindow((x, y, width, height) => {
    if (!heading?.node) {
      transition.openReader({ x, y, width, height }, () => router.push(target));
      return;
    }
    heading.node.measureInWindow((tx, ty, tw, th) =>
      transition.openReader(
        { x, y, width, height, heading: { text: heading.text, x: tx, y: ty, width: tw, height: th } },
        () => router.push(target),
      ),
    );
  });
}
