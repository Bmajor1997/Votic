/** Display metadata only: this registry never grants upload/parser support. */
export const FILE_TYPE_PALETTE = {
  pdf: { accent: "#E77B7B", ink: "#853F3F" },
  word: { accent: "#80A9EF", ink: "#365B96" },
  text: { accent: "#A6ADB8", ink: "#515965" },
  rtf: { accent: "#B49BE8", ink: "#654B91" },
  odt: { accent: "#76B9AD", ink: "#34665C" },
  html: { accent: "#E7AD75", ink: "#80552C" },
  epub: { accent: "#A693D8", ink: "#604D8E" },
  image: { accent: "#83BA9B", ink: "#3B6750" },
  photo: { accent: "#79B8C9", ink: "#356473" },
  slides: { accent: "#D9A078", ink: "#805332" },
  unknown: { accent: "#A6ADB8", ink: "#515965" },
} as const;
type Family = keyof typeof FILE_TYPE_PALETTE;
export type FileType = { extension: string; monogram: string; label: string; family: Family };
const FORMATS: Record<string, { label: string; family: Family }> = {
  pdf: { label: "PDF", family: "pdf" },
  doc: { label: "Word", family: "word" },
  docx: { label: "Word", family: "word" },
  txt: { label: "Text", family: "text" },
  md: { label: "Markdown", family: "text" },
  rtf: { label: "RTF", family: "rtf" },
  odt: { label: "ODT", family: "odt" },
  html: { label: "HTML", family: "html" },
  htm: { label: "HTML", family: "html" },
  epub: { label: "EPUB", family: "epub" },
  jpg: { label: "JPEG", family: "image" },
  jpeg: { label: "JPEG", family: "image" },
  png: { label: "PNG", family: "image" },
  heic: { label: "HEIC", family: "photo" },
  heif: { label: "HEIF", family: "photo" },
  webp: { label: "WebP", family: "photo" },
  ppt: { label: "PowerPoint", family: "slides" },
  pptx: { label: "PowerPoint", family: "slides" },
};
const MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/x-markdown": "md",
  "application/rtf": "rtf",
  "text/rtf": "rtf",
  "application/vnd.oasis.opendocument.text": "odt",
  "text/html": "html",
  "application/xhtml+xml": "html",
  "application/epub+zip": "epub",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/webp": "webp",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};
export type FileTypeInput = { filename?: string | null; mimeType?: string | null; extension?: string | null };
const known = (extension: string) => Object.hasOwn(FORMATS, extension);

/** Explicit extension, then final filename suffix, then MIME. Never examines title words. */
export function resolve_file_type({ filename, mimeType, extension }: FileTypeInput = {}): FileType {
  const explicit = extension?.trim().replace(/^\./, "").toLowerCase() || "";
  const leaf = (filename || "").trim().split(/[?#]/, 1)[0].split(/[\\/]/).pop() || "";
  const dot = leaf.lastIndexOf(".");
  const suffix = dot > 0 ? leaf.slice(dot + 1).toLowerCase() : "";
  const mime = mimeType?.split(";", 1)[0].trim().toLowerCase() || "";
  const fromMime = Object.hasOwn(MIME_EXTENSIONS, mime) ? MIME_EXTENSIONS[mime] : "";
  const resolved = [explicit, suffix, fromMime].find(known);
  if (!resolved) return { extension: "", monogram: "FILE", label: "File", family: "unknown" };
  return { extension: resolved, monogram: resolved.toUpperCase(), ...FORMATS[resolved] };
}

export function file_type_colors(type: FileType, isDark: boolean) {
  const palette = FILE_TYPE_PALETTE[type.family];
  return {
    accent: palette.accent,
    foreground: isDark ? lift_ink(palette.accent) : palette.ink,
    background: `${palette.accent}1A`,
  };
}

/** Lift pastel ink slightly for the Reader's lighter charcoal surfaces as well as navy. */
function lift_ink(hex: string) {
  return (
    "#" +
    [1, 3, 5]
      .map((start) =>
        Math.round(parseInt(hex.slice(start, start + 2), 16) * 0.8 + 255 * 0.2)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
