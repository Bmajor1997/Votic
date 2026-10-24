import { File } from "expo-file-system";
import { Platform } from "react-native";
import { scan_document_image } from "../api/voticApi";
import { ScanPage } from "./scanDraftModel";
export class ScanPageError extends Error {
  constructor(
    public pageId: string,
    message: string,
  ) {
    super(message);
  }
}
async function photo_bytes(uri: string) {
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    if (!response.ok) throw new Error("The photo could not be opened. Retake this page.");
    return response.arrayBuffer();
  }
  const file = new File(uri);
  if (!file.exists || file.size > 12_000_000)
    throw new Error("The photo is unavailable or too large. Retake this page.");
  return file.arrayBuffer();
}
type Job = { signal: AbortSignal; current: () => boolean };
/** Checkpoint each successful page; retry only work that has not already succeeded. */
export async function recognize_scan_pages(
  pages: ScanPage[],
  job: Job,
  cache: Map<string, string>,
  progress: (page: number) => void,
  save: (pageId: string, text: string) => Promise<unknown>,
) {
  const extracted: string[] = [];
  for (const [index, page] of pages.entries()) {
    if (!job.current()) return null;
    progress(index + 1);
    try {
      let text = page.text ?? cache.get(page.id);
      if (text === undefined) {
        const bytes = await photo_bytes(page.uri);
        if (bytes.byteLength > 12_000_000) throw new Error("This photo is too large. Retake this page.");
        if (!job.current()) return null;
        text = (await scan_document_image(`scan-page-${index + 1}.jpg`, bytes, job.signal)).trim();
        if (!text) throw new Error("No readable text was found. Retake or remove this page.");
        cache.set(page.id, text);
      }
      if (!job.current()) return null;
      if (page.text === undefined) await save(page.id, text);
      extracted.push(text);
    } catch (error) {
      throw new ScanPageError(
        page.id,
        `Page ${index + 1}: ${error instanceof Error ? error.message : "Text recognition failed. Try again."}`,
      );
    }
  }
  return extracted;
}
