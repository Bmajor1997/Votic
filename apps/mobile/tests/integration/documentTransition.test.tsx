import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import { PropsWithChildren } from "react";
import { AccessibilityProvider } from "../../src/accessibility/AccessibilityProvider";
import {
  DocumentTransitionProvider,
  useDocumentTransition,
} from "../../src/navigation/DocumentTransitionProvider";

const card = { x: 20, y: 300, width: 350, height: 80 };
function wrapper({ children }: PropsWithChildren) {
  return (
    <AccessibilityProvider>
      <DocumentTransitionProvider>{children}</DocumentTransitionProvider>
    </AccessibilityProvider>
  );
}
async function renderTransition() {
  const hook = await renderHook(() => useDocumentTransition(), { wrapper });
  await act(async () => {});
  return hook;
}

describe("Reader open/close transition", () => {
  it("opens from the tapped card, then closes back to it", async () => {
    const { result } = await renderTransition();
    const openReader = jest.fn();
    const closeReader = jest.fn();
    await act(async () => result.current.openReader(card, openReader));
    expect(openReader).toHaveBeenCalledTimes(1);
    expect(result.current.sourceRect).toEqual(card);
    await act(async () => result.current.beginReader());
    await act(async () => jest.advanceTimersByTime(300));
    expect(result.current.transitioning).toBe(false);
    await act(async () => result.current.closeReader(closeReader));
    expect(closeReader).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(300));
    expect(closeReader).toHaveBeenCalledTimes(1);
  });

  it("still closes when Close is pressed while the Reader is opening", async () => {
    const { result } = await renderTransition();
    const closeReader = jest.fn();
    await act(async () => result.current.openReader(card, () => {}));
    await act(async () => result.current.beginReader());
    await act(async () => result.current.closeReader(closeReader));
    await act(async () => jest.advanceTimersByTime(600));
    expect(closeReader).toHaveBeenCalledTimes(1);
  });

  it("ignores a second open while the first is still running", async () => {
    const { result } = await renderTransition();
    const first = jest.fn();
    const second = jest.fn();
    await act(async () => result.current.openReader(card, first));
    await act(async () => result.current.openReader(card, second));
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it("closes immediately with Reduce Motion", async () => {
    await AsyncStorage.setItem("votic.mobile.accessibility.v1", JSON.stringify({ reduceMotion: true }));
    const { result } = await renderTransition();
    const closeReader = jest.fn();
    await act(async () => result.current.openReader(card, () => {}));
    await act(async () => result.current.beginReader());
    await act(async () => result.current.closeReader(closeReader));
    expect(closeReader).toHaveBeenCalledTimes(1);
  });
});
