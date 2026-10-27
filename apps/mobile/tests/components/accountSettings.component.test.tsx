import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo, Linking, Text } from "react-native";
import { router } from "expo-router";
import { SettingsDetailScreen } from "../../src/settings/SettingsDetails";
import * as billing from "../mocks/subscriptionService";
import * as backend from "../mocks/authBackend";
import { entitlement_of, fakeSubscriptions } from "../mocks/subscriptionService";
import { AppProviders, render_with_providers, test_document } from "../renderWithProviders";
import { create_document_store } from "../../src/documents/documentStorage";
import { legacy_recovery_available } from "../../src/storage/accountStorage";
import { account_deletion_pending, notify_remote_account_deletion } from "../../src/storage/accountDeletion";

const AUTO_OWNER_KEY = "votic.mobile.legacy-library-auto-owner.v1";
function LibraryProbe() {
  const { documents } = useDocumentLibrary();
  return <Text testID="library-titles">{documents.map((document) => document.title).join("|")}</Text>;
}

function Settings() {
  return <SettingsDetailScreen category="account" />;
}

async function open_deletion() {
  await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
}
async function final_deletion() {
  await open_deletion();
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
}
function fail_action(action: "prepareDeleteAccount" | "deleteAccount" | "signOut", failure: unknown) {
  const create = backend.create_auth_backend;
  jest.spyOn(backend, "create_auth_backend").mockImplementation(() => ({
    ...create(),
    [action]: async () => {
      throw failure;
    },
  }));
}

