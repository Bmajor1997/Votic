import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { RefObject, useState } from "react";
import { Alert, View } from "react-native";
import { extractDocument } from "../api/voticApi";
import { useDocumentTransition } from "../navigation/DocumentTransitionProvider";
import { useVoticPurpose } from "../personalization/PurposeProvider";
import { useDocumentLibrary } from "./DocumentLibraryProvider";
import {
  canReadLocally,
  cleanLocalDocumentText,
  validateImport,
  validateLoadedBytes,
} from "./importDocument";

/** Picks a file, reads it, adds it to the library, and opens it in the Reader from `sourceRef`. */
export function useDocumentImport(sourceRef: RefObject<View | null>) {
  const { addTextDocument } = useDocumentLibrary();
  const { defaultPlaybackRate } = useVoticPurpose();
  const transition = useDocumentTransition();
  const [importing, setImporting] = useState(false);

  async function importDocument() {
    setImporting(true);
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
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      validateImport({ name: asset.name, size: asset.size, uri: asset.uri, mimeType: asset.mimeType });
      const response = await fetch(asset.uri);
      if (!response.ok)
        throw new Error("Votic could not access this file. Please choose it again from your device.");
      const bytes = await response.arrayBuffer();
      validateLoadedBytes(bytes.byteLength);
      let text: string;
      if (canReadLocally(asset.name)) text = cleanLocalDocumentText(new TextDecoder().decode(bytes));
      else text = await extractDocument(asset.name, bytes);
      if (!text.trim()) throw new Error("This document does not contain readable text.");
      addTextDocument(asset.name, text, { playbackRate: defaultPlaybackRate });
      openFrom(sourceRef, transition);
    } catch (error) {
      Alert.alert(
        "Could not import document",
        error instanceof Error ? error.message : "Votic could not read this document.",
      );
    } finally {
      setImporting(false);
    }
  }

  return { importing, importDocument };
}

/** Grows the Reader out of `sourceRef`, or opens it directly when there is nothing on screen to grow from. */
export function openFrom(
  sourceRef: RefObject<View | null>,
  transition: ReturnType<typeof useDocumentTransition>,
) {
  const source = sourceRef.current;
  if (!source) {
    router.push("/reader");
    return;
  }
  source.measureInWindow((x, y, width, height) =>
    transition.openReader({ x, y, width, height }, () => router.push("/reader")),
  );
}
