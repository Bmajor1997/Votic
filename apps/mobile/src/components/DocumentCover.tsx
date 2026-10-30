import { document_type_label } from "../documents/documentDisplay";
import { resolve_file_type } from "../documents/fileTypes";
import { VoticDocument } from "../documents/types";
import { FileTypeIcon } from "./FileTypeIcon";

const SIZES = { sm: 44, md: 56, lg: 88 } as const;
/**
 * Compatibility for existing document surfaces; all now share the same file identity. Webpages and scans are saved
 * as text, so they show what they are (WEB, SCAN) instead of TXT, matching their document cards.
 */
export function DocumentCover({
  document,
  size = "md",
}: {
  document: VoticDocument;
  size?: keyof typeof SIZES;
}) {
  const kind = document_type_label(document);
  if (kind === "Webpage")
    return <FileTypeIcon extension="html" monogram="WEB" size={SIZES[size]} decorative />;
  const family = resolve_file_type({ filename: document.sourceName }).family;
  if (kind === "Scan" && family !== "image" && family !== "photo")
    return <FileTypeIcon filename={document.sourceName} monogram="SCAN" size={SIZES[size]} decorative />;
  return <FileTypeIcon filename={document.sourceName} size={SIZES[size]} decorative />;
}
