import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
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

it("waits for camera readiness, reads the native photo, and opens the OCR document", async () => {
  jest.mocked(scan_document_image).mockResolvedValue("A readable scanned page.");
  await render_with_providers(<ScanDocumentScreen />);
  expect(screen.getByRole("button", { name: "Take photo" }).props.accessibilityState.disabled).toBe(true);
  await act(async () => (cameraProps.at(-1)?.onCameraReady as () => void)());
  await fireEvent.press(screen.getByRole("button", { name: "Take photo" }));
  expect(mockTakePhoto).toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Use scan" }));
  expect(mockReadPhoto).toHaveBeenCalled();
  expect(scan_document_image).toHaveBeenCalledWith("scan-page-1.jpg", photoBytes, expect.any(AbortSignal));
  expect(router.replace).toHaveBeenCalledWith("/reader");
});
