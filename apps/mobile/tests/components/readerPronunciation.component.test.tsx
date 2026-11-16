import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import Reader from "../../app/reader";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { load_pronunciations } from "../../src/reader/pronunciationDictionary";
import { fakeAuth } from "../mocks/authBackend";
import { searchParams } from "../mocks/expoRouter";
import { render_with_providers, test_document } from "../renderWithProviders";

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock("../../src/api/voticApi", () => ({ ask_votic: jest.fn() }));
const speak = jest.mocked(Speech.speak);

function OpenedReader() {
  const { activeDocument } = useDocumentLibrary();
  return activeDocument ? <Reader /> : null;
}

const document = test_document("doc-votic", "Votic Notes", {
  plainText: "Votic reads clearly. Second passage.",
});

async function open_listening() {
  searchParams.current = { mode: "listen" };
  await render_with_providers(<OpenedReader />, { documents: [document], reduceMotion: true });
}

async function hold(word: string) {
  await fireEvent(screen.getByText(word, { exact: true }), "longPress");
}

beforeEach(() => {
  speak.mockReset();
});

describe("Press and hold a word in Listen mode", () => {
  it("opens with the word filled in, previews it, and saves it for narration", async () => {
    await open_listening();
    await hold("Votic");
    expect(screen.getByText("Fix how it's said")).toBeTruthy();
    expect(screen.getByLabelText("Word or phrase").props.value).toBe("Votic");

    await fireEvent.changeText(screen.getByLabelText("How Votic should say it"), "VOH-tick");
    await fireEvent.press(screen.getByRole("button", { name: "Preview pronunciation" }));
    expect(speak.mock.calls.at(-1)?.[0]).toBe("VOH-tick");

    await fireEvent.press(screen.getByRole("button", { name: "Save pronunciation" }));
    await waitFor(() => expect(screen.queryByText("Fix how it's said")).toBeNull());
    expect(await load_pronunciations(fakeAuth.user?.uid)).toEqual([
      { id: "votic", term: "Votic", pronunciation: "VOH-tick" },
    ]);

    speak.mockReset();
    await fireEvent.press(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(speak).toHaveBeenCalled());
    expect(speak.mock.calls.at(-1)?.[0]).toBe("VOH-tick reads clearly.");
  });

  it("leaves out punctuation from the held word", async () => {
    await open_listening();
    await hold("clearly.");
    expect(screen.getByLabelText("Word or phrase").props.value).toBe("clearly");
  });

  it("shows the saved pronunciation again and can remove it", async () => {
    await open_listening();
    await hold("Votic");
    await fireEvent.changeText(screen.getByLabelText("How Votic should say it"), "VOH-tick");
    await fireEvent.press(screen.getByRole("button", { name: "Save pronunciation" }));
    await waitFor(() => expect(screen.queryByText("Fix how it's said")).toBeNull());

    await hold("Votic");
    expect(screen.getByLabelText("How Votic should say it").props.value).toBe("VOH-tick");
    await fireEvent.press(screen.getByRole("button", { name: "Remove pronunciation for Votic" }));
    await waitFor(() => expect(screen.queryByText("Fix how it's said")).toBeNull());
    expect(await load_pronunciations(fakeAuth.user?.uid)).toEqual([]);
  });

  it("pauses listening while the sheet is open", async () => {
    await open_listening();
    await fireEvent.press(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(speak).toHaveBeenCalled());
    await act(async () => hold("reads"));
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(Speech.stop).toHaveBeenCalled();
  });
});
