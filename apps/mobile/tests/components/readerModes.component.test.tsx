import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { Pressable, Text } from "react-native";
import { SettingsDetailScreen } from "../../src/settings/SettingsDetails";
import Reader from "../../app/reader";
import { LIBRARY_KEY } from "../../src/documents/documentStorage";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { ReaderThemeProvider, useVoticTheme } from "../../src/theme/ThemeProvider";
import { searchParams } from "../mocks/expoRouter";
import { AppProviders, renderWithProviders, testDocument } from "../renderWithProviders";

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock("../../src/api/voticApi", () => ({ askVotic: jest.fn() }));
const speak = jest.mocked(Speech.speak);

function OpenedReader() {
  const { activeDocument } = useDocumentLibrary();
  return activeDocument ? <Reader /> : null;
}

// Twelve passages of two words each: 24 words in all.
const long = testDocument("doc-long", "Long Read", {
  plainText: Array.from({ length: 12 }, (_, index) => `Passage ${index + 1}.`).join(" "),
});

/** Lays out each passage as 100 points tall in a 300-point viewport, as a device would report. */
async function layOut(passages = 12) {
  const layout = (y: number, height: number) => ({
    nativeEvent: { layout: { x: 0, y, width: 390, height } },
  });
  if (screen.queryByTestId("reading-pages")) {
    await fireEvent(screen.getByTestId("reading-pages"), "layout", layout(0, 300));
    await fireEvent(
      screen.getByTestId("reading-measurement", { includeHiddenElements: true }),
      "textLayout",
      {
        nativeEvent: {
          lines: Array.from({ length: passages }, (_, index) => ({
            text: `Passage ${index + 1}.\n\n`,
            height: 100,
          })),
        },
      },
    );
    return;
  }
  await fireEvent(screen.getByTestId("reader-scroll"), "layout", layout(0, 300));
  for (const [index, passage] of screen.getByTestId("reader-document").children.entries())
    if (typeof passage !== "string" && index < passages)
      await fireEvent(passage, "layout", layout(index * 100, 100));
  await act(async () => jest.advanceTimersByTime(50));
}

/** A finger drag to `offset`, then release. */
async function dragTo(offset: number) {
  if (screen.queryByTestId("reading-pages")) {
    const turns = offset === 900 ? 5 : 2;
    for (let at = 0; at < turns; at += 1)
      await fireEvent.press(screen.getByRole("button", { name: "Next page" }));
    return;
  }
  const scroll = screen.getByTestId("reader-scroll");
  const event = {
    nativeEvent: {
      contentOffset: { x: 0, y: offset },
      contentSize: { width: 390, height: 1200 },
      layoutMeasurement: { width: 390, height: 300 },
    },
  };
  await fireEvent(scroll, "scrollBeginDrag", event);
  await fireEvent.scroll(scroll, event);
  await fireEvent(scroll, "scrollEndDrag", event);
}

async function openIn(mode: "read" | "listen" | null, document = long) {
  searchParams.current = mode ? { mode } : {};
  await renderWithProviders(<OpenedReader />, { documents: [document], reduceMotion: true });
}

beforeEach(() => {
  speak.mockReset();
});

