import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as DocumentPicker from "expo-document-picker";
import { Alert, StyleSheet } from "react-native";
import Documents from "../../app/(tabs)/documents";
import { extract_document } from "../../src/api/voticApi";
import { router } from "../mocks/expoRouter";
import { create_document_store } from "../../src/documents/documentStorage";
import { render_with_providers } from "../renderWithProviders";

jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("../../src/api/voticApi", () => ({ extract_document: jest.fn() }));
const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

describe("document import", () => {
  it("rejects a document that is too large even when the picker reports no size", async () => {
    jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({
      canceled: false,
      assets: [{ name: "big.pdf", uri: "file:///big.pdf", mimeType: "application/pdf", lastModified: 1 }],
    } as DocumentPicker.DocumentPickerResult);
    global.fetch = jest.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(26_000_000),
    })) as unknown as typeof fetch;
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render_with_providers(<Documents />);
    await fireEvent.press(screen.getByRole("button", { name: "Add document" }));
    await fireEvent.press(screen.getByRole("button", { name: "Choose file or cloud storage" }));
    // The Documents page explains the failure in place, with a way to try again.
    expect(await screen.findByText("Couldn't add big.pdf")).toBeTruthy();
    expect(screen.getByText("Document is too large. The current limit is 25 MB.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose another file" })).toBeTruthy();
    expect(alert).not.toHaveBeenCalled();
    expect(extract_document).not.toHaveBeenCalled();
  });
});

it("keeps import choices scrollable with bottom safe-area clearance and working destinations", async () => {
  await render_with_providers(<Documents />);
  await fireEvent.press(screen.getByRole("button", { name: "Add document" }));
  expect(screen.getByTestId("document-import-options")).toBeTruthy();
  expect(
    StyleSheet.flatten(screen.getByTestId("document-import-sheet").props.style).paddingBottom,
  ).toBeGreaterThan(34);
  expect(screen.getByRole("button", { name: "Import webpage" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Scan with camera" }));
  expect(router.push).toHaveBeenLastCalledWith("/scan");
  await fireEvent.press(screen.getByRole("button", { name: "Add document" }));
  await fireEvent.press(screen.getByRole("button", { name: "Import webpage" }));
  expect(router.push).toHaveBeenLastCalledWith("/import-web");
});

it("finishes the import even though the Android file picker sends Votic to the background", async () => {
  const { AppState } = jest.requireActual<typeof import("react-native")>("react-native");
  const appState = (state: string) => {
    for (const [event, listener] of jest.mocked(AppState.addEventListener).mock.calls)
      if (event === "change") (listener as (next: string) => void)(state);
  };
  // While the system picker is open Android reports "background", then "active" once a file is chosen.
  jest.mocked(DocumentPicker.getDocumentAsync).mockImplementation(async () => {
    appState("background");
    appState("active");
    return {
      canceled: false,
      assets: [
        { name: "notes.txt", uri: "file:///notes.txt", mimeType: "text/plain", size: 40, lastModified: 1 },
      ],
    } as DocumentPicker.DocumentPickerResult;
  });
  global.fetch = jest.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new TextEncoder().encode("Chapter one. The picker came and went.").buffer,
  })) as unknown as typeof fetch;
  await render_with_providers(<Documents />);
  await fireEvent.press(screen.getByRole("button", { name: "Add document" }));
  await fireEvent.press(screen.getByRole("button", { name: "Choose file or cloud storage" }));
  await waitFor(async () =>
    expect((await create_document_store("test-user").loadDocuments()).map((d) => d.plainText)).toEqual([
      "Chapter one. The picker came and went.",
    ]),
  );
  expect(screen.queryByText(/Couldn't add/)).toBeNull();
});
