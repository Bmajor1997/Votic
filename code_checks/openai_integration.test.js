import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { create_usage_store, model_prices, estimate_cost, token_usage } from "../app_parts/ai_usage.js";
import { create_votic_server, validate_production_security } from "../votic_server.js";
import { accounted_fetch, validate_voice_wav } from "../app_parts/openai_gateway.js";

const env = { OPENAI_API_KEY: "test-private-key" };
const usage = { input_tokens: 1000, output_tokens: 200, total_tokens: 1200, input_tokens_details: { cached_tokens: 400, cache_write_tokens: 100 } };
const result = (text, extras = {}) => ({ id: "resp-test", status: "completed", model: "gpt-6-luna", usage, output: [{ type: "reasoning" }, { type: "message", role: "assistant", content: [{ type: "output_text", text }] }], ...extras });
const provider = (data) => ({ ok: true, status: 200, headers: new Headers({ "x-request-id": "provider-request" }), json: async () => data });
const post = (base, path, payload) => fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
const document = { title: "Report", sections: [{ heading: "Results", text: "Scores improved." }] };
async function with_server(options, run) {
  const store = options.usageStore || create_usage_store(options.env || env);
  const server = create_votic_server({ env, logger: { warn() {}, error() {} }, ...options, usageStore: store });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try { await run(`http://127.0.0.1:${server.address().port}`, store); }
  finally { server.close(); await once(server, "close"); if (!options.usageStore) store.close(); }
}

