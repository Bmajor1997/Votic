import { VoticDocument } from "../documents/types";
import { FileTypeIcon } from "./FileTypeIcon";

const SIZES = { sm: 44, md: 56, lg: 88 } as const;
/** Compatibility for existing document surfaces; all now share the same file identity. */
export function DocumentCover({
  document,
  size = "md",
}: {
  document: VoticDocument;
  size?: keyof typeof SIZES;
}) {
  return <FileTypeIcon filename={document.sourceName} size={SIZES[size]} decorative />;
}
