import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import Constants from "expo-constants";
import { Pressable, Text } from "react-native";
import Welcome from "../../app/welcome";
import { useAuth } from "../../src/auth/AuthProvider";
import * as backend from "../mocks/authBackend";
import { render_with_providers } from "../renderWithProviders";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { previewTesting: false } } },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const configureApp = require("../../app.config.js");
const originalDev = __DEV__;
const originalProfile = process.env.EAS_BUILD_PROFILE;

function Session() {
  const auth = useAuth();
  return (
    <>
      <Text testID="session">{auth.user?.uid ?? "signed-out"}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Attempt entry"
        onPress={auth.continueWithoutAccount}
      >
        <Text>Attempt entry</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="End session"
        onPress={() => void auth.signOut()}
      >
        <Text>End session</Text>
      </Pressable>
    </>
  );
}

function set_preview(value: unknown) {
  Constants.expoConfig!.extra!.previewTesting = value;
}

function without_firebase() {
  const create = backend.create_auth_backend;
  jest.spyOn(backend, "create_auth_backend").mockImplementation(() => ({ ...create(), configured: false }));
}

beforeEach(() => {
  Object.defineProperty(globalThis, "__DEV__", { value: false, configurable: true, writable: true });
  set_preview(false);
  backend.fakeAuth.reset(null);
});

afterEach(() => {
  Object.defineProperty(globalThis, "__DEV__", { value: originalDev, configurable: true, writable: true });
  set_preview(false);
  if (originalProfile === undefined) delete process.env.EAS_BUILD_PROFILE;
  else process.env.EAS_BUILD_PROFILE = originalProfile;
});

describe("Preview testing entry", () => {
  it("offers an accessible entry in a standalone preview and ends the testing session on sign out", async () => {
    set_preview(true);
    without_firebase();
    await render_with_providers(
      <>
        <Welcome />
        <Session />
      </>,
    );
    const entry = screen.getByRole("button", { name: "Explore Votic without an account" });
    expect(screen.getByText("Testing access only. Account actions require signing in.")).toBeTruthy();
    await fireEvent.press(entry);
    expect(screen.getByTestId("session").props.children).toBe("development");
    expect(backend.fakeAuth.calls).toEqual([]);
    expect(backend.fakeAuth.user).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "End session" }));
    expect(screen.getByTestId("session").props.children).toBe("signed-out");
  });

  it.each([false, undefined, "true"])(
    "blocks release entry when the preview marker is %s",
    async (marker) => {
      set_preview(marker);
      without_firebase();
      await render_with_providers(
        <>
          <Welcome />
          <Session />
        </>,
      );
      expect(screen.queryByRole("button", { name: "Explore Votic without an account" })).toBeNull();
      await fireEvent.press(screen.getByRole("button", { name: "Attempt entry" }));
      expect(screen.getByTestId("session").props.children).toBe("signed-out");
    },
  );

  it("never bypasses configured Firebase, even in a preview", async () => {
    set_preview(true);
    await render_with_providers(
      <>
        <Welcome />
        <Session />
      </>,
    );
    expect(screen.queryByRole("button", { name: "Explore Votic without an account" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Attempt entry" }));
    expect(screen.getByTestId("session").props.children).toBe("signed-out");
  });

  it("preserves entry in local development without Firebase", async () => {
    Object.defineProperty(globalThis, "__DEV__", { value: true });
    without_firebase();
    await render_with_providers(<Welcome />);
    expect(screen.getByRole("button", { name: "Explore Votic without an account" })).toBeTruthy();
  });

  it.each(["preview", "production", "development", undefined])(
    "sets the build marker only for the preview profile (%s)",
    (profile) => {
      if (profile === "production")
        jest.replaceProperty(process, "env", {
          ...process.env,
          EXPO_PUBLIC_FIREBASE_API_KEY: "test-only",
          EXPO_PUBLIC_FIREBASE_PROJECT_ID: "test-project",
          EXPO_PUBLIC_FIREBASE_APP_ID: "test-app",
          EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: "goog_fixtureOnly",
          EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID: "premium",
          EXPO_PUBLIC_VOTIC_API_URL: "https://api.example.com",
          EXPO_PUBLIC_VOTIC_TERMS_URL: "https://example.com/terms",
          EXPO_PUBLIC_VOTIC_PRIVACY_URL: "https://example.com/privacy",
        });
      if (profile === undefined) delete process.env.EAS_BUILD_PROFILE;
      else process.env.EAS_BUILD_PROFILE = profile;
      const config = configureApp({
        config: {
          extra: { previewTesting: true, eas: { projectId: "00000000-0000-4000-8000-000000000000" } },
        },
      });
      expect(config.extra.previewTesting).toBe(profile === "preview");
      expect(config.extra.eas.projectId).toBe("00000000-0000-4000-8000-000000000000");
    },
  );
});
