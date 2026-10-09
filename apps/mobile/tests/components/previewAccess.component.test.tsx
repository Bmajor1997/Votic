import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import Constants from "expo-constants";
import { Pressable, Text } from "react-native";
import Welcome from "../../app/welcome";
import { useAuth } from "../../src/auth/AuthProvider";
import * as backend from "../mocks/authBackend";
import { renderWithProviders } from "../renderWithProviders";

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

function setPreview(value: unknown) {
  Constants.expoConfig!.extra!.previewTesting = value;
}

function withoutFirebase() {
  const create = backend.createAuthBackend;
  jest.spyOn(backend, "createAuthBackend").mockImplementation(() => ({ ...create(), configured: false }));
}

beforeEach(() => {
  Object.defineProperty(globalThis, "__DEV__", { value: false, configurable: true, writable: true });
  setPreview(false);
  backend.fakeAuth.reset(null);
});

afterEach(() => {
  Object.defineProperty(globalThis, "__DEV__", { value: originalDev, configurable: true, writable: true });
  setPreview(false);
  if (originalProfile === undefined) delete process.env.EAS_BUILD_PROFILE;
  else process.env.EAS_BUILD_PROFILE = originalProfile;
});

describe("Preview testing entry", () => {
  it("offers an accessible entry in a standalone preview and ends the testing session on sign out", async () => {
    setPreview(true);
    withoutFirebase();
    await renderWithProviders(
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
      setPreview(marker);
      withoutFirebase();
      await renderWithProviders(
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
    setPreview(true);
    await renderWithProviders(
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
    withoutFirebase();
    await renderWithProviders(<Welcome />);
    expect(screen.getByRole("button", { name: "Explore Votic without an account" })).toBeTruthy();
  });

  it.each(["preview", "production", "development", undefined])(
    "sets the build marker only for the preview profile (%s)",
    (profile) => {
      if (profile === undefined) delete process.env.EAS_BUILD_PROFILE;
      else process.env.EAS_BUILD_PROFILE = profile;
      const config = configureApp({
        config: { extra: { previewTesting: true, eas: { projectId: "existing" } } },
      });
      expect(config.extra.previewTesting).toBe(profile === "preview");
      expect(config.extra.eas.projectId).toBe("existing");
    },
  );
});
