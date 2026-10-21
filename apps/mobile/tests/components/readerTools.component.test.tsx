import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { expect, it, jest } from "@jest/globals";
import * as Speech from "expo-speech";
import { Text } from "react-native";
import Reader from "../../app/reader";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { render_with_providers, test_document } from "../renderWithProviders";
import { router } from "../mocks/expoRouter";

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
function OpenedReader() {
  const { activeDocument } = useDocumentLibrary();
  return activeDocument ? (
    <>
      <Reader />
      <Text testID="saved-location">{`${activeDocument.sentenceIndex}/${activeDocument.wordIndex}/${activeDocument.progress}`}</Text>
    </>
  ) : null;
}
it("makes Listen available for an imported document without pushing a second Reader or starting narration", async () => {
  await render_with_providers(<OpenedReader />, { documents: [test_document("book", "Book")] });
  await fireEvent.press(screen.getByRole("tab", { name: "Listen" }));
  expect(router.setParams).toHaveBeenCalledWith({ mode: "listen", autoplay: "0" });
  expect(router.push).not.toHaveBeenCalled();
  expect(Speech.speak).not.toHaveBeenCalled();
});
it("finds and navigates matches while preserving the saved location and completion state", async () => {
  await render_with_providers(<OpenedReader />, {
    documents: [
      test_document("book", "Book", {
        plainText: "One target sentence.\n\nSecond target sentence.\n\nClosing sentence.",
        sentenceIndex: 1,
        wordIndex: 1,
        progress: 0.4,
      }),
    ],
  });
  const before = screen.getByTestId("saved-location").props.children;
  await fireEvent.press(screen.getByRole("button", { name: "Find within document" }));
  await fireEvent.changeText(screen.getByLabelText("Search document text"), "target");
  await act(async () => jest.advanceTimersByTime(200));
  await waitFor(() => expect(screen.getByText("1 of 2")).toBeTruthy());
  await fireEvent.press(screen.getByRole("button", { name: "Next match" }));
  expect(screen.getByText("2 of 2")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Previous match" }));
  expect(screen.getByText("1 of 2")).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText("Search document text"), "absent");
  await act(async () => jest.advanceTimersByTime(200));
  expect(screen.getByText("No results")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Close document search" }));
  expect(screen.queryByLabelText("Search document text")).toBeNull();
  expect(screen.getByTestId("saved-location").props.children).toBe(before);
  expect(Speech.speak).not.toHaveBeenCalled();
});
