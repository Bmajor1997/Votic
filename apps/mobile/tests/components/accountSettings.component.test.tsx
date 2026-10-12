import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo, Text } from "react-native";
import { router } from "expo-router";
import { SettingsDetailScreen } from "../../src/settings/SettingsDetails";
import * as backend from "../mocks/authBackend";
import { AppProviders, renderWithProviders, testDocument } from "../renderWithProviders";
import { createDocumentStore } from "../../src/documents/documentStorage";
import { legacyRecoveryAvailable } from "../../src/storage/accountStorage";

const AUTO_OWNER_KEY = "votic.mobile.legacy-library-auto-owner.v1";
function LibraryProbe() {
  const { documents } = useDocumentLibrary();
  return <Text testID="library-titles">{documents.map((document) => document.title).join("|")}</Text>;
}

function Settings() {
  return <SettingsDetailScreen category="account" />;
}

async function openDeletion() {
  await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
}
async function finalDeletion() {
  await openDeletion();
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
}
function failAction(action: "deleteAccount" | "signOut", failure: unknown) {
  const create = backend.createAuthBackend;
  jest.spyOn(backend, "createAuthBackend").mockImplementation(() => ({
    ...create(),
    [action]: async () => {
      throw failure;
    },
  }));
}

describe("Settings account management", () => {
  it("shows accessible identity, separate actions, and keeps membership and help navigation", async () => {
    const rendered = await renderWithProviders(<Settings />);
    expect(screen.getByText("reader@example.com")).toBeTruthy();
    expect(screen.getByRole("header", { name: "ACCOUNT ACCESS" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "ACCOUNT DELETION" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" }).props.accessibilityHint).toMatch(
      /Does not delete/,
    );
    expect(screen.getByRole("button", { name: "Delete account" }).props.accessibilityHint).toMatch(
      /Destructive/,
    );
    // Votic Premium is managed in the store account; the status comes from the store.
    expect(screen.getByRole("button", { name: "Votic Premium" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restore purchases" })).toBeTruthy();
    await rendered.rerender(
      <AppProviders>
        <SettingsDetailScreen category="reading" />
      </AppProviders>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Pronunciation dictionary" }));
    expect(router.push).toHaveBeenCalledWith("/pronunciations");
    await rendered.rerender(
      <AppProviders>
        <SettingsDetailScreen category="help" />
      </AppProviders>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Show tips again" }));
    expect(screen.getByText("Done. The Getting Started checklist is back on Home.")).toBeTruthy();
  });
  it("confirms sign out, allows cancellation, and calls only existing signOut", async () => {
    const doc = testDocument("saved", "Saved", {
      savedPassages: [
        { id: "note", text: "Passage", note: "My note", createdAt: 1, updatedAt: 1, sentenceIndex: 0 },
      ],
    });
    await renderWithProviders(<Settings />, { documents: [doc] });
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByRole("header", { name: "Sign out of Votic?" })).toBeTruthy();
    expect(backend.fakeAuth.calls).toEqual([]);
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(backend.fakeAuth.calls).toEqual([]);
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(backend.fakeAuth.calls).toEqual(["signOut"]);
    expect(backend.fakeAuth.user).toBeNull();
    expect(await createDocumentStore("test-user").loadDocuments()).toEqual([doc]);
  });
  it("does not delete on the first tap, Cancel, Continue, or Keep account", async () => {
    await renderWithProviders(<Settings />);
    const before = await AsyncStorage.getAllKeys();
    await openDeletion();
    expect(screen.getByRole("header", { name: "Before you delete your account" })).toBeTruthy();
    expect(screen.getByText(/does not cancel an App Store or Google Play subscription/)).toBeTruthy();
    expect(backend.fakeAuth.calls).toEqual([]);
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    await finalDeletion();
    expect(screen.getByRole("header", { name: "Permanently delete account?" })).toBeTruthy();
    expect(backend.fakeAuth.calls).toEqual([]);
    await fireEvent.press(screen.getByRole("button", { name: "Keep account" }));
    expect(backend.fakeAuth.calls).toEqual([]);
    expect(await AsyncStorage.getAllKeys()).toEqual(before);
    expect(backend.fakeAuth.user).not.toBeNull();
  });
  it("only final confirmation deletes through existing auth and preserves documents and notes", async () => {
    const doc = testDocument("saved", "Saved");
    await renderWithProviders(<Settings />, { documents: [doc] });
    await finalDeletion();
    await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
    expect(backend.fakeAuth.calls).toEqual(["deleteAccount"]);
    expect(backend.fakeAuth.user).toBeNull();
    expect(await createDocumentStore("test-user").loadDocuments()).toEqual([doc]);
  });
  it.each([
    ["auth/requires-recent-login", /sign back in using your usual sign-in method/],
    ["auth/network-request-failed", /Check your connection/],
    ["auth/too-many-requests", /Wait a few minutes/],
    ["unknown", /couldn't delete your account/],
  ])("handles deletion error %s without signing out or clearing data", async (code, message) => {
    failAction("deleteAccount", { code });
    const announcement = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    await renderWithProviders(<Settings />);
    await finalDeletion();
    await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
    expect(screen.getByRole("alert").props.children).toMatch(message);
    expect(announcement).toHaveBeenCalledWith(expect.stringMatching(message));
    expect(backend.fakeAuth.user).not.toBeNull();
    expect(backend.fakeAuth.calls).toEqual([]);
    await fireEvent.press(screen.getByRole("button", { name: "Keep account" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("shows a useful sign-out error and allows cancelling", async () => {
    failAction("signOut", new Error("provider detail"));
    await renderWithProviders(<Settings />);
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByRole("alert").props.children).toMatch(/couldn't sign you out/);
    expect(backend.fakeAuth.user).not.toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
  });
  it("disables confirmations and prevents repeat deletion while pending", async () => {
    let resolve!: () => void;
    const deletion = jest.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const create = backend.createAuthBackend;
    jest
      .spyOn(backend, "createAuthBackend")
      .mockImplementation(() => ({ ...create(), deleteAccount: deletion }));
    await renderWithProviders(<Settings />);
    await finalDeletion();
    await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
    expect(screen.getByRole("button", { name: "Delete account", disabled: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Keep account", disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
    expect(deletion).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
  });
  it("honors Reduce Motion and Android back cancels the request", async () => {
    await renderWithProviders(<Settings />, { reduceMotion: true });
    await openDeletion();
    const modal = screen.getByTestId("account-confirmation");
    expect(modal.props.animationType).toBe("none");
    await fireEvent(modal, "requestClose");
    expect(backend.fakeAuth.calls).toEqual([]);
    expect(screen.getByRole("button", { name: "Delete account" })).toBeTruthy();
  });
  it("does not offer account actions when signed out", async () => {
    backend.fakeAuth.reset(null);
    await renderWithProviders(<Settings />);
    expect(screen.getByText("Not signed in")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete account" })).toBeNull();
    // With no account, there's no subscription to manage or restore.
    expect(screen.queryByRole("button", { name: "Votic Premium" })).toBeNull();
  });
});

it("recovers an older device library only after the owner confirms, keeping current documents", async () => {
  const legacy = testDocument("legacy", "Older book", {
    savedPassages: [
      {
        id: "p",
        sentenceIndex: 0,
        text: "Older text",
        note: "Older private note",
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  });
  await createDocumentStore().saveDocuments([legacy]);
  // Nobody was signed in when this version first ran, so the older library waits for its owner to recover it.
  await AsyncStorage.setItem(AUTO_OWNER_KEY, JSON.stringify({ uid: null }));
  function Probe() {
    const { documents } = useDocumentLibrary();
    return <Text testID="recovery-library">{documents.map((document) => document.title).join("|")}</Text>;
  }
  await renderWithProviders(
    <>
      <Settings />
      <Probe />
    </>,
    { documents: [testDocument("current", "Current book")] },
  );
  expect(screen.getByTestId("recovery-library").props.children).toBe("Current book");
  await fireEvent.press(await screen.findByRole("button", { name: "Recover older device library" }));
  expect(screen.getByText(/Recover only if the older library/)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByTestId("recovery-library").props.children).toBe("Current book");
  await fireEvent.press(screen.getByRole("button", { name: "Recover older device library" }));
  await fireEvent.press(screen.getByRole("button", { name: "Recover my library" }));
  await waitFor(() =>
    expect(screen.getByTestId("recovery-library").props.children).toBe("Current book|Older book"),
  );
  expect(await createDocumentStore().loadDocuments()).toEqual([legacy]);
  expect(screen.queryByRole("button", { name: "Recover older device library" })).toBeNull();
  // The library reloads in place: Settings stays open instead of the whole app reloading.
  expect(screen.getByRole("button", { name: "Delete account" })).toBeTruthy();
});

it("moves the older library automatically into the account that was signed in when Votic updated", async () => {
  await createDocumentStore().saveDocuments([testDocument("legacy", "Older book")]);
  await renderWithProviders(<LibraryProbe />, { documents: [testDocument("current", "Current book")] });
  await waitFor(() =>
    expect(screen.getByTestId("library-titles").props.children).toBe("Current book|Older book"),
  );
  // Claimed by this account, so another account can't take it.
  expect(await legacyRecoveryAvailable("someone-else")).toBe(false);
});

it("lets the development account copy the older library without claiming it", async () => {
  backend.fakeAuth.reset({ uid: "development", email: null, displayName: null });
  await createDocumentStore().saveDocuments([testDocument("legacy", "Older book")]);
  await renderWithProviders(<LibraryProbe />);
  await waitFor(() => expect(screen.getByTestId("library-titles").props.children).toBe("Older book"));
  // A real account can still recover it later, and the development account doesn't copy it twice.
  await AsyncStorage.setItem(AUTO_OWNER_KEY, JSON.stringify({ uid: null }));
  expect(await legacyRecoveryAvailable("real-account")).toBe(true);
  expect(await legacyRecoveryAvailable("development")).toBe(false);
});
