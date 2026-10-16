export { IMPORT_TYPES } from "../../config/importTypes";
export type ImportCandidate = { name: string; mimeType?: string | null; size?: number | null; uri: string };
export const MAX_DOCUMENT_BYTES = 25_000_000;
/** The server reads photos of pages up to this size (scanned PDFs and documents can be larger). */
export const MAX_PAGE_PHOTO_BYTES = 12_000_000;
export const UNSUPPORTED_TYPE_MESSAGE =
  "Choose a TXT, Markdown, PDF, Word, PowerPoint, EPUB, RTF, ODT, or HTML document, or a JPEG, PNG, or WebP photo of a page.";
export function supported_document(name: string) {
  return /\.(txt|md|pdf|docx|pptx|ppt|epub|rtf|odt|html|htm|jpg|jpeg|png|webp)$/i.test(name);
}
/** A photo of a page, read with text recognition rather than as a document. */
export function is_page_photo(name: string) {
  return /\.(jpe?g|png|webp)$/i.test(name);
}
/** A photo of a page counts as a scan; every other imported file is an uploaded file. */
export function import_origin(name: string) {
  return is_page_photo(name) ? ("scan" as const) : ("file" as const);
}
const PHOTO_TOO_LARGE = "This photo is too large. The limit for photos of pages is 12 MB.";
export function can_read_locally(name: string) {
  return /\.(txt|md)$/i.test(name);
}
export function clean_local_document_text(source: string) {
  return String(source || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
export function validate_import(candidate: ImportCandidate) {
  if (!candidate.name || candidate.name.length > 255) throw new Error("Document filename is too long.");
  if (!supported_document(candidate.name)) throw new Error(UNSUPPORTED_TYPE_MESSAGE);
  if (typeof candidate.size === "number" && (!Number.isFinite(candidate.size) || candidate.size < 0))
    throw new Error("Votic could not determine this document's size.");
  if ((candidate.size || 0) > MAX_DOCUMENT_BYTES)
    throw new Error("Document is too large. The current limit is 25 MB.");
  if (is_page_photo(candidate.name) && (candidate.size || 0) > MAX_PAGE_PHOTO_BYTES)
    throw new Error(PHOTO_TOO_LARGE);
  return candidate;
}
export function validate_loaded_bytes(byteLength: number, name = "") {
  if (!Number.isSafeInteger(byteLength) || byteLength < 0)
    throw new Error("Votic could not determine this document's size.");
  if (byteLength > MAX_DOCUMENT_BYTES) throw new Error("Document is too large. The current limit is 25 MB.");
  // Checked before uploading, so a large photo isn't sent only to be refused.
  if (is_page_photo(name) && byteLength > MAX_PAGE_PHOTO_BYTES) throw new Error(PHOTO_TOO_LARGE);
}
