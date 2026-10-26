import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { create_usage_store } from "../app_parts/ai_usage.js";
import { create_votic_server } from "../votic_server.js";

// The production route end to end: Firebase identity, RevenueCat-verified billing period, credit ledger and AI routes.
const usage = { input_tokens: 1000, output_tokens: 200, total_tokens: 1200 };
const answer = (text) => ({ id: "resp", status: "completed", usage, output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text }] }] });
const provider = (data, status = 200) => ({ ok: status < 400, status, headers: new Headers(), json: async () => data });
const document = { title: "Report", sections: [{ heading: "Results", text: "Scores improved." }] };
const document_answer = answer(JSON.stringify({ answer: "They improved.", sectionIndex: 0, sectionTitle: "Results", quote: null }));
const period = { purchase_date: "2026-10-03T10:00:00Z", expires_date: "2099-12-03T10:00:00Z" };
const customer = (entitlement = period) => ({ subscriber: { entitlements: entitlement ? { pro: { product_identifier: "votic_plus", ...entitlement } } : {}, subscriptions: { votic_plus: { store: "play_store" } } } });
const base_env = { REVENUECAT_SECRET_API_KEY: "rc-secret", OPENAI_API_KEY: "test-key", VOTIC_MONTHLY_CREDITS: "10" };

async function with_server({ env = {}, revenueCat = async () => ({ ok: true, json: async () => customer() }), ai = async () => provider(answer("Help")), uid = "plus-user", store, ...options } = {}, run) {
  const full_env = { ...base_env, ...env };
  const usage_store = store || create_usage_store(full_env);
  const server = create_votic_server({ env: full_env, usageStore: usage_store, authorize: () => (uid ? { uid } : true), revenueCatFetchImpl: revenueCat, fetchImpl: ai, logger: { warn() {}, error() {} }, ...options });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) => fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  try { await run({ post, store: usage_store, base }); }
  finally { server.closeAllConnections(); server.close(); await once(server, "close"); if (!store) usage_store.close(); }
}
const ai_usage = async (post) => { const response = await post("/api/ai-usage"); return { status: response.status, body: await response.json() }; };

test("AI Usage reports the verified period with a full allowance and never trusts identity or plan from the request", async () => {
  const requested = [];
  await with_server({ revenueCat: async (url) => { requested.push(url); return { ok: true, json: async () => customer() }; } }, async ({ post }) => {
    const response = await post("/api/ai-usage", { uid: "someone-else", allowance: 999999, used: 0 });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), {
      status: "active", plan: { name: "Votic Plus" },
      monthly: { percentRemaining: 100, allowance: 10, used: 0, remaining: 10, periodStart: "2026-10-03T10:00:00.000Z", periodEnd: "2099-12-03T10:00:00.000Z", resetsAt: "2099-12-03T10:00:00.000Z", billingPeriodVerified: true },
      purchased: { remaining: 0 }, purchaseProducts: [],
    });
    assert.match(requested[0], /subscribers\/plus-user$/);
  });
});

test("unauthenticated and unverifiable requests never get a percentage", async () => {
  await with_server({ uid: null }, async ({ post }) => assert.equal((await post("/api/ai-usage")).status, 401));
  await with_server({ revenueCat: async () => ({ ok: false, status: 500, json: async () => ({}) }) }, async ({ post }) => {
    const { status, body } = await ai_usage(post);
    assert.equal(status, 503);
    assert.equal(body.monthly, undefined);
    assert.doesNotMatch(JSON.stringify(body), /rc-secret/);
  });
  await with_server({ env: { REVENUECAT_SECRET_API_KEY: "" } }, async ({ post }) => {
    assert.deepEqual((await ai_usage(post)).body, { status: "not-configured", plan: null, monthly: null, purchased: null, purchaseProducts: [] });
  });
});

test("expired or absent subscriptions report not-subscribed and can't spend AI", async () => {
  for (const entitlement of [{ purchase_date: "2026-01-01T00:00:00Z", expires_date: "2026-02-01T00:00:00Z" }, null]) {
    let calls = 0;
    await with_server({ revenueCat: async () => ({ ok: true, json: async () => customer(entitlement) }), ai: async () => { calls += 1; return provider(answer("x")); } }, async ({ post }) => {
      assert.deepEqual((await ai_usage(post)).body, { status: "not-subscribed", plan: null, monthly: null, purchased: { remaining: 0 }, purchaseProducts: [] });
      assert.equal((await post("/api/help", { question: "How?", document })).status, 403);
      assert.equal(calls, 0);
    });
  }
});

test("each answered document question is charged once; failures and fallbacks are free", async () => {
  let mode = "ok";
  const ai = async () => mode === "ok" ? provider(document_answer) : mode === "rejected" ? provider({ error: { code: "bad" } }, 400) : provider({}, 500);
  await with_server({ ai }, async ({ post }) => {
    const first = await post("/api/help", { question: "What changed?", document });
    assert.equal((await first.json()).mode, "document-ai");
    assert.equal((await ai_usage(post)).body.monthly.used, 2);
    assert.equal((await ai_usage(post)).body.monthly.percentRemaining, 80);
    for (mode of ["rejected", "server-error"]) {
      const failed = await (await post("/api/help", { question: "Again?", document })).json();
      assert.equal(failed.mode, "built-in");
    }
    assert.equal((await ai_usage(post)).body.monthly.used, 2, "no result, no charge");
  });
});

