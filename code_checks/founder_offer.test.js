import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { create_votic_server, capability_report } from "../votic_server.js";
import { create_usage_store } from "../app_parts/ai_usage.js";
import { founder_offer_config, is_founder_product } from "../app_parts/founder_offer.js";

const silent = { warn() {}, error() {} };
async function server(options, work) {
  const instance = create_votic_server({ logger: silent, ...options });
  instance.listen(0, "127.0.0.1"); await once(instance, "listening");
  try { await work(`http://127.0.0.1:${instance.address().port}`); }
  finally { instance.closeAllConnections(); await new Promise(resolve => instance.close(resolve)); }
}
const post = (url) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
const access = async (base) => (await post(base + "/api/access")).json();

test("founder offer settings are off by default and validated", () => {
  assert.equal(founder_offer_config({}), null);
  assert.deepEqual(founder_offer_config({ VOTIC_FOUNDER_PRODUCT_ID: "votic_founder_lifetime", VOTIC_FOUNDER_ENDS_AT: "2027-01-31T00:00:00Z" }),
    { productId: "votic_founder_lifetime", endsAt: Date.parse("2027-01-31T00:00:00Z"), limit: 100 });
  assert.throws(() => founder_offer_config({ VOTIC_FOUNDER_PRODUCT_ID: "votic_founder_lifetime" }), /VOTIC_FOUNDER_ENDS_AT/);
  assert.throws(() => founder_offer_config({ VOTIC_FOUNDER_PRODUCT_ID: "x", VOTIC_FOUNDER_ENDS_AT: "2027-01-01", VOTIC_FOUNDER_LIMIT: "0" }), /VOTIC_FOUNDER_LIMIT/);
  assert.throws(() => founder_offer_config({ VOTIC_FOUNDER_PRODUCT_ID: "bad id", VOTIC_FOUNDER_ENDS_AT: "2027-01-01" }), /VOTIC_FOUNDER_PRODUCT_ID/);
  const config = founder_offer_config({ VOTIC_FOUNDER_PRODUCT_ID: "founder", VOTIC_FOUNDER_ENDS_AT: "2027-01-01" });
  assert.equal(is_founder_product(config, "founder"), true);
  assert.equal(is_founder_product(config, "votic_plus:monthly"), false);
  assert.equal(is_founder_product(null, "founder"), false);
  assert.match(capability_report({}).join("\n"), /Founder lifetime offer: off/);
});