describe("Read mode", () => {
  it("shows Ask Votic and More, with no Play button and no audio controls", async () => {
    await openIn("read");
    expect(screen.getByRole("button", { name: "Ask Votic about this page" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show reading tools" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Playback speed/ })).toBeNull();
  });

  it("is how a document opens when no mode is given", async () => {
    await openIn(null);
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    expect(screen.getByRole("button", { name: "Show reading tools" })).toBeTruthy();
  });

  it("keeps reading tools in More, without the listening-only ones", async () => {
    await openIn("read");
    await fireEvent.press(screen.getByRole("button", { name: "Show reading tools" }));
    expect(screen.getByRole("button", { name: "Text" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Color" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bookmark" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Previous passage" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    // Reading focus only changes the spoken-text highlight, so it is not offered here.
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Text" }));
    expect(screen.getByRole("header", { name: "Appearance" })).toBeTruthy();
  });

  it("moves the saved text position when turning pages", async () => {
    await openIn("read");
    await layOut();
    expect(screen.getByText("0% read")).toBeTruthy();
    // Offset 400 puts the reading line at 400 + 135 = 535: 35% into passage 6, its first word → 10 of 23.
    await dragTo(400);
    expect(screen.getByText("35% read")).toBeTruthy();
    expect(screen.getByText("Page 3 of 6")).toBeTruthy();
    expect(speak).not.toHaveBeenCalled();
    // The end of the document reads as 100%.
    await dragTo(900);
    expect(screen.getByText("87% read")).toBeTruthy();
    expect(screen.getByText("Page 6 of 6")).toBeTruthy();
  });

  it("saves the page's first word through the existing document progress", async () => {
    await openIn("read");
    await layOut();
    await dragTo(400);
    await act(async () => jest.advanceTimersByTime(2500));
    await waitFor(async () => {
      const saved = JSON.parse((await AsyncStorage.getItem(LIBRARY_KEY)) || "[]");
      expect(saved[0]).toMatchObject({ sentenceIndex: 4, wordIndex: 0 });
      expect(saved[0].progress).toBeCloseTo(8 / 23, 2);
    });
  });

  it("resumes at the saved position", async () => {
    await openIn("read", { ...long, sentenceIndex: 5, wordIndex: 0, progress: 10 / 23 });
    expect(screen.getByText("43% read")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    await layOut();
    expect(screen.getByText("Page 3 of 6")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Previous page" }));
    expect(screen.getByText("Page 2 of 6")).toBeTruthy();
  });

  it("does not highlight passages, since nothing is being read aloud", async () => {
    await openIn("read");
    await layOut();
    // The current passage renders as plain text rather than word-by-word spans.
    expect(screen.getByText(/Passage 1\.\s+Passage 2\./)).toBeTruthy();
  });

  it("keeps narration unavailable after reading to a new position", async () => {
    await openIn("read");
    await layOut();
    await dragTo(400);
    await fireEvent.press(screen.getByRole("button", { name: "Show reading tools" }));
    expect(screen.queryByRole("button", { name: "Switch to listening" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Listen" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    expect(speak).not.toHaveBeenCalled();
    expect(screen.getByText("35% read")).toBeTruthy();
  });

  it("honors explicit Read even when an autoplay parameter is present", async () => {
    searchParams.current = { mode: "read", autoplay: "1" };
    await renderWithProviders(<OpenedReader />, { documents: [long], reduceMotion: true });
    await layOut();
    await act(async () => jest.advanceTimersByTime(500));
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    expect(speak).not.toHaveBeenCalled();
    expect(Speech.stop).toHaveBeenCalled();
  });

  it("stops narration on a reused route and ignores a late completed-utterance callback", async () => {
    searchParams.current = { mode: "listen" };
    const view = await renderWithProviders(<OpenedReader />, { documents: [long], reduceMotion: true });
    await fireEvent.press(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(speak).toHaveBeenCalled());
    const options = speak.mock.calls.at(-1)?.[1] as Speech.SpeechOptions;
    const calls = speak.mock.calls.length;
    jest.mocked(Speech.stop).mockClear();
    searchParams.current = { mode: "read", autoplay: "1" };
    await view.rerender(
      <AppProviders>
        <OpenedReader />
      </AppProviders>,
    );
    expect(Speech.stop).toHaveBeenCalled();
    await act(async () => options.onDone?.());
    expect(speak).toHaveBeenCalledTimes(calls);
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    expect(screen.getByRole("button", { name: "Show reading tools" })).toBeTruthy();
  });

  it("opens Ask Votic without leaving Read mode", async () => {
    await openIn("read");
    await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));
    expect(screen.getByTestId("ask-votic-panel")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Close Ask Votic" }));
    await act(async () => jest.advanceTimersByTime(500));
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    expect(screen.getByRole("button", { name: "Show reading tools" })).toBeTruthy();
  });
});

describe("Listen mode", () => {
  it("shows Ask Votic, Play, and More", async () => {
    await openIn("listen");
    expect(screen.getByRole("button", { name: "Ask Votic about this page" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Expand listening controls" })).toBeTruthy();
  });

  it("keeps the listening tools in More", async () => {
    await openIn("listen");
    await fireEvent.press(screen.getByRole("button", { name: "Expand listening controls" }));
    expect(screen.getByRole("button", { name: "Previous passage" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Playback speed/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Listen" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "More" })).toBeTruthy();
  });

  it("moves progress with the spoken word", async () => {
    await openIn("listen");
    await layOut();
    await fireEvent.press(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(speak).toHaveBeenCalled());
    const options = speak.mock.calls.at(-1)?.[1] as Speech.SpeechOptions;
    // "Passage 1." — the boundary at character 8 is the second word.
    const onBoundary = options.onBoundary as (event: { charIndex: number; charLength: number }) => void;
    await act(async () => onBoundary({ charIndex: 8, charLength: 2 }));
    expect(screen.getByText("4% read")).toBeTruthy();
  });

  it("opens Ask Votic without leaving Listen mode", async () => {
    await openIn("listen");
    await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));
    expect(screen.getByTestId("ask-votic-panel")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Close Ask Votic" }));
    await act(async () => jest.advanceTimersByTime(500));
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  });
});

describe("One progress bar", () => {
  it.each(["read", "listen"] as const)("shows a single document progress bar in %s mode", async (mode) => {
    await openIn(mode);
    expect(screen.getAllByLabelText("Document playback position")).toHaveLength(1);
    await fireEvent.press(
      screen.getByRole("button", {
        name: mode === "read" ? "Show reading tools" : "Expand listening controls",
      }),
    );
    expect(screen.getAllByLabelText("Document playback position")).toHaveLength(1);
  });
});

function ThemeProbe({ id = "theme" }: { id?: string }) {
  const { theme, setAppearanceMode } = useVoticTheme();
  return (
    <>
      <Text testID={id}>{JSON.stringify(theme)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Sepia ${id}`}
        onPress={() => setAppearanceMode("sepia")}
      />
    </>
  );
}

function ThemeScopes() {
  return (
    <>
      <ThemeProbe id="app-theme" />
      <ReaderThemeProvider>
        <ThemeProbe id="reader-theme" />
      </ReaderThemeProvider>
    </>
  );
}

describe("Appearance", () => {
  it("offers Light, Dark, and System for the app without Sepia", async () => {
    await renderWithProviders(<SettingsDetailScreen category="appearance" />);
    for (const name of ["Light", "Dark", "System"]) expect(screen.getByRole("radio", { name })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "Sepia" })).toBeNull();
    await fireEvent.press(screen.getByRole("radio", { name: "System" }));
    await waitFor(async () =>
      expect(JSON.parse((await AsyncStorage.getItem("votic.mobile.theme.v1")) || "{}")).toMatchObject({
        appearanceMode: "system",
      }),
    );
  });

  it.each([
    ["light", "#FFFFFF", "#292D32"],
    ["dark", "#292D32", "#FAFAF9"],
    ["sepia", "#F4ECD8", "#5B4636"],
  ])("renders the %s Reader palette independently of the app", async (mode, background, text) => {
    await AsyncStorage.setItem(
      "votic.mobile.theme.v1",
      JSON.stringify({ accentName: "blue", appearanceMode: "light", readerAppearanceMode: mode }),
    );
    await renderWithProviders(<ThemeScopes />);
    const theme = JSON.parse(screen.getByTestId("reader-theme").props.children);
    expect(theme).toMatchObject({ background, text, mode, isDark: mode === "dark" });
    expect(theme.accent.toUpperCase()).toBe(mode === "sepia" ? "#2157CF" : "#2563EB");
    expect(JSON.parse(screen.getByTestId("app-theme").props.children)).toMatchObject({
      mode: "light",
      background: "#F3F6FC",
    });
  });

  it("saves Reader Sepia without changing app Dark", async () => {
    await AsyncStorage.setItem("votic.mobile.theme.v1", JSON.stringify({ appearanceMode: "dark" }));
    await renderWithProviders(<ThemeScopes />);
    await fireEvent.press(screen.getByRole("button", { name: "Sepia reader-theme" }));
    expect(JSON.parse(screen.getByTestId("app-theme").props.children)).toMatchObject({
      mode: "dark",
      background: "#0B1220",
      surface: "#152238",
    });
    expect(JSON.parse(screen.getByTestId("reader-theme").props.children)).toMatchObject({ mode: "sepia" });
    await waitFor(async () =>
      expect(JSON.parse((await AsyncStorage.getItem("votic.mobile.theme.v1")) || "{}")).toMatchObject({
        appearanceMode: "dark",
        readerAppearanceMode: "sepia",
      }),
    );
  });

  it("migrates legacy Sepia to Reader-only", async () => {
    await AsyncStorage.setItem("votic.mobile.theme.v1", JSON.stringify({ appearanceMode: "sepia" }));
    await renderWithProviders(<ThemeScopes />);
    expect(JSON.parse(screen.getByTestId("app-theme").props.children)).toMatchObject({ mode: "light" });
    expect(JSON.parse(screen.getByTestId("reader-theme").props.children)).toMatchObject({ mode: "sepia" });
  });
});
