import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { create_credit_ledger, credit_cost, percent_remaining, CREDIT_HOLD_MS, MAX_USD_PER_CREDIT } from "../app_parts/ai_credits.js";
import { create_usage_store, AiLimitError } from "../app_parts/ai_usage.js";
import { create_credit_wallet } from "../app_parts/credit_wallet.js";

const clock = (start) => { let time = Date.parse(start); const now = () => new Date(time); now.set = (value) => { time = Date.parse(value); }; now.add = (ms) => { time += ms; }; return now; };
const subscriber = (periodStart, periodEnd) => ({ allowed: true, productId: "plus", store: "play_store", periodStart, periodEnd });
const ledger = (now) => create_credit_ledger(new DatabaseSync(":memory:"), { now });
const purchase = (db, uid, transaction, credits, revoked = 0) => db.prepare("INSERT INTO credit_grants(event_id,uid,transaction_id,product_id,credits,created_at,revoked) VALUES(?,?,?,?,?,?,?)")
  .run(`evt-${transaction}`, uid, transaction, "credits", credits, new Date().toISOString(), revoked);
const exhausted = (error) => error instanceof AiLimitError && error.code === "AI_CREDITS_EXHAUSTED" && error.status === 429;

test("percent remaining rounds down, never exceeds 100 and never goes below 0", () => {
  assert.equal(percent_remaining(1000, 0), 100);
  assert.equal(percent_remaining(1000, 10), 99);
  assert.equal(percent_remaining(1000, 1), 99);
  assert.equal(percent_remaining(1000, 500), 50);
  assert.equal(percent_remaining(1000, 999), 0);
  assert.equal(percent_remaining(1000, 1000), 0);
  assert.equal(percent_remaining(1000, 1500), 0);
  assert.equal(percent_remaining(1000, -5), 100);
  assert.equal(percent_remaining(0, 0), null);
  assert.equal(percent_remaining(null, 0), null);
});

test("credit prices are fixed per action and chosen from request size before any AI work", () => {
  assert.equal(credit_cost("help"), 1);
  assert.equal(credit_cost("ask-votic", 20_000), 2);
  assert.equal(credit_cost("catch-me-up", 100_000), 2);
  assert.equal(credit_cost("ask-votic", 100_001), 5);
  assert.equal(credit_cost("document-review", 400_000), 5);
  assert.equal(credit_cost("scan-ocr"), 3);
  assert.equal(credit_cost("pdf-ocr", 1_000_000), 10);
  assert.equal(credit_cost("pdf-ocr", 5_000_000), 20);
  assert.equal(credit_cost("pdf-ocr", 12_000_000), 30);
  assert.equal(credit_cost("ask-votic-transcription"), 1);
  assert.throws(() => credit_cost("unpriced-feature"));
});

test("a verified billing period is granted once, renewal starts a fresh allowance, stale or overlapping data does not", () => {
  const now = clock("2026-11-05T00:00:00Z"), credits = ledger(now);
  const first = credits.period("u", subscriber("2026-11-03T10:00:00Z", "2026-12-03T10:00:00Z"), 1000);
  assert.deepEqual(first, { start: "2026-11-03T10:00:00.000Z", end: "2026-12-03T10:00:00.000Z", allowance: 1000, verified: true });
  // Repeated verification of the same period is the same row, even if the configured allowance changes meanwhile.
  assert.deepEqual(credits.period("u", subscriber("2026-11-03T10:00:00Z", "2026-12-03T10:00:00Z"), 5000), first);
  credits.reserve({ uid: "u", request_id: "r1", feature: "help", credits: 600, period: first });
  credits.charge("r1");
  // A restart that overlaps the granted period (e.g. resubscribing mid-period) does not grant a second allowance.
  const overlap = credits.period("u", subscriber("2026-11-20T00:00:00Z", "2026-12-20T00:00:00Z"), 1000);
  assert.equal(overlap.start, first.start);
  assert.equal(overlap.end, "2026-12-20T00:00:00.000Z");
  assert.equal(credits.summary("u", overlap).used, 600);
  // Renewal on the billing anniversary (reported a little early) begins a new, unused allowance.
  now.set("2026-12-20T00:05:00Z");
  const renewed = credits.period("u", subscriber("2026-12-19T23:00:00Z", "2027-01-19T23:00:00Z"), 1000);
  assert.equal(renewed.start, "2026-12-19T23:00:00.000Z");
  assert.deepEqual(credits.summary("u", renewed), { allowance: 1000, used: 0, remaining: 1000, purchased: 0 });
  // A delayed, older profile can't move the account back into a previous period.
  assert.equal(credits.period("u", subscriber("2026-11-03T10:00:00Z", "2026-12-03T10:00:00Z"), 1000).start, renewed.start);
});

