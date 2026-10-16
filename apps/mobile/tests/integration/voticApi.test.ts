import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { set_auth_token_provider } from "../../src/api/authToken";
import {
  ask_votic,
  check_voice_question_availability,
  transcribe_voice_question,
} from "../../src/api/voticApi";

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  set_auth_token_provider(null);
});

describe("Votic API requests", () => {
  it("rejects oversized multibyte context before refreshing credentials or sending it", async () => {
    const token = jest.fn(async () => "id-token");
    set_auth_token_provider(token);
    const fetchMock = jest.fn(async () => new Response("{}"));
    global.fetch = fetchMock as typeof fetch;
    await expect(
      ask_votic("Summarize", {
        title: "Conversation",
        sections: [{ heading: "Transcript", text: "漢".repeat(200_000) }],
      }),
    ).rejects.toThrow("too long");
    expect(token).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("times out a stalled token refresh and never sends a late request", async () => {
    let finish!: (token: string) => void;
    set_auth_token_provider(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const fetchMock = jest.fn(async () => new Response("{}"));
    global.fetch = fetchMock as typeof fetch;
    const outcome = expect(ask_votic("Hello")).rejects.toThrow("Votic took too long to respond");
    await jest.advanceTimersByTimeAsync(20_000);
    await outcome;
    finish("late-token");
    await jest.advanceTimersByTimeAsync(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("times out a stalled response body and can make another request afterwards", async () => {
    let signal: AbortSignal | null | undefined;
    global.fetch = jest.fn(async (_url: unknown, init?: RequestInit) => {
      signal = init?.signal;
      return { ok: true, json: () => new Promise(() => {}) } as unknown as Response;
    }) as typeof fetch;
    const outcome = expect(ask_votic("Hello")).rejects.toThrow("Votic took too long to respond");
    await jest.advanceTimersByTimeAsync(20_000);
    await outcome;
    expect(signal?.aborted).toBe(true);
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ answer: "Recovered" }))) as typeof fetch;
    expect((await ask_votic("Try again")).answer).toBe("Recovered");
  });

  it("labels Catch Me Up on the existing authenticated Ask Votic route", async () => {
    const fetchMock = jest.fn(
      async (_url: unknown, _init?: RequestInit) =>
        new Response(JSON.stringify({ answer: "Overview" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    await ask_votic("Catch me up", undefined, [], "adaptive", "catch-me-up");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ feature: "catch-me-up" });
  });

  it("sends voice bytes only to the authenticated backend and reports allowance errors", async () => {
    set_auth_token_provider(async () => "id-token");
    const fetchMock = jest.fn(
      async (_url: unknown, _init?: RequestInit) =>
        new Response(JSON.stringify({ text: "What does this mean?" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const bytes = new ArrayBuffer(44);
    try {
      expect(await transcribe_voice_question(bytes)).toBe("What does this mean?");
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toContain("/api/transcribe-question");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer id-token");
      expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("audio/wav");
      expect(init?.body).toBe(bytes);
      global.fetch = jest.fn(
        async () => new Response(JSON.stringify({ error: "Monthly allowance reached" }), { status: 429 }),
      ) as typeof fetch;
      await expect(transcribe_voice_question(bytes)).rejects.toThrow("Monthly allowance reached");
    } finally {
      set_auth_token_provider(null);
    }
  });
  it("requires sign-in before voice upload and checks backend readiness", async () => {
    const fetchMock = jest.fn(async () => new Response(JSON.stringify({ ready: true })));
    global.fetch = fetchMock as typeof fetch;
    await expect(transcribe_voice_question(new ArrayBuffer(44))).rejects.toThrow("Sign in");
    expect(fetchMock).not.toHaveBeenCalled();
    set_auth_token_provider(async () => "id-token");
    await check_voice_question_availability();
    expect(fetchMock.mock.calls).toHaveLength(1);
  });

  it("cancels during stalled credential refresh without uploading later", async () => {
    let finish!: (token: string) => void;
    set_auth_token_provider(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const fetchMock = jest.fn(async () => new Response("{}"));
    global.fetch = fetchMock as typeof fetch;
    const controller = new AbortController();
    const outcome = expect(
      transcribe_voice_question(new ArrayBuffer(44), controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await outcome;
    finish("late-token");
    await jest.advanceTimersByTimeAsync(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

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
    const outcome = expect(ask_votic("How do I upload?")).rejects.toThrow("Votic took too long to respond");
    // The async variant lets the request read its sign-in token before fetch starts.
    await jest.advanceTimersByTimeAsync(19_999);
    expect(signal?.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await outcome;
    expect(signal?.aborted).toBe(true);
  });

  it("sends the signed-in person's token and a non-default explanation style", async () => {
    set_auth_token_provider(async () => "id-token");
    const fetchMock = jest.fn(
      async (_url: unknown, _init?: RequestInit) =>
        new Response(JSON.stringify({ answer: "Here you go." }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    await ask_votic("Explain this", undefined, [], "simple");
    set_auth_token_provider(null);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer id-token");
    expect(JSON.parse(String(init.body))).toMatchObject({ explanationStyle: "simple" });
  });

  it("reports a connection failure without leaking the raw error", async () => {
    global.fetch = jest.fn(() => Promise.reject(new TypeError("Network request failed"))) as typeof fetch;
    await expect(ask_votic("How do I upload?")).rejects.toThrow(
      "Votic could not connect. Check your connection and try again.",
    );
  });
});
