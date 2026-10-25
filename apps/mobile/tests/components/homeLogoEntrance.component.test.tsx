import { beforeEach, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Context, useEffect, useState } from "react";
import { AccessibilityInfo, Animated, AppState, Pressable, Text } from "react-native";
import { HomeLogoEntrance } from "../../src/home/HomeLogoEntrance";
import { useAccessibilityPreferences } from "../../src/accessibility/AccessibilityProvider";
import { useAuth } from "../../src/auth/AuthProvider";
import { Screen } from "../../src/components/Screen";
import { MOTION } from "../../src/motion/motionSpec";
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
  visible: (value: boolean) => void;
  focus: (value: boolean) => void;
  motion: (value: boolean) => void;
  signOut: () => Promise<void>;
};
const alice = { uid: "test-user", email: "a@example.com", displayName: "A" };
const runs: { value: Animated.Value; stop: ReturnType<typeof jest.fn> }[] = [];
const appListeners: ((state: string) => void)[] = [];
function Fixture({ initiallyReady = true }: { initiallyReady?: boolean }) {
  const [ready, setReady] = useState(initiallyReady);
  const [visible, setVisible] = useState(true);
  const [focused, setFocused] = useState(true);
  const access = useAccessibilityPreferences();
  const auth = useAuth();
  useEffect(() => {
    control = {
      ready: setReady,
      visible: setVisible,
      focus: setFocused,
      motion: access.setReduceMotion,
      signOut: auth.signOut,
    };
  }, [access.setReduceMotion, auth.signOut]);
  return (
    <TestFocusContext.Provider value={focused}>
      {visible ? <HomeLogoEntrance ready={ready} /> : <Screen title="Documents" />}
      <Pressable accessibilityRole="button" onPress={() => setReady(true)}>
        <Text>Home action</Text>
      </Pressable>
    </TestFocusContext.Provider>
  );
}
/** How much of the wordmark is still to enter: 1 before the assembly, 0 once the last letter (c) has settled. */
function shift() {
  const style = screen.getByTestId("votic-wordmark-letter-c").props.style;
  const opacity = (Array.isArray(style) ? Object.assign({}, ...style.flat()) : style).opacity;
  return 1 - (typeof opacity === "number" ? opacity : opacity.__getValue());
}
beforeEach(() => {
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
  await act(async () => fakeAuth.setUser(alice));
}
async function frame() {
  await act(async () => jest.advanceTimersByTime(40));
}

it("waits for Home readiness without a final-position flash, then plays once and keeps controls usable", async () => {
  await fresh(false);
  expect(shift()).toBeGreaterThan(0);
  expect(runs).toHaveLength(0);
  await fireEvent.press(screen.getByRole("button", { name: "Home action" }));
  await frame();
  expect(runs).toHaveLength(1);
  expect(screen.getByRole("image", { name: "Votic logo" })).toBeTruthy();
  expect(screen.getByTestId("home-logo-entrance").props.pointerEvents).toBe("none");
  await act(async () => control.focus(false));
  expect(runs[0].stop).toHaveBeenCalled();
  expect(shift()).toBe(0);
  await act(async () => control.focus(true));
  await frame();
  await act(async () => control.visible(false));
  expect(screen.queryByTestId("home-logo-entrance")).toBeNull();
  await act(async () => control.visible(true));
  await frame();
  await act(async () => appListeners.forEach((listener) => listener("background")));
  await act(async () => appListeners.forEach((listener) => listener("active")));
  await frame();
  expect(runs).toHaveLength(1);
  expect(shift()).toBe(0);
});
it("shows a restored session statically and ignores token refreshes", async () => {
  await render_with_providers(<Fixture />);
  await frame();
  expect(shift()).toBe(0);
  await act(async () => fakeAuth.setUser({ ...alice }));
  await frame();
  expect(runs).toHaveLength(0);
});
it("re-arms after sign-out and a new sign-in to the same account", async () => {
  await fresh();
  await frame();
  expect(runs).toHaveLength(1);
  await act(async () => control.signOut());
  await act(async () => fakeAuth.setUser({ ...alice }));
  await frame();
  expect(runs).toHaveLength(2);
});
it("settles immediately when Less motion is enabled during an entrance", async () => {
  await fresh();
  await frame();
  expect(runs).toHaveLength(1);
  await act(async () => control.motion(true));
  expect(shift()).toBe(0);
  expect(runs[0].stop).toHaveBeenCalled();
  await act(async () => control.motion(false));
  await frame();
  expect(runs).toHaveLength(1);
});
it("skips motion from the initial device Reduce Motion setting", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
  await fresh();
  await frame();
  expect(runs).toHaveLength(0);
  expect(shift()).toBe(0);
});
it("reveals the logo if Home or the native animation never settles", async () => {
  await fresh(false);
  expect(shift()).toBeGreaterThan(0);
  await act(async () => jest.advanceTimersByTime(MOTION.homeLogo.settleDeadline + 1));
  expect(shift()).toBe(0);
  await act(async () => control.ready(true));
  await frame();
  expect(runs).toHaveLength(0);
});

it("settles a native animation that never calls its completion callback", async () => {
  await fresh();
  await frame();
  expect(runs).toHaveLength(1);
  expect(shift()).toBeGreaterThan(0);
  // The safety deadline allows the whole assembly before revealing the finished logo.
  await act(async () => jest.advanceTimersByTime(MOTION.homeLogo.settleDeadline));
  expect(shift()).toBeGreaterThan(0);
  await act(async () => jest.advanceTimersByTime(MOTION.homeLogo.duration));
  expect(shift()).toBe(0);
});
it("keeps the logo visible if the native animation cannot start", async () => {
  const ordinary = jest.mocked(Animated.timing).getMockImplementation()!;
  jest.mocked(Animated.timing).mockImplementation((value, config) => {
    if (config.duration === MOTION.homeLogo.duration) throw new Error("Driver unavailable");
    return ordinary(value, config);
  });
  await fresh();
  await frame();
  expect(shift()).toBe(0);
  expect(screen.getByRole("button", { name: "Home action" })).toBeTruthy();
});
