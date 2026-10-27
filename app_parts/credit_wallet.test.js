import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { create_credit_wallet, authorized_revenuecat_webhook, account_deletion_key } from "./credit_wallet.js";

test("RevenueCat top-up grants once, spends once and survives restart", () => {
  const dir = mkdtempSync(join(tmpdir(), "votic-credit-"));
  const env = { VOTIC_AI_USAGE_DB: join(dir, "ledger.sqlite"), VOTIC_CREDIT_PRODUCTS_JSON: JSON.stringify({ credits_500: 500 }) };
  try {
    let wallet = create_credit_wallet(env);
    const event = { id: "evt-1", type: "NON_RENEWING_PURCHASE", app_user_id: "firebase-uid", transaction_id: "tx-1", product_id: "credits_500", environment: "PRODUCTION" };
    assert.equal(wallet.grant(event).processed, true);
    assert.equal(wallet.grant({ ...event, id: "evt-2" }).processed, true);
    assert.equal(wallet.balance("firebase-uid"), 500);
    assert.equal(wallet.spend("firebase-uid", "req-1", 200), true);
    assert.equal(wallet.spend("firebase-uid", "req-1", 200), true);
    assert.equal(wallet.balance("firebase-uid"), 300);
    assert.equal(wallet.spend("firebase-uid", "req-2", 301), false);
    wallet.close();
    wallet = create_credit_wallet(env);
    assert.equal(wallet.balance("firebase-uid"), 300);
    wallet.revoke("tx-1");
    assert.equal(wallet.balance("firebase-uid"), 0);
    wallet.restore("tx-1");
    assert.equal(wallet.balance("firebase-uid"), 300);
    wallet.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("Webhook requires configured secret and exact authorization", () => {
  const secret = "a-very-long-random-webhook-secret";
  assert.equal(authorized_revenuecat_webhook(secret, secret), true);
  assert.equal(authorized_revenuecat_webhook(secret + "x", secret), false);
  assert.equal(authorized_revenuecat_webhook("", secret), false);
  assert.equal(authorized_revenuecat_webhook(secret, ""), false);
});

test("free store test purchases never grant credits unless a test server allows them", () => {
  const dir = mkdtempSync(join(tmpdir(), "votic-credit-"));
  const env = { VOTIC_AI_USAGE_DB: join(dir, "ledger.sqlite"), VOTIC_CREDIT_PRODUCTS_JSON: JSON.stringify({ credits_500: 500 }) };
  const wallet = create_credit_wallet(env);
  try {
    const sandbox = { id: "evt-s", type: "NON_RENEWING_PURCHASE", app_user_id: "tester", transaction_id: "tx-s", product_id: "credits_500", environment: "SANDBOX" };
    assert.equal(wallet.grant(sandbox).processed, false);
    assert.equal(wallet.grant({ ...sandbox, environment: undefined }).processed, false);
    assert.equal(wallet.grant({ ...sandbox, type: "ONE_TIME_PURCHASE", environment: "PRODUCTION" }).processed, false);
    assert.equal(wallet.balance("tester"), 0);
    assert.equal(wallet.grant(sandbox, { allowSandbox: true }).processed, true);
    assert.equal(wallet.balance("tester"), 500);
  } finally { wallet.close(); rmSync(dir, { recursive: true, force: true }); }
});

test("refund ordering survives restart, equal-time delivery and duplicate grants", () => {
  const dir = mkdtempSync(join(tmpdir(), "votic-refund-"));
  const env = { VOTIC_AI_USAGE_DB: join(dir, "ledger.sqlite"), VOTIC_CREDIT_PRODUCTS_JSON: '{"credits_500":500}' };
  const event = { id: "refund", type: "CANCELLATION", app_user_id: "buyer", transaction_id: "tx", product_id: "credits_500", environment: "PRODUCTION", event_timestamp_ms: 2000 };
  let wallet = create_credit_wallet(env);
  try {
    wallet.refund(event);
    wallet.close();
    wallet = create_credit_wallet(env);
    wallet.grant({ ...event, id: "purchase", type: "NON_RENEWING_PURCHASE", event_timestamp_ms: 1000 });
    assert.equal(wallet.balance("buyer"), 0);
    wallet.refund({ ...event, id: "reverse", type: "REFUND_REVERSED", event_timestamp_ms: 3000 });
    wallet.refund(event);
    assert.equal(wallet.balance("buyer"), 500);
    // Equal-time ambiguity always revokes, regardless of the order in which events arrive.
    wallet.refund({ ...event, event_timestamp_ms: 3000 });
    wallet.refund({ ...event, id: "reverse", type: "REFUND_REVERSED", event_timestamp_ms: 3000 });
    assert.equal(wallet.balance("buyer"), 0);
    wallet.deleteAccount("buyer");
    // New isolated grant is not affected by deleted personal refund history.
    wallet.grant({ ...event, id: "purchase", type: "NON_RENEWING_PURCHASE" });
    assert.equal(wallet.balance("buyer"), 500);
  } finally { wallet.close(); rmSync(dir, { recursive: true, force: true }); }
});

test("wallet mutations roll back invalid identities and leave no personal refund data after deletion", () => {
  const dir = mkdtempSync(join(tmpdir(), "votic-credit-delete-"));
  const env = { VOTIC_AI_USAGE_DB: join(dir, "ledger.sqlite"), VOTIC_CREDIT_PRODUCTS_JSON: '{"credits_500":500}' };
  const wallet = create_credit_wallet(env), db = new DatabaseSync(env.VOTIC_AI_USAGE_DB);
  const purchase = { id: "evt", type: "NON_RENEWING_PURCHASE", app_user_id: "buyer", transaction_id: "tx", product_id: "credits_500", environment: "PRODUCTION", event_timestamp_ms: 1000 };
  try {
    assert.throws(() => wallet.grant({ ...purchase, app_user_id: "$RCAnonymousID:test" }), /verified/);
    wallet.grant(purchase); // The rejected grant must not leave a transaction/lock open.
    wallet.refund({ ...purchase, type: "CANCELLATION", event_timestamp_ms: 2000 });
    wallet.deleteAccount("buyer");
    db.prepare("INSERT INTO account_deletions(uid_hash,anonymous_id,requested_at) VALUES(?,?,?)").run(account_deletion_key("buyer"), "deleted", new Date().toISOString());
    assert.equal(wallet.grant(purchase).processed, false);
    assert.equal(wallet.refund({ ...purchase, type: "REFUND_REVERSED", event_timestamp_ms: 3000 }).processed, false);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM credit_refund_states WHERE uid=?").get("buyer").n, 0);
    assert.equal(wallet.balance("buyer"), 0);
    wallet.grant({ ...purchase, id: "other", transaction_id: "other", app_user_id: "other" });
    assert.equal(wallet.balance("other"), 500);
  } finally { db.close(); wallet.close(); rmSync(dir, { recursive: true, force: true }); }
});
