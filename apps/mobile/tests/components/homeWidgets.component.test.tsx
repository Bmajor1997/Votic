import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Dimensions, StyleSheet } from "react-native";
import Home from "../../app/(tabs)/index";
import { NotesShelf, RecentShelf } from "../../src/home/HomeWidgets";
import { home_notes } from "../../src/home/homeModel";
import { document_widget_tone, widget_palette, WidgetTone } from "../../src/home/widgetDesign";
import { router } from "../mocks/expoRouter";
import { render_with_providers, test_document } from "../renderWithProviders";

const featured = test_document("featured", "The next chapter", {
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
const recent = test_document("recent", "Field Guide", {
  sourceName: "Field Guide.epub",
  progress: 0.3,
  lastOpenedAt: 1,
});

describe("Colorful Home cards", () => {
  it.each([320, 375, 390])("keeps full Continue labels in order at a %s-point phone width", async (width) => {
    const originalWindow = Dimensions.get("window");
    const originalScreen = Dimensions.get("screen");
    try {
      await act(async () =>
        Dimensions.set({ window: { ...originalWindow, width, fontScale: 1 }, screen: originalScreen }),
      );
      await render_with_providers(<Home />, { documents: [featured], reduceMotion: true });
      const actions = screen.getByTestId("home-continue-actions");
      expect(StyleSheet.flatten(actions.props.style).flexDirection).toBe("row");
      const buttons = screen.getAllByRole("button", { name: /^Continue (Listening|Reading):/ });
      expect(buttons.map((button) => button.props.accessibilityLabel)).toEqual([
        "Continue Listening: The next chapter",
        "Continue Reading: The next chapter",
      ]);
      for (const label of ["Continue Listening", "Continue Reading"]) {
        const text = screen.getByText(label);
        expect(text.props.numberOfLines).toBeUndefined();
        expect(text.props.allowFontScaling).not.toBe(false);
        expect(StyleSheet.flatten(text.props.style).fontSize).toBeGreaterThanOrEqual(14);
      }
    } finally {
      await act(async () => Dimensions.set({ window: originalWindow, screen: originalScreen }));
    }
  });

  it("keeps both actions side by side with accessibility text, letting labels wrap instead of cutting them off", async () => {
    const originalWindow = Dimensions.get("window");
    const originalScreen = Dimensions.get("screen");
    try {
      await act(async () =>
        Dimensions.set({ window: { ...originalWindow, width: 320, fontScale: 2 }, screen: originalScreen }),
      );
      await render_with_providers(<Home />, { documents: [featured], reduceMotion: true });
      expect(StyleSheet.flatten(screen.getByTestId("home-continue-actions").props.style).flexDirection).toBe(
        "row",
      );
      expect(
        screen
          .getAllByRole("button", { name: /^Continue (Listening|Reading):/ })
          .map((button) => button.props.accessibilityLabel),
      ).toEqual(["Continue Listening: The next chapter", "Continue Reading: The next chapter"]);
      for (const label of ["Continue Listening", "Continue Reading"]) {
        expect(screen.getByText(label).props.numberOfLines).toBeUndefined();
        expect(screen.getByText(label).props.allowFontScaling).not.toBe(false);
      }
    } finally {
      await act(async () => Dimensions.set({ window: originalWindow, screen: originalScreen }));
    }
  });

  for (const mode of ["light", "dark"] as const) {
    it(`keeps accessible actions and decorative artwork separate in ${mode} mode`, async () => {
      await AsyncStorage.setItem("votic.mobile.theme.v1", JSON.stringify({ appearanceMode: mode }));
      await render_with_providers(<Home />, { documents: [featured, recent], reduceMotion: true });
      expect(StyleSheet.flatten(screen.getByTestId("home-continue-card").props.style).backgroundColor).toBe(
        widget_palette(mode === "dark", "chapter").surface,
      );
      expect(StyleSheet.flatten(screen.getByTestId("home-week-card").props.style).backgroundColor).toBe(
        widget_palette(mode === "dark", "activity").surface,
      );
      expect(StyleSheet.flatten(screen.getByTestId("home-recent-card").props.style).backgroundColor).toBe(
        "transparent",
      );
      expect(StyleSheet.flatten(screen.getByTestId("note-preview-type").props.style).backgroundColor).toBe(
        widget_palette(mode === "dark", "notes").surface,
      );
      const read = screen.getByRole("button", { name: "Continue Reading: The next chapter" });
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
    await render_with_providers(<RecentShelf documents={[recent]} onOpen={open} onMore={more} />);
    await fireEvent.press(screen.getByRole("button", { name: "Open Field Guide" }));
    expect(open).toHaveBeenCalledWith(
      recent,
      expect.objectContaining({ current: expect.anything() }),
      expect.objectContaining({ text: recent.title, node: expect.anything() }),
    );
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
      await render_with_providers(
        <>
          <RecentShelf documents={[document]} onOpen={open} onMore={() => {}} />
          <NotesShelf notes={home_notes([featured])} onOpen={() => {}} />
        </>,
      );
      expect(screen.getByText(longTitle).props.numberOfLines).toBeUndefined();
      expect(screen.getByText("An idea to revisit").props.numberOfLines).toBeUndefined();
      expect(StyleSheet.flatten(screen.getByTestId("home-recent-card").props.style).width).toBeGreaterThan(
        156,
      );
      await fireEvent.press(screen.getByRole("button", { name: `Open ${longTitle}` }));
      expect(open).toHaveBeenCalledWith(
        document,
        expect.anything(),
        expect.objectContaining({ text: longTitle, node: expect.anything() }),
      );
    } finally {
      await act(async () => Dimensions.set({ window: originalWindow, screen: originalScreen }));
    }
  });
  it("preserves pinned-note selection and its original passage", async () => {
    const open = jest.fn();
    const notes = home_notes([featured]);
    await render_with_providers(<NotesShelf notes={notes} onOpen={open} />);
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
  it("keeps card colors distinct with deep jade activity and soft lavender notes", () => {
    const tones: WidgetTone[] = ["chapter", "activity", "notes", "pdf", "slides", "book", "text"];
    for (const dark of [false, true]) {
      const surfaces = tones.map((tone) => widget_palette(dark, tone).surface);
      expect(new Set(surfaces).size).toBe(tones.length);
      expect(widget_palette(dark, "activity").surface).toBe("#205B53");
      expect(widget_palette(dark, "notes").surface).toBe("#C9BEDC");
      for (const hex of surfaces) expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("keeps normal-size text readable on resting and pressed surfaces in both themes", () => {
    const tones: WidgetTone[] = ["chapter", "activity", "notes", "pdf", "slides", "book", "text"];
    for (const dark of [false, true])
      for (const tone of tones) {
        const palette = widget_palette(dark, tone);
        for (const surface of [palette.surface, palette.art]) {
          expect(contrast(palette.ink, surface)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(palette.detail, surface)).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(palette.strong, palette.onStrong)).toBeGreaterThanOrEqual(4.5);
      }
  });
  it("uses file type rather than document order to choose the cover treatment", () => {
    expect(document_widget_tone("REPORT.PDF")).toBe("pdf");
    expect(document_widget_tone("slides.pptx")).toBe("slides");
    expect(document_widget_tone("book.epub")).toBe("book");
    expect(document_widget_tone("report.docx")).toBe("chapter");
    expect(document_widget_tone("notes.md")).toBe("text");
  });
});

describe("Home with an empty library", () => {
  it("keeps Home's sections, each saying what will show up there", async () => {
    await render_with_providers(<Home />, { onboarding: { checklistDismissed: false } });
    expect(screen.queryByRole("header", { name: "Your reading starts here" })).toBeNull();
    expect(screen.queryByRole("header", { name: "Continue" })).toBeNull();
    expect(screen.getByRole("header", { name: "Your next read starts here" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add document" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Upload a document" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Hide getting started" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Browse documents" }));
    expect(router.push).toHaveBeenCalledWith("/documents");
    expect(screen.getByRole("button", { name: /^This week: no reading or listening yet/ })).toBeTruthy();
    expect(screen.getByText("No activity")).toBeTruthy();
    expect(screen.getByRole("header", { name: "Recent files" })).toBeTruthy();
    expect(screen.getByText("Your shelf starts here")).toBeTruthy();
    expect(screen.getByRole("header", { name: "Recent notes" })).toBeTruthy();
    expect(screen.getByText("No notes")).toBeTruthy();
    // Nothing to see yet, so no "See all".
    expect(screen.queryByRole("button", { name: /^See all/ })).toBeNull();
  });
});

it("offers browsing when every document is finished, while keeping recent documents", async () => {
  await render_with_providers(<Home />, {
    documents: [test_document("finished", "Finished book", { progress: 1, completedAt: 5 })],
    onboarding: { checklistDismissed: false },
  });
  expect(screen.getByRole("header", { name: "Your next read starts here" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Open Finished book" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Hide getting started" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Add document" })).toBeNull();
});

describe("Quick Notes on Home", () => {
  it("is never offered as the document to continue, but its notes still show", async () => {
    const quickNotes = test_document("quick", "Quick Notes", {
      sourceName: "Quick Notes.txt",
      notebookKind: "quick-notes",
      progress: 0,
      lastOpenedAt: 99,
      savedPassages: [
        { id: "q1", sentenceIndex: 0, text: "", note: "Call the library", createdAt: 1, updatedAt: 5 },
      ],
    });
    await render_with_providers(<Home />, { documents: [quickNotes, recent] });
    expect(screen.queryByRole("button", { name: /^Continue (Listening|Reading): Quick Notes/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Continue Reading: Field Guide/ }).length).toBe(1);
    expect(screen.getAllByText("Call the library").length).toBeGreaterThan(0);
  });
});

it("previews the saved reading and speech passage without a file icon in Continue", async () => {
  await render_with_providers(<Home />, {
    documents: [
      {
        ...featured,
        plainText: "First passage. Saved passage here. Following passage.",
        sentenceIndex: 1,
        wordIndex: 1,
      },
    ],
    reduceMotion: true,
  });
  expect(screen.getByText("AT YOUR SAVED POSITION")).toBeTruthy();
  expect(screen.getByText("Saved passage here. Following passage.")).toBeTruthy();
  expect(screen.queryByTestId("home-document-artwork", { includeHiddenElements: true })).toBeNull();
});
it("shows an honest fallback when the saved location is unavailable", async () => {
  await render_with_providers(<Home />, {
    documents: [{ ...featured, sentenceIndex: 999 }],
    reduceMotion: true,
  });
  expect(screen.getByText("DOCUMENT PREVIEW")).toBeTruthy();
  expect(screen.queryByText("AT YOUR SAVED POSITION")).toBeNull();
  expect(screen.getByRole("button", { name: "Continue Listening: The next chapter" })).toBeTruthy();
});

it("shows retained content as decorative recent-file pages with secondary format labels", async () => {
  const documents = [
    { ...recent, id: "html", sourceName: "Field Guide.html", plainText: "A real webpage excerpt." },
    { ...recent, id: "pdf", sourceName: "Field Guide.pdf", plainText: "A real PDF excerpt." },
    { ...recent, id: "book", sourceName: "Field Guide.epub", plainText: "A real book excerpt." },
  ];
  await render_with_providers(<RecentShelf documents={documents} onOpen={() => {}} onMore={() => {}} />);
  expect(screen.getAllByTestId("home-page-preview", { includeHiddenElements: true })).toHaveLength(3);
  for (const kind of ["browser", "pdf", "book"])
    expect(screen.getByTestId(`home-preview-${kind}`, { includeHiddenElements: true })).toBeTruthy();
  for (const document of documents)
    expect(screen.getByText(document.plainText, { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByText("HTML", { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByText("PDF", { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByText("EPUB", { includeHiddenElements: true })).toBeTruthy();
});
it("keeps recent files usable when retained preview text is empty", async () => {
  await render_with_providers(
    <RecentShelf documents={[{ ...recent, plainText: "" }]} onOpen={() => {}} onMore={() => {}} />,
  );
  expect(screen.getByText("Your next read starts here.", { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Open Field Guide" })).toBeTruthy();
});
