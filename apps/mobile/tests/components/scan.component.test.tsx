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
  Paths: { cache: { uri: "file:///cache/" }, document: { uri: "file:///documents/" } },
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
jest.mock("../../src/documents/scanPhoto", () => ({
  rotate_scan_photo: jest.fn(async () => ({ uri: "file:///cache/rotated.jpg" })),
}));
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
  await fireEvent.press(screen.getByRole("button", { name: "Finish scan" }));
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
  await fireEvent.press(screen.getByRole("button", { name: "Finish scan" }));
  await waitFor(() =>
    expect(Alert.alert).toHaveBeenCalledWith("Could not read scan", "Page 2: Temporary failure"),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Finish scan" }));
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

it("asks to finish a saved scan review before paying to read new pages", async () => {
  const { Alert } = jest.requireActual<typeof import("react-native")>("react-native");
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const { store_ocr_review } = jest.requireActual<typeof import("../../src/documents/ocrReviewStorage")>(
    "../../src/documents/ocrReviewStorage",
  );
  await store_ocr_review("test-user", {
    id: "scan-review-saved",
    name: "Earlier scan.txt",
    pages: ["Earlier page."],
    playbackRate: 1,
    origin: "scan",
  });
  jest.mocked(scan_document_image).mockClear();
  await render_with_providers(<ScanDocumentScreen />);
  await act(async () => (cameraProps.at(-1)?.onCameraReady as () => void)());
  await fireEvent.press(screen.getByRole("button", { name: "Take photo" }));
  await fireEvent.press(screen.getByRole("button", { name: "Finish scan" }));
  await waitFor(() =>
    expect(alert).toHaveBeenCalledWith(
      "Finish your saved scan first",
      expect.stringMatching(/unfinished scan review/),
      expect.arrayContaining([expect.objectContaining({ text: "Resume review" })]),
    ),
  );
  expect(scan_document_image).not.toHaveBeenCalled();
  const resume = (alert.mock.calls.at(-1)?.[2] as { text: string; onPress?: () => void }[]).find(
    (button) => button.text === "Resume review",
  );
  await act(async () => resume?.onPress?.());
  expect((await screen.findByLabelText("Recognized text, page 1")).props.value).toBe("Earlier page.");
});

async function take_page(uri: string) {
  mockTakePhoto.mockResolvedValueOnce({ uri });
  await act(async () => (cameraProps.at(-1)?.onCameraReady as () => void)());
  await fireEvent.press(screen.getByRole("button", { name: "Take photo" }));
  await screen.findByRole("button", { name: "Finish scan" });
}
async function add_page(uri: string) {
  await fireEvent.press(screen.getByRole("button", { name: "Add another page" }));
  await take_page(uri);
}

it("collects, reorders, retakes and rotates pages, then saves one titled document", async () => {
  const { load_scan_draft } = jest.requireActual<typeof import("../../src/documents/scanDraftStorage")>(
    "../../src/documents/scanDraftStorage",
  );
  const { fakeScanPhotos } =
    jest.requireActual<typeof import("../mocks/scanDraftFiles")>("../mocks/scanDraftFiles");
  jest
    .mocked(scan_document_image)
    .mockReset()
    .mockResolvedValueOnce("Page three.")
    .mockResolvedValueOnce("Replacement page two.")
    .mockResolvedValueOnce("Page one.");
  await render_with_providers(<ScanDocumentScreen />);
  await take_page("file:///camera/one.jpg");
  await add_page("file:///camera/two.jpg");
  await add_page("file:///camera/three.jpg");
  await fireEvent.changeText(screen.getByLabelText("Scanned document title"), "My three-page notes");
  await fireEvent.press(screen.getByRole("button", { name: "Rotate page" }));
  await fireEvent.press(screen.getByRole("button", { name: "Move page earlier" }));
  await fireEvent.press(screen.getByRole("button", { name: "Move page earlier" }));
  await fireEvent.press(screen.getByRole("button", { name: "Select page 3" }));
  await fireEvent.press(screen.getByRole("button", { name: "Retake page" }));
  await take_page("file:///camera/replacement-two.jpg");
  await fireEvent.press(screen.getByRole("button", { name: "Move page earlier" }));
  const draft = await load_scan_draft("test-user");
  expect(draft?.title).toBe("My three-page notes");
  expect(draft?.pages.map((p) => fakeScanPhotos.get(`test-user:${p.id}`))).toEqual([
    "file:///cache/rotated.jpg",
    "file:///camera/replacement-two.jpg",
    "file:///camera/one.jpg",
  ]);
  await fireEvent.press(screen.getByRole("button", { name: "Finish scan" }));
  await screen.findByLabelText("Recognized text, page 1");
  // The durable OCR review takes over only after every page was recognized.
  expect(await load_scan_draft("test-user")).toBeNull();
  expect(fakeScanPhotos.size).toBe(0);
  await fireEvent.press(screen.getByRole("button", { name: "Save document" }));
  const { create_document_store } = jest.requireActual<typeof import("../../src/documents/documentStorage")>(
    "../../src/documents/documentStorage",
  );
  const documents = await create_document_store("test-user").loadDocuments();
  expect(documents).toHaveLength(1);
  expect(documents[0]).toMatchObject({
    title: "My three-page notes",
    plainText: "Page three.\n\nReplacement page two.\n\nPage one.",
    origin: "scan",
  });
});

it("resumes a partial scan after remount and retries only the failed page", async () => {
  const { Alert } = jest.requireActual<typeof import("react-native")>("react-native");
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  jest
    .mocked(scan_document_image)
    .mockReset()
    .mockResolvedValueOnce("First page saved.")
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce("Second page recovered.");
  const first = await render_with_providers(<ScanDocumentScreen />);
  await take_page("file:///camera/one.jpg");
  await add_page("file:///camera/two.jpg");
  await fireEvent.press(screen.getByRole("button", { name: "Finish scan" }));
  await waitFor(() => expect(alert).toHaveBeenCalledWith("Could not read scan", "Page 2: Offline"));
  await first.unmount();
  await render_with_providers(<ScanDocumentScreen />);
  expect(screen.getByRole("button", { name: "Select page 1" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Select page 2" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Finish scan" }));
  expect((await screen.findByLabelText("Recognized text, page 1")).props.value).toBe("First page saved.");
  expect(jest.mocked(scan_document_image).mock.calls.map((call) => call[0])).toEqual([
    "scan-page-1.jpg",
    "scan-page-2.jpg",
    "scan-page-2.jpg",
  ]);
});

it("does not silently drop a blank page and lets the user remove it", async () => {
  const { Alert } = jest.requireActual<typeof import("react-native")>("react-native");
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  jest.mocked(scan_document_image).mockReset().mockResolvedValueOnce("   ");
  await render_with_providers(<ScanDocumentScreen />);
  await take_page("file:///camera/blank.jpg");
  await fireEvent.press(screen.getByRole("button", { name: "Finish scan" }));
  await waitFor(() =>
    expect(alert).toHaveBeenCalledWith("Could not read scan", expect.stringContaining("No readable text")),
  );
  expect(screen.queryByRole("header", { name: "Review recognized text" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Remove page" }));
  const buttons = alert.mock.calls.at(-1)?.[2];
  await act(async () => buttons?.find((button) => button.text === "Remove")?.onPress?.());
  await screen.findByRole("button", { name: "Take photo" });
  expect(screen.queryByRole("button", { name: "Select page 1" })).toBeNull();
});
