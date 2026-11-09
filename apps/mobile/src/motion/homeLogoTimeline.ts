/** Home allocates more time to each robot while preserving the V's existing timing. */
export const HOME_ROBOT_TIMELINE = {
  stroke: [0, 0.048],
  wings: [[0.048, 0.096], [0.096, 0.144], [0.144, 0.192]],
  vSettle: [0.192, 0.216],
  // The next carrier begins when the previous letter is placed (72% of its delivery).
  letters: [[0.216, 0.428], [0.36864, 0.58064], [0.52128, 0.73328], [0.67392, 0.88592]],
  finish: [0.97, 1],
} as const;