test("monthly credits do not roll over; a missing billing end resets on the calendar month", () => {
  const now = clock("2026-11-30T23:00:00Z"), credits = ledger(now);
  const november = credits.period("u", subscriber("2026-11-01T00:00:00Z", null), 1000);
  assert.deepEqual(november, { start: "2026-11-01T00:00:00.000Z", end: "2026-12-01T00:00:00.000Z", allowance: 1000, verified: false });
  credits.reserve({ uid: "u", request_id: "r1", feature: "help", credits: 100, period: november });
  credits.charge("r1");
  now.set("2026-12-01T00:00:00Z");
  const december = credits.period("u", subscriber(undefined, undefined), 1000);
  assert.equal(december.start, "2026-12-01T00:00:00.000Z");
  assert.equal(credits.summary("u", december).remaining, 1000, "unused November credits are not added");
});

test("reservations are idempotent per request, released holds are never charged, balances never go negative", () => {
  const now = clock("2026-11-05T00:00:00Z"), credits = ledger(now);
  const period = credits.period("u", subscriber("2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z"), 10);
  assert.deepEqual(credits.reserve({ uid: "u", request_id: "same", feature: "help", credits: 4, period }), { request_id: "same", status: "reserved" });
  assert.deepEqual(credits.reserve({ uid: "u", request_id: "same", feature: "help", credits: 4, period }), { request_id: "same", status: "reserved" });
  assert.equal(credits.summary("u", period).used, 4, "a repeated request id is held once");
  credits.charge("same"); credits.charge("same");
  assert.equal(credits.summary("u", period).used, 4, "a repeated charge is a no-op");
  credits.reserve({ uid: "u", request_id: "failed", feature: "help", credits: 6, period });
  credits.release("failed"); credits.release("failed"); credits.charge("failed");
  assert.equal(credits.summary("u", period).used, 4, "a failed request is given back and can't be charged afterward");
  assert.throws(() => credits.reserve({ uid: "u", request_id: "too-much", feature: "help", credits: 7, period }), exhausted);
  assert.throws(() => credits.reserve({ uid: "other", request_id: "same", feature: "help", credits: 1, period }), /another account/);
  for (const credits_value of [0, -1, 1.5]) assert.throws(() => credits.reserve({ uid: "u", request_id: `bad${credits_value}`, feature: "help", credits: credits_value, period }), /Invalid credit cost/);
  credits.reserve({ uid: "u", request_id: "rest", feature: "help", credits: 6, period });
  credits.charge("rest");
  const summary = credits.summary("u", period);
  assert.deepEqual(summary, { allowance: 10, used: 10, remaining: 0, purchased: 0 });
  assert.equal(percent_remaining(summary.allowance, summary.used), 0);
});

test("an interrupted request's hold expires so its credits come back, without touching settled charges", () => {
  const now = clock("2026-11-05T00:00:00Z"), credits = ledger(now);
  const period = credits.period("u", subscriber("2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z"), 10);
  credits.reserve({ uid: "u", request_id: "crashed", feature: "help", credits: 8, period });
  credits.reserve({ uid: "u", request_id: "done", feature: "help", credits: 2, period });
  credits.charge("done");
  assert.equal(credits.summary("u", period).remaining, 0);
  now.add(CREDIT_HOLD_MS + 1);
  assert.equal(credits.summary("u", period).remaining, 8);
  assert.deepEqual(credits.records("u").map((row) => [row.request_id, row.status]), [["crashed", "released"], ["done", "charged"]]);
});