test("REST output and cached/cache-write accounting work across existing paid AI routes", async () => {
  const requests = [];
  await with_server({ authorize: () => ({ uid: "verified-user" }), fetchImpl: async (url, options) => {
    const body = JSON.parse(options.body); requests.push({ url, options, body });
    return provider(result(body.text?.format.name === "votic_document_answer" ? JSON.stringify({ answer: "Scores improved.", sectionIndex: 0, sectionTitle: "untrusted" }) : body.text ? JSON.stringify({ summary: "Summary", takeaways: ["Scores improved"] }) : "Helpful answer"));
  } }, async (base, store) => {
    assert.equal((await (await post(base, "/api/help", { question: "Upload?" })).json()).mode, "ai");
    const docAnswer = await (await post(base, "/api/help", { question: "Results?", document })).json();
    assert.equal(docAnswer.sectionTitle, "Results");
    await post(base, "/api/help", { question: "Catch me up", document, feature: "catch-me-up" });
    assert.equal((await post(base, "/api/review", document)).status, 200);
    assert.equal((await fetch(base + "/api/scan", { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Votic-Filename": "page.jpg" }, body: Buffer.from([255, 216, 255]) })).status, 200);
    const records = store.records();
    assert.deepEqual(records.map((r) => r.feature).sort(), ["ask-votic", "ask-votic", "catch-me-up", "document-review", "scan-ocr"].sort());
    for (const row of records) {
      assert.equal(row.user_id, "user:verified-user");
      assert.equal(row.total_tokens, 1200); assert.equal(row.cached_tokens, 400); assert.equal(row.cache_write_tokens, 100);
      assert.equal(row.input_tokens, 1000); assert.equal(row.output_tokens, 200);
      assert.ok(Math.abs(row.estimated_cost_usd - 0.0001665) < 1e-10);
      assert.equal(row.provider_request_id, "provider-request"); assert.equal(row.response_id, "resp-test");
      assert.ok(row.started_at && row.completed_at); assert.equal(row.usage_known, 1);
    }
    assert.doesNotMatch(JSON.stringify(records), /test-private-key|Scores improved|Upload\?/);
    for (const r of requests) {
      assert.equal(r.body.model, "gpt-6-luna"); assert.equal(r.body.store, false);
      assert.equal(r.body.service_tier, "default"); assert.deepEqual(r.body.reasoning, { effort: "none" });
      assert.equal(r.body.safety_identifier.length, 64);
      assert.match(r.options.headers["X-Client-Request-Id"], /^[0-9a-f-]{36}$/);
    }
    assert.equal((await fetch(base + "/app_parts/ai_usage.js")).status, 404);
  });
});

test("monthly reservations survive restart, coordinate workers, and reset at UTC month boundary", () => {
  const dir = mkdtempSync(join(tmpdir(), "votic-usage-")), path = join(dir, "usage.sqlite");
  let time = new Date("2026-10-31T23:59:00Z");
  const settings = { VOTIC_AI_MONTHLY_TOKENS: "100", VOTIC_AI_USAGE_DB: path };
  const reserve = (store, user_id = "user:a") => store.reserve({ user_id, feature: "ask-votic", model: "gpt-6-luna", input_bound: 50, output_bound: 20, rates: model_prices("gpt-6-luna") });
  let first, second;
  try {
    first = create_usage_store(settings, { now: () => time }); second = create_usage_store(settings, { now: () => time });
    const id = reserve(first);
    assert.throws(() => reserve(second), /monthly AI allowance/);
    first.finish(id, { status: "unknown" }); first.close(); first = null;
    assert.equal(second.records()[0].allowance_tokens, 70);
    assert.throws(() => reserve(second), /monthly AI allowance/);
    reserve(second, "user:b");
    time = new Date("2026-11-01T00:01:00Z"); reserve(second);
    assert.equal(second.records().length, 3);
  } finally { first?.close(); second?.close(); rmSync(dir, { recursive: true, force: true }); }
});

test("concurrent requests cannot overspend and monthly rejection sends no provider request", async () => {
  let entered, release, calls = 0;
  const gate = new Promise((r) => { release = r; }), started = new Promise((r) => { entered = r; });
  await with_server({ env: { ...env, VOTIC_AI_MONTHLY_TOKENS: "4000" }, fetchImpl: async () => { calls++; entered(); await gate; return provider(result("Answer")); } }, async (base) => {
    const first = post(base, "/api/help", { question: "Upload?" }); await started;
    try { assert.equal((await post(base, "/api/help", { question: "Upload?" })).status, 429); }
    finally { release(); }
    assert.equal((await first).status, 200); assert.equal(calls, 1);
  });
});

test("incomplete, timeout, missing usage and provider rejection never fake zero token usage", async () => {
  const store = create_usage_store();
  const options = { method: "POST", headers: {}, body: JSON.stringify({ model: "gpt-6-luna", input: "secret document", max_output_tokens: 100 }) };
  try {
    const run = (fetch_impl) => accounted_fetch({ fetch_impl, store, env, user_id: "user:a", feature: "ask-votic" })("https://api.openai.com/v1/responses", options);
    await assert.rejects(run(async () => { throw new Error("timeout secret"); }));
    await run(async () => provider(result("Answer", { usage: undefined })));
    await assert.rejects(run(async () => provider(result("Partial", { status: "incomplete" }))));
    await assert.rejects(run(async () => ({ ok: false, status: 401 })));
    const records = store.records();
    assert.ok(records.find((r) => r.status === "unknown").allowance_tokens > 0);
    assert.ok(records.find((r) => r.status === "completed").input_tokens === null);
    assert.equal(records.find((r) => r.status === "incomplete").total_tokens, 1200);
    assert.equal(records.find((r) => r.status === "provider-error").estimated_cost_usd, 0);
    assert.equal(token_usage({ usage: { ...usage, total_tokens: 0 } }), null);
  } finally { store.close(); }
});

function wav(seconds = 1) {
  const bytes = Buffer.alloc(44 + 16000 * 2 * seconds);
  bytes.write("RIFF", 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(16000, 24); bytes.writeUInt32LE(32000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36); bytes.writeUInt32LE(bytes.length - 44, 40); return bytes;
}
test("voice foundation authenticates, validates real duration, accounts multipart STT, and returns text only", async () => {
  let calls = 0;
  await with_server({ env: { ...env, VOTIC_VOICE_QUESTIONS_ENABLED: "true" }, authorize: (r) => r.headers.authorization ? { uid: "voice-user" } : true, fetchImpl: async (url, options) => {
    calls++; assert.equal(url, "https://api.openai.com/v1/audio/transcriptions");
    assert.equal(options.body.get("model"), "gpt-4o-mini-transcribe");
    assert.equal(options.body.get("file").type, "audio/wav");
    assert.equal(options.headers["Content-Type"], undefined);
    return provider({ text: "What does this mean?", usage: { input_tokens: 100, output_tokens: 5, total_tokens: 105 } });
  } }, async (base, store) => {
    const voice = (body, signed = true) => fetch(base + "/api/transcribe-question", { method: "POST", headers: { "Content-Type": "audio/wav", ...(signed ? { Authorization: "verified-by-test-authorizer" } : {}) }, body });
    assert.equal((await voice(wav(), false)).status, 401);
    assert.equal((await voice(wav(61))).status, 400);
    assert.equal((await voice(Buffer.from("invalid"))).status, 400);
    assert.deepEqual(await (await voice(wav())).json(), { text: "What does this mean?" });
    assert.equal(calls, 1); assert.equal(store.records()[0].feature, "ask-votic-transcription");
    assert.equal(store.records()[0].total_tokens, 105);
    assert.ok(Math.abs(store.records()[0].estimated_cost_usd - 0.00015) < 1e-10);
  });
  const corrupted = wav(); corrupted.writeUInt32LE(1, 28);
  assert.throws(() => validate_voice_wav(corrupted), /PCM/);
});

test("production requires account protection and private persistence; custom models require explicit pricing", () => {
  assert.throws(() => validate_production_security({ ...env, NODE_ENV: "production", FIREBASE_PROJECT_ID: "votic" }), /persistent private ledger/);
  assert.throws(() => validate_production_security({ EXPO_PUBLIC_OPENAI_API_KEY: "anything" }), /backend/);
  assert.throws(() => model_prices("unpriced-model"), /PRICES_JSON/);
  assert.ok(estimate_cost({ input_tokens: 300000, output_tokens: 100, cached_tokens: 0, cache_write_tokens: 0 }, model_prices("gpt-6-luna")) > 0.06);
});

test("global/user cost, shared feature rate and concurrency gates reserve atomically", () => {
  const reserve = (store, user_id = "user:a", feature = "ask-votic") => store.reserve({ user_id, feature, model: "gpt-6-luna", input_bound: 1000, output_bound: 100, rates: model_prices("gpt-6-luna") });
  for (const [settings, expected] of [
    [{ VOTIC_AI_MONTHLY_BUDGET_USD: "0.0002" }, /monthly AI budget/],
    [{ VOTIC_AI_USER_MONTHLY_BUDGET_USD: "0.0002" }, /monthly AI allowance/],
    [{ VOTIC_AI_USER_RATE_LIMIT: "1" }, /Too many/],
    [{ VOTIC_AI_USER_CONCURRENCY: "1" }, /Too many/],
  ]) {
    const store = create_usage_store(settings);
    try {
      reserve(store);
      assert.throws(() => reserve(store, "user:a", "document-review"), expected);
      if (settings.VOTIC_AI_MONTHLY_BUDGET_USD) assert.throws(() => reserve(store, "user:b"), expected);
      else reserve(store, "user:b");
    } finally { store.close(); }
  }
});

test("durable daily caps survive handler/process restart and identity spoofing cannot change allowance", async () => {
  const store = create_usage_store({ VOTIC_AI_CLIENT_DAILY_LIMIT: "1" });
  const options = { usageStore: store, authorize: () => ({ uid: "verified" }), fetchImpl: async () => provider(result("Answer")) };
  try {
    await with_server(options, async (base) => assert.equal((await post(base, "/api/help", { question: "Upload?", userId: "spoofed" })).status, 200));
    await with_server(options, async (base) => assert.equal((await post(base, "/api/help", { question: "Upload?", userId: "different" })).status, 429));
    assert.equal(store.records().length, 1); assert.equal(store.records()[0].user_id, "user:verified");
  } finally { store.close(); }
});
