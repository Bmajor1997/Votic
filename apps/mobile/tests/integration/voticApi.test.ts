import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { setAuthTokenProvider } from "../../src/api/authToken";
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
    // The async variant lets the request read its sign-in token before fetch starts.
    await jest.advanceTimersByTimeAsync(19_999);
    expect(signal?.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await outcome;
    expect(signal?.aborted).toBe(true);
  });

  it("sends the signed-in person's token and a non-default explanation style", async () => {
    setAuthTokenProvider(async () => "id-token");
    const fetchMock = jest.fn(
      async (_url: unknown, _init?: RequestInit) =>
        new Response(JSON.stringify({ answer: "Here you go." }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    await askVotic("Explain this", undefined, [], "simple");
    setAuthTokenProvider(null);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer id-token");
    expect(JSON.parse(String(init.body))).toMatchObject({ explanationStyle: "simple" });
  });

  it("reports a connection failure without leaking the raw error", async () => {
    global.fetch = jest.fn(() => Promise.reject(new TypeError("Network request failed"))) as typeof fetch;
    await expect(askVotic("How do I upload?")).rejects.toThrow(
      "Votic could not connect. Check your connection and try again.",
    );
  });
});
