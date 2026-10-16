import { beforeEach, expect, it, jest } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import { NotificationPlaybackSync } from "../../src/playback/NotificationPlaybackSync";
import type { NotificationPlaybackState } from "../../src/playback/notificationPlayback";

let mockState: Partial<NotificationPlaybackState> = {};
let mock_receive: (state: Partial<NotificationPlaybackState>) => void = () => {};
const mockPlayer = {
  get_state: () => mockState,
  stop: jest.fn(async () => {}),
  addListener: (_event: string, listener: typeof mock_receive) => {
    mock_receive = listener;
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
let mockSubscription = { access: true, checking: false };
jest.mock("../../src/subscription/SubscriptionProvider", () => ({
  useSubscription: () => mockSubscription,
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
  mockSubscription = { access: true, checking: false };
  mockLibrary.updateProgress.mockClear();
  mockLibrary.completeDocument.mockClear();
  mockPlayer.stop.mockClear();
});

it("saves progress when the notification is paused without mounting the Reader", async () => {
  await render(<NotificationPlaybackSync />);
  await act(async () => mock_receive(state));
  expect(mockLibrary.updateProgress).toHaveBeenCalledWith("book", expect.any(Number), 1, 0);
  await act(async () => mock_receive({ ...state, completed: true, wordIndex: 1 }));
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
  await act(async () => mock_receive({ ...state, accountId: "someone-else" }));
  expect(mockPlayer.stop).toHaveBeenCalled();
  expect(mockLibrary.updateProgress).not.toHaveBeenCalled();
});

it("keeps narrating while Premium is still being confirmed at launch, and stops once access is lost", async () => {
  // Opening Votic from the notification: the subscription check has not finished yet.
  mockSubscription = { access: false, checking: true };
  mockState = { ...state, playing: true };
  const view = await render(<NotificationPlaybackSync />);
  await act(async () => mock_receive({ ...state, playing: true }));
  expect(mockPlayer.stop).not.toHaveBeenCalled();
  expect(mockLibrary.updateProgress).not.toHaveBeenCalled();
  mockSubscription = { access: true, checking: false };
  await act(async () => view.rerender(<NotificationPlaybackSync />));
  expect(mockPlayer.stop).not.toHaveBeenCalled();
  mockSubscription = { access: false, checking: false };
  await act(async () => view.rerender(<NotificationPlaybackSync />));
  expect(mockPlayer.stop).toHaveBeenCalled();
});
