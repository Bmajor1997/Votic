import { beforeEach, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Context, useEffect, useState } from "react";
import { AccessibilityInfo, Animated, AppState, Pressable, StyleSheet, Text } from "react-native";
import { HomeLogoEntrance } from "../../src/home/HomeLogoEntrance";
import { WordmarkEntranceProvider } from "../../src/home/WordmarkEntrance";
import { useAccessibilityPreferences } from "../../src/accessibility/AccessibilityProvider";
import { useAuth } from "../../src/auth/AuthProvider";
import { Screen } from "../../src/components/Screen";
import { MOTION } from "../../src/motion/motionSpec";
import { HOME_ROBOT_TIMELINE } from "../../src/motion/homeLogoTimeline";
import { fakeAuth } from "../mocks/authBackend";
import { render_with_providers, seed_storage } from "../renderWithProviders";

jest.mock("expo-router", () => {
  const original = jest.requireActual<object>("../mocks/expoRouter");
  const React = jest.requireActual<typeof import("react")>("react");
  const TestFocusContext = React.createContext(true);
  return {
    ...original,
    TestFocusContext,
    useFocusEffect(effect: () => void | (() => void)) {
      const focused = React.useContext(TestFocusContext);
      React.useEffect(() => (focused ? effect() : undefined), [effect, focused]);
    },
  };
});
const { TestFocusContext } = jest.requireMock<{ TestFocusContext: Context<boolean> }>("expo-router");
let control: {
  ready: (value: boolean) => void;
  page: (value: "home" | "documents" | "both") => void;
  focus: (value: boolean) => void;
  motion: (value: boolean) => void;
  sign_out: () => Promise<void>;
};
const alice = { uid: "test-user", email: "a@example.com", displayName: "A" };
const runs: { value: Animated.Value; stop: ReturnType<typeof jest.fn> }[] = [];
const appListeners: ((state: string) => void)[] = [];
/** Home and another page (Documents) under the shared entrance, as the tabs keep them in the app. */
function Fixture({ initiallyReady = true }: { initiallyReady?: boolean }) {
  const [ready, setReady] = useState(initiallyReady);
  const [page, setPage] = useState<"home" | "documents" | "both">("home");
  const [focused, setFocused] = useState(true);
  const access = useAccessibilityPreferences();
  const auth = useAuth();
  useEffect(() => {
    control = {
      ready: setReady,
      page: setPage,
      focus: setFocused,
      motion: access.set_reduce_motion,
      sign_out: auth.sign_out,
    };
  }, [access.set_reduce_motion, auth.sign_out]);
  return (
    <WordmarkEntranceProvider>
      <TestFocusContext.Provider value={focused && page !== "documents"}>
        {page !== "documents" ? <HomeLogoEntrance ready={ready} /> : null}
      </TestFocusContext.Provider>
      {page !== "home" ? <Screen title="Documents" /> : null}
      <Pressable accessibilityRole="button" onPress={() => setReady(true)}>
        <Text>Home action</Text>
      </Pressable>
    </WordmarkEntranceProvider>
  );
}
/** A wordmark piece's opacity; `which` picks the Home (0) or Documents (last) wordmark when both are shown. */
function opacity(testID: string, which = 0) {
  const all = screen.getAllByTestId(testID, { includeHiddenElements: true });
  const style = StyleSheet.flatten(all[which < 0 ? all.length - 1 : which].props.style);
  const value = style.opacity as number | { __getValue: () => number };
  return typeof value === "number" ? value : value.__getValue();
}
/** How much of the wordmark is still to enter: 1 before the assembly, 0 once the last letter (c) has settled. */
function shift(which = 0) {
  return 1 - opacity("votic-wordmark-letter-c", which);
}
beforeEach(() => {
  reached = 0;
  runs.length = 0;
  appListeners.length = 0;
  const original = Animated.timing;
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => {
    if (config.duration !== MOTION.homeLogo.duration) return original(value, config);
    const stop = jest.fn();
    runs.push({ value: value as Animated.Value, stop });
    return { start: jest.fn(), stop, reset: jest.fn() } as Animated.CompositeAnimation;
  });
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
    appListeners.push(listener as (state: string) => void);
    return {
      remove: jest.fn(() => {
        const at = appListeners.indexOf(listener as (state: string) => void);
        if (at >= 0) appListeners.splice(at, 1);
      }),
    };
  });
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
});
async function fresh(initiallyReady = true, reduceMotion = false) {
  fakeAuth.reset(alice);
  await seed_storage({ reduceMotion });
  fakeAuth.reset(null);
  await render_with_providers(<Fixture initiallyReady={initiallyReady} />);
  await act(async () => fakeAuth.set_user(alice));
}
/** The entrance has run for real until progress `t`: the native value and the clock both move on. */
let reached = 0;
async function reach(t: number) {
  await act(async () => {
    jest.advanceTimersByTime((t - reached) * MOTION.homeLogo.duration);
    reached = t;
    runs[0].value.setValue(t);
  });
}
async function frame() {
  await act(async () => jest.advanceTimersByTime(40));
}
/** Where letter t's robot is mid-walk: o placed, t still on its way. */
const MID_T =
  HOME_ROBOT_TIMELINE.letters[1][0] +
  0.3 * (HOME_ROBOT_TIMELINE.letters[1][1] - HOME_ROBOT_TIMELINE.letters[1][0]);

