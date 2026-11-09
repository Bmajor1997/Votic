import { expect, it } from "@jest/globals";
import { act, screen } from "@testing-library/react-native";
import { Animated, StyleSheet } from "react-native";
import { VoticWordmark, WORDMARK_TIMELINE, HOME_ROBOT_TIMELINE } from "../../src/components/VoticWordmark";
import { ROBOT_BEATS, ROBOT_HANDOFF } from "../../src/motion/robotCarrier";
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
  const value = StyleSheet.flatten(screen.getByTestId(testID, { includeHiddenElements: true }).props.style)
    .opacity as number | { __getValue: () => number };
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
  expect(screen.queryByTestId("votic-wordmark-robot-o")).toBeNull();
  for (const id of PIECES) expect(opacity(id)).toBe(1);
});

it("brings in each wing and letter on its own: every piece finishes before the next one starts", () => {
  const t = WORDMARK_TIMELINE;
  const sequence = [t.stroke, ...t.wings, t.vSettle, ...t.letters, t.finish];
  for (let index = 1; index < sequence.length; index++)
    expect(sequence[index][0]).toBeGreaterThanOrEqual(sequence[index - 1][1]);
});

/** A transform entry's current value (number or animated value) from an element's flattened style. */
function transform_value(testID: string, key: string, index = 0) {
  const style = StyleSheet.flatten(screen.getByTestId(testID, { includeHiddenElements: true }).props.style);
  const entries = (style.transform as Record<string, unknown>[]).filter((entry) => entry[key] !== undefined);
  const value = entries[index]?.[key] as number | string | { __getValue: () => number | string };
  return typeof value === "object" ? value.__getValue() : value;
}
const degrees = (testID: string, index = 0) => parseFloat(String(transform_value(testID, "rotate", index)));
const at_letter = (index: number, fraction: number) => {
  const [start, end] = HOME_ROBOT_TIMELINE.letters[index];
  return start + (end - start) * fraction;
};

it("brings each letter and its own robot in from the right after the V, then leaves the finished logo", async () => {
  const progress = new Animated.Value(0);
  await render_with_providers(<VoticWordmark entrance={progress} robotEntrance />);
  const letters = ["o", "t", "i", "c"] as const;
  await act(async () => progress.setValue(HOME_ROBOT_TIMELINE.vSettle[1]));
  for (const letter of letters) expect(opacity(`votic-wordmark-robot-${letter}`)).toBe(0);
  for (const [index, letter] of letters.entries()) {
    await act(async () => progress.setValue(at_letter(index, 0.3)));
    expect(opacity(`votic-wordmark-robot-${letter}`)).toBe(1);
    expect(opacity(`votic-robot-legs-${letter}`)).toBe(1);
    expect(opacity(`votic-robot-arm-${letter}`)).toBe(1);
    expect(opacity(`votic-wordmark-letter-${letter}`)).toBe(1);
    for (const other of letters.slice(index + 1)) expect(opacity(`votic-wordmark-robot-${other}`)).toBe(0);
    // Letter and robot travel together, still to the right of the letter's place.
    expect(transform_value(`votic-robot-carrier-${letter}`, "translateX")).toBeGreaterThan(0);
  }
  await act(async () => progress.setValue(1));
  for (const letter of letters) {
    expect(opacity(`votic-wordmark-robot-${letter}`)).toBe(0);
    expect(opacity(`votic-robot-arm-${letter}`)).toBe(0);
    expect(opacity(`votic-wordmark-letter-${letter}`)).toBe(1);
    expect(transform_value(`votic-robot-carrier-${letter}`, "translateX")).toBe(0);
    expect(transform_value(`votic-robot-letter-${letter}`, "translateX")).toBe(0);
    expect(transform_value(`votic-robot-letter-${letter}`, "translateY")).toBe(0);
    expect(degrees(`votic-robot-letter-${letter}`)).toBe(0);
  }
  expect(wordmark_scale()).toBe(1);
});

