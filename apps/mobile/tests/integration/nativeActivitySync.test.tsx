import { act, screen, waitFor } from "@testing-library/react-native";
import { expect, it, jest } from "@jest/globals";
import { Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useActivity, ACTIVITY_KEY } from "../../src/activity/ActivityProvider";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { create_document_store } from "../../src/documents/documentStorage";
import { NativeActivitySync } from "../../src/playback/NativeActivitySync";
import { account_storage_key } from "../../src/storage/accountStorage";
import { render_with_providers, test_document } from "../renderWithProviders";

const mockListeners = new Set<() => void>();
const mockStart = new Date(2026, 9, 21, 10).getTime();
let mockDuration = 10_000;
const mockPlayer = {
  get_state: () => ({}),
  activity_events: () => [
    {
      id: "speech-hour",
      accountId: "test-user",
      documentId: "book",
      start: mockStart,
      durationMs: mockDuration,
    },
  ],
  ack_activity: jest.fn(async () => {}),
  addListener: (_name: string, listener: () => void) => {
    mockListeners.add(listener);
    return { remove: () => mockListeners.delete(listener) };
  },
  stop: jest.fn(async () => {}),
};
jest.mock("../../src/playback/notificationPlayback", () => ({
  ...jest.requireActual<typeof import("../../src/playback/notificationPlayback")>(
    "../../src/playback/notificationPlayback",
  ),
  notification_player: () => mockPlayer,
}));
function Probe() {
  const { measuredLog } = useActivity();
  const { documents } = useDocumentLibrary();
  const total = Object.values(measuredLog.buckets)
    .flatMap(Object.values)
    .reduce((sum, split) => sum + split.listening, 0);
  return (
    <>
      <NativeActivitySync />
      <Text testID="measured">{total}</Text>
      <Text testID="document-time">
        {Object.values(documents[0]?.activity || {}).reduce((sum, day) => sum + day.listeningSeconds, 0)}
      </Text>
    </>
  );
}
it("persists native background speech in both production providers before acknowledging it", async () => {
  await render_with_providers(<Probe />, { documents: [test_document("book", "Book")] });
  await waitFor(() => expect(screen.getByTestId("measured").props.children).toBe(10_000));
  await waitFor(() => expect(mockPlayer.ack_activity).toHaveBeenCalled());
  expect(screen.getByTestId("document-time").props.children).toBe(10);
  const stored = await create_document_store("test-user").loadDocuments();
  expect(Object.values(stored[0].activity!)[0].listeningSeconds).toBe(10);
  const raw = JSON.parse((await AsyncStorage.getItem(account_storage_key(ACTIVITY_KEY, "test-user")))!);
  expect(raw.nativeCheckpoints["speech-hour"]).toBe(10_000);
  await act(async () => {
    for (const listener of mockListeners) listener();
  });
  expect(screen.getByTestId("measured").props.children).toBe(10_000);
  mockDuration = 12_500;
  await act(async () => {
    for (const listener of mockListeners) listener();
  });
  await waitFor(() => expect(screen.getByTestId("document-time").props.children).toBe(12.5));
  expect(screen.getByTestId("measured").props.children).toBe(12_500);
});
