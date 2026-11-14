import { beforeEach, expect, it, jest } from "@jest/globals";
import { act, screen } from "@testing-library/react-native";
import { Context, useEffect, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet } from "react-native";
import { ContinuePreview } from "../../src/home/ContinuePreview";
import { useAccessibilityPreferences } from "../../src/accessibility/AccessibilityProvider";
import { MOTION } from "../../src/motion/motionSpec";
import { VoticDocument } from "../../src/documents/types";
import { render_with_providers, test_document } from "../renderWithProviders";

// Home's focus, controllable: true while Home is the screen in front.
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
  focus: (value: boolean) => void;
  document: (value: VoticDocument) => void;
  motion: (value: boolean) => void;
};
const story = test_document("doc-1", "The Gift of the Magi", {
  plainText: "One dollar and eighty-seven cents. That was all. And sixty cents of it was in pennies.",
  sentenceIndex: 0,
  wordIndex: 0,
});
function Home() {
  const [focused, setFocused] = useState(true);
  const [document, setDocument] = useState(story);
  const access = useAccessibilityPreferences();
  useEffect(() => {
    control = { focus: setFocused, document: setDocument, motion: access.set_reduce_motion };
  }, [access.set_reduce_motion]);
  return (
    <TestFocusContext.Provider value={focused}>
      <ContinuePreview document={document} />
    </TestFocusContext.Provider>
  );
}

const runs: { stop: ReturnType<typeof jest.fn> }[] = [];
beforeEach(() => {
  runs.length = 0;
  const original = Animated.timing;
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => {
    const animation = original(value, config);
    if (config.duration !== MOTION.papers.duration) return animation;
    const stop = jest.fn(() => animation.stop());
    runs.push({ stop });
    return { ...animation, stop };
  });
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
});

/** The paper's current horizontal offset from its usual place, and its opacity. */
function paper() {
  const style = StyleSheet.flatten(screen.getByTestId("home-preview-paper").props.style);
  const read = (value: number | { __getValue: () => number } | undefined) =>
    typeof value === "number" ? value : (value?.__getValue() ?? 0);
  const shift = (style.transform as { translateX?: number | { __getValue: () => number } }[]).find(
    (item) => item.translateX !== undefined,
  )?.translateX;
  return { x: read(shift), opacity: read(style.opacity as number | { __getValue: () => number }) };
}

it("slides one sheet of paper in from the left when Home appears, keeping the preview's text", async () => {
  await render_with_providers(<Home />);
  expect(runs).toHaveLength(1);
  expect(screen.getByText(/One dollar and eighty-seven cents/)).toBeTruthy();
  // Only the front, text-bearing sheet: no paper behind it.
  expect(screen.queryByTestId("home-preview-back-sheet")).toBeNull();
  // It starts to the left, out of view (not at rest), and the slide is long and eased.
  expect(paper()).toEqual({ x: -MOTION.papers.travel, opacity: 0 });
  // A long, unmistakable glide across the card rather than a quick flip.
  expect(MOTION.papers.travel).toBeGreaterThanOrEqual(100);
  expect(MOTION.papers.duration).toBeGreaterThanOrEqual(700);
  expect(MOTION.papers.duration).toBeLessThanOrEqual(900);
});

it("replays on every return to Home, but not on rerenders or progress updates", async () => {
  await render_with_providers(<Home />);
  expect(runs).toHaveLength(1);
  // Reading progress moves on and the screen rerenders: no replay.
  await act(async () => control.document({ ...story, sentenceIndex: 1, wordIndex: 3 }));
  await act(async () => control.document({ ...story, sentenceIndex: 2, wordIndex: 0 }));
  expect(runs).toHaveLength(1);
  // Away to another tab or screen, then back: it plays again, each time.
  await act(async () => control.focus(false));
  expect(runs[0].stop).toHaveBeenCalled();
  await act(async () => control.focus(true));
  expect(runs).toHaveLength(2);
  await act(async () => control.focus(false));
  await act(async () => control.focus(true));
  expect(runs).toHaveLength(3);
});

it("stops the slide whenever Home is left, even with quick back-and-forth", async () => {
  await render_with_providers(<Home />);
  for (let i = 0; i < 4; i++) {
    await act(async () => control.focus(false));
    await act(async () => control.focus(true));
  }
  await act(async () => control.focus(false));
  // Five arrivals, and every one was stopped when Home was left (the test renderer can't report native-driver
  // positions, so where the paper comes to rest is checked on a device).
  expect(runs).toHaveLength(5);
  expect(runs.every((run) => run.stop.mock.calls.length > 0)).toBe(true);
});

it("shows the paper in place, without sliding, when Reduce Motion is on", async () => {
  await render_with_providers(<Home />, { reduceMotion: true });
  expect(runs).toHaveLength(0);
  expect(paper()).toEqual({ x: 0, opacity: 1 });
  await act(async () => control.focus(false));
  await act(async () => control.focus(true));
  expect(runs).toHaveLength(0);
});

it("stops at once when Reduce Motion is turned on mid-slide, and stays still after", async () => {
  await render_with_providers(<Home />);
  expect(runs).toHaveLength(1);
  await act(async () => control.motion(true));
  expect(runs[0].stop).toHaveBeenCalled();
  // And with it on, coming back to Home doesn't animate.
  await act(async () => control.focus(false));
  await act(async () => control.focus(true));
  expect(runs).toHaveLength(1);
});
