import { describe, expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StyleSheet } from "react-native";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import { FeedbackScreen, FeedbackForm } from "../../src/feedback/FeedbackScreens";
import * as api from "../../src/api/voticApi";
import { fakeAuth } from "../mocks/authBackend";
import { render_with_providers } from "../renderWithProviders";

async function fill() {
  await fireEvent.changeText(screen.getByLabelText("Title (required)"), "Offline listening");
  await fireEvent.changeText(screen.getByLabelText("Description (required)"), "Let me listen on a flight.");
}
describe("Native feedback", () => {
  it("has exactly two primary choices and opens the separate forms", async () => {
    await render_with_providers(<FeedbackScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Suggest a Feature" }));
    expect(router.push).toHaveBeenCalledWith("/feedback/feature");
    await fireEvent.press(screen.getByRole("button", { name: "Report a Bug" }));
    expect(router.push).toHaveBeenCalledWith("/feedback/bug");
    expect(screen.getAllByRole("button")).toHaveLength(3); // Two options and back navigation.
    expect(screen.queryByText("Most Requested Features")).toBeNull();
  });
  it("validates required fields and submits feature feedback with no reproduction fields", async () => {
    const submit = jest.spyOn(api, "submit_feedback").mockResolvedValue("id");
    await render_with_providers(<FeedbackForm category="feature" />);
    await fireEvent.press(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a title and description before submitting.");
    expect(submit).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Steps to reproduce (optional)")).toBeNull();
    await fill();
    await fireEvent.press(screen.getByRole("button", { name: "Submit" }));
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ category: "feature", title: "Offline listening" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Thanks for your suggestion! Your feedback helps make Votic better.",
    );
  });
  it("preserves bug fields after an error, shows loading, prevents double submission and retries", async () => {
    jest.spyOn(Crypto, "randomUUID").mockReturnValue("caa14067-ae9a-47c8-b2ba-405af42d3870");
    let resolve: (id: string) => void = () => {};
    const submit = jest
      .spyOn(api, "submit_feedback")
      .mockRejectedValueOnce(new Error("Server unavailable"))
      .mockImplementation(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
    await render_with_providers(<FeedbackForm category="bug" />, { reduceMotion: true });
    await fill();
    expect(screen.getAllByLabelText(/\((required|optional)\)/)).toHaveLength(2);
    expect(screen.queryByLabelText("Steps to reproduce (optional)")).toBeNull();
    expect(screen.queryByLabelText("Expected behavior (optional)")).toBeNull();
    expect(screen.queryByLabelText("Actual behavior (optional)")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Server unavailable");
    expect(screen.getByLabelText("Title (required)")).toHaveDisplayValue("Offline listening");
    expect(screen.getByLabelText("Description (required)")).toHaveDisplayValue("Let me listen on a flight.");
    expect(submit).toHaveBeenLastCalledWith({
      category: "bug",
      title: "Offline listening",
      description: "Let me listen on a flight.",
      requestId: expect.any(String),
    });
    await fireEvent.press(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByRole("button", { name: "Submit" }).props.accessibilityState).toEqual({
      busy: true,
      disabled: true,
    });
    await fireEvent.press(screen.getByRole("button", { name: "Submit" }));
    expect(submit).toHaveBeenCalledTimes(2);
    await act(async () => resolve("id"));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Thanks for reporting this issue! Your feedback helps us improve Votic.",
    );
  });
  it("offers existing Votic sign-in and never submits without an account", async () => {
    fakeAuth.reset(null);
    const submit = jest.spyOn(api, "submit_feedback").mockResolvedValue("id");
    await render_with_providers(<FeedbackForm category="feature" />);
    await fireEvent.press(screen.getByRole("button", { name: "Sign in to submit feedback" }));
    expect(router.push).toHaveBeenCalledWith("/sign-in");
    expect(submit).not.toHaveBeenCalled();
  });
  it.each([
    ["light", "#FFFFFF", "#17253D"],
    ["dark", "#152238", "#F2F6FF"],
  ])("uses the %s theme with accessible input labels", async (appearanceMode, backgroundColor, color) => {
    await AsyncStorage.setItem("votic.mobile.theme.v1", JSON.stringify({ appearanceMode }));
    await render_with_providers(<FeedbackForm category="feature" />, { reduceMotion: true });
    const input = screen.getByLabelText("Description (required)");
    expect(StyleSheet.flatten(input.props.style)).toMatchObject({ backgroundColor, color });
    expect(input.props.accessibilityHint).toBe("Maximum 5000 characters");
  });
  it("limits input, labels fields, and discards drafts on account changes", async () => {
    await render_with_providers(<FeedbackForm category="bug" />);
    const title = screen.getByLabelText("Title (required)");
    expect(title.props.maxLength).toBe(120);
    expect(title.props.style).toBeTruthy();
    expect(screen.getByLabelText("Description (required)").props.maxLength).toBe(5000);
    await fill();
    await act(async () => fakeAuth.setUser({ uid: "other", email: null, displayName: null }));
    expect(screen.getByLabelText("Title (required)")).toHaveDisplayValue("");
  });
  it("updates and then clears the required-field message as each field is filled", async () => {
    await render_with_providers(<FeedbackForm category="bug" />);
    expect(screen.queryByTestId("feedback-validation")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByTestId("feedback-validation")).toHaveTextContent(
      "Enter a title and description before submitting.",
    );
    await fireEvent.changeText(screen.getByLabelText("Title (required)"), "Crash");
    expect(screen.getByTestId("feedback-validation")).toHaveTextContent(
      "Enter a description before submitting.",
    );
    await fireEvent.changeText(screen.getByLabelText("Description (required)"), "The reader closed.");
    expect(screen.queryByTestId("feedback-validation")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    // Emptying a field again brings back only the message for that field.
    await fireEvent.changeText(screen.getByLabelText("Title (required)"), "  ");
    expect(screen.getByTestId("feedback-validation")).toHaveTextContent("Enter a title before submitting.");
  });
  it("keeps a server error while typing, separate from field validation", async () => {
    jest.spyOn(api, "submit_feedback").mockRejectedValueOnce(new Error("Today's feedback limit reached"));
    await render_with_providers(<FeedbackForm category="bug" />);
    await fill();
    await fireEvent.press(screen.getByRole("button", { name: "Submit" }));
    await fireEvent.changeText(screen.getByLabelText("Description (required)"), "Let me listen offline.");
    expect(screen.getByText("Today's feedback limit reached")).toBeTruthy();
    expect(screen.queryByTestId("feedback-validation")).toBeNull();
  });
  it("tells a signed-in person the service is unavailable instead of asking them to sign in", async () => {
    jest
      .spyOn(api, "submit_feedback")
      .mockRejectedValueOnce(
        new api.FeedbackSubmitError(
          "Feedback is temporarily unavailable. Your message is still here, so please try again later.",
          "AUTH_UNAVAILABLE",
        ),
      );
    await render_with_providers(<FeedbackForm category="bug" />);
    await fill();
    await fireEvent.press(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/^Feedback is temporarily unavailable\./);
    expect(screen.queryByRole("button", { name: "Sign in again" })).toBeNull();
    expect(screen.queryByText(/Sign in/)).toBeNull();
    expect(screen.getByLabelText("Title (required)")).toHaveDisplayValue("Offline listening");
    expect(screen.getByRole("button", { name: "Submit" })).toBeTruthy();
  });
  it("offers to sign in again after an expired session and returns the draft to the same account only", async () => {
    jest
      .spyOn(api, "submit_feedback")
      .mockRejectedValueOnce(
        new api.FeedbackSubmitError("Your sign-in has expired. Sign in again to continue.", "AUTH_EXPIRED"),
      );
    const first = await render_with_providers(<FeedbackForm category="bug" />);
    await fill();
    await fireEvent.press(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/^Your sign-in has expired\./);
    await fireEvent.press(screen.getByRole("button", { name: "Sign in again" }));
    expect(router.push).toHaveBeenCalledWith("/sign-in");
    await first.unmount();
    // Back from sign-in as the same account: the draft is restored, once.
    const again = await render_with_providers(<FeedbackForm category="bug" />);
    expect(screen.getByLabelText("Title (required)")).toHaveDisplayValue("Offline listening");
    expect(screen.getByLabelText("Description (required)")).toHaveDisplayValue("Let me listen on a flight.");
    await again.unmount();
    await render_with_providers(<FeedbackForm category="bug" />);
    expect(screen.getByLabelText("Title (required)")).toHaveDisplayValue("");
  });
  it("never hands a held draft to a different account", async () => {
    jest
      .spyOn(api, "submit_feedback")
      .mockRejectedValueOnce(new api.FeedbackSubmitError("Your sign-in has expired.", "AUTH_EXPIRED"));
    const first = await render_with_providers(<FeedbackForm category="bug" />);
    await fill();
    await fireEvent.press(screen.getByRole("button", { name: "Submit" }));
    await fireEvent.press(screen.getByRole("button", { name: "Sign in again" }));
    await first.unmount();
    fakeAuth.reset({ uid: "someone-else", email: null, displayName: null });
    await render_with_providers(<FeedbackForm category="bug" />);
    expect(screen.getByLabelText("Title (required)")).toHaveDisplayValue("");
  });
});