it("starts the next robot when the previous letter is placed", async () => {
  const t = HOME_ROBOT_TIMELINE;
  expect(t.letters[0][0]).toBeGreaterThanOrEqual(t.vSettle[1]);
  for (let index = 1; index < t.letters.length; index++) {
    const [start, end] = t.letters[index - 1];
    expect(t.letters[index][0]).toBeCloseTo(start + (end - start) * ROBOT_HANDOFF);
  }
  const progress = new Animated.Value(0);
  await render_with_providers(<VoticWordmark entrance={progress} robotEntrance />);
  await act(async () => progress.setValue(at_letter(0, ROBOT_HANDOFF)));
  // o is down, upright and in place, and t's robot is only now appearing.
  expect(transform_value("votic-robot-carrier-o", "translateX")).toBe(0);
  expect(transform_value("votic-robot-letter-o", "translateY")).toBeCloseTo(0);
  expect(degrees("votic-robot-letter-o")).toBeCloseTo(0);
  expect(opacity("votic-wordmark-robot-t")).toBe(0);
  await act(async () => progress.setValue(at_letter(1, 0.1)));
  expect(opacity("votic-wordmark-robot-t")).toBe(1);
  // The first robot is still visibly leaving while the next one arrives.
  expect(opacity("votic-wordmark-robot-o")).toBe(1);
});

it("hugs the letter to its chest: raised, leaning back with the body, on a short jointed arm", async () => {
  const progress = new Animated.Value(0);
  await render_with_providers(<VoticWordmark entrance={progress} robotEntrance />);
  await act(async () => progress.setValue(at_letter(0, 0.3)));
  // The body leans back (rotation is the last transform on the body frame), and the letter rides up with it.
  expect(degrees("votic-wordmark-robot-o")).toBeGreaterThanOrEqual(8);
  expect(transform_value("votic-robot-letter-o", "translateY")).toBeLessThan(-3);
  expect(degrees("votic-robot-letter-o")).toBeGreaterThanOrEqual(8);
  // Upper arm from the shoulder, forearm from the elbow, with the hand at the forearm's end.
  expect(screen.getByTestId("votic-robot-arm-o", { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByTestId("votic-robot-forearm-o", { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByTestId("votic-robot-hand-o", { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByTestId("votic-wordmark-letter-o").props.children).toBe("o");
  // Facing left: the robot's left side.
  expect(transform_value("votic-wordmark-robot-o", "scaleX")).toBe(1);
  // A tall letter stays upright under the chin instead of tipping back into the face.
  await act(async () => progress.setValue(at_letter(2, 0.3)));
  expect(Math.abs(degrees("votic-robot-letter-i"))).toBeLessThan(5);
});

it("walks on alternating legs while carrying", async () => {
  const progress = new Animated.Value(0);
  await render_with_providers(<VoticWordmark entrance={progress} robotEntrance />);
  const thigh = (side: number) => degrees(`votic-robot-leg-o-${side}`);
  const [walkStart, walkEnd] = ROBOT_BEATS.walk;
  const step = (walkEnd - walkStart) / 4;
  const leader: number[] = [];
  for (const n of [0, 1, 2]) {
    await act(async () => progress.setValue(at_letter(0, walkStart + n * step)));
    leader.push(Math.sign(thigh(0) - thigh(1)));
  }
  // The leading leg swaps on each step.
  expect(leader[0]).not.toBe(leader[1]);
  expect(leader[1]).not.toBe(leader[2]);
});

it("releases the letter, turns to the right and walks away", async () => {
  const progress = new Animated.Value(0);
  await render_with_providers(<VoticWordmark entrance={progress} robotEntrance />);
  await act(async () => progress.setValue(at_letter(0, ROBOT_BEATS.release[0])));
  const onLetter = transform_value("votic-robot-forearm-o", "translateX") as number;
  await act(async () => progress.setValue(at_letter(0, ROBOT_BEATS.release[1])));
  // The arm has come back off the letter towards the body.
  expect(transform_value("votic-robot-forearm-o", "translateX") as number).toBeGreaterThan(onLetter);
  expect(transform_value("votic-wordmark-robot-o", "scaleX")).toBeCloseTo(1);
  await act(async () => progress.setValue(at_letter(0, ROBOT_BEATS.turn[1])));
  expect(transform_value("votic-wordmark-robot-o", "scaleX")).toBeCloseTo(-1);
  expect(transform_value("votic-robot-legs-o", "scaleX")).toBeCloseTo(-1);
  let previous = 0;
  for (const fraction of [0.9, 0.97, 1.0]) {
    await act(async () => progress.setValue(at_letter(0, fraction)));
    const x = transform_value("votic-wordmark-robot-o", "translateX") as number;
    expect(x).toBeGreaterThan(previous);
    expect(transform_value("votic-robot-legs-o", "translateX")).toBeCloseTo(x);
    expect(opacity("votic-wordmark-robot-o")).toBe(1);
    previous = x;
  }
  // The letter stays put.
  expect(transform_value("votic-robot-carrier-o", "translateX")).toBe(0);
  expect(transform_value("votic-robot-letter-o", "translateX")).toBe(0);
});
