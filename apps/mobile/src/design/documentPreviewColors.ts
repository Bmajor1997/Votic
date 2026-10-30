import { FILE_FORMAT_PALETTE } from "../documents/fileTypes";

/** Match the same format's icon and note identity; paper itself stays white. */
export const documentPreviewColors = {
  pdf: { ink: FILE_FORMAT_PALETTE.pdf.ink, bar: "#F5E1DE" },
  html: { ink: FILE_FORMAT_PALETTE.html.ink, bar: "#D9F1F7" },
  epub: { ink: FILE_FORMAT_PALETTE.epub.ink, bar: "#EDE3F7" },
  text: { ink: FILE_FORMAT_PALETTE.txt.ink, bar: "#E7E8EB" },
  scan: { ink: "#6B573D", bar: "#EEE5D6" },
} as const;
