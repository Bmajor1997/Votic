import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { create_credit_wallet, authorized_revenuecat_webhook } from "./credit_wallet.js";

test("RevenueCat top-up grants once, spends once and survives restart", () => {
  const dir = mkdtempSync(join(tmpdir(), "votic-credit-"));
  const env = { VOTIC_AI_USAGE_DB: join(dir, "ledger.sqlite"), VOTIC_CREDIT_PRODUCTS_JSON: JSON.stringify({ credits_500: 500 }) };
  try {
    let wallet = create_credit_wallet(env);
    const event = { id: "evt-1", type: "NON_RENEWING_PURCHASE", app_user_id: "firebase-uid", transaction_id: "tx-1", product_id: "credits_500" };
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
