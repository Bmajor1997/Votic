import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { create_votic_server, validate_production_security } from "../votic_server.js";
import { create_credit_wallet } from "../app_parts/credit_wallet.js";

// The production route: HTTP request, webhook secret, app-key check order, body limit, and the durable wallet.
const secret = "a-very-long-random-webhook-secret-123";
const purchase = { id: "evt-1", type: "NON_RENEWING_PURCHASE", app_user_id: "buyer", transaction_id: "tx-1", product_id: "credits_500", environment: "PRODUCTION", event_timestamp_ms: 1000 };
async function webhook(events, extraEnv = {}, { authorization = secret } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "votic-webhook-"));
  const env = { VOTIC_AI_USAGE_DB: join(dir, "ledger.sqlite"), VOTIC_CREDIT_PRODUCTS_JSON: '{"credits_500":500}', REVENUECAT_WEBHOOK_SECRET: secret, ...extraEnv };
  const server = create_votic_server({ env, authorize: () => ({ uid: "someone" }), logger: { warn() {}, error() {} } });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const statuses = [];
  try {
    for (const event of events) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/revenuecat-webhook`, {
        method: "POST", headers: { Authorization: authorization, "Content-Type": "application/json" }, body: JSON.stringify({ event }),
      });
      statuses.push(response.status);
    }
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  const wallet = create_credit_wallet(env);
  try { return { statuses, balance: wallet.balance("buyer") }; }
  finally { wallet.close(); rmSync(dir, { recursive: true, force: true }); }
}

test("a purchase is credited even when the server requires Votic's app key", async () => {
  assert.deepEqual(await webhook([purchase], { VOTIC_CLIENT_KEYS: "client-key-1234567890" }), { statuses: [200], balance: 500 });
});
test("the webhook secret is still required, with or without app keys", async () => {
  assert.deepEqual(await webhook([purchase], {}, { authorization: "wrong" }), { statuses: [401], balance: 0 });
  assert.deepEqual(await webhook([purchase], { VOTIC_CLIENT_KEYS: "client-key-1234567890" }, { authorization: "" }), { statuses: [401], balance: 0 });
});
test("a free store test purchase grants nothing on a live server", async () => {
  assert.deepEqual(await webhook([{ ...purchase, environment: "SANDBOX" }]), { statuses: [200], balance: 0 });
  assert.deepEqual(await webhook([{ ...purchase, environment: "SANDBOX" }], { VOTIC_CREDIT_ALLOW_SANDBOX: "true" }), { statuses: [200], balance: 500 });
});
test("RevenueCat's refund event takes the credits back, and a reversed refund restores them", async () => {
  const refund = { ...purchase, id: "evt-2", type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT", event_timestamp_ms: 2000 };
  assert.deepEqual(await webhook([purchase, refund]), { statuses: [200, 200], balance: 0 });
  assert.deepEqual(await webhook([purchase, refund, { ...purchase, id: "evt-3", type: "REFUND_REVERSED", event_timestamp_ms: 3000 }]), { statuses: [200, 200, 200], balance: 500 });
});
test("a purchase carrying many customer attributes is still credited; an oversized body is refused", async () => {
  const attributes = (count, size) => Object.fromEntries(Array.from({ length: count }, (_, i) => [`attr_${i}`, { value: "x".repeat(size), updated_at_ms: 1 }]));
  assert.deepEqual(await webhook([{ ...purchase, subscriber_attributes: attributes(80, 500) }]), { statuses: [200], balance: 500 });
  assert.deepEqual(await webhook([{ ...purchase, subscriber_attributes: attributes(400, 1000) }]), { statuses: [413], balance: 0 });
});

const refund = { ...purchase, id: "refund", type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT", event_timestamp_ms: 2000 };
const reversed = { ...purchase, id: "reversed", type: "REFUND_REVERSED", event_timestamp_ms: 3000 };
test("a refund delivered before its purchase still revokes the eventual grant", async () => {
  assert.deepEqual(await webhook([refund, purchase, purchase]), { statuses: [200, 200, 200], balance: 0 });
});
test("refund reversals and repeated old events converge regardless of delivery order", async () => {
  for (const events of [
    [purchase, refund, reversed, refund],
    [reversed, refund, purchase],
    [refund, purchase, reversed, refund, purchase],
  ]) assert.equal((await webhook(events)).balance, 500);
  assert.equal((await webhook([purchase, reversed, { ...refund, id: "later-refund", event_timestamp_ms: 4000 }])).balance, 0);
});
test("sandbox and unknown-environment refunds cannot mutate production purchases", async () => {
  assert.equal((await webhook([purchase, { ...refund, environment: "SANDBOX" }])).balance, 500);
  assert.equal((await webhook([purchase, { ...refund, environment: undefined }])).balance, 500);
  assert.equal((await webhook([purchase, refund, { ...reversed, environment: "SANDBOX" }])).balance, 0);
  assert.equal((await webhook([
    { ...purchase, environment: "SANDBOX" }, { ...refund, environment: "SANDBOX" },
  ], { VOTIC_CREDIT_ALLOW_SANDBOX: "true" })).balance, 0);
});
test("a refund for another account or product cannot revoke a matching transaction ID", async () => {
  assert.equal((await webhook([purchase, { ...refund, app_user_id: "another-account" }])).balance, 500);
  assert.equal((await webhook([purchase, { ...refund, product_id: "unknown-product" }])).balance, 500);
});
test("refunds with no valid ordering timestamp are refused for retry instead of acknowledged and lost", async () => {
  for (const event_timestamp_ms of [undefined, -1, "2000", 1.5]) {
    const result = await webhook([purchase, { ...refund, event_timestamp_ms }]);
    assert.equal(result.statuses[1], 500);
    assert.equal(result.balance, 500);
  }
});

test("production startup refuses free sandbox-credit grants", () => {
  const env = { NODE_ENV: "production", FIREBASE_PROJECT_ID: "fixture", REVENUECAT_SECRET_API_KEY: "fixture-only" };
  assert.throws(() => validate_production_security({ ...env, VOTIC_CREDIT_ALLOW_SANDBOX: "true" }), /disabled in production/);
  assert.doesNotThrow(() => validate_production_security(env));
  assert.doesNotThrow(() => validate_production_security({ NODE_ENV: "development", VOTIC_CREDIT_ALLOW_SANDBOX: "true" }));
});

test("production credit products require a usable webhook secret before accepting customers", () => {
  const env = { NODE_ENV: "production", FIREBASE_PROJECT_ID: "fixture", REVENUECAT_SECRET_API_KEY: "fixture-only", VOTIC_CREDIT_PRODUCTS_JSON: '{"credits_500":500}' };
  for (const REVENUECAT_WEBHOOK_SECRET of [undefined, "short"])
    assert.throws(() => validate_production_security({ ...env, REVENUECAT_WEBHOOK_SECRET }), /at least 24/);
  assert.doesNotThrow(() => validate_production_security({ ...env, REVENUECAT_WEBHOOK_SECRET: secret }));
});
