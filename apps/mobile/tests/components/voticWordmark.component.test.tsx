import { expect, it } from "@jest/globals";
import { act, screen } from "@testing-library/react-native";
import { Animated, StyleSheet } from "react-native";
import { VoticWordmark, WORDMARK_TIMELINE, HOME_ROBOT_TIMELINE } from "../../src/components/VoticWordmark";
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

it("brings each letter and its own robot in from the right after the V, then leaves the finished logo", async () => {
  const progress = new Animated.Value(0);
  await render_with_providers(<VoticWordmark entrance={progress} robotEntrance />);
  const letters = ["o", "t", "i", "c"] as const;
  await act(async () => progress.setValue(HOME_ROBOT_TIMELINE.vSettle[1]));
  for (const letter of letters) expect(opacity(`votic-wordmark-robot-${letter}`)).toBe(0);
  for (const [index, letter] of letters.entries()) {
    const range = HOME_ROBOT_TIMELINE.letters[index];
    await act(async () => progress.setValue(range[0] + (range[1] - range[0]) * 0.3));
    expect(opacity(`votic-wordmark-robot-${letter}`)).toBe(1);
    for (const other of letters.slice(index + 1))
      expect(opacity(`votic-wordmark-robot-${other}`)).toBe(0);
    const robot = StyleSheet.flatten(
      screen.getByTestId(`votic-wordmark-robot-${letter}`, { includeHiddenElements: true }).props.style,
    );
    const glyph = StyleSheet.flatten(screen.getByTestId(`votic-wordmark-letter-${letter}`).props.style);
    const x = (style: typeof robot) => {
      const value = (style.transform as { translateX: number | { __getValue: () => number } }[])[0]
        .translateX;
      return typeof value === "number" ? value : value.__getValue();
    };
    expect(x(robot)).toBeGreaterThan(0);
    expect(x(robot)).toBeCloseTo(x(glyph));
  }
  await act(async () => progress.setValue(1));
  for (const letter of letters) {
    expect(opacity(`votic-wordmark-robot-${letter}`)).toBe(0);
    expect(opacity(`votic-wordmark-letter-${letter}`)).toBe(1);
  }
});
it("brings in each wing and letter on its own: every piece finishes before the next one starts", () => {
  const t = WORDMARK_TIMELINE;
  const sequence = [t.stroke, ...t.wings, t.vSettle, ...t.letters, t.finish];
  for (let index = 1; index < sequence.length; index++)
    expect(sequence[index][0]).toBeGreaterThanOrEqual(sequence[index - 1][1]);
});

it("starts the next robot when the previous letter is placed", () => {
  const t = HOME_ROBOT_TIMELINE;
  expect(t.letters[0][0]).toBeGreaterThanOrEqual(t.vSettle[1]);
  for (let index = 1; index < t.letters.length; index++) {
    const [start, end] = t.letters[index - 1];
    expect(t.letters[index][0]).toBeCloseTo(start + (end - start) * 0.72);
    expect(t.letters[index][0]).toBeLessThan(end);
  }
});

it("alternates the robot legs while walking and keeps its body leaning back", async () => {
  const progress = new Animated.Value(0);
  await render_with_providers(<VoticWordmark entrance={progress} robotEntrance />);
  const [start, end] = HOME_ROBOT_TIMELINE.letters[0];
  const rotation = (id: string) => {
    const style = StyleSheet.flatten(screen.getByTestId(id, { includeHiddenElements: true }).props.style);
    const rotate = (style.transform as { rotate: string | { __getValue: () => string } }[]).find((part) => part.rotate)?.rotate;
    return typeof rotate === "string" ? rotate : rotate?.__getValue();
  };
  await act(async () => progress.setValue(start + (end - start) * 0.16));
  expect(rotation("votic-robot-leg-o-0")).toBe("-20deg");
  expect(rotation("votic-robot-leg-o-1")).toBe("20deg");
  expect(rotation("votic-robot-lean-o")).not.toBe("0deg");
  await act(async () => progress.setValue(start + (end - start) * 0.32));
  expect(rotation("votic-robot-leg-o-0")).toBe("20deg");
  expect(rotation("votic-robot-leg-o-1")).toBe("-20deg");
});

