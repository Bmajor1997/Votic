import { describe, expect, it } from "vitest";
import { readerSourceTransform } from "./readerTransform";

const window = { width: 400, height: 800 };

describe("Reader open/close transform", () => {
  it("starts on the tapped card's rectangle", () => {
    // A 200x100 card whose centre is at (150, 650).
    expect(readerSourceTransform({ x: 50, y: 600, width: 200, height: 100 }, window)).toEqual({
      scaleX: 0.5,
      scaleY: 0.125,
      translateX: 150 - 200,
      translateY: 650 - 400,
    });
  });
  it("fills the window when there is no source card", () => {
    expect(readerSourceTransform(null, window)).toEqual({
      scaleX: 1,
      scaleY: 1,
      translateX: 0,
      translateY: 0,
    });
  });
  it("never collapses to zero size for a tiny or empty card", () => {
    const transform = readerSourceTransform({ x: 10, y: 10, width: 0, height: 1 }, window);
    expect(transform.scaleX).toBe(0.05);
    expect(transform.scaleY).toBe(0.05);
  });
});
