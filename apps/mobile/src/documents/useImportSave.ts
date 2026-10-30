import { useMotionFeedback } from "../motion/MotionFeedback";
import { useCallback } from "react";
import { Alert } from "react-native";
import { useDocumentLibrary } from "./DocumentLibraryProvider";
import { useOcrReview } from "./OcrReviewProvider";
import { import_origin, is_page_photo } from "./importDocument";
import { VoticDocument } from "./types";

/** A live library document with the same file name and the same text: importing it again would only duplicate it. */
export function find_duplicate_import(documents: VoticDocument[], name: string, text: string) {
  const body = text.trim();
  return documents.find(
    (document) =>
      !document.deletedAt &&
      !document.notebookKind &&
      document.sourceName === name &&
      document.plainText === body,
  );
}

type DuplicateChoice = "open" | "copy" | "cancel";

function ask_about_duplicate(existing: VoticDocument): Promise<DuplicateChoice> {
  return new Promise((resolve) =>
    Alert.alert(
      "Already in your library",
      `“${existing.title}” is already in Votic with the same text. Open it, or add a second copy?`,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve("cancel") },
        { text: "Add a copy", onPress: () => resolve("copy") },
        { text: "Open it", onPress: () => resolve("open") },
      ],
      { cancelable: true, onDismiss: () => resolve("cancel") },
    ),
  );
}

/** One save path for picker and OS shares; image text always receives human review. */
export function useImportSave() {
  const { addTextDocumentDurably, documents, openDocument } = useDocumentLibrary();
  const { review } = useOcrReview();
  const { show } = useMotionFeedback();
  return useCallback(
    async (name: string, text: string, playbackRate: number) => {
      if (!text.trim()) throw new Error("This document does not contain readable text.");
      const options = { playbackRate, origin: import_origin(name) };
      if (is_page_photo(name)) return review(name, [text], options);
      const duplicate = find_duplicate_import(documents, name, text);
      if (duplicate) {
        const choice = await ask_about_duplicate(duplicate);
        if (choice === "cancel") return null;
        if (choice === "open") {
          openDocument(duplicate.id);
          return duplicate;
        }
      }
      const document = await addTextDocumentDurably(name, text, options);
      show("import", document.title);
      return document;
    },
    [addTextDocumentDurably, documents, openDocument, review, show],
  );
}
