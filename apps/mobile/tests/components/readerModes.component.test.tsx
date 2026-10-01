import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { Text } from "react-native";
import Settings from "../../app/(tabs)/settings";
import Reader from "../../app/reader";
import { LIBRARY_KEY } from "../../src/documents/documentStorage";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { useVoticTheme } from "../../src/theme/ThemeProvider";
import { searchParams } from "../mocks/expoRouter";
import { renderWithProviders, testDocument } from "../renderWithProviders";

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
  await fireEvent(screen.getByTestId("reader-scroll"), "layout", layout(0, 300));
  for (const [index, passage] of screen.getByTestId("reader-document").children.entries())
    if (typeof passage !== "string" && index < passages)
      await fireEvent(passage, "layout", layout(index * 100, 100));
  await act(async () => jest.advanceTimersByTime(50));
}

/** A finger drag to `offset`, then release. */
async function dragTo(offset: number) {
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

  it("moves the document position, and the progress bar, as the reader scrolls", async () => {
    await openIn("read");
    await layOut();
    expect(screen.getByText("0% read")).toBeTruthy();
    // Offset 400 puts the reading line at 400 + 135 = 535: 35% into passage 6, its first word → 10 of 23.
    await dragTo(400);
    expect(screen.getByText("43% read")).toBeTruthy();
    expect(screen.getByText("6 passages left")).toBeTruthy();
    expect(speak).not.toHaveBeenCalled();
    // The end of the document reads as 100%.
    await dragTo(900);
    expect(screen.getByText("100% read")).toBeTruthy();
  });

  it("saves the scrolled position through the existing document progress", async () => {
    await openIn("read");
    await layOut();
    await dragTo(400);
    await act(async () => jest.advanceTimersByTime(2500));
    await waitFor(async () => {
      const saved = JSON.parse((await AsyncStorage.getItem(LIBRARY_KEY)) || "[]");
      expect(saved[0]).toMatchObject({ sentenceIndex: 5, wordIndex: 0 });
      expect(saved[0].progress).toBeCloseTo(10 / 23, 2);
    });
  });

  it("resumes at the saved position", async () => {
    await openIn("read", { ...long, sentenceIndex: 5, wordIndex: 0, progress: 10 / 23 });
    expect(screen.getByText("43% read")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
  });

  it("does not highlight passages, since nothing is being read aloud", async () => {
    await openIn("read");
    await layOut();
    // The current passage renders as plain text rather than word-by-word spans.
    expect(screen.getByText("Passage 1.")).toBeTruthy();
  });

  it("switches to listening when asked, then plays from the reading position", async () => {
    await openIn("read");
    await layOut();
    await dragTo(400);
    await fireEvent.press(screen.getByRole("button", { name: "Show reading tools" }));
    await fireEvent.press(screen.getByRole("button", { name: "Switch to listening" }));
    await fireEvent.press(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(speak).toHaveBeenCalled());
    expect(speak.mock.calls.at(-1)?.[0]).toBe("Passage 6.");
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

function ThemeProbe() {
  const { theme } = useVoticTheme();
  return <Text testID="theme">{JSON.stringify(theme)}</Text>;
}

describe("Appearance", () => {
  it("offers Light, Dark, and Sepia, and no longer System", async () => {
    await renderWithProviders(<Settings />);
    for (const name of ["Light", "Dark", "Sepia"]) expect(screen.getByRole("radio", { name })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "System" })).toBeNull();
    await fireEvent.press(screen.getByRole("radio", { name: "Sepia" }));
    expect(screen.getByRole("radio", { name: "Sepia", checked: true })).toBeTruthy();
    await waitFor(async () =>
      expect(JSON.parse((await AsyncStorage.getItem("votic.mobile.theme.v1")) || "{}")).toMatchObject({
        appearanceMode: "sepia",
      }),
    );
  });

  it.each([
    ["light", "#FFFFFF", "#292D32"],
    ["dark", "#292D32", "#FAFAF9"],
    ["sepia", "#F4ECD8", "#5B4636"],
  ])("renders the %s palette", async (mode, background, text) => {
    await AsyncStorage.setItem(
      "votic.mobile.theme.v1",
      JSON.stringify({ accentName: "blue", appearanceMode: mode }),
    );
    await renderWithProviders(<ThemeProbe />);
    const theme = JSON.parse(screen.getByTestId("theme").props.children);
    expect(theme).toMatchObject({ background, text, mode, isDark: mode === "dark" });
    // Sepia deepens the accent slightly so small accent text stays readable on the paper color.
    expect(theme.accent.toUpperCase()).toBe(mode === "sepia" ? "#2157CF" : "#2563EB");
  });

  it("falls back to Light for a saved System choice from earlier versions", async () => {
    await AsyncStorage.setItem(
      "votic.mobile.theme.v1",
      JSON.stringify({ accentName: "blue", appearanceMode: "system" }),
    );
    await renderWithProviders(<ThemeProbe />);
    expect(JSON.parse(screen.getByTestId("theme").props.children)).toMatchObject({ mode: "light" });
  });
});
