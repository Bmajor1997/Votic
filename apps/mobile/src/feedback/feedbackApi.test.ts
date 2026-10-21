import { afterEach, describe, expect, it, vi } from "vitest";
import { submit_feedback } from "../api/voticApi";
import { set_auth_token_provider } from "../api/authToken";
vi.mock("expo-constants", () => ({ default: { expoConfig: { hostUri: "127.0.0.1:8081" } } }));
vi.mock("../storage/accountDeletion", () => ({ notify_remote_account_deletion: vi.fn() }));
const input = {
  category: "feature" as const,
  title: "Offline listening",
  description: "Read documents offline",
  requestId: "feedback-test-request-1234",
};
afterEach(() => {
  set_auth_token_provider(null);
  vi.unstubAllGlobals();
});
describe("feedback API transport", () => {
  it("sends the current Firebase token and stable request reference without a client identity field", async () => {
    vi.stubGlobal("__DEV__", true);
    set_auth_token_provider(async () => "signed-token");
    const request = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: "persisted" }) });
    vi.stubGlobal("fetch", request);
    expect(await submit_feedback(input)).toBe("persisted");
    const [url, options] = request.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:4173/api/feedback");
    expect(options.headers.Authorization).toBe("Bearer signed-token");
    expect(JSON.parse(options.body)).toEqual(input);
  });
  it("requires a token before making a network request", async () => {
    vi.stubGlobal("__DEV__", true);
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    await expect(submit_feedback(input)).rejects.toThrow("Sign in to submit feedback.");
    expect(request).not.toHaveBeenCalled();
  });
  it("surfaces server validation and rate-limit failures and rejects unconfirmed success", async () => {
    vi.stubGlobal("__DEV__", true);
    set_auth_token_provider(async () => "signed-token");
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: "Today's feedback limit reached" }),
      })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({}) });
    vi.stubGlobal("fetch", request);
    await expect(submit_feedback(input)).rejects.toThrow("Today's feedback limit reached");
    await expect(submit_feedback(input)).rejects.toThrow("could not confirm");
  });
});
