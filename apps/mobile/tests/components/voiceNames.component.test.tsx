import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import { ReaderSettingsSheet } from "../../src/reader/components/ReaderSettingsSheet";
import { voticVoiceNames } from "../../src/reader/voices";
import { renderWithProviders } from "../renderWithProviders";

const voices = [
  { identifier: "en-us-x-tpf-local", name: "en-us-x-tpf-local", language: "en-US" },
  { identifier: "en-us-x-iom-local", name: "en-us-x-iom-local", language: "en-US" },
];
const preview = jest.fn();

describe("Voice names in the Listen sheet", () => {
  it("shows every voice by a real name, with no female or male choices to make", async () => {
    await renderWithProviders(
      <ReaderSettingsSheet
        sheet="listen"
        onClose={() => {}}
        rate={1}
        onRateChange={() => {}}
        voices={voices}
        previewVoiceIdentifier={null}
        onPreviewVoice={preview}
        onSelectVoice={() => {}}
      />,
    );
    const names = voticVoiceNames(voices);
    for (const voice of voices)
      expect(screen.getByRole("button", { name: `Preview ${names[voice.identifier]} voice` })).toBeTruthy();
    expect(screen.queryByText(/Device voice|en-us-x/)).toBeNull();
    expect(screen.queryByRole("radio", { name: /Female name|Male name/ })).toBeNull();
    expect(screen.queryByText(/female or male/i)).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: `Preview ${names[voices[0].identifier]} voice` }),
    );
    expect(preview).toHaveBeenCalledWith(voices[0], names[voices[0].identifier]);
  });
});
