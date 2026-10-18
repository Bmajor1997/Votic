import { describe, expect, it, jest } from "@jest/globals";
import { act, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import SignIn from "../../app/sign-in";
import Welcome from "../../app/welcome";
import { fakeAuth } from "../mocks/authBackend";
import { render_with_providers } from "../renderWithProviders";

/** The headline word currently lit up as if read aloud, if any. */
function lit_word() {
  const words = ["Make", "room", "for", "what", "matters."];
  return words.find((word) => {
    const style = StyleSheet.flatten(screen.getByText(word).props.style) ?? {};
    return Boolean(style.backgroundColor);
  });
}

describe("Welcome motion", () => {
  it("reads the headline once to screen readers and lights its words up in turn", async () => {
    fakeAuth.reset(null);
    await render_with_providers(<Welcome />);
    expect(screen.getByRole("header", { name: "Make room for\nwhat matters." })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with email" })).toBeTruthy();
    expect(lit_word()).toBeUndefined();
    await act(async () => jest.advanceTimersByTime(1700));
    expect(lit_word()).toBe("Make");
    await act(async () => jest.advanceTimersByTime(420));
    expect(lit_word()).toBe("room");
  });

  it("stands still with Less motion", async () => {
    fakeAuth.reset(null);
    await render_with_providers(<Welcome />, { reduceMotion: true });
    await act(async () => jest.advanceTimersByTime(5000));
    expect(lit_word()).toBeUndefined();
    expect(screen.getByRole("header", { name: "Make room for\nwhat matters." })).toBeTruthy();
  });

  it("keeps Sign in's title, Google, and the email form under the new header motion", async () => {
    fakeAuth.reset(null);
    await render_with_providers(<SignIn />);
    await act(async () => jest.advanceTimersByTime(1000));
    expect(screen.getByRole("header", { name: "Welcome back" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
  });
});
