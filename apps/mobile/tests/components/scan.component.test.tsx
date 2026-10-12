import { describe, expect, it, jest } from "@jest/globals";
import { screen } from "@testing-library/react-native";
import ScanDocumentScreen from "../../app/scan";
import { render_with_providers } from "../renderWithProviders";

const cameraProps: Record<string, unknown>[] = [];
jest.mock("expo-camera", () => {
  const { forwardRef } = jest.requireActual<typeof import("react")>("react");
  const { View: MockView } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    useCameraPermissions: () => [{ granted: true }, jest.fn()],
    CameraView: forwardRef((props: Record<string, unknown>, _ref) => {
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
