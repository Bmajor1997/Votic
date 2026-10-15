import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { RefObject, useState } from "react";
import { Alert, View } from "react-native";
import { extract_document, scan_document_image } from "../api/voticApi";
import { useDocumentTransition } from "../navigation/DocumentTransitionProvider";
import { useVoticPurpose } from "../personalization/PurposeProvider";
import { useDocumentLibrary } from "./DocumentLibraryProvider";
import {
  can_read_locally,
  clean_local_document_text,
  validate_import,
  validate_loaded_bytes,
} from "./importDocument";

export type ImportFailure = { name: string | null; message: string };

/**
 * Picks a file, reads it, adds it to the library, and opens it in the Reader from `sourceRef`.
 * By default a failure shows an alert; screens that show failures inline pass `inlineErrors`.
 */
export function useDocumentImport(sourceRef: RefObject<View | null>, { inlineErrors = false } = {}) {
  const { addTextDocument } = useDocumentLibrary();
  const { defaultPlaybackRate } = useVoticPurpose();
  const transition = useDocumentTransition();
  const [importing, setImporting] = useState(false);
  /** The file being read, shown while Votic extracts its text. */
  const [processingName, setProcessingName] = useState<string | null>(null);
  const [failure, setFailure] = useState<ImportFailure | null>(null);

  async function import_document() {
    setImporting(true);
    setFailure(null);
    let name: string | null = null;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "text/plain",
          "text/markdown",
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "application/vnd.ms-powerpoint",
          "application/epub+zip",
          "application/rtf",
          "application/vnd.oasis.opendocument.text",
          "text/html",
          "image/jpeg",
          "image/png",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      name = asset.name;
      setProcessingName(asset.name);
      validate_import({ name: asset.name, size: asset.size, uri: asset.uri, mimeType: asset.mimeType });
      const response = await fetch(asset.uri);
      if (!response.ok)
        throw new Error("Votic could not access this file. Please choose it again from your device.");
      const bytes = await response.arrayBuffer();
      validate_loaded_bytes(bytes.byteLength);
      let text: string;
      if (can_read_locally(asset.name)) text = clean_local_document_text(new TextDecoder().decode(bytes));
      else if (/\.(jpe?g|png)$/i.test(asset.name)) text = await scan_document_image(asset.name, bytes);
      else text = await extract_document(asset.name, bytes);
      if (!text.trim()) throw new Error("This document does not contain readable text.");
      addTextDocument(asset.name, text, { playbackRate: defaultPlaybackRate });
      open_from(sourceRef, transition);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Votic could not read this document.";
      if (inlineErrors) setFailure({ name, message });
      else Alert.alert("Could not import document", message);
    } finally {
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
) {
  const target = params ? { pathname: "/reader" as const, params } : "/reader";
  const source = sourceRef.current;
  if (!source) {
    router.push(target);
    return;
  }
  source.measureInWindow((x, y, width, height) =>
    transition.openReader({ x, y, width, height }, () => router.push(target)),
  );
}
