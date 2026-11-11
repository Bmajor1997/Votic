import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Animated } from "react-native";
import { SignInCancelled } from "../../src/auth/authErrors";
import { GOOGLE_MESSAGES, GoogleSignInProblem } from "../../src/auth/googleSignIn";
import SignIn from "../../app/sign-in";
import Welcome from "../../app/welcome";
import { fakeAuth } from "../mocks/authBackend";
import { router } from "../mocks/expoRouter";
import { render_with_providers } from "../renderWithProviders";

describe("Welcome motion", () => {
  it("plays the same V flight for Create account as for Sign in, then opens it once", async () => {
    fakeAuth.reset(null);
    const moves = watch_moves();
    await render_with_providers(<Welcome />);
    await fireEvent.press(screen.getByRole("button", { name: "Create account with email" }));
    // The V flies (three wings, the stroke, the glow) before Create account opens.
    expect(moves.away()).toEqual([460, 460, 460, 520, 500]);
    expect(router.push).not.toHaveBeenCalled();
    // More taps during the flight change nothing.
    await fireEvent.press(screen.getByRole("button", { name: "Create account with email" }));
    await act(async () => jest.advanceTimersByTime(1500));
    expect(router.push.mock.calls).toEqual([["/create-account"]]);
    expect(moves.away()).toHaveLength(5);
  });

  it("sends the person where they tapped first: a second choice during the flight is ignored", async () => {
    fakeAuth.reset(null);
    const moves = watch_moves();
    await render_with_providers(<Welcome />);
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    await fireEvent.press(screen.getByRole("button", { name: "Create account with email" }));
    await act(async () => jest.advanceTimersByTime(1500));
    expect(router.push.mock.calls).toEqual([["/sign-in"]]);
    expect(moves.away()).toHaveLength(5);
  });

  it("stands still, with a plain headline, until someone taps Sign in", async () => {
    fakeAuth.reset(null);
    await render_with_providers(<Welcome />);
    expect(screen.getByRole("header", { name: "Make room for\nwhat matters." })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
    // No word lights up or bolds: the headline is just text.
    await act(async () => jest.advanceTimersByTime(5000));
    expect(router.push).not.toHaveBeenCalled();
  });

  it("lets the V's wings and stroke fly away before Sign in opens", async () => {
    fakeAuth.reset(null);
    await render_with_providers(<Welcome />);
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(router.push).not.toHaveBeenCalled();
    // A second tap while it flies doesn't open Sign in twice.
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    await act(async () => jest.advanceTimersByTime(1500));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/sign-in");
  });

  it("opens Sign in straight away with Less motion, and Create account with email never waits", async () => {
    fakeAuth.reset(null);
    await render_with_providers(<Welcome />, { reduceMotion: true });
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(router.push).toHaveBeenCalledWith("/sign-in");
    await fireEvent.press(screen.getByRole("button", { name: "Create account with email" }));
    expect(router.push).toHaveBeenLastCalledWith("/create-account");
  });

  it("keeps Sign in's title and the email form under the V, with Google left on Welcome", async () => {
    fakeAuth.reset(null);
    await render_with_providers(<SignIn />);
    expect(screen.getByRole("header", { name: "Welcome back" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Continue with Google" })).toBeNull();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
  });

  it("flies the V away first, then opens Google's account picker exactly once", async () => {
    fakeAuth.reset(null);
    let release = () => {};
    fakeAuth.googlePending = new Promise<void>((resolve) => (release = resolve));
    const moves = watch_moves();
    await render_with_providers(<Welcome />);
    const google = () => screen.getByRole("button", { name: "Continue with Google" });
    await fireEvent.press(google());
    // The usual flight starts at once (three wings, then the stroke, and the glow fading); the picker waits for it.
    expect(moves.away()).toEqual([460, 460, 460, 520, 500]);
    expect(fakeAuth.calls).not.toContain("signInWithGoogle");
    expect(google().props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    // Taps during the flight change nothing: no second flight, no Sign in.
    await fireEvent.press(google());
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    await act(async () => jest.advanceTimersByTime(1500));
    expect(fakeAuth.calls.filter((call) => call === "signInWithGoogle")).toHaveLength(1);
    expect(moves.away()).toHaveLength(5);
    expect(router.push).not.toHaveBeenCalled();
    await act(async () => release());
    expect(fakeAuth.user?.uid).toBe("google");
    // Signed in: the V isn't brought back.
    expect(moves.back()).toEqual([]);
  });

  it.each([
    ["closes the account picker", () => new SignInCancelled()],
    ["hits an error", () => new GoogleSignInProblem(GOOGLE_MESSAGES.network.release, "network")],
  ])("puts the V back together and stays usable when the person %s", async (_label, failure) => {
    fakeAuth.reset(null);
    fakeAuth.googleFailure = failure();
    const moves = watch_moves();
    await render_with_providers(<Welcome />);
    await fireEvent.press(screen.getByRole("button", { name: "Continue with Google" }));
    await act(async () => jest.advanceTimersByTime(1500));
    expect(fakeAuth.calls).toContain("signInWithGoogle");
    // Every piece (three wings, the stroke and the glow) comes back to its place.
    expect(moves.back()).toEqual([360, 360, 360, 360, 360]);
    await act(async () => jest.advanceTimersByTime(600));
    const google = screen.getByRole("button", { name: "Continue with Google" });
    expect(google.props.accessibilityState.disabled).toBe(false);
    // Try again: it flies once more and asks Google once more.
    fakeAuth.googleFailure = null;
    fakeAuth.socialCreatesAccount = false;
    await fireEvent.press(google);
    expect(moves.away()).toHaveLength(10);
    await act(async () => jest.advanceTimersByTime(1500));
    expect(fakeAuth.calls.filter((call) => call === "signInWithGoogle")).toHaveLength(2);
    expect(fakeAuth.user?.uid).toBe("google");
  });

  it("opens Google's account picker straight away with Less motion, and the V never moves", async () => {
    fakeAuth.reset(null);
    fakeAuth.googleFailure = new SignInCancelled();
    const moves = watch_moves();
    await render_with_providers(<Welcome />, { reduceMotion: true });
    await fireEvent.press(screen.getByRole("button", { name: "Continue with Google" }));
    expect(fakeAuth.calls).toContain("signInWithGoogle");
    expect(moves.away()).toEqual([]);
    expect(moves.back()).toEqual([]);
    expect(
      screen.getByRole("button", { name: "Continue with Google" }).props.accessibilityState.disabled,
    ).toBe(false);
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(router.push).toHaveBeenCalledWith("/sign-in");
  });
});

/**
 * The V's movements as they start (the test renderer doesn't report native-driver positions): the durations of
 * timings that send a piece away (to 1) and that bring it back (to 0).
 */
function watch_moves() {
  const original = Animated.timing;
  const started: { to: number; duration: number }[] = [];
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => {
    started.push({ to: config.toValue as number, duration: config.duration ?? 0 });
    return original(value, config);
  });
  // The small header logo's one-time wing pulse (110–140 ms) isn't part of the V's flight.
  const durations = (to: number) =>
    started.filter((move) => move.to === to && move.duration >= 300).map((move) => move.duration);
  return { away: () => durations(1), back: () => durations(0) };
}
