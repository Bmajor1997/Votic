import { useCallback } from "react";
import { useDocumentLibrary } from "./DocumentLibraryProvider";
import { useOcrReview } from "./OcrReviewProvider";
import { import_origin, is_page_photo } from "./importDocument";

/** One save path for picker and OS shares; image text always receives human review. */
export function useImportSave() {
  const { addTextDocumentDurably } = useDocumentLibrary();
  const { review } = useOcrReview();
  return useCallback(
    (name: string, text: string, playbackRate: number) => {
      if (!text.trim()) throw new Error("This document does not contain readable text.");
      const options = { playbackRate, origin: import_origin(name) };
      return is_page_photo(name)
        ? review(name, [text], options)
        : addTextDocumentDurably(name, text, options);
    },
    [addTextDocumentDurably, review],
  );
}
