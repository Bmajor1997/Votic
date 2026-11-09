import { describe, expect, it, vi } from "vitest";
import { SignInCancelled, auth_error_message } from "./authErrors";
import { GOOGLE_MESSAGES, create_google_sign_in, type GoogleSignInDeps } from "./googleSignIn";

const statusCodes = {
  SIGN_IN_CANCELLED: "12501",
  IN_PROGRESS: "IN_PROGRESS",
  PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
  SIGN_IN_REQUIRED: "4",
  NULL_PRESENTER: "NULL_PRESENTER",
};
const coded = (code: string, message = "native failure") => Object.assign(new Error(message), { code });

/** A stand-in for @react-native-google-signin/google-signin. */
function fake_module(signIn: () => Promise<unknown>) {
  const GoogleSignin = {
    configure: vi.fn(),
    hasPlayServices: vi.fn(async () => true),
    signIn: vi.fn(signIn),
    signOut: vi.fn(async () => null),
  };
  return {
    GoogleSignin,
    statusCodes,
    isSuccessResponse: (response: { type: string }) => response.type === "success",
  };
}
const success = (idToken: string | null) => async () => ({ type: "success", data: { idToken } });

function setup(
  overrides: Partial<GoogleSignInDeps> = {},
  signIn: () => Promise<unknown> = success("google-id-token"),
) {
  const google = fake_module(signIn);
  const exchange = vi.fn(async () => {});
  const flow = create_google_sign_in({
    load: () => google as never,
    webClientId: "web-client.apps.googleusercontent.com",
    platform: "android",
    dev: false,
    exchange,
    ...overrides,
  });
  return { flow, google, exchange };
}

describe("Continue with Google", () => {
  it("opens Google's picker and hands its ID token to Firebase, configuring Google once", async () => {
    const { flow, google, exchange } = setup();
    expect(flow.available).toBe(true);
    await flow.signIn();
    await flow.signIn();
    expect(google.GoogleSignin.configure).toHaveBeenCalledTimes(1);
    expect(google.GoogleSignin.configure).toHaveBeenCalledWith(
      expect.objectContaining({ webClientId: "web-client.apps.googleusercontent.com" }),
    );
    expect(google.GoogleSignin.hasPlayServices).toHaveBeenCalled();
    expect(exchange).toHaveBeenCalledWith("google-id-token");
  });

  it("is unavailable, with a specific reason, when the web client ID is missing", async () => {
    const { flow, google } = setup({ webClientId: undefined });
    expect(flow.available).toBe(false);
    await expect(flow.signIn()).rejects.toThrow(GOOGLE_MESSAGES.noClientId.release);
    expect(google.GoogleSignin.signIn).not.toHaveBeenCalled();
    const dev = setup({ webClientId: "", dev: true }).flow;
    await expect(dev.signIn()).rejects.toThrow(/EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing/);
  });

  it("explains when this build lacks the Google native module", async () => {
    const { flow } = setup({ load: () => null, dev: true });
    await expect(flow.signIn()).rejects.toThrow(/Rebuild and reinstall/);
  });

  it("treats closing the picker as a quiet cancellation", async () => {
    const { flow, exchange } = setup({}, async () => {
      throw coded(statusCodes.SIGN_IN_CANCELLED);
    });
    await expect(flow.signIn()).rejects.toBeInstanceOf(SignInCancelled);
    const dismissed = setup({}, async () => ({ type: "cancelled", data: null }));
    await expect(dismissed.flow.signIn()).rejects.toBeInstanceOf(SignInCancelled);
    expect(exchange).not.toHaveBeenCalled();
  });

  it.each([
    ["Google's DEVELOPER_ERROR (unregistered signing certificate)", coded("10"), "developerError"],
    [
      "a DEVELOPER_ERROR reported only in the message",
      coded("", "DEVELOPER_ERROR: Follow troubleshooting"),
      "developerError",
    ],
    ["missing Play services", coded(statusCodes.PLAY_SERVICES_NOT_AVAILABLE), "playServices"],
    ["a network failure", coded("7"), "network"],
    ["a picker that's already open", coded(statusCodes.IN_PROGRESS), "inProgress"],
  ] as const)("explains %s", async (_label, error, key) => {
    const { flow } = setup({}, async () => {
      throw error;
    });
    const failure = await flow.signIn().catch((caught: unknown) => caught);
    expect(auth_error_message(failure)).toBe(GOOGLE_MESSAGES[key].release);
  });

  it("names what to check for DEVELOPER_ERROR in development builds", async () => {
    const { flow } = setup({ dev: true }, async () => {
      throw coded("10");
    });
    await expect(flow.signIn()).rejects.toThrow(/SHA-1 signing fingerprint.*com\.votic\.app/);
  });

  it("explains a missing ID token and a token Firebase rejects", async () => {
    const noToken = setup({}, success(null));
    await expect(noToken.flow.signIn()).rejects.toThrow(GOOGLE_MESSAGES.noToken.release);
    const rejected = setup();
    rejected.exchange.mockRejectedValueOnce(coded("auth/invalid-credential"));
    await expect(rejected.flow.signIn()).rejects.toThrow(GOOGLE_MESSAGES.tokenRejected.release);
  });

  it("keeps Firebase's own account messages, such as an email that already has a password account", async () => {
    const { flow, exchange } = setup();
    exchange.mockRejectedValueOnce(coded("auth/account-exists-with-different-credential"));
    const failure = await flow.signIn().catch((caught: unknown) => caught);
    expect(auth_error_message(failure)).toMatch(/Sign in the way you did before/);
  });

  it("gives an unknown failure a message rather than nothing", async () => {
    const { flow } = setup({}, async () => {
      throw coded("13");
    });
    const failure = await flow.signIn().catch((caught: unknown) => caught);
    expect(auth_error_message(failure)).toBe(GOOGLE_MESSAGES.failed.release);
  });

  it("forgets the Google account on sign-out only after Google was used", async () => {
    const { flow, google } = setup();
    await flow.signOut();
    expect(google.GoogleSignin.signOut).not.toHaveBeenCalled();
    await flow.signIn();
    await flow.signOut();
    expect(google.GoogleSignin.signOut).toHaveBeenCalledTimes(1);
  });
});