describe("Settings account management", () => {
  it("keeps interrupted deletion retryable and never lets a late save restore erased data", async () => {
    let attempts = 0;
    const create = backend.create_auth_backend;
    jest.spyOn(backend, "create_auth_backend").mockImplementation(() => {
      const original = create();
      return {
        ...original,
        async deleteAccount(uid) {
          attempts += 1;
          if (attempts === 1) throw new Error("Backend deletion interrupted");
          await original.deleteAccount(uid);
        },
      };
    });
    await create_document_store("other-user").saveDocuments([
      test_document("other", "Other private document"),
    ]);
    await render_with_providers(<Settings />, { documents: [test_document("saved", "Private document")] });
    await final_deletion();
    await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
    expect(screen.getByRole("alert").props.children).toMatch(/Backend deletion interrupted/);
    expect(await account_deletion_pending("test-user")).toBe(true);
    expect(
      (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith("votic.mobile.account:test-user:")),
    ).toEqual([]);
    await create_document_store("test-user").saveDocuments([test_document("stale", "Stale result")]);
    expect(
      (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith("votic.mobile.account:test-user:")),
    ).toEqual([]);
    // A background response must not discard this device's pending Firebase-deletion step.
    await act(async () => notify_remote_account_deletion());
    expect(backend.fakeAuth.user?.uid).toBe("test-user");
    expect(await account_deletion_pending("test-user")).toBe(true);
    await fireEvent.press(screen.getByRole("button", { name: "Retry deletion" }));
    await waitFor(() => expect(backend.fakeAuth.user).toBeNull());
    await waitFor(async () => expect(await account_deletion_pending("test-user")).toBe(false));
    expect((await create_document_store("other-user").loadDocuments())[0].title).toBe(
      "Other private document",
    );
  });

  it("erases this device's data and finishes the Firebase deletion when another device started it", async () => {
    await render_with_providers(<Settings />, { documents: [test_document("saved", "Private document")] });
    await act(async () => notify_remote_account_deletion());
    await waitFor(() => expect(backend.fakeAuth.user).toBeNull());
    // Any device can remove a sign-in left behind when deletion stopped after the backend step.
    expect(backend.fakeAuth.calls).toEqual(["deleteAccount"]);
    expect(
      (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith("votic.mobile.account:test-user:")),
    ).toEqual([]);
    expect(await account_deletion_pending("test-user")).toBe(false);
  });

  it("signs out to retry later when this device's sign-in is too old to finish the deletion", async () => {
    fail_action(
      "deleteAccount",
      Object.assign(new Error("Sign in again"), { code: "auth/requires-recent-login" }),
    );
    await render_with_providers(<Settings />, { documents: [test_document("saved", "Private document")] });
    await act(async () => notify_remote_account_deletion());
    await waitFor(() => expect(backend.fakeAuth.user).toBeNull());
    expect(backend.fakeAuth.calls).toEqual(["signOut"]);
    expect(
      (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith("votic.mobile.account:test-user:")),
    ).toEqual([]);
    expect(await account_deletion_pending("test-user")).toBe(false);
  });
  it("shows accessible identity, separate actions, and keeps membership and help navigation", async () => {
    const rendered = await render_with_providers(<Settings />);
    expect(screen.getByText("reader@example.com")).toBeTruthy();
    expect(screen.getByRole("header", { name: "ACCOUNT ACCESS" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "ACCOUNT DELETION" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" }).props.accessibilityHint).toMatch(
      /Does not delete/,
    );
    expect(screen.getByRole("button", { name: "Delete account" }).props.accessibilityHint).toMatch(
      /Destructive/,
    );
    // Votic Plus is managed in the store account; the status comes from the store.
    expect(screen.getByRole("button", { name: "Votic Plus" })).toBeTruthy();
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
    expect(screen.getByText("Done. Reading tips will appear again as you use Votic.")).toBeTruthy();
  });
  it("confirms sign out, allows cancellation, and calls only existing signOut", async () => {
    const doc = test_document("saved", "Saved", {
      savedPassages: [
        { id: "note", text: "Passage", note: "My note", createdAt: 1, updatedAt: 1, sentenceIndex: 0 },
      ],
    });
    await render_with_providers(<Settings />, { documents: [doc] });
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByRole("header", { name: "Sign out?" })).toBeTruthy();
    expect(screen.getByText("Documents and notes saved on this device won't be deleted.")).toBeTruthy();
    // The confirmation and the row stay short: no session explanation.
    expect(
      screen.queryByText(/End this session|ends your current session|account remains active/),
    ).toBeNull();
    expect(backend.fakeAuth.calls).toEqual([]);
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(backend.fakeAuth.calls).toEqual([]);
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
    expect(backend.fakeAuth.calls).toEqual(["signOut"]);
    expect(backend.fakeAuth.user).toBeNull();
    expect(await create_document_store("test-user").loadDocuments()).toEqual([doc]);
  });
  it("does not delete on the first tap, Cancel, Continue, or Keep account", async () => {
    await render_with_providers(<Settings />);
    const before = await AsyncStorage.getAllKeys();
    await open_deletion();
    expect(screen.getByRole("header", { name: "Before you delete your account" })).toBeTruthy();
    expect(screen.getByText(/does not cancel an App Store or Google Play subscription/)).toBeTruthy();
    expect(backend.fakeAuth.calls).toEqual([]);
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    await final_deletion();
    expect(screen.getByRole("header", { name: "Permanently delete account?" })).toBeTruthy();
    expect(backend.fakeAuth.calls).toEqual([]);
    await fireEvent.press(screen.getByRole("button", { name: "Keep account" }));
    expect(backend.fakeAuth.calls).toEqual([]);
    expect(await AsyncStorage.getAllKeys()).toEqual(before);
    expect(backend.fakeAuth.user).not.toBeNull();
  });
  it("only final confirmation deletes the account and erases its documents and notes", async () => {
    const doc = test_document("saved", "Saved");
    await render_with_providers(<Settings />, { documents: [doc] });
    await final_deletion();
    await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
    expect(backend.fakeAuth.calls).toEqual(["deleteAccount"]);
    expect(backend.fakeAuth.user).toBeNull();
    expect(await create_document_store("test-user").loadDocuments()).toEqual([]);
  });
  it.each([
    ["auth/requires-recent-login", /sign back in using your usual sign-in method/],
    ["auth/network-request-failed", /Check your connection/],
    ["auth/too-many-requests", /Wait a few minutes/],
    ["unknown", /couldn't delete your account/],
  ])("handles deletion error %s without signing out or clearing data", async (code, message) => {
    fail_action("prepareDeleteAccount", { code });
    const announcement = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    await render_with_providers(<Settings />);
    await final_deletion();
    await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
    expect(screen.getByRole("alert").props.children).toMatch(message);
    expect(announcement).toHaveBeenCalledWith(expect.stringMatching(message));
    expect(backend.fakeAuth.user).not.toBeNull();
    expect(backend.fakeAuth.calls).toEqual([]);
    await fireEvent.press(screen.getByRole("button", { name: "Keep account" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("shows a useful sign-out error and allows cancelling", async () => {
    fail_action("signOut", new Error("provider detail"));
    await render_with_providers(<Settings />);
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
    const create = backend.create_auth_backend;
    jest
      .spyOn(backend, "create_auth_backend")
      .mockImplementation(() => ({ ...create(), deleteAccount: deletion }));
    await render_with_providers(<Settings />);
    await final_deletion();
    await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
    expect(screen.getByRole("button", { name: "Delete account", disabled: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Keep account", disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
    expect(deletion).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
  });
  it("honors Reduce Motion and Android back cancels the request", async () => {
    await render_with_providers(<Settings />, { reduceMotion: true });
    await open_deletion();
    const modal = screen.getByTestId("account-confirmation");
    expect(modal.props.animationType).toBe("none");
    await fireEvent(modal, "requestClose");
    expect(backend.fakeAuth.calls).toEqual([]);
    expect(screen.getByRole("button", { name: "Delete account" })).toBeTruthy();
  });
  it("does not offer account actions when signed out", async () => {
    backend.fakeAuth.reset(null);
    await render_with_providers(<Settings />);
    expect(screen.getByText("Not signed in")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete account" })).toBeNull();
    // With no account, there's no subscription to manage or restore.
    expect(screen.queryByRole("button", { name: "Votic Plus" })).toBeNull();
  });
});

it("recovers an older device library only after the owner confirms, keeping current documents", async () => {
  const legacy = test_document("legacy", "Older book", {
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
  await create_document_store().saveDocuments([legacy]);
  // Nobody was signed in when this version first ran, so the older library waits for its owner to recover it.
  await AsyncStorage.setItem(AUTO_OWNER_KEY, JSON.stringify({ uid: null }));
  function Probe() {
    const { documents } = useDocumentLibrary();
    return <Text testID="recovery-library">{documents.map((document) => document.title).join("|")}</Text>;
  }
  await render_with_providers(
    <>
      <Settings />
      <Probe />
    </>,
    { documents: [test_document("current", "Current book")] },
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
  expect(await create_document_store().loadDocuments()).toEqual([legacy]);
  expect(screen.queryByRole("button", { name: "Recover older device library" })).toBeNull();
  // The library reloads in place: Settings stays open instead of the whole app reloading.
  expect(screen.getByRole("button", { name: "Delete account" })).toBeTruthy();
});

it("moves the older library automatically into the account that was signed in when Votic updated", async () => {
  await create_document_store().saveDocuments([test_document("legacy", "Older book")]);
  await render_with_providers(<LibraryProbe />, { documents: [test_document("current", "Current book")] });
  await waitFor(() =>
    expect(screen.getByTestId("library-titles").props.children).toBe("Current book|Older book"),
  );
  // Claimed by this account, so another account can't take it.
  expect(await legacy_recovery_available("someone-else")).toBe(false);
});

it("lets the development account copy the older library without claiming it", async () => {
  backend.fakeAuth.reset({ uid: "development", email: null, displayName: null });
  await create_document_store().saveDocuments([test_document("legacy", "Older book")]);
  await render_with_providers(<LibraryProbe />);
  await waitFor(() => expect(screen.getByTestId("library-titles").props.children).toBe("Older book"));
  // A real account can still recover it later, and the development account doesn't copy it twice.
  await AsyncStorage.setItem(AUTO_OWNER_KEY, JSON.stringify({ uid: null }));
  expect(await legacy_recovery_available("real-account")).toBe(true);
  expect(await legacy_recovery_available("development")).toBe(false);
});

it("explains why a test build without Votic accounts has no Delete account option", async () => {
  backend.fakeAuth.configured = false;
  await render_with_providers(<Settings />);
  expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Delete account" })).toBeNull();
  expect(screen.getByText(/isn't connected to Votic accounts, so there's no account to delete/)).toBeTruthy();
});

it("offers Delete account wherever Votic sign-in is configured", async () => {
  await render_with_providers(<Settings />);
  expect(screen.getByRole("button", { name: "Delete account" })).toBeTruthy();
  expect(screen.queryByText(/isn't connected to Votic accounts/)).toBeNull();
});

describe("switching Votic Plus billing", () => {
  const month = {
    id: "$rc_monthly",
    productId: "plus:monthly",
    priceString: "$9.99",
    billingPeriod: { count: 1, unit: "month" as const },
    trial: null,
  };
  const year = {
    ...month,
    id: "$rc_annual",
    productId: "plus:annual",
    priceString: "$79.99",
    billingPeriod: { count: 1, unit: "year" as const },
  };
  it("offers the other billing period through the store's change flow, never a second purchase", async () => {
    fakeSubscriptions.reset({
      plans: [month, year],
      defaultEntitlement: entitlement_of("active", { productId: "plus:monthly" }),
    });
    await render_with_providers(<SettingsDetailScreen category="account" />);
    expect(await screen.findByText(/Annual billing is \$79\.99\/year/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Switch to annual billing" }));
    expect(fakeSubscriptions.calls).toContain("changePlan:$rc_annual:from:plus:monthly");
    expect(fakeSubscriptions.calls.some((call) => call.startsWith("purchase:"))).toBe(false);
    expect(screen.getByText(/You're on annual billing\. Your monthly AI allowance continues/)).toBeTruthy();
  });
  it("offers monthly to an annual subscriber, starting at the end of the annual period", async () => {
    fakeSubscriptions.reset({
      plans: [month, year],
      defaultEntitlement: entitlement_of("active", { productId: "plus:annual" }),
    });
    await render_with_providers(<SettingsDetailScreen category="account" />);
    expect(
      await screen.findByText(
        /Monthly billing is \$9\.99\/month\. It starts when your current annual period ends/,
      ),
    ).toBeTruthy();
    fakeSubscriptions.nextPurchase = { kind: "cancelled" };
    await fireEvent.press(screen.getByRole("button", { name: "Switch to monthly billing" }));
    expect(screen.queryByText(/Monthly billing starts when/)).toBeNull();
  });
  it("offers no switch without an active subscription or a known product", async () => {
    for (const entitlement of [
      entitlement_of("expired", { productId: "plus:monthly" }),
      entitlement_of("active"),
    ]) {
      fakeSubscriptions.reset({ plans: [month, year], defaultEntitlement: entitlement });
      const rendered = await render_with_providers(<SettingsDetailScreen category="account" />);
      expect(screen.queryByRole("button", { name: /^Switch to / })).toBeNull();
      await rendered.unmount();
    }
  });
});

describe("Settings store failures", () => {
  it("reports a failed subscription-management link and allows retry", async () => {
    const open = jest.spyOn(Linking, "openURL").mockRejectedValueOnce(new Error("No store available"));
    await render_with_providers(<Settings />);
    await fireEvent.press(screen.getByRole("button", { name: "Votic Plus" }));
    expect(screen.getByText(/Could not open subscription settings/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Votic Plus" }));
    expect(open).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/Could not open subscription settings/)).toBeNull();
  });
  it("handles an unexpected restore failure and leaves restore retryable", async () => {
    fakeSubscriptions.throwNext = "restore";
    await render_with_providers(<Settings />);
    await fireEvent.press(screen.getByRole("button", { name: "Restore purchases" }));
    expect(screen.getByText(/couldn't reach the store/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Restore purchases" }));
    expect(screen.getByText("Your Votic Plus subscription is active.")).toBeTruthy();
  });
  it("disables repeat restores while the store is pending and discards late results after unmount", async () => {
    let finish!: (value: ReturnType<typeof entitlement_of>) => void;
    const restore = jest.fn(
      () =>
        new Promise<ReturnType<typeof entitlement_of>>((resolve) => {
          finish = resolve;
        }),
    );
    const create = billing.create_subscription_service;
    jest.spyOn(billing, "create_subscription_service").mockImplementation(() => ({ ...create(), restore }));
    const rendered = await render_with_providers(<Settings />);
    await fireEvent.press(screen.getByRole("button", { name: "Restore purchases" }));
    expect(screen.getByRole("button", { name: "Restore purchases", disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Restore purchases" }));
    expect(restore).toHaveBeenCalledTimes(1);
    await rendered.unmount();
    await act(async () => finish(entitlement_of("active")));
  });
});
