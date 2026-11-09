import { describe, expect, it } from "vitest";
import { HOME_ROBOT_TIMELINE, LIVE_CHANGES, live_letters } from "./homeLogoTimeline";
import { MOTION } from "./motionSpec";
import { ROBOT_END, robotPose } from "./robotCarrier";

const steps = (step = 0.001) => Array.from({ length: Math.round(1 / step) + 1 }, (_, i) => i * step);
/** Whether letter `index`'s robot can be seen at entrance progress `t`. */
function robot_visible(index: number, t: number) {
  const [start, end] = HOME_ROBOT_TIMELINE.letters[index];
  const f = (t - start) / (end - start);
  return f >= 0 && f <= ROBOT_END && robotPose(f).opacity > 0;
}

describe("live letters (which robots are drawn)", () => {
  it("draws every robot whenever it can be seen, even if an update arrives up to 300 ms late", () => {
    const slack = 300 / MOTION.homeLogo.duration;
    for (const t of steps())
      for (let index = 0; index < 4; index++) {
        if (!robot_visible(index, t)) continue;
        // The set in force at t may have been computed up to `slack` earlier, or be about to change.
        expect(live_letters(t)[index]).toBe(true);
        expect(live_letters(Math.max(0, t - slack))[index]).toBe(true);
      }
  });

  it("draws only the robots around what's visible: at most two seen, three drawn only across a safety margin", () => {
    let drawn = 0;
    for (const t of steps()) {
      const live = live_letters(t).filter(Boolean).length;
      const seen = [0, 1, 2, 3].filter((index) => robot_visible(index, t)).length;
      expect(seen).toBeLessThanOrEqual(2);
      expect(live).toBeLessThanOrEqual(3);
      drawn += live;
    }
    // On average well under the four robots that used to be drawn for the whole entrance.
    expect(drawn / steps().length).toBeLessThan(2);
    expect(live_letters(HOME_ROBOT_TIMELINE.wings[2][0])).toEqual([false, false, false, false]);
    expect(live_letters(0.5).filter(Boolean).length).toBeGreaterThan(0);
  });

  it("changes only a handful of times over the whole entrance", () => {
    expect(LIVE_CHANGES.length).toBeLessThanOrEqual(8);
    for (let i = 1; i < LIVE_CHANGES.length; i++)
      expect(LIVE_CHANGES[i]).toBeGreaterThan(LIVE_CHANGES[i - 1]);
  });
});