it("waits for Home readiness without a final-position flash, then plays once and keeps controls usable", async () => {
  await fresh(false);
  expect(shift()).toBeGreaterThan(0);
  expect(runs).toHaveLength(0);
  await fireEvent.press(screen.getByRole("button", { name: "Home action" }));
  await frame();
  expect(runs).toHaveLength(1);
  expect(screen.getByRole("image", { name: "Votic logo" })).toBeTruthy();
  expect(screen.getByTestId("home-logo-entrance").props.pointerEvents).toBe("none");
  // Leaving Home and coming back neither stops nor restarts it.
  await act(async () => control.focus(false));
  await act(async () => control.focus(true));
  await frame();
  expect(runs).toHaveLength(1);
  expect(runs[0].stop).not.toHaveBeenCalled();
});

it("continues on another page from the same moment instead of restarting or finishing", async () => {
  await fresh();
  await frame();
  expect(runs).toHaveLength(1);
  // The native animation has reached t's robot mid-walk.
  await reach(MID_T);
  expect(opacity("votic-wordmark-letter-o")).toBe(1);
  expect(opacity("votic-wordmark-robot-t")).toBe(1);
  expect(opacity("votic-wordmark-letter-c")).toBe(0);
  // Only the robots on screen exist: o walking off, t carrying; i and c are plain (not yet visible) letters.
  expect(screen.queryByTestId("votic-wordmark-robot-o", { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByTestId("votic-wordmark-robot-i", { includeHiddenElements: true })).toBeNull();
  expect(screen.getByTestId("votic-wordmark-plain-c", { includeHiddenElements: true })).toBeTruthy();
  // Mid-switch both headers show the same moment; then only Documents is left.
  await act(async () => control.page("both"));
  expect(screen.getByTestId("page-wordmark-entrance")).toBeTruthy();
  for (const id of ["votic-wordmark-letter-o", "votic-wordmark-robot-t", "votic-wordmark-letter-c"])
    expect(opacity(id, -1)).toBe(opacity(id, 0));
  await act(async () => control.page("documents"));
  expect(screen.queryByTestId("home-logo-entrance")).toBeNull();
  expect(opacity("votic-wordmark-robot-t")).toBe(1);
  expect(runs[0].stop).not.toHaveBeenCalled();
  expect(runs).toHaveLength(1);
  // It carries on to the finished logo on Documents.
  await reach(1);
  expect(shift()).toBe(0);
  // The last robot has gone: either not drawn at all or fully faded.
  if (screen.queryAllByTestId("votic-wordmark-robot-c", { includeHiddenElements: true }).length)
    expect(opacity("votic-wordmark-robot-c")).toBe(0);
  // Back on Home: still finished, no replay.
  await act(async () => control.page("home"));
  await frame();
  expect(runs).toHaveLength(1);
  expect(shift()).toBe(0);
});

it("shows the finished logo on a page opened before the entrance starts, then plays from Home", async () => {
  await fresh(false);
  // Documents opened before Home is ready: the finished logo, not an empty header.
  await act(async () => control.page("documents"));
  expect(shift()).toBe(0);
  await act(async () => control.page("home"));
  await fireEvent.press(screen.getByRole("button", { name: "Home action" }));
  await frame();
  expect(runs).toHaveLength(1);
  await act(async () => runs[0].value.setValue(1));
});

it("finishes everywhere when Votic goes to the background", async () => {
  await fresh();
  await frame();
  await reach(MID_T);
  await act(async () => control.page("both"));
  await act(async () => appListeners.forEach((listener) => listener("background")));
  expect(runs[0].stop).toHaveBeenCalled();
  expect(shift(0)).toBe(0);
  expect(shift(-1)).toBe(0);
  await act(async () => appListeners.forEach((listener) => listener("active")));
  await frame();
  expect(runs).toHaveLength(1);
  expect(shift(0)).toBe(0);
});

it("shows a restored session statically and ignores token refreshes", async () => {
  await render_with_providers(<Fixture />);
  await frame();
  expect(shift()).toBe(0);
  await act(async () => fakeAuth.set_user({ ...alice }));
  await frame();
  expect(runs).toHaveLength(0);
});

it("re-arms after sign-out and a new sign-in to the same account", async () => {
  await fresh();
  await frame();
  expect(runs).toHaveLength(1);
  await act(async () => control.sign_out());
  expect(shift()).toBe(0);
  await act(async () => fakeAuth.set_user({ ...alice }));
  await frame();
  expect(runs).toHaveLength(2);
});

it("finishes immediately on every page when Less motion is turned on, and never replays", async () => {
  await fresh();
  await frame();
  expect(runs).toHaveLength(1);
  await act(async () => control.page("both"));
  await act(async () => control.motion(true));
  expect(shift(0)).toBe(0);
  expect(shift(-1)).toBe(0);
  expect(runs[0].stop).toHaveBeenCalled();
  await act(async () => control.motion(false));
  await frame();
  expect(runs).toHaveLength(1);
});

it("shows the finished wordmark straight away with Less motion already on", async () => {
  await fresh(true, true);
  await frame();
  expect(runs).toHaveLength(0);
  expect(shift()).toBe(0);
});
