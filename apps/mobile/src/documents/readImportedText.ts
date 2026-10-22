import { decode_text_file } from "./textEncoding";
import { extract_document, scan_document_image } from "../api/voticApi";
import {
  can_read_locally,
  clean_local_document_text,
  is_page_photo,
  validate_loaded_bytes,
} from "./importDocument";

/** The text of an imported file: plain text is read on the phone, photos with text recognition, the rest by the server. */
export async function read_imported_text(name: string, bytes: ArrayBuffer, signal?: AbortSignal) {
  validate_loaded_bytes(bytes.byteLength, name);
  if (can_read_locally(name)) return clean_local_document_text(decode_text_file(bytes));
  if (is_page_photo(name)) return scan_document_image(name, bytes, signal);
  return extract_document(name, bytes, signal);
}
