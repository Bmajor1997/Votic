import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { askVotic } from "../../src/api/voticApi";

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

describe("Votic API requests", () => {
  it("gives up with a clear message when the server never responds", async () => {
    let signal: AbortSignal | undefined;
    global.fetch = jest.fn((_url: unknown, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) =>
        signal?.addEventListener("abort", () =>
          reject(Object.assign(new Error("Aborted"), { name: "AbortError" })),
        ),
      );
    }) as typeof fetch;
    const outcome = expect(askVotic("How do I upload?")).rejects.toThrow("Votic took too long to respond");
    jest.advanceTimersByTime(19_999);
    expect(signal?.aborted).toBe(false);
    jest.advanceTimersByTime(1);
    await outcome;
    expect(signal?.aborted).toBe(true);
  });

  it("reports a connection failure without leaking the raw error", async () => {
    global.fetch = jest.fn(() => Promise.reject(new TypeError("Network request failed"))) as typeof fetch;
    await expect(askVotic("How do I upload?")).rejects.toThrow(
      "Votic could not connect. Check your connection and try again.",
    );
  });
});
