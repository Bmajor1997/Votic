import { beforeEach, expect, it, jest } from "@jest/globals";
import * as Speech from "expo-speech";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import { useAnswerListening } from "../../src/ask/useAnswerListening";
import { AskAnswerFooter } from "../../src/ask/AskAnswerFooter";
import { AppProviders, renderWithProviders } from "../renderWithProviders";

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  maxSpeechInputLength: 100,
}));
const speak = jest.mocked(Speech.speak);
const stop = jest.mocked(Speech.stop);
beforeEach(() => {
  speak.mockClear();
  stop.mockReset();
  stop.mockResolvedValue();
});
function Answers({ context = "book", enabled = true, first = "**First** answer." }) {
  const listening = useAnswerListening(context, enabled, 1.2);
  return (
    <>
      {[first, "Second answer."].map((text, i) => (
        <AskAnswerFooter
          key={i}
          listen={{
            playing: listening.playingKey === String(i),
            failed: listening.errorKey === String(i),
            disabled: !enabled,
            onPress: () => void listening.toggle(String(i), text),
          }}
        />
      ))}
    </>
  );
}

it("reads only on demand, replaces the previous answer, and ignores its late callbacks", async () => {
  await renderWithProviders(<Answers />);
  expect(speak).not.toHaveBeenCalled();
  await fireEvent.press(screen.getAllByRole("button", { name: "Read answer aloud" })[0]);
  expect(speak).toHaveBeenLastCalledWith("First answer.", expect.objectContaining({ rate: 1.2 }));
  const old = speak.mock.calls.at(-1)![1]!;
  await fireEvent.press(screen.getByRole("button", { name: "Read answer aloud" }));
  expect(speak).toHaveBeenLastCalledWith("Second answer.", expect.anything());
  await act(async () => old.onDone?.());
  expect(speak).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("button", { name: "Stop reading answer" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Stop reading answer" }));
  expect(screen.getAllByRole("button", { name: "Read answer aloud" })).toHaveLength(2);
});

it("does not start after a pending native stop resolves following cancellation", async () => {
  await renderWithProviders(<Answers />);
  let resolve!: () => void;
  stop.mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  await fireEvent.press(screen.getAllByRole("button", { name: "Read answer aloud" })[0]);
  await fireEvent.press(screen.getByRole("button", { name: "Stop reading answer" }));
  await act(async () => resolve());
  expect(speak).not.toHaveBeenCalled();
});

it("bounds long utterances and offers retry after a speech failure", async () => {
  await renderWithProviders(<Answers first={"A ".repeat(160)} />);
  await fireEvent.press(screen.getAllByRole("button", { name: "Read answer aloud" })[0]);
  expect(speak.mock.calls[0][0].length).toBeLessThanOrEqual(100);
  await act(async () => speak.mock.calls[0][1]?.onDone?.());
  expect(speak).toHaveBeenCalledTimes(2);
  await act(async () => speak.mock.calls[1][1]?.onError?.(new Error("engine failed")));
  expect(screen.getByRole("alert")).toBeTruthy();
  await fireEvent.press(screen.getAllByRole("button", { name: "Read answer aloud" })[0]);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(speak).toHaveBeenCalledTimes(3);
});

it("stops on background, context changes, recording, and leaving the screen", async () => {
  const changes: ((state: AppStateStatus) => void)[] = [];
  const remove = jest.fn();
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
    changes.push(listener);
    return { remove };
  });
  const result = await renderWithProviders(<Answers />);
  await fireEvent.press(screen.getAllByRole("button", { name: "Read answer aloud" })[0]);
  await act(async () => changes.forEach((change) => change("background")));
  await act(async () => jest.advanceTimersByTime(20));
  expect(screen.queryByRole("button", { name: "Stop reading answer" })).toBeNull();
  await fireEvent.press(screen.getAllByRole("button", { name: "Read answer aloud" })[0]);
  await result.rerender(
    <AppProviders>
      <Answers context="other" />
    </AppProviders>,
  );
  await act(async () => jest.advanceTimersByTime(20));
  expect(screen.queryByRole("button", { name: "Stop reading answer" })).toBeNull();
  await fireEvent.press(screen.getAllByRole("button", { name: "Read answer aloud" })[0]);
  await result.rerender(
    <AppProviders>
      <Answers context="other" enabled={false} />
    </AppProviders>,
  );
  await act(async () => jest.advanceTimersByTime(20));
  expect(screen.getAllByRole("button", { name: "Read answer aloud", disabled: true })).toHaveLength(2);
  await result.rerender(
    <AppProviders>
      <Answers />
    </AppProviders>,
  );
  await fireEvent.press(screen.getAllByRole("button", { name: "Read answer aloud" })[0]);
  const count = stop.mock.calls.length;
  await result.unmount();
  expect(stop.mock.calls.length).toBeGreaterThan(count);
});
