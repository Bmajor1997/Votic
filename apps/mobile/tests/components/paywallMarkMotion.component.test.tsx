import { expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Animated, Pressable, Text } from "react-native";
import { useAccessibilityPreferences } from "../../src/accessibility/AccessibilityProvider";
import { PaywallIntro } from "../../src/subscription/PaywallContent";
import { render_with_providers } from "../renderWithProviders";

function MotionControl() {
  const { reduceMotion, setReduceMotion } = useAccessibilityPreferences();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Toggle motion"
      onPress={() => setReduceMotion(!reduceMotion)}
    >
      <Text>Toggle motion</Text>
    </Pressable>
  );
}

function observe_pulse() {
  const timing = Animated.timing;
  const values: Animated.Value[] = [];
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => {
    if (config.toValue === 0.68) values.push(value as Animated.Value);
    return timing(value, config);
  });
  return values;
}

it("finishes the paywall wing pulse once and remains fully visible without looping", async () => {
  const pulses = observe_pulse();
  await render_with_providers(<PaywallIntro />);
  expect(screen.getByTestId("paywall-brand-mark")).toBeTruthy();
  expect(pulses).toHaveLength(1);
  await act(async () => jest.advanceTimersByTime(2000));
  expect((pulses[0] as Animated.Value & { __getValue(): number }).__getValue()).toBe(1);
  await act(async () => jest.advanceTimersByTime(10_000));
  expect(pulses).toHaveLength(1);
});

it("skips the pulse with Reduce Motion enabled", async () => {
  const pulses = observe_pulse();
  await render_with_providers(<PaywallIntro />, { reduceMotion: true });
  await act(async () => jest.advanceTimersByTime(2000));
  expect(pulses).toHaveLength(0);
  expect(screen.getByTestId("paywall-brand-mark")).toBeTruthy();
});

it("settles immediately if Reduce Motion is enabled and does not replay when it is switched back", async () => {
  const pulses = observe_pulse();
  await render_with_providers(
    <>
      <PaywallIntro />
      <MotionControl />
    </>,
  );
  expect(pulses).toHaveLength(1);
  await act(async () => jest.advanceTimersByTime(250));
  await fireEvent.press(screen.getByRole("button", { name: "Toggle motion" }));
  expect((pulses[0] as Animated.Value & { __getValue(): number }).__getValue()).toBe(1);
  await fireEvent.press(screen.getByRole("button", { name: "Toggle motion" }));
  await act(async () => jest.advanceTimersByTime(2000));
  expect(pulses).toHaveLength(1);
});
