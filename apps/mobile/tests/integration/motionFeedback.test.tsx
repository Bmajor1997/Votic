import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { expect, it, jest } from "@jest/globals";
import { useImportSave } from "../../src/documents/useImportSave";
import { useMotionFeedback } from "../../src/motion/MotionFeedback";
import { MOTION } from "../../src/motion/motionSpec";
import { AppProviders } from "../renderWithProviders";
import { fakeAuth } from "../mocks/authBackend";

it("waits for durable import storage before confirming and does not celebrate a failed write", async () => {
  const hook = await renderHook(() => ({ save: useImportSave(), feedback: useMotionFeedback() }), {
    wrapper: AppProviders,
  });
  const original = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
  let finishWrite: (() => void) | undefined;
  let blocked = false;
  const storage = jest.spyOn(AsyncStorage, "setItem").mockImplementation(async (key, value) => {
    if (key.includes("votic.mobile.library.v2") && !blocked) {
      blocked = true;
      await new Promise<void>((resolve) => {
        finishWrite = resolve;
      });
    }
    return original(key, value);
  });
  let pending: ReturnType<typeof hook.result.current.save>;
  await act(async () => {
    pending = hook.result.current.save("chapter.txt", "A readable chapter.", 1);
  });
  await waitFor(() => expect(finishWrite).toBeDefined());
  expect(hook.result.current.feedback.event).toBeNull();
  await act(async () => {
    finishWrite!();
    await pending;
  });
  expect(hook.result.current.feedback.event).toMatchObject({ kind: "import", title: "chapter" });
  await act(async () => jest.advanceTimersByTime(MOTION.saved.hold));
  expect(hook.result.current.feedback.event).toBeNull();
  storage.mockImplementation(async (key, value) => {
    if (key.includes("votic.mobile.library.v2")) throw new Error("Storage full");
    return original(key, value);
  });
  await act(async () => {
    await expect(hook.result.current.save("failed.txt", "Unsaved.", 1)).rejects.toThrow();
  });
  expect(hook.result.current.feedback.event).toBeNull();
  storage.mockRestore();
});

it("clears confirmations on account change and ignores a stale save callback from the prior account", async () => {
  const hook = await renderHook(() => useMotionFeedback(), { wrapper: AppProviders });
  const stale = hook.result.current.show;
  await act(async () => hook.result.current.show("note", "Private note", "note-1"));
  expect(hook.result.current.event?.title).toBe("Private note");
  await act(async () =>
    fakeAuth.setUser({ uid: "other-reader", email: "other@example.com", displayName: null }),
  );
  expect(hook.result.current.event).toBeNull();
  await act(async () => stale("note", "Late private note"));
  expect(hook.result.current.event).toBeNull();
  await act(async () =>
    fakeAuth.setUser({ uid: "test-user", email: "reader@example.com", displayName: null }),
  );
  expect(hook.result.current.event).toBeNull();
});
