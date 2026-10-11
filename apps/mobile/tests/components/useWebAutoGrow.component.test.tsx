import { describe, expect, it, jest } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";
import { useWebAutoGrow } from "../../src/components/useWebAutoGrow";

/** A stand-in for the web's text box: its scroll height is its text's height, or its own height if taller. */
function textBox(lines: () => number) {
  const node = {
    style: { height: "" },
    get scrollHeight() {
      const own = parseFloat(node.style.height) || 0;
      return Math.max(own, lines() * 20 + 26);
    },
  };
  return node;
}

describe("useWebAutoGrow", () => {
  it("grows a line at a time up to the limit, and shrinks again as text is removed", async () => {
    const platform = jest.replaceProperty(Platform, "OS", "web");
    let lines = 1;
    const ref = { current: textBox(() => lines) };
    const view = await renderHook(({ value }: { value: string }) => useWebAutoGrow(ref, value, 46, 146), {
      initialProps: { value: "a" },
    });
    const height = () => ref.current.style.height;
    expect(height()).toBe("46px");
    for (const [count, expected] of [
      [2, "66px"],
      [4, "106px"],
      [6, "146px"],
      [9, "146px"],
      [3, "86px"],
      [1, "46px"],
    ] as const) {
      lines = count;
      await view.rerender({ value: `text with ${count} lines` });
      expect(height()).toBe(expected);
    }
    platform.restore();
  });

  it("leaves phones to grow the box by themselves", async () => {
    const ref = { current: textBox(() => 4) };
    await renderHook(() => useWebAutoGrow(ref, "four lines", 46, 146));
    expect(ref.current.style.height).toBe("");
  });
});
