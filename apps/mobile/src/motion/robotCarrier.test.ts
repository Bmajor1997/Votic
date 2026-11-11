import { describe, expect, it } from "vitest";
import { MOTION } from "./motionSpec";
import { HOME_ROBOT_TIMELINE, HOME_ROBOTS_GONE } from "./homeLogoTimeline";
import {
  ROBOT,
  ROBOT_BEATS,
  ROBOT_END,
  ROBOT_HANDOFF,
  ROBOT_TRAVEL,
  robot_pose,
  type RobotPose,
} from "./robotCarrier";

const rad = (deg: number) => (deg * Math.PI) / 180;
const range = (start: number, end: number, step = 0.0025) => {
  const out: number[] = [];
  for (let f = start; f <= end + 1e-9; f += step) out.push(Math.round(f * 1e6) / 1e6);
  return out;
};
/** Ankle from the joint angles (forward kinematics), in the robot's frame. */
function ankle_from_angles(pose: RobotPose, leg: 0 | 1) {
  const { thigh, knee } = pose.legs[leg];
  const a = rad(thigh);
  const b = rad(thigh + knee);
  return {
    x: ROBOT.hip.x - ROBOT.thigh * Math.sin(a) - ROBOT.shin * Math.sin(b),
    y: ROBOT.hip.y + pose.drop + ROBOT.thigh * Math.cos(a) + ROBOT.shin * Math.cos(b),
  };
}
/** Where an ankle is on screen (relative to the letter's final place), including turning around. */
function world_ankle_x(pose: RobotPose, leg: 0 | 1) {
  const local = ankle_from_angles(pose, leg).x;
  return pose.travel + pose.exit + ROBOT.hip.x + pose.facing * (local - ROBOT.hip.x);
}
const groundAnkle = ROBOT.ground - ROBOT.ankle;

describe("legs and feet", () => {
  it("reach their targets: the drawn joints put each ankle exactly where the gait places it", () => {
    for (const f of range(0, ROBOT_END)) {
      const pose = robot_pose(f);
      for (const leg of [0, 1] as const) {
        const ankle = ankle_from_angles(pose, leg);
        expect(ankle.x).toBeCloseTo(pose.legs[leg].ankle.x, 2);
        expect(ankle.y).toBeCloseTo(pose.legs[leg].ankle.y, 2);
      }
    }
  });

  it("keep a planted foot flat on the ground and still on screen: no sliding or floating", () => {
    let checked = 0;
    for (const walking of [range(0, ROBOT_BEATS.walk[1]), range(ROBOT_BEATS.exit[0], ROBOT_END)])
      for (let i = 1; i < walking.length; i++) {
        const before = robot_pose(walking[i - 1]);
        const after = robot_pose(walking[i]);
        for (const leg of [0, 1] as const) {
          if (!before.legs[leg].planted || !after.legs[leg].planted) continue;
          checked++;
          expect(after.legs[leg].ankle.y).toBeCloseTo(groundAnkle, 3);
          expect(world_ankle_x(after, leg)).toBeCloseTo(world_ankle_x(before, leg), 2);
          // Flat sole: the foot's absolute angle is level.
          expect(after.legs[leg].thigh + after.legs[leg].knee + after.legs[leg].foot).toBeCloseTo(0, 3);
        }
      }
    expect(checked).toBeGreaterThan(100);
  });

  it("alternate legs on slow, visible loaded steps: near, far, near, far, each lifted clear of the ground", () => {
    const steps = 4;
    const [start, end] = ROBOT_BEATS.walk;
    const swings: number[] = [];
    for (let step = 0; step < steps; step++) {
      const mid = robot_pose(start + ((end - start) * (step + 0.5)) / steps);
      const lifted = ([0, 1] as const).filter((leg) => !mid.legs[leg].planted);
      expect(lifted).toHaveLength(1);
      expect(groundAnkle - mid.legs[lifted[0]].ankle.y).toBeGreaterThan(2);
      swings.push(lifted[0]);
    }
    expect(swings).toEqual([0, 1, 0, 1]);
    const letterMs =
      (HOME_ROBOT_TIMELINE.letters[0][1] - HOME_ROBOT_TIMELINE.letters[0][0]) * MOTION.homeLogo.duration;
    expect((letterMs * (end - start)) / steps).toBeGreaterThanOrEqual(250);
  });

  it("stay under the hip: every ankle is within a stride of the body", () => {
    for (const f of range(0, ROBOT_END)) {
      for (const leg of robot_pose(f).legs)
        expect(Math.abs(leg.ankle.x - ROBOT.hip.x)).toBeLessThanOrEqual(7);
    }
  });
});

describe("carrying the letter", () => {
  it("leans back under the load and squints with effort", () => {
    for (const f of range(0, ROBOT_BEATS.settle[1])) {
      const pose = robot_pose(f);
      expect(pose.lean).toBeGreaterThanOrEqual(8);
      expect(pose.eye).toBeLessThan(0.5);
    }
    expect(robot_pose(ROBOT_BEATS.exit[0]).eye).toBe(1);
  });

  it("squats and bows to set the letter down, upright and in place exactly at the handoff", () => {
    const placed = robot_pose(ROBOT_HANDOFF);
    expect(placed.lean).toBe(0);
    expect(placed.travel).toBe(0);
    expect(placed.drop).toBeCloseTo(ROBOT.squat);
    expect(placed.bow).toBeCloseTo(ROBOT.bow);
    expect(robot_pose(0).travel).toBe(ROBOT_TRAVEL);
  });
});

describe("leaving", () => {
  it("lets go, turns to show its right side, then walks out to the right before fading", () => {
    expect(robot_pose(ROBOT_BEATS.turn[0]).facing).toBe(1);
    expect(robot_pose(ROBOT_BEATS.turn[1]).facing).toBe(-1);
    let previous = 0;
    for (const f of range(ROBOT_BEATS.exit[0], ROBOT_END)) {
      const pose = robot_pose(f);
      expect(pose.exit).toBeGreaterThanOrEqual(previous);
      previous = pose.exit;
    }
    // Visible steps out: well clear of the letter before it starts to fade.
    expect(robot_pose(ROBOT_BEATS.fadeOut[0]).exit).toBeGreaterThan(15);
    expect(robot_pose(ROBOT_BEATS.fadeOut[0]).opacity).toBe(1);
    expect(robot_pose(ROBOT_END).opacity).toBe(0);
  });
});

describe("home timeline", () => {
  it("starts each robot as the previous letter is placed, after the V, and clears the last before the finish", () => {
    const { letters, vSettle, finish } = HOME_ROBOT_TIMELINE;
    expect(letters[0][0]).toBeGreaterThanOrEqual(vSettle[1]);
    for (let i = 1; i < letters.length; i++) {
      const [start, end] = letters[i - 1];
      expect(letters[i][0]).toBeCloseTo(start + (end - start) * ROBOT_HANDOFF, 4);
    }
    expect(HOME_ROBOTS_GONE).toBeLessThanOrEqual(finish[0]);
  });
});
