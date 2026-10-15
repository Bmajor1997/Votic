import { expect, it } from "vitest";
import { ai_shimmer_colors } from "./aiShimmerColors";

function luminance(hex: string) {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

it.each([
  ["light", "#FFFFFF"],
  ["light", "#F3F6FC"],
  ["dark", "#0B1220"],
  ["dark", "#292D32"],
  ["sepia", "#F4ECD8"],
] as const)("keeps every shimmer color readable on %s / %s", (mode, background) => {
  const { blue, violet } = ai_shimmer_colors(mode);
  // Check the whole sweep rather than only the endpoints.
  for (let step = 0; step <= 100; step++) {
    const color =
      "#" +
      [1, 3, 5]
        .map((start) => {
          const a = parseInt(blue.slice(start, start + 2), 16);
          const b = parseInt(violet.slice(start, start + 2), 16);
          return Math.round(a + ((b - a) * step) / 100)
            .toString(16)
            .padStart(2, "0");
        })
        .join("");
    const [a, b] = [luminance(color), luminance(background)].sort((x, y) => y - x);
    expect((a + 0.05) / (b + 0.05)).toBeGreaterThanOrEqual(4.5);
  }
});
