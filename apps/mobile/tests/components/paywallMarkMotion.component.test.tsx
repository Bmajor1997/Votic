import { expect, it } from "@jest/globals";
import { screen } from "@testing-library/react-native";
import { PaywallIntro } from "../../src/subscription/PaywallContent";
import { render_with_providers } from "../renderWithProviders";

it.each([false, true])(
  "keeps the existing wordmark and reusable robot visible with reduce motion %s",
  async (reduceMotion) => {
    await render_with_providers(<PaywallIntro />, { reduceMotion });
    expect(screen.getByTestId("votic-wordmark")).toBeTruthy();
    expect(screen.getByTestId("votic-wordmark-wing-1")).toBeTruthy();
    expect(screen.getByTestId("votic-wordmark-wing-2")).toBeTruthy();
    expect(screen.getByTestId("votic-wordmark-wing-3")).toBeTruthy();
    // Decorative art is excluded from the screen reader tree; the real logo remains accessible.
    expect(screen.getByTestId("paywall-robot", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId("paywall-robot-logo", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Read, listen, and understand more" })).toBeTruthy();
  },
);
