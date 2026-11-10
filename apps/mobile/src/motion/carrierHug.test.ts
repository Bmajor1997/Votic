import { describe, expect, it } from "vitest";
import { ARM, LETTER_INK, hug_pose, on_letter, tallness, type CarriedLetter } from "./carrierHug";
import { ROBOT, ROBOT_BEATS, ROBOT_END, ROBOT_HANDOFF } from "./robotCarrier";

const LETTERS: CarriedLetter[] = ["o", "t", "i", "c"];
const range = (start: number, end: number, step = 0.0025) => {
  const out: number[] = [];
  for (let f = start; f <= end + 1e-9; f += step) out.push(Math.round(f * 1e6) / 1e6);
  return out;
};
const back = (letter: CarriedLetter) => ({ x: -LETTER_INK[letter].rsb, y: ROBOT.baseline });
const rad = (deg: number) => (deg * Math.PI) / 180;
/** The end of a bone drawn from `from` at `angle` (degrees from straight down). */
const end = (from: { x: number; y: number }, angle: number, length: number) => ({
  x: from.x - length * Math.sin(rad(angle)),
  y: from.y + length * Math.cos(rad(angle)),
});
const loaded = range(0, ROBOT_HANDOFF - 0.0025);

describe("chest hug", () => {
  it("uses a short arm: a forearm no longer than the upper arm", () => {
    expect(ARM.fore).toBeLessThanOrEqual(ARM.upper);
    expect(ARM.upper + ARM.fore).toBeLessThan(18);
  });

  it("keeps the arm joined: shoulder → elbow → hand, as drawn, with the hand on the letter for every letter", () => {
    for (const letter of LETTERS) {
      const ink = LETTER_INK[letter];
      for (const f of loaded) {
        const pose = hug_pose(letter, f);
        expect(pose.gap).toBe(0);
        const elbow = end(pose.shoulder, pose.upperArm, ARM.upper);
        expect(elbow.x).toBeCloseTo(pose.elbow.x, 4);
        expect(elbow.y).toBeCloseTo(pose.elbow.y, 4);
        const hand = end(pose.elbow, pose.forearm, ARM.fore);
        expect(hand.x).toBeCloseTo(pose.hand.x, 4);
        expect(hand.y).toBeCloseTo(pose.hand.y, 4);
        // The hand rests on the letter's face: inside its ink box once the letter's move is undone.
        const b = back(letter);
        const local = on_letter({ x: -pose.letter.x, y: 0, angle: 0 }, b, {
          x: hand.x,
          y: hand.y - pose.letter.y,
        });
        const r = rad(-pose.letter.angle);
        const dx = local.x - b.x;
        const dy = local.y - b.y;
        const ux = b.x + dx * Math.cos(r) - dy * Math.sin(r);
        const uy = b.y + dx * Math.sin(r) + dy * Math.cos(r);
        expect(ux).toBeGreaterThanOrEqual(b.x - ink.width - 0.01);
        expect(ux).toBeLessThanOrEqual(b.x + 0.01);
        expect(uy).toBeGreaterThanOrEqual(b.y - ink.height - 0.01);
        expect(uy).toBeLessThanOrEqual(b.y + 0.01);
      }
    }
  });

  it("holds the letter against the chest, leaning back with the robot (short letters) or upright (tall ones)", () => {
    for (const letter of LETTERS) {
      const pose = hug_pose(letter, 0.25);
      expect(pose.upper).toBeGreaterThan(8);
      expect(pose.letter.y).toBeLessThan(-3);
      if (tallness(letter) === 0) expect(pose.letter.angle).toBeCloseTo(pose.upper);
      else expect(Math.abs(pose.letter.angle)).toBeLessThan(pose.upper);
    }
  });

  it("keeps every letter's top clear of the robot's head while carrying, so t and i stay readable", () => {
    for (const letter of LETTERS) {
      const ink = LETTER_INK[letter];
      for (const f of range(0, ROBOT_BEATS.settle[1])) {
        const pose = hug_pose(letter, f);
        // The head in the robot's frame, turned with the upper body about the hip.
        const center = {
          x: ROBOT.head.left + ROBOT.head.width / 2,
          y: ROBOT.head.top + ROBOT.head.height / 2,
        };
        const r = rad(pose.upper);
        const lx = center.x - ROBOT.hip.x;
        const ly = center.y - ROBOT.hip.y;
        const head = {
          x: pose.hip.x + pose.body.facing * (lx * Math.cos(r) - ly * Math.sin(r)),
          y: pose.hip.y + lx * Math.sin(r) + ly * Math.cos(r),
        };
        const b = back(letter);
        for (const corner of [
          { x: b.x, y: b.y - ink.height },
          { x: b.x - ink.width / 2, y: b.y - ink.height },
        ]) {
          const top = on_letter(pose.letter, b, corner);
          expect(Math.hypot(top.x - head.x, top.y - head.y)).toBeGreaterThan(ROBOT.head.height / 2 - 0.5);
        }
      }
    }
  });

  it("sets the letter down exactly in place, upright, at the handoff, and never puts a hand below the ground", () => {
    for (const letter of LETTERS) {
      const placed = hug_pose(letter, ROBOT_HANDOFF);
      expect(placed.letter).toEqual({ x: 0, y: 0, angle: 0 });
      for (const f of range(0, ROBOT_END))
        expect(hug_pose(letter, f).hand.y).toBeLessThanOrEqual(ROBOT.baseline);
    }
  });

  it("slides its hand back off the letter, then lets the arm hang beside the body", () => {
    for (const letter of LETTERS) {
      const b = back(letter);
      expect(hug_pose(letter, ROBOT_BEATS.release[0] + 0.03).hand.x).toBeGreaterThan(b.x);
      const hanging = hug_pose(letter, ROBOT_BEATS.release[1]);
      expect(Math.abs(hanging.hand.x - hanging.hip.x)).toBeLessThan(4);
    }
  });
});
