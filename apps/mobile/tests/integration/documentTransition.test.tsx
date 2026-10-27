import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import { Animated, AppState, type AppStateStatus } from "react-native";
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
async function render_transition() {
  const hook = await renderHook(() => useDocumentTransition(), { wrapper });
  await act(async () => {});
  return hook;
}

describe("Reader open/close transition", () => {
  it("opens from the tapped card, then closes back to it", async () => {
    const { result } = await render_transition();
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
    const { result } = await render_transition();
    const closeReader = jest.fn();
    await act(async () => result.current.openReader(card, () => {}));
    await act(async () => result.current.beginReader());
    await act(async () => result.current.closeReader(closeReader));
    await act(async () => jest.advanceTimersByTime(600));
    expect(closeReader).toHaveBeenCalledTimes(1);
  });

  it("ignores a second open while the first is still running", async () => {
    const { result } = await render_transition();
    const first = jest.fn();
    const second = jest.fn();
    await act(async () => result.current.openReader(card, first));
    await act(async () => result.current.openReader(card, second));
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it("closes immediately with Reduce Motion", async () => {
    await AsyncStorage.setItem("votic.mobile.accessibility.v1", JSON.stringify({ reduceMotion: true }));
    const { result } = await render_transition();
    const closeReader = jest.fn();
    await act(async () => result.current.openReader(card, () => {}));
    await act(async () => result.current.beginReader());
    await act(async () => result.current.closeReader(closeReader));
    expect(closeReader).toHaveBeenCalledTimes(1);
  });
});

describe("Interrupted navigation", () => {
  it("releases the open lock when the native animation is interrupted", async () => {
    let complete: ((result: { finished: boolean }) => void) | undefined;
    jest.spyOn(Animated, "timing").mockImplementation(() => ({
      start: (callback) => {
        complete = callback;
      },
      stop: jest.fn(),
      reset: jest.fn(),
    }));
    const { result } = await render_transition();
    await act(async () => result.current.openReader(card, () => {}));
    await act(async () => result.current.beginReader());
    await act(async () => complete!({ finished: false }));
    expect(result.current.transitioning).toBe(false);
    const reopen = jest.fn();
    await act(async () => result.current.openReader(card, reopen));
    expect(reopen).toHaveBeenCalledTimes(1);
  });

  it("ignores duplicate Close and late readiness callbacks", async () => {
    const close = jest.fn();
    const { result } = await render_transition();
    await act(async () => result.current.openReader(card, () => {}));
    await act(async () => result.current.closeReader(close));
    await act(async () => result.current.closeReader(close));
    await act(async () => result.current.beginReader());
    await act(async () => jest.advanceTimersByTime(1000));
    expect(close).toHaveBeenCalledTimes(1);
    expect(result.current.transitioning).toBe(false);
    expect(result.current.sourceRect).toBeNull();
  });
});

it.each(["preparing", "opening", "closing"])(
  "settles %s on screen lock/background and ignores stale animation callbacks",
  async (phase) => {
    let change: (state: AppStateStatus) => void = () => {};
    jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
      change = listener;
      return { remove: jest.fn() };
    });
    const callbacks: ((result: { finished: boolean }) => void)[] = [];
    jest.spyOn(Animated, "timing").mockImplementation(() => ({
      start: (callback) => {
        if (callback) callbacks.push(callback);
      },
      stop: jest.fn(),
      reset: jest.fn(),
    }));
    const { result } = await render_transition();
    const close = jest.fn();
    await act(async () => result.current.openReader(card, () => {}));
    if (phase !== "preparing") await act(async () => result.current.beginReader());
    if (phase === "closing") await act(async () => result.current.closeReader(close));
    await act(async () => change("background"));
    await act(async () => change("active"));
    await act(async () => callbacks.forEach((callback) => callback({ finished: false })));
    expect(result.current.transitioning).toBe(false);
    expect(close).toHaveBeenCalledTimes(phase === "closing" ? 1 : 0);
    expect(result.current.sourceRect).toEqual(phase === "closing" ? null : card);
    const reopen = jest.fn();
    await act(async () => result.current.openReader(card, reopen));
    expect(reopen).toHaveBeenCalledTimes(1);
  },
);

it("does not navigate from animation callbacks after the provider unmounts", async () => {
  let complete: ((result: { finished: boolean }) => void) | undefined;
  jest.spyOn(Animated, "timing").mockImplementation(() => ({
    start: (callback) => {
      complete = callback;
    },
    stop: jest.fn(),
    reset: jest.fn(),
  }));
  const { result, unmount } = await render_transition();
  const close = jest.fn();
  await act(async () => result.current.closeReader(close));
  await unmount();
  await act(async () => complete!({ finished: true }));
  expect(close).not.toHaveBeenCalled();
});