test("exhausted monthly usage is refused before any AI call, with the renewal date; built-in help stays free", async () => {
  let calls = 0;
  await with_server({ env: { VOTIC_MONTHLY_CREDITS: "3" }, ai: async () => { calls += 1; return provider(document_answer); } }, async ({ post }) => {
    assert.equal((await post("/api/help", { question: "One?", document })).status, 200);
    const refused = await post("/api/help", { question: "Two?", document });
    assert.equal(refused.status, 429);
    assert.deepEqual(await refused.json(), { error: "You've used this month's AI allowance.", code: "AI_CREDITS_EXHAUSTED", resetsAt: "2099-12-03T10:00:00.000Z" });
    assert.equal(calls, 1);
    const usage_now = (await ai_usage(post)).body.monthly;
    assert.deepEqual([usage_now.used, usage_now.percentRemaining], [2, 33]);
    // One credit left covers a help question; after that the built-in answer is used, free.
    assert.equal((await (await post("/api/help", { question: "How do I import?" })).json()).mode, "ai");
    const free = await post("/api/help", { question: "How do I import?" });
    assert.equal(free.status, 200);
    assert.equal((await free.json()).mode, "built-in");
    assert.equal(calls, 2);
    assert.equal((await ai_usage(post)).body.monthly.percentRemaining, 0);
  });
});

test("concurrent questions can't overspend the allowance", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let calls = 0;
  await with_server({ env: { VOTIC_MONTHLY_CREDITS: "4", VOTIC_AI_USER_CONCURRENCY: "10" }, ai: async () => { calls += 1; await gate; return provider(document_answer); } }, async ({ post }) => {
    const requests = Array.from({ length: 5 }, (_, i) => post("/api/help", { question: `Q${i}?`, document }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    release();
    const statuses = (await Promise.all(requests)).map((response) => response.status).sort();
    assert.deepEqual(statuses, [200, 200, 429, 429, 429]);
    assert.equal(calls, 2);
    assert.equal((await ai_usage(post)).body.monthly.remaining, 0);
  });
});

test("purchased credits are spent after the monthly allowance and refunds are honored", async () => {
  const dir = mkdtempSync(join(tmpdir(), "votic-usage-"));
  const secret = "a-very-long-random-webhook-secret-123";
  const env = { VOTIC_AI_USAGE_DB: join(dir, "ledger.sqlite"), VOTIC_CREDIT_PRODUCTS_JSON: '{"votic_ai_credits_100":100}', REVENUECAT_WEBHOOK_SECRET: secret, VOTIC_MONTHLY_CREDITS: "2" };
  const event = { id: "evt-1", type: "NON_RENEWING_PURCHASE", app_user_id: "plus-user", transaction_id: "tx-1", product_id: "votic_ai_credits_100", environment: "PRODUCTION" };
  try {
    await with_server({ env, ai: async () => provider(document_answer) }, async ({ post, base }) => {
      const webhook = (body) => fetch(base + "/api/revenuecat-webhook", { method: "POST", headers: { Authorization: secret, "Content-Type": "application/json" }, body: JSON.stringify({ event: body }) });
      assert.equal((await post("/api/help", { question: "One?", document })).status, 200);
      assert.equal((await post("/api/help", { question: "Two?", document })).status, 429);
      assert.equal((await webhook(event)).status, 200);
      assert.equal((await webhook(event)).status, 200, "a repeated webhook is acknowledged");
      let usage_now = (await ai_usage(post)).body;
      assert.deepEqual([usage_now.monthly.percentRemaining, usage_now.purchased.remaining, usage_now.purchaseProducts], [0, 100, ["votic_ai_credits_100"]]);
      assert.equal((await post("/api/help", { question: "Two?", document })).status, 200);
      usage_now = (await ai_usage(post)).body;
      assert.deepEqual([usage_now.monthly.used, usage_now.purchased.remaining], [2, 98]);
      assert.equal((await webhook({ ...event, id: "evt-2", type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT" })).status, 200);
      assert.equal((await ai_usage(post)).body.purchased.remaining, 0);
      assert.equal((await post("/api/help", { question: "Three?", document })).status, 429);
    });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("camera scans are charged per result; a failed scan is not", async () => {
  const photo = Buffer.alloc(2000); photo.set([255, 216, 255]);
  let fail = false;
  await with_server({ ai: async () => fail ? provider({}, 503) : provider(answer("Page text")) }, async ({ base, post }) => {
    const scan = () => fetch(base + "/api/scan", { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Votic-Filename": "page.jpg" }, body: photo });
    assert.equal((await scan()).status, 200);
    assert.equal((await ai_usage(post)).body.monthly.used, 3);
    fail = true;
    assert.equal((await scan()).status, 503);
    assert.equal((await ai_usage(post)).body.monthly.used, 3);
  });
});

test("account deletion leaves no credit balance for the account", async () => {
  const store = create_usage_store(base_env);
  try {
    await with_server({ store, ai: async () => provider(document_answer) }, async ({ post }) => {
      assert.equal((await post("/api/help", { question: "One?", document })).status, 200);
    });
    assert.equal(store.credits.records("plus-user").length, 1);
    store.beginAccountDeletion("plus-user");
    assert.deepEqual(store.credits.records("plus-user"), []);
    await with_server({ store }, async ({ post }) => assert.equal((await post("/api/ai-usage")).status, 403));
  } finally { store.close(); }
});
