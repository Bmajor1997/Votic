import { beforeEach, expect, it, jest } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import { NotificationPlaybackSync } from "../../src/playback/NotificationPlaybackSync";
import type { NotificationPlaybackState } from "../../src/playback/notificationPlayback";

let mockState: Partial<NotificationPlaybackState> = {};
let mockReceive: (state: Partial<NotificationPlaybackState>) => void = () => {};
const mockPlayer = {
  get_state: () => mockState,
  stop: jest.fn(async () => {}),
  addListener: (_event: string, listener: typeof mockReceive) => {
    mockReceive = listener;
    return { remove: jest.fn() };
  },
};
const mockLibrary = {
  loaded: true,
  documents: [{ id: "book", plainText: "One sentence. Second sentence." }],
  updateProgress: jest.fn(),
  completeDocument: jest.fn(),
};
jest.mock("../../src/documents/DocumentLibraryProvider", () => ({ useDocumentLibrary: () => mockLibrary }));
jest.mock("../../src/storage/AccountDataProvider", () => ({ useAccountData: () => ({ uid: "test-user" }) }));
jest.mock("../../src/subscription/SubscriptionProvider", () => ({
  useSubscription: () => ({ access: true }),
}));
jest.mock("../../src/playback/notificationPlayback", () => ({
  ...jest.requireActual<typeof import("../../src/playback/notificationPlayback")>(
    "../../src/playback/notificationPlayback",
  ),
  notification_player: () => mockPlayer,
}));
const state = {
  accountId: "test-user",
  documentId: "book",
  passageIndex: 1,
  wordIndex: 0,
  playing: false,
  completed: false,
};
beforeEach(() => {
  mockState = {};
  mockLibrary.updateProgress.mockClear();
  mockLibrary.completeDocument.mockClear();
  mockPlayer.stop.mockClear();
});

it("saves progress when the notification is paused without mounting the Reader", async () => {
  await render(<NotificationPlaybackSync />);
  await act(async () => mockReceive(state));
  expect(mockLibrary.updateProgress).toHaveBeenCalledWith("book", expect.any(Number), 1, 0);
  await act(async () => mockReceive({ ...state, completed: true, wordIndex: 1 }));
  expect(mockLibrary.completeDocument).toHaveBeenCalledWith("book", 1, 1);
});

it("resynchronizes the native position after JS was suspended and refuses another account", async () => {
  let change: (state: AppStateStatus) => void = () => {};
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, callback) => {
    change = callback;
    return { remove: jest.fn() };
  });
  await render(<NotificationPlaybackSync />);
  mockState = state;
  await act(async () => change("active"));
  expect(mockLibrary.updateProgress).toHaveBeenCalledWith("book", expect.any(Number), 1, 0);
  mockLibrary.updateProgress.mockClear();
  await act(async () => mockReceive({ ...state, accountId: "someone-else" }));
  expect(mockPlayer.stop).toHaveBeenCalled();
  expect(mockLibrary.updateProgress).not.toHaveBeenCalled();
});
