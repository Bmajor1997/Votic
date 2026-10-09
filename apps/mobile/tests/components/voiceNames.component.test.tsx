import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import { ReaderSettingsSheet } from "../../src/reader/components/ReaderSettingsSheet";
import { voticVoiceName } from "../../src/reader/voices";
import { parseVoiceNames, VOICE_NAMES_KEY } from "../../src/reader/useVoiceNames";
import { renderWithProviders } from "../renderWithProviders";

const voice = { identifier: "en-us-x-tpf-local", name: "en-us-x-tpf-local", language: "en-US" };
const preview = jest.fn();
function Sheet() {
  return (
    <ReaderSettingsSheet
      sheet="listen"
      onClose={() => {}}
      rate={1}
      onRateChange={() => {}}
      voices={[voice]}
      previewVoiceIdentifier={null}
      onPreviewVoice={preview}
      onSelectVoice={() => {}}
    />
  );
}
describe("Device voice names", () => {
  it("provides accessible naming choices and persists the choice by voice identifier", async () => {
    const view = await renderWithProviders(<Sheet />);
    expect(
      screen.getByRole("radio", { name: "Female name for Device voice 1" }).props.accessibilityHint,
    ).toContain("without changing");
    await fireEvent.press(screen.getByRole("radio", { name: "Female name for Device voice 1" }));
    const name = voticVoiceName(voice, "female");
    expect(await screen.findByRole("radio", { name: `Female name for ${name}`, checked: true })).toBeTruthy();
    expect(parseVoiceNames(await AsyncStorage.getItem(VOICE_NAMES_KEY))).toEqual({
      [voice.identifier]: "female",
    });
    await fireEvent.press(screen.getByRole("button", { name: `Preview ${name} voice` }));
    expect(preview).toHaveBeenCalledWith(voice, name);
    await view.unmount();
    await renderWithProviders(<Sheet />);
    expect(await screen.findByRole("radio", { name: `Female name for ${name}`, checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("radio", { name: `Male name for ${name}` }));
    expect(
      await screen.findByRole("radio", {
        name: `Male name for ${voticVoiceName(voice, "male")}`,
        checked: true,
      }),
    ).toBeTruthy();
  });
  it("announces a save failure without pretending the name was saved", async () => {
    await renderWithProviders(<Sheet />);
    jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("storage full"));
    await fireEvent.press(screen.getByRole("radio", { name: "Male name for Device voice 1" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Voice names could not be loaded or saved. Please try again.",
    );
    expect(screen.getByRole("radio", { name: "Male name for Device voice 1", checked: false })).toBeTruthy();
  });
  it("rejects corrupt saved choices", () => {
    expect(parseVoiceNames("broken")).toEqual({});
    expect(parseVoiceNames('["female"]')).toEqual({});
    expect(parseVoiceNames('{"a":"female","b":"male","c":"unknown"}')).toEqual({ a: "female", b: "male" });
  });
});