test("purchased credits are spent only after monthly credits, survive renewal, and refunds stop them being spent", () => {
  const now = clock("2026-11-05T00:00:00Z"), db = new DatabaseSync(":memory:"), credits = create_credit_ledger(db, { now });
  const period = credits.period("u", subscriber("2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z"), 10);
  purchase(db, "u", "tx-1", 20);
  purchase(db, "u", "tx-refunded", 500, 1);
  assert.equal(credits.summary("u", period).purchased, 20, "a refunded purchase is not spendable");
  credits.reserve({ uid: "u", request_id: "a", feature: "help", credits: 8, period }); credits.charge("a");
  assert.deepEqual(credits.summary("u", period), { allowance: 10, used: 8, remaining: 2, purchased: 20 });
  credits.reserve({ uid: "u", request_id: "b", feature: "help", credits: 5, period });
  const split = credits.records("u").at(-1);
  assert.deepEqual([split.subscription_credits, split.purchased_credits], [2, 3]);
  credits.release("b");
  assert.equal(credits.summary("u", period).purchased, 20, "a released hold returns purchased credits too");
  credits.reserve({ uid: "u", request_id: "c", feature: "help", credits: 5, period }); credits.charge("c");
  assert.deepEqual(credits.summary("u", period), { allowance: 10, used: 10, remaining: 0, purchased: 17 });
  // Renewal: fresh monthly credits, and the remaining purchase is still there.
  now.set("2026-12-01T00:10:00Z");
  const renewed = credits.period("u", subscriber("2026-12-01T00:00:00Z", "2027-01-01T00:00:00Z"), 10);
  assert.deepEqual(credits.summary("u", renewed), { allowance: 10, used: 0, remaining: 10, purchased: 17 });
  // Refund of the remaining purchase: never a negative balance, and nothing more to spend.
  db.prepare("UPDATE credit_grants SET revoked=1 WHERE transaction_id='tx-1'").run();
  assert.equal(credits.summary("u", renewed).purchased, 0);
  credits.reserve({ uid: "u", request_id: "d", feature: "help", credits: 10, period: renewed }); credits.charge("d");
  assert.throws(() => credits.reserve({ uid: "u", request_id: "e", feature: "help", credits: 1, period: renewed }), (error) => exhausted(error) && error.resetsAt === "2027-01-01T00:00:00.000Z" && error.purchased === false);
});

test("simultaneous requests from separate server processes can't spend the same credits twice", () => {
  const dir = mkdtempSync(join(tmpdir(), "votic-credits-"));
  const path = join(dir, "ledger.sqlite"), now = clock("2026-11-05T00:00:00Z");
  const workers = [0, 1, 2].map(() => { const db = new DatabaseSync(path); db.exec("PRAGMA busy_timeout=5000"); return { db, credits: create_credit_ledger(db, { now }) }; });
  try {
    const period = workers[0].credits.period("u", subscriber("2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z"), 10);
    let granted = 0, refused = 0;
    for (let i = 0; i < 12; i += 1) {
      try { workers[i % 3].credits.reserve({ uid: "u", request_id: `r${i}`, feature: "help", credits: 2, period }); granted += 1; }
      catch (error) { assert.ok(exhausted(error)); refused += 1; }
    }
    assert.deepEqual({ granted, refused }, { granted: 5, refused: 7 });
    assert.equal(workers[2].credits.summary("u", period).remaining, 0);
  } finally { for (const worker of workers) worker.db.close(); rmSync(dir, { recursive: true, force: true }); }
});

test("provider safeguards follow the credits actually spent, with the configured limits as a floor", () => {
  const now = clock("2026-11-05T00:00:00Z"), credits = ledger(now);
  const period = credits.period("u", subscriber("2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z"), 1000);
  const floor = { monthlyTokens: 2_000_000, monthlyBudgetUsd: 5 };
  assert.deepEqual(credits.safeguards("u", floor), floor);
  credits.reserve({ uid: "u", request_id: "big", feature: "help", credits: 1000, period });
  assert.deepEqual(credits.safeguards("u", floor), { monthlyTokens: 40_000_000, monthlyBudgetUsd: 1000 * MAX_USD_PER_CREDIT });
  credits.release("big");
  assert.deepEqual(credits.safeguards("u", floor), floor);
});

test("account deletion removes the account's credit history and later purchases for it are not credited", () => {
  const dir = mkdtempSync(join(tmpdir(), "votic-credits-"));
  const env = { VOTIC_AI_USAGE_DB: join(dir, "ledger.sqlite"), VOTIC_CREDIT_PRODUCTS_JSON: '{"credits_500":500}' };
  const store = create_usage_store(env), wallet = create_credit_wallet(env);
  try {
    const event = { id: "evt-1", type: "NON_RENEWING_PURCHASE", app_user_id: "gone", transaction_id: "tx-1", product_id: "credits_500", environment: "PRODUCTION" };
    wallet.grant(event);
    const period = store.credits.period("gone", subscriber("2026-11-01T00:00:00Z", "2099-12-01T00:00:00Z"), 1000);
    store.credits.reserve({ uid: "gone", request_id: "r1", feature: "help", credits: 1001, period });
    store.credits.charge("r1");
    store.beginAccountDeletion("gone");
    assert.deepEqual(store.credits.records("gone"), []);
    assert.equal(wallet.balance("gone"), 0);
    assert.equal(wallet.grant({ ...event, id: "evt-2", transaction_id: "tx-2" }).processed, false);
    assert.equal(wallet.balance("gone"), 0);
  } finally { wallet.close(); store.close(); rmSync(dir, { recursive: true, force: true }); }
});
