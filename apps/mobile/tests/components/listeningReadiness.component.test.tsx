import { act, fireEvent, screen } from "@testing-library/react-native";
import { expect, it, jest } from "@jest/globals";
import { OfflineVoiceStatus } from "../../src/reader/components/OfflineVoiceStatus";
import { SleepTimerControl } from "../../src/reader/components/SleepTimerControl";
import { render_with_providers } from "../renderWithProviders";
import type { NotificationPlaybackState } from "../../src/playback/notificationPlayback";

const mockListeners = new Set<(state: Partial<NotificationPlaybackState>) => void>();
const mockPlayer = {
  get_state: () => ({}),
  voice_status: jest.fn(async (_voice: string | null) => ({ status: "unknown" })),
  open_voice_settings: jest.fn(async () => {}),
  set_sleep_timer: jest.fn(async (_seconds: number, _passage: boolean) => {}),
  stop: jest.fn(async () => {}),
  addListener: (_name: string, callback: (state: Partial<NotificationPlaybackState>) => void) => {
    mockListeners.add(callback);
    return { remove: () => mockListeners.delete(callback) };
  },
};
jest.mock("../../src/playback/notificationPlayback", () => ({ notification_player: () => mockPlayer }));
it.each(["network", "missing", "unknown", "offline"])(
  "shows the engine's %s capability rather than inferring it from a local-sounding name",
  async (status) => {
    mockPlayer.voice_status.mockResolvedValue({ status });
    await render_with_providers(<OfflineVoiceStatus voice="voice-local" />);
    expect(mockPlayer.voice_status).toHaveBeenCalledWith("voice-local");
    const copy = {
      network: /requires a network connection/,
      missing: /language data is missing/,
      unknown: /could not be verified/,
      offline: /device reports that this voice can work offline/,
    };
    expect(screen.getByText(copy[status as keyof typeof copy])).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Device voice settings" }));
    expect(mockPlayer.open_voice_settings).toHaveBeenCalled();
  },
);
it("sets and cancels a native timer without starting playback", async () => {
  await render_with_providers(<SleepTimerControl />);
  await fireEvent.press(screen.getByRole("button", { name: "Sleep timer" }));
  await fireEvent.press(screen.getByRole("button", { name: "30 minutes" }));
  expect(mockPlayer.set_sleep_timer).toHaveBeenLastCalledWith(1800, false);
  await act(async () => {
    for (const listener of mockListeners) listener({ sleepPassage: 4 });
  });
  await fireEvent.press(screen.getByRole("button", { name: "Active sleep timer. Change or cancel" }));
  await fireEvent.press(screen.getByRole("button", { name: "Cancel timer" }));
  expect(mockPlayer.set_sleep_timer).toHaveBeenLastCalledWith(0, false);
});
