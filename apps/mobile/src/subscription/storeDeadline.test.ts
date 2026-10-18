import { afterEach, expect, it, vi } from "vitest";
import { store_deadline } from "./storeDeadline";

afterEach(() => vi.useRealTimers());

it("stops waiting for a stalled store without fabricating an entitlement", async () => {
  vi.useFakeTimers();
  const work = store_deadline(new Promise<never>(() => {}));
  const result = expect(work).rejects.toThrow("Membership check timed out");
  await vi.advanceTimersByTimeAsync(12_000);
  await result;
  expect(vi.getTimerCount()).toBe(0);
});

it("keeps successful and failed store results and clears its deadline", async () => {
  vi.useFakeTimers();
  await expect(store_deadline(Promise.resolve({ premium: false }))).resolves.toEqual({ premium: false });
  await expect(store_deadline(Promise.reject(new Error("Store offline")))).rejects.toThrow("Store offline");
  expect(vi.getTimerCount()).toBe(0);
});
