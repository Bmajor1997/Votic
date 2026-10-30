import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Alert, Linking } from "react-native";
import { SettingsDetailScreen } from "../../src/settings/SettingsDetails";
import { create_document_store } from "../../src/documents/documentStorage";
import { render_with_providers, test_document } from "../renderWithProviders";
import { router } from "../mocks/expoRouter";
import { fakeSubscriptions } from "../mocks/subscriptionService";
import * as files from "../../src/storage/storageUsageFiles";

jest.mock("../../src/storage/storageUsageFiles", () => ({
  read_scan_photo_usage: jest.fn(async () => 500),
  read_temporary_usage: jest.fn(() => ({ bytes: 2000, clearableBytes: 1000 })),
  clear_old_temporary_files: jest.fn(),
}));

describe("Settings support and library tools", () => {
  it("opens an email draft and shows the address if no mail app is available", async () => {
    const open = jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no email app"));
    await render_with_providers(<SettingsDetailScreen category="support" />);
    await fireEvent.press(screen.getByRole("button", { name: "Email support" }));
    expect(open).toHaveBeenCalledWith("mailto:votic.support@gmail.com?subject=Votic%20support");
    expect(await screen.findByRole("alert")).toHaveTextContent(/Could not open your email app/);
    expect(screen.getByText(/You can also write to votic.support@gmail.com/).props.selectable).toBe(true);
  });
  it("uses configured legal destinations and existing diagnostic consent", async () => {
    fakeSubscriptions.legal = {
      privacyUrl: "https://example.com/privacy",
      termsUrl: "https://example.com/terms",
    };
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    await render_with_providers(<SettingsDetailScreen category="privacy" />);
    await fireEvent.press(screen.getByRole("link", { name: "Privacy Policy" }));
    await fireEvent.press(screen.getByRole("link", { name: "Terms of Service" }));
    expect(open).toHaveBeenCalledWith("https://example.com/privacy");
    expect(open).toHaveBeenCalledWith("https://example.com/terms");
    expect(screen.getByRole("switch", { name: "Share failure counts" })).toBeTruthy();
  });
  it.each([
    ["Library backup & restore", "/library-backup"],
    ["Recently Deleted", "/recently-deleted"],
    ["Note drafts", "/note-drafts"],
  ])("opens %s from Library tools", async (label, path) => {
    await render_with_providers(<SettingsDetailScreen category="library" />);
    await fireEvent.press(screen.getByRole("button", { name: label }));
    expect(router.push).toHaveBeenCalledWith(path);
    expect(screen.getByRole("button", { name: "Unfinished scan" })).toBeTruthy();
  });
  it("measures only the current account and requires confirmation before clearing temporary files", async () => {
    jest.mocked(files.clear_old_temporary_files).mockClear();
    await create_document_store("other-user").saveDocuments([
      test_document("private", "Other account private"),
    ]);
    await render_with_providers(<SettingsDetailScreen category="storage" />, {
      documents: [test_document("one", "My saved document")],
    });
    expect(await screen.findByText("My saved document")).toBeTruthy();
    expect(screen.queryByText("Other account private")).toBeNull();
    const alert = jest.spyOn(Alert, "alert");
    await fireEvent.press(screen.getByRole("button", { name: "Clear old temporary files" }));
    expect(files.clear_old_temporary_files).not.toHaveBeenCalled();
    const actions = alert.mock.calls[0][2]!;
    expect(actions[0].text).toBe("Cancel");
    await act(async () => {
      actions[1].onPress?.();
    });
    await waitFor(() => expect(files.clear_old_temporary_files).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Old temporary files cleared/)).toBeTruthy();
    expect((await create_document_store("test-user").loadDocuments())[0].title).toBe("My saved document");
    expect((await create_document_store("other-user").loadDocuments())[0].title).toBe(
      "Other account private",
    );
  });
  it("shows unavailable cache measurement and disables cleanup when it cannot be measured", async () => {
    jest.mocked(files.read_temporary_usage).mockImplementationOnce(() => {
      throw new Error("Cannot measure");
    });
    await render_with_providers(<SettingsDetailScreen category="storage" />);
    expect(await screen.findByText("Saved account data")).toBeTruthy();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Clear old temporary files" })).toBeDisabled();
  });
});
