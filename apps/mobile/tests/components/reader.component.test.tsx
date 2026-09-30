import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import Reader from "../../app/reader";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { router } from "../mocks/expoRouter";
import { renderWithProviders, testDocument } from "../renderWithProviders";

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
const speak = jest.mocked(Speech.speak);

// In the app the Reader only opens once the library has loaded an active document.
function OpenedReader() {
  const { activeDocument } = useDocumentLibrary();
  return activeDocument ? <Reader /> : null;
}

const book = testDocument("doc-book", "Field Guide", {
  plainText: "First passage here. Second passage there. Third passage ends.",
});

/** The options (callbacks) passed to the most recent Speech.speak call. */
function lastSpeech() {
  const call = speak.mock.calls.at(-1);
  if (!call) throw new Error("nothing was spoken");
  return { text: call[0], options: call[1] as Speech.SpeechOptions };
}

beforeEach(() => {
  speak.mockReset();
});

describe("Reader", () => {
  it("shows the document's passages and reading progress", async () => {
    await renderWithProviders(<OpenedReader />, { documents: [book], reduceMotion: true });
    // Title in the header and in the listening dock.
    expect(screen.getAllByText("Field Guide")).toHaveLength(2);
    expect(screen.getByText("First passage here.")).toBeTruthy();
    expect(screen.getByText("Third passage ends.")).toBeTruthy();
    expect(screen.getByText("0% read")).toBeTruthy();
    expect(screen.getByText("2 passages left")).toBeTruthy();
  });

  it("reads the current passage aloud and continues to the next", async () => {
    await renderWithProviders(<OpenedReader />, { documents: [book], reduceMotion: true });
    await fireEvent.press(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(speak).toHaveBeenCalled());
    expect(lastSpeech().text).toBe("First passage here.");
    expect(lastSpeech().options.rate).toBe(1);
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();

    await act(async () => lastSpeech().options.onDone?.());
    expect(lastSpeech().text).toBe("Second passage there.");
    expect(screen.getByText("1 passages left")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(Speech.stop).toHaveBeenCalled();
  });

  it("moves between passages and finishes the document", async () => {
    await renderWithProviders(<OpenedReader />, { documents: [book], reduceMotion: true });
    expect(screen.getByRole("button", { name: "Previous passage", disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Next passage" }));
    expect(screen.getByText("1 passages left")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Next passage" }));
    expect(screen.getByText("0 passages left")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Previous passage" }));
    expect(screen.getByText("1 passages left")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Next passage" }));

    await fireEvent.press(screen.getByRole("button", { name: "Finish document" }));
    expect(screen.getByText("Nicely done.")).toBeTruthy();
    expect(screen.getByText("100% read")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Review" }));
    expect(router.push).toHaveBeenCalledWith("/review");
  });

  it("finishes the document when narration reaches the end", async () => {
    await renderWithProviders(<OpenedReader />, {
      documents: [{ ...book, sentenceIndex: 2 }],
      reduceMotion: true,
    });
    await fireEvent.press(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(lastSpeech().text).toBe("Third passage ends."));
    await act(async () => lastSpeech().options.onDone?.());
    expect(screen.getByText("Nicely done.")).toBeTruthy();
  });

  it("saves the current passage with a note", async () => {
    await renderWithProviders(<OpenedReader />, { documents: [book], reduceMotion: true });
    await fireEvent.press(screen.getByRole("button", { name: "Save current passage" }));
    expect(screen.getAllByText("First passage here.").length).toBeGreaterThan(1);
    await fireEvent.changeText(screen.getByLabelText("Note about saved passage"), "Key opening idea.");
    await fireEvent.press(screen.getByRole("radio", { name: "Key Point" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save passage" }));
    expect(screen.getByRole("button", { name: "Edit saved passage" })).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Edit saved passage" }));
    expect(screen.getByDisplayValue("Key opening idea.")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Key Point", checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Remove saved passage" }));
    expect(screen.getByRole("button", { name: "Save current passage" })).toBeTruthy();
  });

  it("opens the listening controls from the speed button", async () => {
    await renderWithProviders(<OpenedReader />, { documents: [book], reduceMotion: true });
    await fireEvent.press(screen.getByRole("button", { name: /^Playback speed/ }));
    expect(screen.getByRole("header", { name: "Listen" })).toBeTruthy();
    expect(screen.getByText("Your device voice will be used.")).toBeTruthy();
    await fireEvent.press(screen.getAllByRole("button", { name: "Close reader controls" })[0]);
    expect(screen.queryByRole("header", { name: "Listen" })).toBeNull();
  });

  it("stops narration and navigates back when closed", async () => {
    await renderWithProviders(<OpenedReader />, { documents: [book], reduceMotion: true });
    await fireEvent.press(screen.getByRole("button", { name: "Close reader" }));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(Speech.stop).toHaveBeenCalled();
  });

  it("offers Ask Votic about the open document", async () => {
    await renderWithProviders(<OpenedReader />, { documents: [book], reduceMotion: true });
    await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this document" }));
    expect(router.push).toHaveBeenCalledWith("/assistant");
  });
});
