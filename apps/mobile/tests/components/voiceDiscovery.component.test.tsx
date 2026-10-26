import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import VoicesScreen from "../../app/voices";
import { votic_voice_names } from "../../src/reader/voices";
import { SettingsDetailScreen } from "../../src/settings/SettingsDetails";
import { PaywallPreview } from "../../src/subscription/PaywallPreview";
import { EMPTY_ANSWERS } from "../../src/onboarding/onboardingModel";
import { router } from "../mocks/expoRouter";
import { render_with_providers } from "../renderWithProviders";

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
const us = names["voice-us"],
  gb = names["voice-gb"];

async function saved_voice() {
  const raw = await AsyncStorage.getItem("votic.mobile.accessibility.v1");
  return raw ? JSON.parse(raw).voiceIdentifier : undefined;
}

describe("finding voices", () => {
  it("is in Settings › Reading & Listening, where every voice can be previewed and chosen", async () => {
    await render_with_providers(<SettingsDetailScreen category="reading" />);
    await fireEvent.press(await screen.findByRole("button", { name: "Voice" }));
    expect(router.push).toHaveBeenCalledWith("/voices");
    screen.unmount();
    await render_with_providers(<VoicesScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: `Preview ${us} voice` }));
    await waitFor(() =>
      expect(jest.mocked(Speech.speak)).toHaveBeenLastCalledWith(
        expect.stringContaining(us),
        expect.objectContaining({ voice: "voice-us" }),
      ),
    );
    expect(screen.getByRole("radio", { name: `Select ${gb} voice, British English` })).toBeTruthy();
    await fireEvent.press(screen.getByRole("radio", { name: `Select ${us} voice, US English` }));
    await waitFor(async () => expect(await saved_voice()).toBe("voice-us"));
  });

  it("offers voices during setup; choosing one saves it and plays the sample in that voice", async () => {
    await render_with_providers(<SettingsDetailScreen category="personalization" />, {
      accountSetup: { answers: { ...EMPTY_ANSWERS } },
    });
    await fireEvent.press(screen.getByRole("button", { name: "Your answers" }));
    await fireEvent.press(screen.getByLabelText("Research. Dig into papers and compare findings"));
    for (let step = 0; step < 3; step += 1)
      await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Find your listening rhythm.")).toBeTruthy();
    jest.mocked(Speech.speak).mockClear();
    await fireEvent.press(await screen.findByRole("radio", { name: `${gb} voice, British English` }));
    await waitFor(() =>
      expect(jest.mocked(Speech.speak)).toHaveBeenLastCalledWith(
        "People who slept after learning new words remembered more of them the next day than people who stayed awake.",
        expect.objectContaining({ voice: "voice-gb" }),
      ),
    );
    await waitFor(async () => expect(await saved_voice()).toBe("voice-gb"));
    expect(screen.getByText("More voices are in Settings › Reading & Listening › Voice.")).toBeTruthy();
  });

  it("keeps the voice chosen on the paywall preview, in the same order", async () => {
    await render_with_providers(<PaywallPreview />);
    const before = (await screen.findAllByRole("radio", { name: /^Preview voice / })).map(
      (radio) => radio.props.accessibilityLabel,
    );
    await fireEvent.press(screen.getByRole("radio", { name: `Preview voice ${gb}` }));
    await waitFor(async () => expect(await saved_voice()).toBe("voice-gb"));
    await act(async () => {});
    expect(
      screen
        .getAllByRole("radio", { name: /^Preview voice / })
        .map((radio) => radio.props.accessibilityLabel),
    ).toEqual(before);
  });
});
