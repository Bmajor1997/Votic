import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { scan_document_image } from "../../src/api/voticApi";
import { router } from "../mocks/expoRouter";
import ScanDocumentScreen from "../../app/scan";
import { render_with_providers } from "../renderWithProviders";

const photoBytes = new ArrayBuffer(8);
const mockReadPhoto = jest.fn(async () => photoBytes);
const mockTakePhoto = jest.fn(async () => ({ uri: "file:///camera/page.jpg" }));
jest.mock("expo-file-system", () => ({
  File: jest.fn(() => ({ exists: true, size: 8, arrayBuffer: mockReadPhoto })),
}));
const cameraProps: Record<string, unknown>[] = [];
jest.mock("expo-camera", () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual<typeof import("react")>("react");
  const { View: MockView } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    useCameraPermissions: () => [{ granted: true }, jest.fn()],
    CameraView: forwardRef((props: Record<string, unknown>, ref) => {
      useImperativeHandle(ref, () => ({ takePictureAsync: mockTakePhoto }));
      cameraProps.push(props);
      return <MockView testID="scan-camera" />;
    }),
  };
});
jest.mock("../../src/api/voticApi", () => ({ scan_document_image: jest.fn() }));

describe("document scanner", () => {
  it("never flashes the screen when a photo is taken", async () => {
    await render_with_providers(<ScanDocumentScreen />);
    expect(screen.getByTestId("scan-camera")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Take photo" })).toBeTruthy();
    // expo-camera's default shutter animation flashes the whole screen, a photosensitivity risk.
    expect(cameraProps.at(-1)?.animateShutter).toBe(false);
  });
});

it("waits for camera readiness and reviews/corrects OCR before opening its saved document", async () => {
  jest.mocked(scan_document_image).mockResolvedValue("A readable scanned page.");
  await render_with_providers(<ScanDocumentScreen />);
  expect(screen.getByRole("button", { name: "Take photo" }).props.accessibilityState.disabled).toBe(true);
  await act(async () => (cameraProps.at(-1)?.onCameraReady as () => void)());
  await fireEvent.press(screen.getByRole("button", { name: "Take photo" }));
  expect(mockTakePhoto).toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Review scan text" }));
  expect(mockReadPhoto).toHaveBeenCalled();
  expect(scan_document_image).toHaveBeenCalledWith("scan-page-1.jpg", photoBytes, expect.any(AbortSignal));
  expect(router.replace).not.toHaveBeenCalled();
  expect(await screen.findByRole("header", { name: "Review recognized text" })).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText("Recognized text, page 1"), "Corrected recognized page.");
  await fireEvent.press(screen.getByRole("button", { name: "Save document" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/reader"));
  expect(scan_document_image).toHaveBeenCalledTimes(1);
});

it("keeps page order and successful OCR work after a recoverable failure, without paying to reread that page", async () => {
  const { Alert } = jest.requireActual<typeof import("react-native")>("react-native");
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  jest
    .mocked(scan_document_image)
    .mockClear()
    .mockResolvedValueOnce("First captured page.")
    .mockRejectedValueOnce(new Error("Temporary failure"))
    .mockResolvedValueOnce("Second captured page.");
  mockTakePhoto
    .mockResolvedValueOnce({ uri: "file:///camera/first.jpg" })
    .mockResolvedValueOnce({ uri: "file:///camera/second.jpg" });
  await render_with_providers(<ScanDocumentScreen />);
  await act(async () => (cameraProps.at(-1)?.onCameraReady as () => void)());
  await fireEvent.press(screen.getByRole("button", { name: "Take photo" }));
  await fireEvent.press(screen.getByRole("button", { name: "Add another page" }));
  await act(async () => (cameraProps.at(-1)?.onCameraReady as () => void)());
  await fireEvent.press(screen.getByRole("button", { name: "Take photo" }));
  await fireEvent.press(screen.getByRole("button", { name: "Review scan text" }));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Could not read scan", "Temporary failure"));
  await fireEvent.press(screen.getByRole("button", { name: "Review scan text" }));
  expect((await screen.findByLabelText("Recognized text, page 1")).props.value).toBe("First captured page.");
  await fireEvent.press(screen.getByRole("button", { name: "Next page" }));
  expect(screen.getByLabelText("Recognized text, page 2").props.value).toBe("Second captured page.");
  await fireEvent.changeText(screen.getByLabelText("Recognized text, page 2"), "Corrected second page.");
  await fireEvent.press(screen.getByRole("button", { name: "Save document" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/reader"));
  expect(jest.mocked(scan_document_image).mock.calls.map((call) => call[0])).toEqual([
    "scan-page-1.jpg",
    "scan-page-2.jpg",
    "scan-page-2.jpg",
  ]);
  const { create_document_store } = jest.requireActual<typeof import("../../src/documents/documentStorage")>(
    "../../src/documents/documentStorage",
  );
  expect((await create_document_store("test-user").loadDocuments())[0].plainText).toBe(
    "First captured page.\n\nCorrected second page.",
  );
});
