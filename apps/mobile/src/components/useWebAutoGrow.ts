import { RefObject, useLayoutEffect } from "react";
import { Platform } from "react-native";

type Measurable = { style: { height: string }; scrollHeight: number };

/**
 * Sizes a multi-line question box to its text on the web, a line at a time between `min` and `max`.
 * Phones grow a multi-line TextInput by themselves. The web's own measurement only grows (a text box's
 * scroll height never drops below its current height), so the box is collapsed before measuring, which
 * lets it shrink again as text is deleted, sent, or replaced by a voice transcript.
 */
export function useWebAutoGrow(ref: RefObject<unknown>, value: string, min: number, max: number) {
  useLayoutEffect(() => {
    if (Platform.OS !== "web") return;
    const node = ref.current as Partial<Measurable> | null;
    if (!node?.style || typeof node.scrollHeight !== "number") return;
    node.style.height = "0px";
    const height = Math.min(max, Math.max(min, node.scrollHeight));
    node.style.height = `${height}px`;
  }, [ref, value, min, max]);
}
