import { expect, it, jest } from "@jest/globals";
import { act } from "@testing-library/react-native";
import { AppState } from "react-native";
import { useImportSession } from "../../src/documents/useImportSession";
import { render_with_providers } from "../renderWithProviders";

it("aborts work and rejects late import results after backgrounding or leaving", async () => {
  let session: ReturnType<typeof useImportSession> | undefined;
  const leave = jest.fn();
  function Harness() {
    session = useImportSession(leave);
    return null;
  }
  const view = await render_with_providers(<Harness />);
  const first = session!.start()!;
  expect(first.current()).toBe(true);
  expect(session!.start()).toBeNull();
  await act(async () => {
    for (const [event, listener] of jest.mocked(AppState.addEventListener).mock.calls)
      if (event === "change") (listener as (state: string) => void)("background");
  });
  expect(first.signal.aborted).toBe(true);
  expect(first.current()).toBe(false);
  const second = session!.start()!;
  await view.unmount();
  expect(second.signal.aborted).toBe(true);
  expect(second.current()).toBe(false);
  expect(leave).toHaveBeenCalled();
});

it("keeps an import alive while Votic's own file picker has the app in the background", async () => {
  let session: ReturnType<typeof useImportSession> | undefined;
  function Harness() {
    session = useImportSession();
    return null;
  }
  await render_with_providers(<Harness />);
  const background = () => {
    for (const [event, listener] of jest.mocked(AppState.addEventListener).mock.calls)
      if (event === "change") (listener as (state: string) => void)("background");
  };
  const job = session!.start()!;
  await act(async () => {
    await job.away(async () => background());
  });
  expect(job.current()).toBe(true);
  // Once the picker has closed, backgrounding cancels again.
  await act(async () => background());
  expect(job.signal.aborted).toBe(true);
  expect(job.current()).toBe(false);
});
