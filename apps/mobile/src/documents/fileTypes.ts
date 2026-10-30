/** Display metadata only: this registry never grants upload/parser support. */
export const FILE_TYPE_PALETTE = {
  pdf: { accent: "#E77B7B", ink: "#853F3F" },
  word: { accent: "#5289E2", ink: "#28529A" },
  text: { accent: "#A6ADB8", ink: "#515965" },
  rtf: { accent: "#DB78AD", ink: "#8A365E" },
  odt: { accent: "#43B19F", ink: "#216657" },
  html: { accent: "#43B7D0", ink: "#195B70" },
  epub: { accent: "#AC82DE", ink: "#65408F" },
  image: { accent: "#57A963", ink: "#31663B" },
  photo: { accent: "#B88355", ink: "#744924" },
  slides: { accent: "#EA923D", ink: "#85470F" },
  unknown: { accent: "#A6ADB8", ink: "#515965" },
} as const;

/** Format colors are shared by cards, file icons and source notes.
 * Aliases (.jpg/.jpeg and .htm/.html) identify the same format.
 * Semantic families remain separate from color identity and import support.
 */
export const FILE_FORMAT_PALETTE = {
  pdf: FILE_TYPE_PALETTE.pdf,
  txt: FILE_TYPE_PALETTE.text,
  md: { accent: "#657F91", ink: "#3C5365" },
  docx: FILE_TYPE_PALETTE.word,
  ppt: FILE_TYPE_PALETTE.slides,
  pptx: { accent: "#CCAD32", ink: "#6E5910" },
  epub: FILE_TYPE_PALETTE.epub,
  rtf: FILE_TYPE_PALETTE.rtf,
  odt: FILE_TYPE_PALETTE.odt,
  html: FILE_TYPE_PALETTE.html,
  jpeg: FILE_TYPE_PALETTE.image,
  png: { accent: "#94AD3D", ink: "#53641C" },
  webp: { accent: "#7786E0", ink: "#3F4998" },
  heic: FILE_TYPE_PALETTE.photo,
  heif: { accent: "#AF6B9E", ink: "#753C67" },
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
  const name = (filename || "").trim();
  // Query/fragment delimiters belong to URLs; local filenames may contain them literally.
  const path = /^[a-z][a-z\d+.-]*:\/\//i.test(name) ? name.split(/[?#]/, 1)[0] : name;
  const leaf = path.split(/[\\/]/).pop() || "";
  const dot = leaf.lastIndexOf(".");
  const suffix = dot > 0 ? leaf.slice(dot + 1).toLowerCase() : "";
  const mime = mimeType?.split(";", 1)[0].trim().toLowerCase() || "";
  const fromMime = Object.hasOwn(MIME_EXTENSIONS, mime) ? MIME_EXTENSIONS[mime] : "";
  const resolved = [explicit, suffix, fromMime].find(known);
  if (!resolved) return { extension: "", monogram: "FILE", label: "File", family: "unknown" };
  return { extension: resolved, monogram: resolved.toUpperCase(), ...FORMATS[resolved] };
}

/**
 * A filename without its final extension when that extension is a document type Votic knows ("sample.pdf" →
 * "sample", "Notes.PDF " → "Notes"). Unknown suffixes stay ("v1.2", "Dr. Who"), and a name that is only an
 * extension is kept. For display only: stored filenames, paths, MIME types, and export names are unchanged.
 */
export function strip_file_extension(name: string) {
  const text = name.trim();
  const match = /^(.*\S)\.([A-Za-z0-9]{1,5})$/u.exec(text);
  return match && known(match[2].toLowerCase()) ? match[1].trimEnd() : text;
}

export function file_type_palette(type: FileType): { accent: string; ink: string } {
  const extension = type.extension === "jpg" ? "jpeg" : type.extension === "htm" ? "html" : type.extension;
  return Object.hasOwn(FILE_FORMAT_PALETTE, extension)
    ? FILE_FORMAT_PALETTE[extension as keyof typeof FILE_FORMAT_PALETTE]
    : FILE_TYPE_PALETTE[type.family];
}

export function file_type_colors(type: FileType, isDark: boolean) {
  const palette = file_type_palette(type);
  return {
    accent: palette.accent,
    foreground: isDark ? lift_ink(palette.accent) : palette.ink,
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
