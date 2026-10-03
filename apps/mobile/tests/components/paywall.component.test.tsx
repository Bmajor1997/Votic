import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import { Alert } from "react-native";
import { router } from "expo-router";
import Paywall from "../../app/paywall";
import { renderWithProviders } from "../renderWithProviders";

describe("Membership paywall", () => {
  it("shows annual pricing by default and updates renewal copy for monthly", async () => {
    await renderWithProviders(<Paywall />);
    expect(
      screen.getByRole("radio", { name: "Annual, $99 per year, save 36 percent", checked: true }),
    ).toBeTruthy();
    expect(screen.getByText(/14 days free, then \$99 per year/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("radio", { name: "Monthly, $12.99 per month" }));
    expect(screen.getByText(/14 days free, then \$12.99 per month/)).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Monthly, $12.99 per month", checked: true })).toBeTruthy();
  });
  it("lets beta testers continue without pretending to start a subscription", async () => {
    await renderWithProviders(<Paywall />);
    expect(screen.getByText(/Continuing won’t charge you or start a trial/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(router.replace).toHaveBeenCalledWith("/");
  });
  it("explains that restoration is unavailable during beta", async () => {
    const alert = jest.spyOn(Alert, "alert");
    await renderWithProviders(<Paywall />);
    await fireEvent.press(screen.getByRole("button", { name: "Restore purchases" }));
    expect(alert).toHaveBeenCalledWith(
      "Restore purchases",
      expect.stringContaining("No purchases can be restored yet"),
    );
  });
});
