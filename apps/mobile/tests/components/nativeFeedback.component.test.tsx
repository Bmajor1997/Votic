import { describe, expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StyleSheet } from "react-native";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { router } from "expo-router";
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
    await fireEvent.changeText(screen.getByLabelText("Steps to reproduce (optional)"), "Lock the phone");
    await fireEvent.changeText(screen.getByLabelText("Expected behavior (optional)"), "Continue reading");
    await fireEvent.changeText(screen.getByLabelText("Actual behavior (optional)"), "Stops reading");
    await fireEvent.press(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Server unavailable");
    expect(screen.getByLabelText("Steps to reproduce (optional)")).toHaveDisplayValue("Lock the phone");
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
});
