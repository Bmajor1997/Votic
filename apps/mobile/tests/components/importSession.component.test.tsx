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
