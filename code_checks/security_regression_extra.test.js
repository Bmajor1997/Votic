import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { create_credit_wallet } from "../app_parts/credit_wallet.js";

const purchase = { id: "purchase", type: "NON_RENEWING_PURCHASE", app_user_id: "buyer", transaction_id: "tx", product_id: "credits_500", environment: "PRODUCTION", event_timestamp_ms: 1000 };
function with_wallet(run) {
  const dir = mkdtempSync(join(tmpdir(), "votic-security-regression-"));
  const wallet = create_credit_wallet({ VOTIC_AI_USAGE_DB: join(dir, "wallet.sqlite"), VOTIC_CREDIT_PRODUCTS_JSON: '{"credits_500":500}' });
  try { run(wallet); } finally { wallet.close(); rmSync(dir, { recursive: true, force: true }); }
}

test("replayed purchase with new event identifiers never duplicates a grant", () => with_wallet(wallet => {
  for (let i = 0; i < 25; i++) wallet.grant({ ...purchase, id: "event-" + i });
  assert.equal(wallet.balance("buyer"), 500);
}));

test("one user's credit balance cannot be spent by another identity", () => with_wallet(wallet => {
  wallet.grant(purchase);
  assert.equal(wallet.spend("attacker", "request", 100), false);
  assert.equal(wallet.balance("buyer"), 500);
  assert.equal(wallet.balance("attacker"), 0);
}));

test("refund replay cannot repeatedly deduct credits", () => with_wallet(wallet => {
  wallet.grant(purchase);
  const refund = { ...purchase, id: "refund", type: "CANCELLATION", event_timestamp_ms: 2000 };
  for (let i = 0; i < 10; i++) wallet.refund({ ...refund, id: "refund-" + i });
  assert.equal(wallet.balance("buyer"), 0);
}));