test("only beta testers see the founder offer, it survives the end of beta, and it closes at the cap", async () => {
  const folder = mkdtempSync(join(tmpdir(), "votic-founder-"));
  const ends = new Date(Date.now() + 30 * 86400000).toISOString();
  const db = join(folder, "usage.sqlite");
  const founder = { VOTIC_FOUNDER_PRODUCT_ID: "votic_founder_lifetime", VOTIC_FOUNDER_ENDS_AT: ends, VOTIC_FOUNDER_LIMIT: "2" };
  const beta_env = { FIREBASE_PROJECT_ID: "fixture", VOTIC_AI_USAGE_DB: db, VOTIC_BETA_ACCESS_MODE: "allowlist", VOTIC_BETA_TESTER_UIDS: "tester,tester2", ...founder };
  const launch_env = { FIREBASE_PROJECT_ID: "fixture", VOTIC_AI_USAGE_DB: db, ...founder };
  let uid = "tester";
  const paid = new Set();
  const premium = async () => false;
  premium.subscription = async (who) => paid.has(who)
    ? { allowed: true, productId: "votic_founder_lifetime", store: null, periodStart: "2026-11-01T00:00:00Z", periodEnd: null }
    : { allowed: false, productId: null, store: null };
  const store = create_usage_store(beta_env);
  try {
    // During the beta, testers get in free and the paywall (and founder offer) never shows.
    await server({ env: beta_env, usageStore: store, authorize: () => ({ uid }), authorize_premium: premium }, async (base) => {
      assert.deepEqual(await access(base), { uid: "tester", allowed: true, beta: true });
      uid = "tester2"; await access(base);
    });
    // Beta access switched off at launch: testers hit the paywall and see the founder offer; others don't.
    await server({ env: launch_env, usageStore: store, authorize: () => ({ uid }), authorize_premium: premium }, async (base) => {
      uid = "tester";
      const offered = await access(base);
      assert.equal(offered.allowed, false);
      assert.deepEqual(offered.founderOffer, { productId: "votic_founder_lifetime", endsAt: ends, remaining: 2 });
      uid = "stranger";
      assert.deepEqual(await access(base), { uid: "stranger", allowed: false, beta: false });
      // A verified founder purchase unlocks Votic and takes a spot, counted once however often it's checked.
      paid.add("tester"); uid = "tester";
      assert.deepEqual(await access(base), { uid: "tester", allowed: true, beta: false });
      await access(base);
      uid = "tester2";
      assert.equal((await access(base)).founderOffer.remaining, 1);
      // A non-tester who somehow bought it still counts toward the cap; at the cap the offer closes.
      paid.add("stranger"); uid = "stranger"; await access(base);
      uid = "tester2";
      assert.equal((await access(base)).founderOffer, undefined);
    });
    // After the end date the offer is gone even below the cap.
    const closed = { ...launch_env, VOTIC_FOUNDER_LIMIT: "100", VOTIC_FOUNDER_ENDS_AT: new Date(Date.now() - 1000).toISOString() };
    await server({ env: closed, usageStore: store, authorize: () => ({ uid: "tester2" }), authorize_premium: premium }, async (base) => {
      assert.equal((await access(base)).founderOffer, undefined);
    });
    // Deleting an account forgets that it was a beta tester.
    store.begin_account_deletion("tester2");
    assert.equal(store.founder.was_beta_tester("tester2"), false);
    assert.equal(store.founder.purchase_count(), 2);
  } finally { store.close(); rmSync(folder, { recursive: true, force: true }); }
});

test("founders get every future upgrade free: the highest plan and its AI allowance", async () => {
  const folder = mkdtempSync(join(tmpdir(), "votic-founder-top-"));
  const tiers = [
    { productId: "votic_plus:votic-plus-monthly", name: "Votic Plus", store: "play_store", monthlyTokens: 1_000_000, monthlyCredits: 1000, monthlyBudgetUsd: 2 },
    { productId: "votic_max:votic-max-monthly", name: "Votic Max", store: "play_store", monthlyTokens: 4_000_000, monthlyCredits: 4000, monthlyBudgetUsd: 8 },
  ];
  const env = { FIREBASE_PROJECT_ID: "fixture", VOTIC_AI_USAGE_DB: join(folder, "usage.sqlite"),
    VOTIC_FOUNDER_PRODUCT_ID: "votic_founder_lifetime", VOTIC_FOUNDER_ENDS_AT: new Date(Date.now() + 86400000).toISOString(),
    VOTIC_SUBSCRIPTION_TIERS_JSON: JSON.stringify(tiers) };
  let product = "votic_founder_lifetime";
  const premium = async () => true;
  premium.subscription = async () => ({ allowed: true, productId: product, store: "play_store", periodStart: "2026-11-01T00:00:00Z", periodEnd: null });
  const store = create_usage_store(env);
  try {
    await server({ env, usageStore: store, authorize: () => ({ uid: "founder" }), authorize_premium: premium }, async (base) => {
      const usage = await (await post(base + "/api/ai-usage")).json();
      assert.equal(usage.plan.name, "Votic Founder");
      assert.equal(usage.monthly.allowance, 4000);
      const options = await (await post(base + "/api/subscription-options")).json();
      assert.equal(options.current.name, "Votic Max");
      assert.deepEqual(options.upgrades, []);
      // A regular Votic Plus subscriber keeps their own plan and still sees the upgrade.
      product = "votic_plus:votic-plus-monthly";
      const plus = await (await post(base + "/api/subscription-options")).json();
      assert.equal(plus.current.name, "Votic Plus");
      assert.equal(plus.upgrades.length, 1);
    });
  } finally { store.close(); rmSync(folder, { recursive: true, force: true }); }
});