it("shows a side-profile carrier while leaving the full letter visible", async () => {
  const progress = new Animated.Value(0);
  await render_with_providers(<VoticWordmark entrance={progress} robotEntrance />);
  const [start, end] = HOME_ROBOT_TIMELINE.letters[0];
  await act(async () => progress.setValue(start + (end - start) * 0.3));
  expect(screen.getByTestId("votic-robot-profile-o", { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByTestId("votic-wordmark-letter-o").props.children).toBe("o");
  expect(opacity("votic-wordmark-letter-o")).toBeGreaterThan(0);
});

 it("keeps the grip aligned with the letter and releases it on placement", async () => {
  const progress = new Animated.Value(0);
  await render_with_providers(<VoticWordmark entrance={progress} robotEntrance />);
  const [start, end] = HOME_ROBOT_TIMELINE.letters[0];
  await act(async () => progress.setValue(start + (end - start) * 0.3));
  const grip = StyleSheet.flatten(screen.getByTestId("votic-robot-grip-o", { includeHiddenElements: true }).props.style);
  const glyph = StyleSheet.flatten(screen.getByTestId("votic-wordmark-letter-o").props.style);
  const x = (style: typeof grip) => {
    const value = (style.transform as { translateX: number | { __getValue: () => number } }[])[0].translateX;
    return typeof value === "number" ? value : value.__getValue();
  };
  expect(x(grip)).toBeCloseTo(x(glyph));
  expect(opacity("votic-robot-grip-o")).toBe(1);
  await act(async () => progress.setValue(start + (end - start) * 0.72));
  expect(opacity("votic-robot-grip-o")).toBe(0);
});

it("alternates raised and grounded feet during the carry", async () => {
  const progress = new Animated.Value(0);
  await render_with_providers(<VoticWordmark entrance={progress} robotEntrance />);
  const [start, end] = HOME_ROBOT_TIMELINE.letters[0];
  const lift = (side: number) => {
    const style = StyleSheet.flatten(screen.getByTestId(`votic-robot-leg-o-${side}`, { includeHiddenElements: true }).props.style);
    const value = (style.transform as { translateY?: number | { __getValue: () => number } }[]).find((item) => item.translateY !== undefined)?.translateY;
    return typeof value === "number" ? value : value?.__getValue();
  };
  await act(async () => progress.setValue(start + (end - start) * 0.16));
  expect(lift(0)).toBeCloseTo(0);
  expect(lift(1)).toBeCloseTo(-4);
  await act(async () => progress.setValue(start + (end - start) * 0.32));
  expect(lift(0)).toBeCloseTo(-4);
  expect(lift(1)).toBeCloseTo(0);
});

 it("turns to the right and walks away after placement", async () => {
  const progress = new Animated.Value(0);
  await render_with_providers(<VoticWordmark entrance={progress} robotEntrance />);
  const [start, end] = HOME_ROBOT_TIMELINE.letters[0];
  const read = (id: string, key: string) => {
    const style = StyleSheet.flatten(screen.getByTestId(id, { includeHiddenElements: true }).props.style);
    const entry = (style.transform as Record<string, number | { __getValue: () => number }>[])
      .find((item) => item[key] !== undefined)?.[key];
    return typeof entry === "number" ? entry : entry?.__getValue();
  };
  await act(async () => progress.setValue(start + (end - start) * 0.79));
  expect(read("votic-wordmark-robot-o", "scaleX")).toBeCloseTo(-1);
  expect(read("votic-wordmark-robot-o", "translateX")).toBeCloseTo(0);
  await act(async () => progress.setValue(start + (end - start) * 0.86));
  expect(read("votic-wordmark-robot-o", "translateX")).toBeGreaterThan(0);
  expect(read("votic-robot-leg-o-1", "translateY")).toBeCloseTo(-4);
});
