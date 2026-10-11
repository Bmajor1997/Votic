import { it, expect } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import Paywall from "../../app/paywall";
import AccountManagement from "../../app/account";
import { fakeAuth } from "../mocks/authBackend";
import { entitlementOf, fakeSubscriptions } from "../mocks/subscriptionService";
import { router } from "../mocks/expoRouter";
import { renderWithProviders } from "../renderWithProviders";
import { loadAccountPreferences } from "../../src/onboarding/accountPreferences";

it("an expired subscriber can reach account management from the paywall and delete with both confirmations", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlementOf("expired") });
  const rendered = await renderWithProviders(<Paywall />);
  await fireEvent.press(screen.getByRole("button", { name: "Manage account" }));
  expect(router.push).toHaveBeenCalledWith("/account");
  await rendered.unmount();
  await renderWithProviders(<AccountManagement />);
  expect(await loadAccountPreferences("test-user")).not.toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
  expect(fakeAuth.calls).not.toContain("deleteAccount");
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  expect(fakeAuth.calls).not.toContain("deleteAccount");
  await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
  expect(fakeAuth.calls).toContain("deleteAccount");
  expect(fakeAuth.user).toBeNull();
  expect(await loadAccountPreferences("test-user")).toBeNull();
});
