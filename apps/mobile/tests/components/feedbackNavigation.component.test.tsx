import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { AppProviders, seed_storage } from "../renderWithProviders";

// A real in-memory router: these tests follow the navigation history itself, not calls to a mocked function.
jest.unmock("expo-router");
/* eslint-disable @typescript-eslint/no-require-imports */
const { renderRouter } =
  require("expo-router/testing-library") as typeof import("expo-router/testing-library");
const { router } = require("expo-router") as typeof import("expo-router");
const { FeedbackScreen, FeedbackForm } =
  require("../../src/feedback/FeedbackScreens") as typeof import("../../src/feedback/FeedbackScreens");
/* eslint-enable @typescript-eslint/no-require-imports */

function SettingsStub() {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push("/feedback")}>
      <Text>Settings home</Text>
    </Pressable>
  );
}
const routes = {
  index: SettingsStub,
  "feedback/index": FeedbackScreen,
  "feedback/feature": () => <FeedbackForm category="feature" />,
  "feedback/bug": () => <FeedbackForm category="bug" />,
};

/**
 * Renders the routes at `initialUrl`. expo-router attaches getPathname() to the object render returns, which with
 * Testing Library 14 is a promise, so that object is kept (and awaited separately) for pathname assertions.
 */
async function open_router(initialUrl = "/") {
  await seed_storage({});
  let routed!: ReturnType<typeof renderRouter>;
  await act(async () => {
    routed = renderRouter(routes, { initialUrl, wrapper: AppProviders });
    await routed;
  });
  await act(async () => {});
  // Wrapped, because returning a promise-like object from an async function would unwrap it again.
  return { pathname: () => routed.getPathname() };
}
const back = () =>
  screen.getAllByRole("button").find((button) => /^Back/.test(button.props.accessibilityLabel ?? ""))!;

describe("Feedback back navigation", () => {
  it.each([
    ["Suggest a Feature", "feature"],
    ["Report a Bug", "bug"],
  ])("after %s and its back arrow, one tap on Feedback's back arrow leaves Feedback", async (option) => {
    const app = await open_router();
    await fireEvent.press(screen.getByText("Settings home"));
    expect(app.pathname()).toBe("/feedback");
    await fireEvent.press(screen.getByRole("button", { name: option }));
    expect(app.pathname()).not.toBe("/feedback");
    // The form's own back arrow returns to the Feedback screen it came from...
    await act(async () => fireEvent.press(back()));
    expect(app.pathname()).toBe("/feedback");
    // ...and a single tap on Feedback's back arrow leaves it, instead of landing on a second Feedback screen.
    await act(async () => fireEvent.press(back()));
    expect(app.pathname()).toBe("/");
    expect(screen.getByText("Settings home")).toBeTruthy();
  });

  it("a form opened directly, without Feedback underneath, still goes back to Feedback and then out", async () => {
    const app = await open_router("/feedback/bug");
    expect(app.pathname()).toBe("/feedback/bug");
    await act(async () => fireEvent.press(back()));
    expect(app.pathname()).toBe("/feedback");
    // The bug form still has only a title and a description.
    await fireEvent.press(screen.getByRole("button", { name: "Report a Bug" }));
    expect(screen.getAllByLabelText(/\(required\)/)).toHaveLength(2);
  });
});
