import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { NotesShelf } from "../../src/home/HomeWidgets";
import { NotebookCard } from "../../src/notes/components/NotebookCard";
import { NoteGroupCard } from "../../src/notes/components/NoteGroupCard";
import { note_palette } from "../../src/notes/notePalette";
import { render_with_providers, test_document } from "../renderWithProviders";

const passage = {
  id: "note",
  sentenceIndex: 0,
  text: "Source passage.",
  note: "My saved thought.",
  title: "Remember this",
  createdAt: 1,
  updatedAt: 2,
};
const sources = [
  { sourceName: "report.PDF", tint: "#F5E1DE", ink: "#853F3F" },
  { sourceName: "notes.txt", tint: "#E7E8EB", ink: "#515965" },
  { sourceName: "article.html", tint: "#D9F1F7", ink: "#195B70" },
];
const documents = sources.map((source, i) =>
  test_document(String(i), `Source ${i}`, { sourceName: source.sourceName, savedPassages: [passage] }),
);

describe("Notes inherit source identity", () => {
  it.each(["light", "dark"])("keeps source colors on Home and notebook previews in %s mode", async (mode) => {
    await AsyncStorage.setItem("votic.mobile.theme.v1", JSON.stringify({ appearanceMode: mode }));
    const open = jest.fn();
    await render_with_providers(
      <>
        <NotesShelf notes={documents.map((document) => ({ document, passage }))} onOpen={open} />
        {documents.map((document) => (
          <NotebookCard key={document.id} document={document} fullWidth={false} onPress={() => {}} />
        ))}
      </>,
    );
    const tabs = screen.getAllByTestId("note-preview-type", { includeHiddenElements: true });
    expect(tabs).toHaveLength(6);
    sources.forEach((source, i) => {
      expect(StyleSheet.flatten(tabs[i].props.style).backgroundColor).toBe(source.tint);
      expect(StyleSheet.flatten(tabs[i + 3].props.style).backgroundColor).toBe(source.tint);
    });
    await fireEvent.press(screen.getAllByTestId("home-note-card")[0]);
    expect(open).toHaveBeenCalledWith({ document: documents[0], passage });
  });

  it.each(sources)(
    "retains the $sourceName color when opening its notes",
    async ({ sourceName, tint, ink }) => {
      const document = test_document("source", "Source", { sourceName });
      const view = jest.fn();
      await render_with_providers(
        <NoteGroupCard
          document={document}
          passages={[passage]}
          inNotebook={false}
          selecting={false}
          selectedIds={[]}
          onOpenNotebook={() => {}}
          onToggleSelected={() => {}}
          onView={view}
          onMore={() => {}}
        />,
      );
      expect(
        StyleSheet.flatten(screen.getByRole("button", { name: "Open Source notebook" }).props.style)
          .backgroundColor,
      ).toBe(tint);
      expect(StyleSheet.flatten(screen.getByText("Remember this").props.style).color).toBe(ink);
      await fireEvent.press(screen.getByRole("button", { name: "View note from Source" }));
      expect(view).toHaveBeenCalledWith({ document, passage });
    },
  );

  it("uses origins for webpages/scans, gray for unknown sources, and lavender for Quick Notes", () => {
    expect(
      note_palette(test_document("web", "Web", { sourceName: "article.txt", origin: "webpage" })).surface,
    ).toBe("#D9F1F7");
    expect(
      note_palette(
        test_document("legacy", "Web", { sourceName: "article.txt", sourceUrl: "https://example.com" }),
      ).surface,
    ).toBe("#D9F1F7");
    expect(
      note_palette(test_document("scan", "Scan", { sourceName: "scan.txt", origin: "scan" })).surface,
    ).toBe("#EEE5D6");
    expect(note_palette(test_document("unknown", "PDF title only", { sourceName: "unknown" })).surface).toBe(
      "#E7E8EB",
    );
    expect(
      note_palette(
        test_document("quick", "Quick Notes", { notebookKind: "quick-notes", sourceName: "ideas.txt" }),
      ).surface,
    ).toBe("#C9BEDC");
    expect(note_palette(test_document("word", "Word", { sourceName: "letter.docx" })).ink).toBe("#28529A");
  });

  it("keeps note text legible on colored headers and paper for every file family", () => {
    for (const ext of [
      "pdf",
      "docx",
      "txt",
      "html",
      "htm",
      "md",
      "rtf",
      "odt",
      "epub",
      "jpg",
      "heic",
      "pptx",
      "unknown",
    ]) {
      const colors = note_palette(test_document(ext, ext, { sourceName: `source.${ext}` }));
      expect(contrast(colors.ink, colors.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.detail, colors.paper)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

function contrast(a: string, b: string) {
  function luminance(hex: string) {
    const [r, g, blue] = [1, 3, 5].map((offset) => {
      const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * blue;
  }
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
