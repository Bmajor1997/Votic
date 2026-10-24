import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { subscription_tiers, verified_tier, upgrade_options } from "../app_parts/subscription_tiers.js";
import { create_usage_store, AiLimitError } from "../app_parts/ai_usage.js";
import { create_premium_authorizer } from "../app_parts/premium_access.js";
import { create_votic_server } from "../votic_server.js";
const base = { productId: "basic-monthly", name: "Basic", store: "play_store", monthlyTokens: 100, monthlyBudgetUsd: 1 };
const plus = { ...base, productId: "plus-monthly", name: "Plus", monthlyTokens: 200, monthlyBudgetUsd: 2 };
const env = { VOTIC_SUBSCRIPTION_TIERS_JSON: JSON.stringify([base, plus]), REVENUECAT_SECRET_API_KEY: "test-key" };
const profile = { allowed: true, productId: base.productId, store: base.store };
const rates = { input: 1, output: 1, cached: 1, cache_write: 1 };
const reserve = (store, allowance) => store.reserve({ user_id: "user:verified", feature: "ask-votic", model: "test", input_bound: 80, output_bound: 10, rates, allowance });

test("no catalog preserves existing plans; malformed or duplicate configuration fails closed", () => {
  assert.deepEqual(subscription_tiers({}), []);
  for (const input of ["{}", "null", JSON.stringify([base, base]), JSON.stringify([{ ...base, monthlyTokens: -1 }]), JSON.stringify([{ ...base, monthlyBudgetUsd: "2" }])])
    assert.throws(() => subscription_tiers({ VOTIC_SUBSCRIPTION_TIERS_JSON: input }));
});
test("only a verified same-store product can yield higher-capacity offers", () => {
  const catalog = [base, plus, { ...plus, productId: "ios", store: "app_store" }, { ...plus, productId: "same-tokens", monthlyTokens: 100 }, { ...plus, productId: "same-budget", monthlyBudgetUsd: 1 }];
  assert.equal(verified_tier(catalog, profile), base);
  for (const change of [{ allowed: false }, { productId: "spoof" }, { store: "app_store" }]) assert.equal(verified_tier(catalog, { ...profile, ...change }), null);
  assert.deepEqual(upgrade_options(catalog, base), [{ productId: plus.productId, name: "Plus", capacityMultiplier: 2 }]);
  assert.deepEqual(upgrade_options(catalog, plus), []);
  assert.deepEqual(upgrade_options(catalog, null), []);
});
test("verified allowance changes actual enforcement without resetting usage, and preserves global caps", () => {
  const store = create_usage_store({ VOTIC_AI_MONTHLY_TOKENS: "100", VOTIC_AI_USER_CONCURRENCY: "10" }, { now: () => new Date("2026-12-31T23:59:00Z") });
  try {
    reserve(store);
    assert.throws(() => reserve(store), e => e instanceof AiLimitError && e.code === "AI_MONTHLY_ALLOWANCE" && e.resetsAt === "2027-01-01T00:00:00.000Z");
    reserve(store, plus);
    assert.throws(() => reserve(store, plus), /monthly AI allowance/);
    assert.equal(store.records().length, 2);
  } finally { store.close(); }
  const limited = create_usage_store({ VOTIC_AI_MONTHLY_BUDGET_USD: "0.00001" });
  try { assert.throws(() => reserve(limited, plus), e => e.code !== "AI_MONTHLY_ALLOWANCE" && /Votic's monthly/.test(e.message)); }
  finally { limited.close(); }
});
async function with_server(options, run) {
  const server = create_votic_server({ env, authorize: () => ({ uid: "verified" }), logger: { warn() {}, error() {} }, ...options });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
const customer = productId => ({ subscriber: { entitlements: { pro: { product_identifier: productId, purchase_date: "2026-01-01T00:00:00Z", expires_date: null } }, subscriptions: { [productId]: { store: "play_store" } } } });
test("subscription endpoint uses authenticated RevenueCat product, excludes budgets and spoofed identity", async () => {
  const requested = [];
  await with_server({ revenueCatFetchImpl: async url => { requested.push(url); return { ok: true, json: async () => customer(base.productId) }; } }, async url => {
    const response = await fetch(url + "/api/subscription-options", { method: "POST", body: JSON.stringify({ uid: "someone-else", productId: plus.productId }) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { current: { name: "Basic", productId: base.productId, store: "play_store" }, upgrades: [{ productId: plus.productId, name: "Plus", capacityMultiplier: 2 }] });
    assert.match(requested[0], /subscribers\/verified$/);
  });
});
test("unknown products, absent catalog and authentication failures cannot advertise upgrades", async () => {
  await with_server({ revenueCatFetchImpl: async () => ({ ok: true, json: async () => customer("unknown") }) }, async url => {
    assert.deepEqual(await (await fetch(url + "/api/subscription-options", { method: "POST" })).json(), { current: null, upgrades: [] });
  });
  await with_server({ env: {}, revenueCatFetchImpl: async () => { throw new Error("must not fetch"); } }, async url => {
    assert.equal((await fetch(url + "/api/subscription-options", { method: "POST" })).status, 200);
  });
  await with_server({ authorize: () => true }, async url => {
    assert.equal((await fetch(url + "/api/subscription-options", { method: "POST" })).status, 401);
  });
});
test("real AI request uses verified tier, never the tier claimed in the request body", async () => {
  const calls = [];
  await with_server({ env: { ...env, OPENAI_API_KEY: "test-ai-key" },
    revenueCatFetchImpl: async () => ({ ok: true, json: async () => customer(base.productId) }),
    fetchImpl: async () => { calls.push("ai"); throw new Error("must not spend"); },
  }, async url => {
    const response = await fetch(url + "/api/help", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: "Upload?", tier: "Plus" }) });
    assert.equal(response.status, 429);
    const error = await response.json();
    assert.equal(error.code, "AI_MONTHLY_ALLOWANCE");
    assert.ok(Number.isFinite(Date.parse(error.resetsAt)));
    assert.equal(calls.length, 0);
  });
});

test("Google Play base plans under one SKU keep distinct verified identities", async () => {
  const payload = customer("votic");
  payload.subscriber.subscriptions.votic.product_plan_identifier = "basic-monthly";
  const authorize = create_premium_authorizer(env, { fetchImpl: async () => ({ ok: true, json: async () => payload }) });
  assert.deepEqual(await authorize.subscription("verified"), { allowed: true, productId: "votic:basic-monthly", store: "play_store" });
  assert.equal(verified_tier([base, plus], await authorize.subscription("verified")), null);
});
