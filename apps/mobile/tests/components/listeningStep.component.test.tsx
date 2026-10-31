import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { Linking, Platform, StyleSheet } from "react-native";
import { EMPTY_ANSWERS } from "../../src/onboarding/onboardingModel";
import { votic_voice_names } from "../../src/reader/voices";
import { SettingsDetailScreen } from "../../src/settings/SettingsDetails";
import { render_with_providers } from "../renderWithProviders";

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));

const BASIC = [
  { identifier: "voice-us", name: "voice-us", language: "en-US", quality: "Default" },
  { identifier: "voice-gb", name: "voice-gb", language: "en-GB", quality: "Default" },
];
const WITH_HQ = [BASIC[0], { ...BASIC[1], quality: "Enhanced" }];
const names = votic_voice_names(BASIC);

beforeEach(() => {
  jest.mocked(Speech.stop).mockResolvedValue(undefined);
  jest.mocked(Speech.speak).mockClear();
});

/** Opens the listening step from Settings › Personalization, as the other setup tests do. */
async function open_listening_step(voices: typeof BASIC) {
  jest.mocked(Speech.getAvailableVoicesAsync).mockResolvedValue(voices as never);
  await render_with_providers(<SettingsDetailScreen category="personalization" />, {
    accountSetup: { answers: { ...EMPTY_ANSWERS } },
  });
  await fireEvent.press(screen.getByRole("button", { name: "Your answers" }));
  await fireEvent.press(screen.getByLabelText("Work. Get through reports and find decisions"));
  for (let step = 0; step < 3; step += 1)
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByText("Find your listening rhythm.")).toBeTruthy();
  await screen.findByRole("radio", { name: new RegExp(`^${names["voice-gb"]} voice`) });
}

describe("Listening step", () => {
  it("keeps the sample word highlighted without enlarging it when emphasis was disabled", async () => {
    await AsyncStorage.setItem("votic.mobile.accessibility.v1", JSON.stringify({ wordEmphasis: false }));
    await open_listening_step(BASIC);
    await fireEvent.press(screen.getByRole("button", { name: "Play sample" }));
    await waitFor(() => expect(Speech.speak).toHaveBeenCalled());
    const options = jest.mocked(Speech.speak).mock.calls.at(-1)?.[1] as {
      onBoundary: (event: { charIndex: number }) => void;
    };
    await act(async () => options.onBoundary({ charIndex: 9 }));
    const spoken = StyleSheet.flatten(screen.getByTestId("listening-word").props.style);
    expect(spoken.backgroundColor).toBeTruthy();
    expect(spoken.fontWeight).toBeUndefined();
    expect(spoken.fontSize).toBeUndefined();
  });

  it("shows the sample in a player with the voice and speed in use", async () => {
    await open_listening_step(BASIC);
    expect(screen.getByTestId("listening-player")).toBeTruthy();
    expect(screen.getByText(/WEEKLY TEAM UPDATE · SAMPLE/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play sample" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play the sample from the start" })).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Sample progress" })).toBeTruthy();
    // Each speed says how it feels.
    expect(screen.getByText("Relaxed")).toBeTruthy();
    expect(screen.getByText("Skim")).toBeTruthy();
  });

  it("highlights the spoken word on top of the sentence, bold and a little larger", async () => {
    await open_listening_step(BASIC);
    await fireEvent.press(screen.getByRole("button", { name: "Play sample" }));
    await waitFor(() => expect(Speech.speak).toHaveBeenCalled());
    const options = jest.mocked(Speech.speak).mock.calls.at(-1)?.[1] as {
      onBoundary: (event: { charIndex: number }) => void;
    };
    await act(async () => options.onBoundary({ charIndex: 9 }));
    const spoken = StyleSheet.flatten(screen.getByTestId("listening-word").props.style);
    expect(spoken.backgroundColor).toBeTruthy();
    expect(spoken.fontWeight).toBe("900");
    let node = screen.getByTestId("listening-word").parent;
    while (node && !StyleSheet.flatten(node.props.style)?.fontSize) node = node.parent;
    const sentence = StyleSheet.flatten(node?.props.style) as { fontSize: number; backgroundColor?: string };
    expect(spoken.fontSize).toBe(sentence.fontSize + 2);
    expect(sentence.backgroundColor).toBeTruthy();

    // Sentences only: the sentence stays highlighted, the word doesn't.
    await fireEvent.press(screen.getByRole("radio", { name: "Sentences only. A calmer highlight" }));
    expect(screen.queryByTestId("listening-word")).toBeNull();
  });

  it("replays the sample from the start", async () => {
    await open_listening_step(BASIC);
    await fireEvent.press(screen.getByRole("button", { name: "Play the sample from the start" }));
    await waitFor(() => expect(Speech.speak).toHaveBeenCalledTimes(1));
    await fireEvent.press(screen.getByRole("button", { name: "Play the sample from the start" }));
    await waitFor(() => expect(Speech.speak).toHaveBeenCalledTimes(2));
  });

  it("suggests better voices only when the phone has no high-quality voice, and opens its speech settings", async () => {
    const platform = jest.replaceProperty(Platform, "OS", "android");
    const sendIntent = jest.spyOn(Linking, "sendIntent").mockResolvedValue(undefined);
    try {
      await open_listening_step(BASIC);
      expect(screen.getByText("Want a more natural voice?")).toBeTruthy();
      await fireEvent.press(screen.getByRole("button", { name: "Get more natural voices" }));
      expect(sendIntent).toHaveBeenCalledWith("com.android.settings.TTS_SETTINGS");
    } finally {
      platform.restore();
    }
  });

  it("marks high-quality voices and doesn't suggest others when one is installed", async () => {
    await open_listening_step(WITH_HQ);
    expect(
      screen.getByRole("radio", { name: `${names["voice-gb"]} voice, British English, high quality` }),
    ).toBeTruthy();
    expect(screen.getByText("HQ")).toBeTruthy();
    expect(screen.queryByText("Want a more natural voice?")).toBeNull();
  });
});
