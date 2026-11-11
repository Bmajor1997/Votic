import { ROBOT_END, ROBOT_HANDOFF } from "./robotCarrier";

/** Each robot's visit, as a share of the Home entrance; its exit continues past the end of its range. */
const LETTER = 0.23;
const FIRST = 0.216;
const letter = (index: number) => {
  const start = FIRST + index * LETTER * ROBOT_HANDOFF;
  return [round(start), round(start + LETTER)] as const;
};
const round = (value: number) => Math.round(value * 1e5) / 1e5;

/**
 * Home allocates more time to each robot while preserving the V's existing timing. The next carrier begins when the
 * previous letter is placed (ROBOT_HANDOFF of its range), and the last robot is gone before the finishing settle.
 */
export const HOME_ROBOT_TIMELINE = {
  stroke: [0, 0.048],
  wings: [
    [0.048, 0.096],
    [0.096, 0.144],
    [0.144, 0.192],
  ],
  vSettle: [0.192, 0.216],
  letters: [letter(0), letter(1), letter(2), letter(3)],
  finish: [0.97, 1],
} as const;

/** When the last robot has walked off (its exit runs past its letter range). */
export const HOME_ROBOTS_GONE = round(HOME_ROBOT_TIMELINE.letters[3][0] + LETTER * ROBOT_END);

/**
 * Which letters have a robot on screen at entrance progress `t` (with a margin either side). Outside that window a
 * letter is either not there yet (invisible) or already placed, so it can be drawn as a plain letter with no robot
 * views: each wordmark then animates only what can be seen, which keeps page changes mid-entrance smooth.
 */
export const LIVE_MARGIN = 0.04;
const LIVE_WINDOWS = HOME_ROBOT_TIMELINE.letters.map(
  ([start, end]) => [start - LIVE_MARGIN, start + (end - start) * ROBOT_END + LIVE_MARGIN] as const,
);
export const NO_LIVE_LETTERS: readonly boolean[] = [false, false, false, false];
export function live_letters(t: number): readonly boolean[] {
  return LIVE_WINDOWS.map(([from, to]) => t >= from && t <= to);
}
/** The moments (0–1) when the set of live letters changes. */
export const LIVE_CHANGES: readonly number[] = [...new Set(LIVE_WINDOWS.flat().map(round))]
  .filter((t) => t > 0 && t < 1)
  .sort((a, b) => a - b);
