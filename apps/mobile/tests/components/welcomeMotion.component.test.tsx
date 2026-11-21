import { describe, expect, it } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { SignInCancelled } from "../../src/auth/authErrors";
import { GOOGLE_MESSAGES, GoogleSignInProblem } from "../../src/auth/googleSignIn";
import { WELCOME_BACKGROUND } from "../../src/theme/ThemeProvider";
import SignIn from "../../app/sign-in";
import Welcome from "../../app/welcome";
import { fakeAuth } from "../mocks/authBackend";
import { fakeVideoPlayers } from "../mocks/expoVideo";
import { router } from "../mocks/expoRouter";
import { render_with_providers } from "../renderWithProviders";

// The book is decoration that screen readers skip, so queries must ask for hidden elements to find it.
const HIDDEN = { includeHiddenElements: true };

describe("Welcome's book", () => {
  it("turns its pages once, silently and without stopping other audio, then holds the last page", async () => {
    fakeAuth.reset(null);
    await render_with_providers(<Welcome />);
    expect(screen.getByTestId("welcome-book-video", HIDDEN)).toBeTruthy();
    expect(fakeVideoPlayers).toHaveLength(1);
    expect(fakeVideoPlayers[0]).toMatchObject({
      loop: false,
      muted: true,
      audioMixingMode: "mixWithOthers",
      playing: true,
    });
    await act(async () => fakeVideoPlayers[0].finish());
    expect(screen.queryByTestId("welcome-book-video", HIDDEN)).toBeNull();
    expect(screen.getByTestId("welcome-book-still", HIDDEN)).toBeTruthy();
  });

  it("shows the last page still, with no video, with Less motion", async () => {
    fakeAuth.reset(null);
    await render_with_providers(<Welcome />, { reduceMotion: true });
    expect(screen.getByTestId("welcome-book-still", HIDDEN)).toBeTruthy();
    expect(screen.queryByTestId("welcome-book-video", HIDDEN)).toBeNull();
    expect(fakeVideoPlayers).toHaveLength(0);
  });

  it("opens Create account and Sign in at once, while the pages are still turning", async () => {
    fakeAuth.reset(null);
    await render_with_providers(<Welcome />);
    await fireEvent.press(screen.getByRole("button", { name: "Create account" }));
    expect(router.push).toHaveBeenLastCalledWith("/create-account");
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(router.push).toHaveBeenLastCalledWith("/sign-in");
    expect(router.push).toHaveBeenCalledTimes(2);
  });

  it("is dark in every appearance, with Google's white button and a plain headline", async () => {
    fakeAuth.reset(null);
    await render_with_providers(<Welcome />);
    expect(screen.getByRole("header", { name: "Make room for\nwhat matters." })).toBeTruthy();
    expect(screen.queryByText(/free/i)).toBeNull();
    const google = screen.getByRole("button", { name: "Continue with Google" });
    expect(JSON.stringify(google.props.style)).toContain("#FFFFFF");
    expect(JSON.stringify(screen.toJSON())).toContain(WELCOME_BACKGROUND);
  });
});

describe("Welcome's Google button", () => {
  it("keeps Sign in's title and the email form, with Google left on Welcome", async () => {
    fakeAuth.reset(null);
    await render_with_providers(<SignIn />);
    expect(screen.getByRole("header", { name: "Welcome back" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Continue with Google" })).toBeNull();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
  });

  it("opens Google's account picker straight away, exactly once, and blocks the other buttons meanwhile", async () => {
    fakeAuth.reset(null);
    let release = () => {};
    fakeAuth.googlePending = new Promise<void>((resolve) => (release = resolve));
    await render_with_providers(<Welcome />);
    const google = () => screen.getByRole("button", { name: "Continue with Google" });
    await fireEvent.press(google());
    expect(fakeAuth.calls.filter((call) => call === "signInWithGoogle")).toHaveLength(1);
    expect(google().props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    await fireEvent.press(google());
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    await fireEvent.press(screen.getByRole("button", { name: "Create account" }));
    expect(fakeAuth.calls.filter((call) => call === "signInWithGoogle")).toHaveLength(1);
    expect(router.push).not.toHaveBeenCalled();
    await act(async () => release());
    expect(fakeAuth.user?.uid).toBe("google");
  });

  it.each([
    ["closes the account picker", () => new SignInCancelled()],
    ["hits an error", () => new GoogleSignInProblem(GOOGLE_MESSAGES.network.release, "network")],
  ])("stays usable when the person %s, and can try again", async (_label, failure) => {
    fakeAuth.reset(null);
    fakeAuth.googleFailure = failure();
    await render_with_providers(<Welcome />);
    await fireEvent.press(screen.getByRole("button", { name: "Continue with Google" }));
    expect(fakeAuth.calls).toContain("signInWithGoogle");
    const google = screen.getByRole("button", { name: "Continue with Google" });
    expect(google.props.accessibilityState.disabled).toBe(false);
    fakeAuth.googleFailure = null;
    fakeAuth.socialCreatesAccount = false;
    await fireEvent.press(google);
    expect(fakeAuth.calls.filter((call) => call === "signInWithGoogle")).toHaveLength(2);
    expect(fakeAuth.user?.uid).toBe("google");
  });
});
