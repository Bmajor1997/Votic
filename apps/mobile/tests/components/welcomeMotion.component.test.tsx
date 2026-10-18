import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import SignIn from "../../app/sign-in";
import Welcome from "../../app/welcome";
import { fakeAuth } from "../mocks/authBackend";
import { router } from "../mocks/expoRouter";
import { render_with_providers } from "../renderWithProviders";

describe("Welcome motion", () => {
  it("stands still, with a plain headline, until someone taps Sign in", async () => {
    fakeAuth.reset(null);
    await render_with_providers(<Welcome />);
    expect(screen.getByRole("header", { name: "Make room for\nwhat matters." })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
    // No word lights up or bolds: the headline is just text.
    await act(async () => jest.advanceTimersByTime(5000));
    expect(router.push).not.toHaveBeenCalled();
  });

  it("lets the V hop off the top of the screen before Sign in opens", async () => {
    fakeAuth.reset(null);
    await render_with_providers(<Welcome />);
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(router.push).not.toHaveBeenCalled();
    // A second tap during the hop doesn't open Sign in twice.
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    await act(async () => jest.advanceTimersByTime(1000));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/sign-in");
  });

  it("opens Sign in straight away with Less motion, and Continue with email never waits", async () => {
    fakeAuth.reset(null);
    await render_with_providers(<Welcome />, { reduceMotion: true });
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(router.push).toHaveBeenCalledWith("/sign-in");
    await fireEvent.press(screen.getByRole("button", { name: "Continue with email" }));
    expect(router.push).toHaveBeenLastCalledWith("/create-account");
  });

  it("keeps Sign in's title, Google, and the email form under the V", async () => {
    fakeAuth.reset(null);
    await render_with_providers(<SignIn />);
    expect(screen.getByRole("header", { name: "Welcome back" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
  });
});
