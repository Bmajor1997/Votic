import { beforeEach, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import Reader from "../../app/reader";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import type { NotificationPlaybackState } from "../../src/playback/notificationPlayback";
import { fakeAuth } from "../mocks/authBackend";
import { searchParams, router } from "../mocks/expoRouter";
import { render_with_providers, test_document } from "../renderWithProviders";

const mockListeners = new Set<(state: Partial<NotificationPlaybackState>) => void>();
let mockState: Partial<NotificationPlaybackState> = {};
const mockPlayer = {
  start: jest.fn(async (_payload: string) => {}),
  pause: jest.fn(async () => {}),
  stop: jest.fn(async () => {}),
  get_state: () => mockState,
  addListener: (_event: string, listener: (state: Partial<NotificationPlaybackState>) => void) => {
    mockListeners.add(listener);
    return { remove: () => mockListeners.delete(listener) };
  },
};
jest.mock("../../src/playback/notificationPlayback", () => ({
  ...jest.requireActual<typeof import("../../src/playback/notificationPlayback")>(
    "../../src/playback/notificationPlayback",
  ),
  notification_player: () => mockPlayer,
}));
jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock("../../src/api/voticApi", () => ({ ask_votic: jest.fn() }));

const document = test_document("native-book", "Field guide", {
  plainText: "First passage here. Second passage there. Third passage ends.",
});
function OpenedReader() {
  const library = useDocumentLibrary();
  return library.activeDocument ? <Reader /> : null;
}
async function state_change(state: Partial<NotificationPlaybackState>) {
  mockState = state;
  await act(async () => mockListeners.forEach((listener) => listener(state)));
}
const playing = {
  accountId: "test-user",
  documentId: "native-book",
  title: "Field guide",
  passageIndex: 0,
  wordIndex: 0,
  playing: true,
  completed: false,
  error: null,
};
beforeEach(() => {
  mockState = {};
  mockListeners.clear();
  mockPlayer.start.mockClear();
  mockPlayer.pause.mockClear();
  mockPlayer.stop.mockClear();
  jest.mocked(Speech.speak).mockClear();
  searchParams.current = { mode: "listen" };
});

it("starts the full native queue, handles external next/pause, and keeps narration when the Reader closes", async () => {
  await render_with_providers(<OpenedReader />, { documents: [document], reduceMotion: true });
  await fireEvent.press(screen.getByRole("button", { name: "Play" }));
  await waitFor(() => expect(mockPlayer.start).toHaveBeenCalled());
  const payload = JSON.parse(mockPlayer.start.mock.calls[0][0]);
  expect(payload).toMatchObject({ accountId: "test-user", documentId: "native-book", passageIndex: 0 });
  expect(payload.passages).toHaveLength(3);
  expect(Speech.speak).not.toHaveBeenCalled();
  await state_change({ ...playing, passageIndex: 1, wordIndex: 1 });
  expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Pause" }));
  expect(mockPlayer.pause).toHaveBeenCalled();
  await state_change({ ...playing, passageIndex: 1 });
  mockPlayer.pause.mockClear();
  await fireEvent.press(screen.getByRole("button", { name: "Close reader" }));
  expect(router.back).toHaveBeenCalled();
  expect(mockPlayer.pause).not.toHaveBeenCalled();
  expect(mockPlayer.stop).not.toHaveBeenCalled();
});

it("stops native playback on sign-out so another account cannot control or hear the old document", async () => {
  await render_with_providers(<OpenedReader />, { documents: [document], reduceMotion: true });
  await state_change(playing);
  mockPlayer.stop.mockClear();
  await act(async () => fakeAuth.setUser(null));
  expect(mockPlayer.stop).toHaveBeenCalled();
});

it("keeps the interrupted position and waits for an explicit Play after external audio pauses narration", async () => {
  await render_with_providers(<OpenedReader />, { documents: [document], reduceMotion: true });
  await state_change({ ...playing, passageIndex: 1, wordIndex: 2 });
  await state_change({ ...playing, passageIndex: 1, wordIndex: 2, playing: false });
  expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  expect(mockPlayer.start).not.toHaveBeenCalled();
  // A later refresh of the paused native session must not restart the queue.
  await state_change({ ...playing, passageIndex: 1, wordIndex: 2, playing: false });
  expect(mockPlayer.start).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Play" }));
  await waitFor(() => expect(mockPlayer.start).toHaveBeenCalledTimes(1));
  expect(JSON.parse(mockPlayer.start.mock.calls[0][0])).toMatchObject({ passageIndex: 1, wordIndex: 2 });
});
