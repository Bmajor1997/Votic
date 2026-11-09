import { SignInCancelled } from "./authErrors";

/**
 * Continue with Google: Google's native account picker returns an ID token, which Firebase exchanges for a Votic
 * session. The same call creates the account the first time and signs in after that.
 *
 * Every way it can fail ends in a plain message (never a silent tap): a missing web client ID or native module in
 * this build, Google Play services, the Android signing setup Google checks (DEVELOPER_ERROR), the network, or
 * Firebase rejecting the token. Development builds add what to check; release builds keep it short.
 */

type GoogleModule = typeof import("@react-native-google-signin/google-signin");

export type GoogleSignInDeps = {
  /** The native module, or null when this build doesn't include it. */
  load: () => GoogleModule | null;
  webClientId?: string;
  iosClientId?: string;
  platform: string;
  /** Development build: messages say what to check. */
  dev: boolean;
  /** Exchanges Google's ID token for a Firebase session. */
  exchange: (idToken: string) => Promise<void>;
};

/** Google's Android "developer error" status: the app's package or signing certificate isn't registered. */
const DEVELOPER_ERROR = "10";
const NETWORK_ERROR = "7";

export class GoogleSignInProblem extends Error {
  constructor(
    message: string,
    readonly reason: string,
  ) {
    super(message);
    // Matches the auth error convention: the message is shown to the person as written.
    this.name = "VoticAuthUnavailable";
  }
}

export const GOOGLE_MESSAGES = {
  noClientId: {
    dev: "Google sign-in isn't set up in this development build: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing from apps/mobile/.env. Add the Web client ID from Firebase's Google sign-in provider, then restart Metro with --clear.",
    release: "Google sign-in isn't available in this version of Votic. Continue with email for now.",
  },
  noModule: {
    dev: "This development build doesn't include Google sign-in. Rebuild and reinstall it with npx expo run:android.",
    release: "Google sign-in isn't available in this version of Votic. Update Votic or continue with email.",
  },
  playServices: {
    dev: "Google Play services is missing or out of date on this device. Use an emulator image with Google Play, or update Play services.",
    release: "Google Play services is missing or out of date on this device. Update it, then try again.",
  },
  inProgress: { dev: "Google sign-in is already open.", release: "Google sign-in is already open." },
  developerError: {
    dev: "Google rejected this build's sign-in setup (DEVELOPER_ERROR). Add this build's SHA-1 signing fingerprint to the Firebase Android app com.votic.app, and check the web client ID belongs to the same Firebase project.",
    release:
      "Google sign-in isn't set up correctly for this version of Votic. Continue with email, and contact Votic support if it keeps happening.",
  },
  network: {
    dev: "Votic couldn't reach Google. Check the connection and try again.",
    release: "Votic couldn't reach Google. Check your connection and try again.",
  },
  noToken: {
    dev: "Google returned no ID token. Check EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is the Web client ID (not the Android one).",
    release: "Google didn't return a sign-in token. Please try again.",
  },
  tokenRejected: {
    dev: "Firebase rejected the Google token. Check the web client ID belongs to this Firebase project and Google is enabled under Authentication → Sign-in method.",
    release: "Votic couldn't confirm your Google account. Please try again.",
  },
  failed: {
    dev: "Google sign-in didn't finish",
    release: "Google sign-in didn't finish. Please try again.",
  },
} as const;

const code_of = (error: unknown) =>
  error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "";

export function create_google_sign_in(deps: GoogleSignInDeps) {
  let configured = false;
  const say = (key: keyof typeof GOOGLE_MESSAGES, detail = "") => {
    const text = GOOGLE_MESSAGES[key][deps.dev ? "dev" : "release"];
    return new GoogleSignInProblem(deps.dev && detail ? `${text} (${detail})` : text, key);
  };

  /** Turns a native Google failure into a message, or a quiet cancellation. */
  function native_failure(google: GoogleModule, error: unknown): Error {
    const code = code_of(error);
    if (code === google.statusCodes.SIGN_IN_CANCELLED) return new SignInCancelled();
    if (code === google.statusCodes.IN_PROGRESS) return say("inProgress");
    if (code === google.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return say("playServices");
    const message = error instanceof Error ? error.message : "";
    if (code === DEVELOPER_ERROR || message.startsWith("DEVELOPER_ERROR")) return say("developerError");
    if (code === NETWORK_ERROR) return say("network");
    return say("failed", code || message);
  }

  return {
    /** Whether the button can work in this build (it is still shown, and explains itself, when it can't). */
    available: Boolean(deps.webClientId) && deps.platform !== "web",
    get configured() {
      return configured;
    },
    async signIn() {
      if (!deps.webClientId) throw say("noClientId");
      const google = deps.load();
      if (!google) throw say("noModule");
      if (!configured) {
        google.GoogleSignin.configure({ webClientId: deps.webClientId, iosClientId: deps.iosClientId });
        configured = true;
      }
      let response: Awaited<ReturnType<typeof google.GoogleSignin.signIn>>;
      try {
        if (deps.platform === "android")
          await google.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        response = await google.GoogleSignin.signIn();
      } catch (error) {
        throw native_failure(google, error);
      }
      if (!google.isSuccessResponse(response)) throw new SignInCancelled();
      const idToken = response.data.idToken;
      if (!idToken) throw say("noToken");
      try {
        await deps.exchange(idToken);
      } catch (error) {
        const code = code_of(error);
        // The same Firebase codes as email sign-in keep their own messages (for example, an email that already
        // has a password account); a rejected token means the Google setup doesn't match this Firebase project.
        if (code === "auth/invalid-credential" || code === "auth/invalid-idp-response")
          throw say("tokenRejected");
        throw error;
      }
    },
    /** Forgets the Google account too, so the next Google sign-in offers the account picker again. */
    async signOut() {
      if (!configured) return;
      await deps
        .load()
        ?.GoogleSignin.signOut()
        .catch(() => null);
    },
  };
}
