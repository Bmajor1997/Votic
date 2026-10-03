import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import * as DocumentPicker from "expo-document-picker";
import { Alert } from "react-native";
import Documents from "../../app/(tabs)/documents";
import { extractDocument } from "../../src/api/voticApi";
import { renderWithProviders } from "../renderWithProviders";

jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("../../src/api/voticApi", () => ({ extractDocument: jest.fn() }));
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
    await renderWithProviders(<Documents />);
    await fireEvent.press(screen.getByRole("button", { name: "Add document" }));
    await fireEvent.press(screen.getByRole("button", { name: "Choose file or cloud storage" }));
    // The Documents page explains the failure in place, with a way to try again.
    expect(await screen.findByText("Couldn't add big.pdf")).toBeTruthy();
    expect(screen.getByText("Document is too large. The current limit is 25 MB.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose another file" })).toBeTruthy();
    expect(alert).not.toHaveBeenCalled();
    expect(extractDocument).not.toHaveBeenCalled();
  });
});
