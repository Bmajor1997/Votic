import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Alert, AlertButton, Linking } from "react-native";
import Settings from "../../app/(tabs)/settings";
import { loadOnboardingState } from "../../src/onboarding/onboardingStorage";
import { createFakeAuth, createFakeSubscriptions, entitlementOf } from "../mocks/accountServices";
import { renderWithProviders } from "../renderWithProviders";

async function settle() {
  for (let i = 0; i < 5; i += 1) await act(async () => {});
}

function setup(subscriptions = createFakeSubscriptions({ unavailableReason: "not-configured" })) {
  const auth = createFakeAuth({ signedIn: { email: "sam@example.com", firstName: "Sam", uid: "u1" } });
  return {
    auth,
    subscriptions,
    services: {
      auth: auth.service,
      subscriptions: subscriptions.service,
      legal: { termsUrl: null, privacyUrl: null },
    },
  };
}

describe("Account settings", () => {
  it("shows who is signed in", async () => {
    const { services } = setup();
    await renderWithProviders(<Settings />, { services });
    expect(screen.getByText("Sam · sam@example.com")).toBeTruthy();
  });

  it("signs out after confirmation", async () => {
    const { auth, services } = setup();
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderWithProviders(<Settings />, { services });
    await fireEvent.press(screen.getByRole("button", { name: "Sign Out" }));
    const buttons = alert.mock.calls[0][2] as AlertButton[];
    expect(alert.mock.calls[0][1]).toBe("Your documents and notes stay on this device.");
    await act(async () => buttons.find((button) => button.text === "Sign Out")!.onPress!());
    expect(auth.currentUid).toBeNull();
  });

  it("deletes the account only with the right password", async () => {
    const { auth, services } = setup();
    await renderWithProviders(<Settings />, { services });
    await fireEvent.press(screen.getByRole("button", { name: "Delete Account" }));
    await fireEvent.changeText(screen.getByLabelText("Password"), "wrong-pass1");
    await fireEvent.press(screen.getByRole("button", { name: "Delete My Account" }));
    await settle();
    expect(screen.getByText("That email and password don't match. Check them and try again.")).toBeTruthy();
    expect(auth.currentUid).toBe("u1");
    await fireEvent.changeText(screen.getByLabelText("Password"), "reading123");
    await fireEvent.press(screen.getByRole("button", { name: "Delete My Account" }));
    await settle();
    expect(auth.currentUid).toBeNull();
  });

  it("edits personalization later and saves only on Save", async () => {
    const { services } = setup();
    await renderWithProviders(<Settings />, { services });
    await fireEvent.press(screen.getByRole("button", { name: "Personalization" }));
    await fireEvent.press(screen.getByLabelText("Summarize long documents"));
    for (let step = 0; step < 4; step += 1)
      await fireEvent.press(screen.getByRole("button", { name: /Continue|Skip for now/ }));
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    await settle();
    expect((await loadOnboardingState("u1"))?.answers.goals).toEqual(["summarize"]);
  });

  it("shows subscription status and opens the store's management page", async () => {
    const subscriptions = createFakeSubscriptions({
      entitlements: {
        u1: entitlementOf("cancelled-active", {
          expiresAt: Date.UTC(2026, 10, 1),
          managementUrl: "https://apps.apple.com/account/subscriptions",
        }),
      },
    });
    const { services } = setup(subscriptions);
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await AsyncStorage.setItem("votic.mobile.device-history.v1", "new");
    await renderWithProviders(<Settings />, { services });
    await settle();
    expect(screen.getByText(/^Cancelled · access until/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Manage Subscription" }));
    expect(open).toHaveBeenCalledWith("https://apps.apple.com/account/subscriptions");
  });

  it("hides subscription controls when subscriptions aren't available", async () => {
    const { services } = setup();
    await renderWithProviders(<Settings />, { services });
    expect(screen.queryByRole("button", { name: "Manage Subscription" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Restore Purchases" })).toBeNull();
  });
});
