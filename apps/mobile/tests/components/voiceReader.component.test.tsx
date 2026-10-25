import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { StyleSheet } from "react-native";
import Reader from "../../app/reader";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { votic_voice_names } from "../../src/reader/voices";
import { searchParams } from "../mocks/expoRouter";
import { render_with_providers, test_document } from "../renderWithProviders";

const VOICES = [
  { identifier: "voice-us", name: "voice-us", language: "en-US" },
  { identifier: "voice-gb", name: "voice-gb", language: "en-GB" },
];
jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => [
    { identifier: "voice-us", name: "voice-us", language: "en-US" },
    { identifier: "voice-gb", name: "voice-gb", language: "en-GB" },
  ]),
}));
// restoreMocks clears the factory's implementations after each test, so they are set again before each one.
beforeEach(() => {
  jest.mocked(Speech.getAvailableVoicesAsync).mockResolvedValue(VOICES as never);
  jest.mocked(Speech.stop).mockResolvedValue(undefined);
});
const names = votic_voice_names(VOICES);
const gb = names["voice-gb"];

async function saved_voice() {
  const raw = await AsyncStorage.getItem("votic.mobile.accessibility.v1");
  return raw ? JSON.parse(raw).voiceIdentifier : undefined;
}
function OpenedReader() {
  const { activeDocument } = useDocumentLibrary();
  return activeDocument ? <Reader /> : null;
}

describe("the voice on the Reader", () => {
  it("shows the current voice on the Reader while listening, and changes it in one tap", async () => {
    searchParams.current = { mode: "listen" };
    await render_with_providers(<OpenedReader />, { documents: [test_document("book", "Book")] });
    const button = await screen.findByRole("button", { name: "Voice: Device voice. Change voice" });
    await fireEvent.press(button);
    expect(screen.getByText("Tap play to hear a voice, then choose the one you like.")).toBeTruthy();
    // The list fills the sheet's width; the sheet lays sections out in a row, which once squashed it.
    expect(StyleSheet.flatten(screen.getByTestId("voice-list").props.style)).toMatchObject({
      width: "100%",
      alignSelf: "stretch",
    });
    await fireEvent.press(screen.getByRole("radio", { name: `Select ${gb} voice, British English` }));
    await waitFor(async () => expect(await saved_voice()).toBe("voice-gb"));
    expect(screen.getAllByRole("button", { name: `Voice: ${gb}. Change voice` }).length).toBeGreaterThan(0);
  });

  it("is not shown while reading, only while listening", async () => {
    searchParams.current = { mode: "read" };
    await render_with_providers(<OpenedReader />, { documents: [test_document("book", "Book")] });
    await screen.findByRole("tab", { name: "Read" });
    expect(screen.queryByRole("button", { name: /^Voice: / })).toBeNull();
  });
});
