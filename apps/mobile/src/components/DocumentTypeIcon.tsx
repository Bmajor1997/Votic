import { file_type_colors, resolve_file_type } from "../documents/fileTypes";
import { FileTypeIcon, FileTypeIconProps } from "./FileTypeIcon";

/** Compatibility for existing callers. All file metadata lives in documents/fileTypes. */
export function document_type_color(sourceName: string) {
  return file_type_colors(resolve_file_type({ filename: sourceName }), false).accent;
}
export function DocumentTypeIcon({
  sourceName,
  ...props
}: Omit<FileTypeIconProps, "filename"> & { sourceName: string }) {
  return <FileTypeIcon filename={sourceName} {...props} />;
}
