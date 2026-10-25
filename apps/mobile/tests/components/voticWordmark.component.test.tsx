import { expect, it } from "@jest/globals";
import { act, screen } from "@testing-library/react-native";
import { Animated, StyleSheet } from "react-native";
import { VoticWordmark, WORDMARK_TIMELINE } from "../../src/components/VoticWordmark";
import { render_with_providers } from "../renderWithProviders";

const PIECES = [
  "votic-wordmark-stroke",
  "votic-wordmark-wing-1",
  "votic-wordmark-wing-2",
  "votic-wordmark-wing-3",
  "votic-wordmark-letter-o",
  "votic-wordmark-letter-t",
  "votic-wordmark-letter-i",
  "votic-wordmark-letter-c",
];
/** The wordmark's current overall scale, whether the test renderer reports a number or an animated value. */
function wordmark_scale() {
  const style = StyleSheet.flatten(screen.getByTestId("votic-wordmark").props.style);
  const value = (style.transform as { scale: number | { __getValue: () => number } }[])[0].scale;
  return typeof value === "number" ? value : value.__getValue();
}
function opacity(testID: string) {
  const value = StyleSheet.flatten(screen.getByTestId(testID).props.style).opacity as
    number | { __getValue: () => number };
  return typeof value === "number" ? value : value.__getValue();
}
/** The moment each piece first becomes visible as the entrance runs from 0 to 1. */
async function first_visible(progress: Animated.Value) {
  const seen: Record<string, number> = {};
  for (let step = 0; step <= 200; step++) {
    await act(async () => progress.setValue(step / 200));
    for (const id of PIECES) if (seen[id] === undefined && opacity(id) > 0.05) seen[id] = step / 200;
  }
  return seen;
}

it("builds the V from its left stroke, then the top, middle and bottom wings, then o, t, i and c", async () => {
  const progress = new Animated.Value(0);
  await render_with_providers(<VoticWordmark entrance={progress} />);
  for (const id of PIECES) expect(opacity(id)).toBe(0);
  const seen = await first_visible(progress);
  const order = [...PIECES].sort((a, b) => seen[a] - seen[b]);
  expect(order).toEqual(PIECES);
  // The letters wait until the whole V has appeared.
  expect(seen["votic-wordmark-letter-o"]).toBeGreaterThan(seen["votic-wordmark-wing-3"]);
  for (const id of PIECES) expect(opacity(id)).toBe(1);
});

it("ends exactly at the finished logo: every piece in place, with only a small settle on the way", async () => {
  const progress = new Animated.Value(0);
  await render_with_providers(<VoticWordmark entrance={progress} />);
  await act(async () => progress.setValue(1));
  expect(wordmark_scale()).toBe(1);
  // The finishing emphasis stays subtle.
  await act(async () => progress.setValue((WORDMARK_TIMELINE.finish[0] + WORDMARK_TIMELINE.finish[1]) / 2));
  const peak = wordmark_scale();
  expect(peak).toBeGreaterThan(1);
  expect(peak).toBeLessThanOrEqual(1.04);
});

it("is the finished, accessible logo when there is no entrance", async () => {
  await render_with_providers(<VoticWordmark />);
  expect(screen.getByRole("image", { name: "Votic logo" })).toBeTruthy();
  for (const id of PIECES) expect(opacity(id)).toBe(1);
});
it("brings in each wing and letter on its own: every piece finishes before the next one starts", () => {
  const t = WORDMARK_TIMELINE;
  const sequence = [t.stroke, ...t.wings, t.vSettle, ...t.letters, t.finish];
  for (let index = 1; index < sequence.length; index++)
    expect(sequence[index][0]).toBeGreaterThanOrEqual(sequence[index - 1][1]);
});
