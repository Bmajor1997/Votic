import { expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Animated, Pressable, Text } from "react-native";
import { useAccessibilityPreferences } from "../../src/accessibility/AccessibilityProvider";
import { PaywallIntro } from "../../src/subscription/PaywallContent";
import { render_with_providers } from "../renderWithProviders";

type Readable = Animated.Value & { __getValue(): number };

function MotionControl() {
  const { reduceMotion, set_reduce_motion } = useAccessibilityPreferences();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Toggle motion"
      onPress={() => set_reduce_motion(!reduceMotion)}
    >
      <Text>Toggle motion</Text>
    </Pressable>
  );
}

/** Records each piece that animates back into place (toValue 0), in the order the timings are created. */
function observe_arrival() {
  const timing = Animated.timing;
  const landings: { value: Readable }[] = [];
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => {
    if (config.toValue === 0 && config.easing) landings.push({ value: value as Readable });
    return timing(value, config);
  });
  return landings;
}

it("assembles the paywall V once: the stroke and then each wing land in place, without looping", async () => {
  const landings = observe_arrival();
  await render_with_providers(<PaywallIntro />);
  expect(screen.getByTestId("paywall-brand-mark")).toBeTruthy();
  // The stroke plus three wings.
  expect(landings).toHaveLength(4);
  expect(landings.every(({ value }) => value.__getValue() === 1)).toBe(true);
  await act(async () => jest.advanceTimersByTime(3000));
  expect(landings.every(({ value }) => value.__getValue() === 0)).toBe(true);
  await act(async () => jest.advanceTimersByTime(10_000));
  expect(landings).toHaveLength(4);
});

it("shows the V already whole with Reduce Motion enabled", async () => {
  const landings = observe_arrival();
  await render_with_providers(<PaywallIntro />, { reduceMotion: true });
  await act(async () => jest.advanceTimersByTime(2000));
  expect(landings).toHaveLength(0);
  expect(screen.getByTestId("paywall-brand-mark")).toBeTruthy();
});

it("settles immediately if Reduce Motion is enabled and does not replay when it is switched back", async () => {
  const landings = observe_arrival();
  await render_with_providers(
    <>
      <PaywallIntro />
      <MotionControl />
    </>,
  );
  expect(landings).toHaveLength(4);
  await act(async () => jest.advanceTimersByTime(250));
  await fireEvent.press(screen.getByRole("button", { name: "Toggle motion" }));
  expect(landings.every(({ value }) => value.__getValue() === 0)).toBe(true);
  await fireEvent.press(screen.getByRole("button", { name: "Toggle motion" }));
  await act(async () => jest.advanceTimersByTime(2000));
  expect(landings).toHaveLength(4);
});
