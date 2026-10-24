/** Shared by native interactions and Remotion. Milliseconds, logical pixels, no runtime dependency. */
export const MOTION = {
  homeLogo: { duration: 600, settleDeadline: 1500, easing: [0.215, 0.61, 0.355, 1] },
  document: { open: 420, close: 240, textFrom: 0.42 },
  mode: { duration: 240, distance: 8, pillWidth: 88 },
  playback: { duration: 200, rows: 20 },
  saved: { duration: 340, hold: 2600 },
  finish: { ring: 520, short: 140, long: 180, totals: 240, actions: 220 },
  feedback: { duration: 280 },
} as const;

/** Two rectangles per scanline form one triangle, then separate into the two pause bars. */
export function playback_slices() {
  return Array.from({ length: MOTION.playback.rows }, (_, row) => {
    const y = 4 + ((row + 0.5) * 16) / MOTION.playback.rows;
    const width = 14 * (1 - Math.abs(y - 12) / 8);
    return [0, 1].map((side) => ({
      y: y - 12,
      height: 16 / MOTION.playback.rows + 0.05,
      fromX: 6 + (width * (side === 0 ? 1 : 3)) / 4 - 12,
      fromWidth: width / 2,
      toX: side === 0 ? -4 : 4,
      toWidth: 3.5,
    }));
  }).flat();
}
