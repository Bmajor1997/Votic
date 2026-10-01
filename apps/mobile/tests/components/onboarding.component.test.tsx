import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { Alert, Text } from "react-native";
import Settings from "../../app/(tabs)/settings";
import Personalize from "../../app/personalize";
import Reader from "../../app/reader";
import EmailSignIn from "../../app/sign-in";
import Welcome from "../../app/welcome";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { GettingStartedCard } from "../../src/onboarding/GettingStartedCard";
import { ONBOARDING_KEY, nextTip, parseOnboardingState } from "../../src/onboarding/OnboardingProvider";
import { fakeAuth } from "../mocks/authBackend";
import { router, searchParams } from "../mocks/expoRouter";
import { renderWithProviders, testDocument } from "../renderWithProviders";

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));

async function savedOnboarding() {
  return parseOnboardingState(await AsyncStorage.getItem(ONBOARDING_KEY));
}

describe("Welcome", () => {
  it("states what Votic does and offers each way to continue", async () => {
    fakeAuth.reset(null);
    await renderWithProviders(<Welcome />);
    expect(screen.getByRole("header", { name: "Make any document easier to read" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Continue with email" }));
    expect(router.push).toHaveBeenCalledWith("/sign-in");
  });

  it("signs in with Google", async () => {
    fakeAuth.reset(null);
    await renderWithProviders(<Welcome />);
    await fireEvent.press(screen.getByRole("button", { name: "Continue with Google" }));
    expect(fakeAuth.calls).toContain("signInWithGoogle");
    expect(fakeAuth.user?.uid).toBe("google");
  });
});

describe("Email sign-in", () => {
  it("checks the email and password before creating an account", async () => {
    fakeAuth.reset(null);
    await renderWithProviders(<EmailSignIn />);
    await fireEvent.changeText(screen.getByLabelText("Email"), "not-an-email");
    await fireEvent.changeText(screen.getByLabelText("Password"), "short");
    await fireEvent.press(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByText("Enter a valid email address.")).toBeTruthy();
    expect(screen.getByText("Use at least 8 characters.")).toBeTruthy();
    expect(fakeAuth.calls).not.toContain("createAccount");

    await fireEvent.changeText(screen.getByLabelText("Email"), "new@example.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "reading1");
    await fireEvent.press(screen.getByRole("button", { name: "Create account" }));
    expect(fakeAuth.user?.email).toBe("new@example.com");
  });

  it("explains a wrong password without saying whether the account exists", async () => {
    fakeAuth.reset(null);
    fakeAuth.accounts.set("reader@example.com", "reading1");
    await renderWithProviders(<EmailSignIn />);
    await fireEvent.press(screen.getByRole("button", { name: "I already have an account" }));
    expect(screen.getByRole("header", { name: "Welcome back" })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Email"), "reader@example.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "wrong-pass1");
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText(/That email and password don't match/)).toBeTruthy();
    expect(fakeAuth.user).toBeNull();
  });
});

describe("Personalization", () => {
  it("walks through four steps, applies each choice, and finishes into Home", async () => {
    await renderWithProviders(<Personalize />, { onboarding: { personalized: false } });
    expect(screen.getByRole("progressbar", { name: "Step 1 of 4" })).toBeTruthy();
    const continueButton = () => screen.getByRole("button", { name: "Continue" });
    expect(continueButton().props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByRole("radio", { name: /^Research\./ }));
    await fireEvent.press(continueButton());

    expect(screen.getByRole("header", { name: "What makes reading easier for you?" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Larger text" }));
    expect(screen.getByRole("checkbox", { name: "Larger text", checked: true })).toBeTruthy();
    await fireEvent.press(continueButton());

    await fireEvent.press(screen.getByRole("radio", { name: /^Simple\./ }));
    expect(screen.getByText(/It's the money a business really gets/)).toBeTruthy();
    await fireEvent.press(continueButton());

    await fireEvent.press(screen.getByRole("radio", { name: "1.5× speed" }));
    await fireEvent.press(screen.getByRole("radio", { name: /^Sentences only\./ }));
    await fireEvent.press(screen.getByRole("button", { name: "Start using Votic" }));

    expect(router.replace).toHaveBeenCalledWith("/");
    await waitFor(async () => expect((await savedOnboarding())?.personalized).toBe(true));
    expect(await AsyncStorage.getItem("votic.mobile.purpose.v1")).toBe("research");
    expect(await AsyncStorage.getItem("votic.mobile.explanation-style.v1")).toBe("simple");
    expect(await AsyncStorage.getItem("votic.mobile.default-playback-rate.v1")).toBe("1.5");
    const accessibility = JSON.parse((await AsyncStorage.getItem("votic.mobile.accessibility.v1")) || "{}");
    expect(accessibility).toMatchObject({ textSize: "large", highlightMode: "sentence" });
  });

  it("lets every step be skipped and goes back one step at a time", async () => {
    await renderWithProviders(<Personalize />, { onboarding: { personalized: false } });
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Skip this step" }));
    expect(screen.getByRole("progressbar", { name: "Step 2 of 4" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("progressbar", { name: "Step 1 of 4" })).toBeTruthy();
    for (let step = 0; step < 4; step += 1)
      await fireEvent.press(screen.getByRole("button", { name: "Skip this step" }));
    await waitFor(async () => expect((await savedOnboarding())?.personalized).toBe(true));
    expect(await AsyncStorage.getItem("votic.mobile.purpose.v1")).toBeNull();
  });

  it("plays a listening sample at the chosen speed", async () => {
    await renderWithProviders(<Personalize />, { onboarding: { personalized: false } });
    for (let step = 0; step < 3; step += 1)
      await fireEvent.press(screen.getByRole("button", { name: "Skip this step" }));
    await fireEvent.press(screen.getByRole("radio", { name: "1.2× speed" }));
    await fireEvent.press(screen.getByRole("button", { name: "Play sample" }));
    await waitFor(() => expect(Speech.speak).toHaveBeenCalled());
    expect(jest.mocked(Speech.speak).mock.calls.at(-1)?.[1]).toMatchObject({ rate: 1.2 });
    expect(screen.getByRole("button", { name: "Stop sample" })).toBeTruthy();
  });
});

function LibraryCount() {
  const { documents } = useDocumentLibrary();
  return <Text testID="library-count">{documents.map((document) => document.title).join("|")}</Text>;
}

describe("Getting started", () => {
  it("offers a first action and adds the Votic guide when chosen", async () => {
    await renderWithProviders(
      <>
        <GettingStartedCard />
        <LibraryCount />
      </>,
      { onboarding: { checklistDismissed: false } },
    );
    expect(screen.getByRole("header", { name: "Welcome, Sam" })).toBeTruthy();
    expect(screen.getByLabelText("Add a document, not done yet")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Try the Votic guide" }));
    expect(screen.getByTestId("library-count").props.children).toBe("Votic guide");
    expect(screen.getByLabelText("Add a document, done")).toBeTruthy();
    // With a document in the library, the card switches from first actions to the remaining steps.
    expect(screen.queryByRole("button", { name: "Try the Votic guide" })).toBeNull();
    expect(screen.getByText("3 quick steps to get the most from Votic.")).toBeTruthy();
  });

  it("can be hidden", async () => {
    await renderWithProviders(<GettingStartedCard />, { onboarding: { checklistDismissed: false } });
    await fireEvent.press(screen.getByRole("button", { name: "Hide getting started" }));
    expect(screen.queryByRole("button", { name: "Hide getting started" })).toBeNull();
    await waitFor(async () => expect((await savedOnboarding())?.checklistDismissed).toBe(true));
  });
});

function OpenedReader() {
  const { activeDocument } = useDocumentLibrary();
  return activeDocument ? <Reader /> : null;
}
const book = testDocument("doc-book", "Field Guide", {
  plainText: "First passage here. Second passage there. Third passage ends.",
});

/** Reports layout the way a device does, so the Reader finishes opening (tips wait until it has). */
async function layOutReader() {
  const layout = (y: number, height: number) => ({
    nativeEvent: { layout: { x: 0, y, width: 390, height } },
  });
  await fireEvent(screen.getByTestId("reader-scroll"), "layout", layout(0, 600));
  const passages = screen.getByTestId("reader-document").children;
  for (const [index, passage] of passages.entries())
    if (typeof passage !== "string") await fireEvent(passage, "layout", layout(index * 40, 40));
  await act(async () => jest.advanceTimersByTime(50));
}

describe("Reader tips", () => {
  it("shows one tip at a time and retires it once the control is used", async () => {
    searchParams.current = { mode: "listen" };
    await renderWithProviders(<OpenedReader />, {
      documents: [book],
      reduceMotion: true,
      onboarding: { tipsSeen: [] },
    });
    expect(screen.queryByText("Listen along")).toBeNull();
    await layOutReader();
    expect(await screen.findByText("Listen along")).toBeTruthy();
    expect(screen.queryByText("Save what matters")).toBeNull();
    await fireEvent.press(screen.getAllByRole("button", { name: "Play" })[0]);
    expect(screen.queryByText("Listen along")).toBeNull();
    // While Votic is reading, no tip interrupts.
    expect(screen.queryByText("Save what matters")).toBeNull();
    await fireEvent.press(screen.getAllByRole("button", { name: "Pause" })[0]);
    expect(await screen.findByText("Save what matters")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Got it. Dismiss tip: Save what matters" }));
    expect(await screen.findByText("Ask about this document")).toBeTruthy();
    await waitFor(async () =>
      expect((await savedOnboarding())?.tipsSeen).toEqual(["reader-listen", "reader-bookmark"]),
    );
  });

  it("orders tips so a later one waits for the earlier ones", () => {
    const order = [
      { id: "reader-listen" as const, ready: false },
      { id: "reader-bookmark" as const, ready: true },
    ];
    expect(nextTip(order, [])).toBeNull();
    expect(nextTip(order, ["reader-listen"])).toBe("reader-bookmark");
  });
});

describe("Settings personalization and account", () => {
  it("changes purpose and explanation style, and brings tips back", async () => {
    await renderWithProviders(<Settings />);
    await fireEvent.press(screen.getByRole("radio", { name: /^Work\./ }));
    await fireEvent.press(screen.getByRole("radio", { name: "Quick" }));
    await waitFor(async () => expect(await AsyncStorage.getItem("votic.mobile.purpose.v1")).toBe("work"));
    expect(await AsyncStorage.getItem("votic.mobile.explanation-style.v1")).toBe("quick");
    await fireEvent.press(screen.getByRole("button", { name: "Show tips again" }));
    expect(screen.getByText("Done. Tips will appear on Home and in the Reader.")).toBeTruthy();
    await waitFor(async () =>
      expect(await savedOnboarding()).toMatchObject({ tipsSeen: [], checklistDismissed: false }),
    );
  });

  it("signs out after confirming", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === "Sign out")?.onPress?.();
    });
    await renderWithProviders(<Settings />);
    expect(screen.getByText("Signed in as reader@example.com")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Sign out" })));
    expect(alert).toHaveBeenCalled();
    expect(fakeAuth.calls).toContain("signOut");
  });
});
