import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Dimensions, StyleSheet } from "react-native";
import Home from "../../app/(tabs)/index";
import { NotesShelf, RecentShelf } from "../../src/home/HomeWidgets";
import { homeNotes } from "../../src/home/homeModel";
import { documentWidgetTone, widgetPalette, WidgetTone } from "../../src/home/widgetDesign";
import { router } from "../mocks/expoRouter";
import { renderWithProviders, testDocument } from "../renderWithProviders";

const featured = testDocument("featured", "The next chapter", {
  progress: 0.45,
  lastOpenedAt: 10,
  savedPassages: [
    {
      id: "note",
      sentenceIndex: 0,
      title: "An idea to revisit",
      text: "A saved passage.",
      note: "A useful thought.",
      pinned: true,
      createdAt: 1,
      updatedAt: 2,
    },
  ],
});
const recent = testDocument("recent", "Field Guide", {
  sourceName: "Field Guide.epub",
  progress: 0.3,
  lastOpenedAt: 1,
});

describe("Colorful Home cards", () => {
  for (const mode of ["light", "dark"] as const) {
    it(`keeps accessible actions and decorative artwork separate in ${mode} mode`, async () => {
      await AsyncStorage.setItem("votic.mobile.theme.v1", JSON.stringify({ appearanceMode: mode }));
      await renderWithProviders(<Home />, { documents: [featured, recent], reduceMotion: true });
      expect(StyleSheet.flatten(screen.getByTestId("home-continue-card").props.style).backgroundColor).toBe(
        widgetPalette(mode === "dark", "chapter").surface,
      );
      expect(StyleSheet.flatten(screen.getByTestId("home-week-card").props.style).backgroundColor).toBe(
        widgetPalette(mode === "dark", "activity").surface,
      );
      expect(StyleSheet.flatten(screen.getByTestId("home-recent-card").props.style).backgroundColor).toBe(
        widgetPalette(mode === "dark", "book").surface,
      );
      expect(StyleSheet.flatten(screen.getByTestId("home-note-card").props.style).backgroundColor).toBe(
        widgetPalette(mode === "dark", "notes").surface,
      );
      const read = screen.getByRole("button", { name: "Resume reading The next chapter" });
      expect(read.props.accessibilityHint).toContain("without audio controls");
      expect(StyleSheet.flatten(read.props.style).minHeight).toBeGreaterThanOrEqual(48);
      expect(
        screen.getByRole("progressbar", { name: "The next chapter progress" }).props.accessibilityValue.now,
      ).toBe(45);
      expect(screen.getByRole("button", { name: "Open Field Guide" }).props.accessibilityHint).toContain(
        "30%",
      );
      expect(
        screen.getByRole("button", { name: /Pinned note. An idea to revisit/ }).props.accessibilityHint,
      ).toBe("Opens the document at this passage");
      for (const artwork of screen.getAllByTestId("home-document-artwork", { includeHiddenElements: true })) {
        expect(artwork.props.importantForAccessibility).toBe("no-hide-descendants");
        expect(artwork.props.accessible).toBe(false);
      }
      await fireEvent.press(screen.getByRole("button", { name: /This week: no reading or listening yet/ }));
      expect(router.push).toHaveBeenCalledWith("/statistics");
      await fireEvent.press(screen.getByRole("button", { name: "See all documents" }));
      expect(router.push).toHaveBeenCalledWith("/documents");
      await fireEvent.press(screen.getByRole("button", { name: "See all notes" }));
      expect(router.push).toHaveBeenCalledWith("/notes");
    });
  }
  it("preserves recent-document and options callbacks with the original document", async () => {
    const open = jest.fn(),
      more = jest.fn();
    await renderWithProviders(<RecentShelf documents={[recent]} onOpen={open} onMore={more} />);
    await fireEvent.press(screen.getByRole("button", { name: "Open Field Guide" }));
    expect(open).toHaveBeenCalledWith(recent, expect.objectContaining({ current: expect.anything() }));
    await fireEvent.press(screen.getByRole("button", { name: "More options for Field Guide" }));
    expect(more).toHaveBeenCalledWith(recent);
  });
  it("expands shelf cards and keeps long titles available with larger text", async () => {
    const originalWindow = Dimensions.get("window");
    const originalScreen = Dimensions.get("screen");
    try {
      await act(async () =>
        Dimensions.set({ window: { ...originalWindow, fontScale: 2 }, screen: originalScreen }),
      );
      const longTitle = "A longer reading title that should remain available at larger text sizes";
      const document = { ...recent, title: longTitle };
      const open = jest.fn();
      await renderWithProviders(
        <>
          <RecentShelf documents={[document]} onOpen={open} onMore={() => {}} />
          <NotesShelf notes={homeNotes([featured])} onOpen={() => {}} />
        </>,
      );
      expect(screen.getByText(longTitle).props.numberOfLines).toBeUndefined();
      expect(screen.getByText("An idea to revisit").props.numberOfLines).toBeUndefined();
      expect(StyleSheet.flatten(screen.getByTestId("home-recent-card").props.style).width).toBeGreaterThan(
        156,
      );
      await fireEvent.press(screen.getByRole("button", { name: `Open ${longTitle}` }));
      expect(open).toHaveBeenCalledWith(document, expect.anything());
    } finally {
      await act(async () => Dimensions.set({ window: originalWindow, screen: originalScreen }));
    }
  });
  it("preserves pinned-note selection and its original passage", async () => {
    const open = jest.fn();
    const notes = homeNotes([featured]);
    await renderWithProviders(<NotesShelf notes={notes} onOpen={open} />);
    await fireEvent.press(screen.getByRole("button", { name: /Pinned note. An idea to revisit/ }));
    expect(open).toHaveBeenCalledWith(notes[0]);
  });
});

function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5]
      .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
      .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const [bright, dim] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (bright + 0.05) / (dim + 0.05);
}
describe("Home palette contrast", () => {
  it("keeps normal-size text readable on resting and pressed surfaces in both themes", () => {
    const tones: WidgetTone[] = ["chapter", "activity", "notes", "pdf", "slides", "book", "text"];
    for (const dark of [false, true])
      for (const tone of tones) {
        const palette = widgetPalette(dark, tone);
        for (const surface of [palette.surface, palette.art]) {
          expect(contrast(palette.ink, surface)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(palette.detail, surface)).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(palette.strong, palette.onStrong)).toBeGreaterThanOrEqual(4.5);
      }
  });
  it("uses file type rather than document order to choose the cover treatment", () => {
    expect(documentWidgetTone("REPORT.PDF")).toBe("pdf");
    expect(documentWidgetTone("slides.pptx")).toBe("slides");
    expect(documentWidgetTone("book.epub")).toBe("book");
    expect(documentWidgetTone("report.docx")).toBe("chapter");
    expect(documentWidgetTone("notes.md")).toBe("text");
  });
});
