import { darkCards } from "../design/cardPalette";
import { documentPreviewColors } from "../design/documentPreviewColors";
import { document_type_label } from "../documents/documentDisplay";
import { FILE_TYPE_PALETTE, resolve_file_type } from "../documents/fileTypes";
import { VoticDocument } from "../documents/types";
import { mix } from "../theme/ThemeProvider";

type NoteSource = Pick<VoticDocument, "sourceName" | "origin" | "sourceUrl" | "notebookKind">;

/** Source identity is presentation only; saved notes, tags and document links are never rewritten. */
export function note_palette(document: NoteSource) {
  if (document.notebookKind === "quick-notes") return { ...darkCards.notes, paper: "#F8F4FC" };
  const type = resolve_file_type({ filename: document.sourceName });
  const label = document_type_label(document);
  const identity =
    label === "Scan"
      ? documentPreviewColors.scan
      : label === "Webpage" || type.family === "html"
        ? documentPreviewColors.html
        : type.family === "pdf"
          ? documentPreviewColors.pdf
          : type.family === "epub"
            ? documentPreviewColors.epub
            : type.family === "text" || type.family === "unknown"
              ? documentPreviewColors.text
              : {
                  ink: FILE_TYPE_PALETTE[type.family].ink,
                  bar: mix("#FFFFFF", FILE_TYPE_PALETTE[type.family].accent, 0.2),
                };
  return {
    surface: identity.bar,
    paper: mix("#FFFFFF", identity.bar, 0.25),
    border: mix(identity.bar, identity.ink, 0.35),
    ink: identity.ink,
    detail: mix(identity.ink, "#26344B", 0.2),
    art: mix(identity.bar, identity.ink, 0.1),
    strong: identity.ink,
    onStrong: "#FFFFFF",
  };
}
