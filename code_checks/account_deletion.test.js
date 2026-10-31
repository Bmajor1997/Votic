import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { create_usage_store, model_prices } from "../app_parts/ai_usage.js";
import { create_votic_server } from "../votic_server.js";

async function server(options, run) {
  const s = create_votic_server({ logger: { warn() {}, error() {} }, ...options });
  s.listen(0, "127.0.0.1"); await once(s, "listening");
  try { await run(`http://127.0.0.1:${s.address().port}`); }
  finally { s.closeAllConnections(); s.close(); await once(s, "close"); }
}
const post = (base, phase, extra = {}) => fetch(base + "/api/delete-account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phase, ...extra }) });
const identity = () => ({ uid: "account-a", auth_time: Math.floor(Date.now() / 1000) });
const env = { REVENUECAT_SECRET_API_KEY: "test-only" };

test("the private external-request command erases the configured persistent database", () => {
  const dir = mkdtempSync(join(tmpdir(), "votic-operator-delete-")), path = join(dir, "usage.sqlite");
  let store = create_usage_store({}, { path });
  try {
    store.recordReport({ user_id: "account-a", reason: "other", answer: "private" });
    store.recordReport({ user_id: "account-b", reason: "other", answer: "keep" });
    store.close();
    const output = execFileSync(process.execPath, ["--import", "data:text/javascript,globalThis.fetch=async()=>({ok:true,status:200})", "security/delete-account-data.js", "--uid=account-a", "--confirmed-owner"], {
      cwd: new URL("..", import.meta.url), encoding: "utf8",
      env: { ...process.env, NODE_ENV: "production", VOTIC_AI_USAGE_DB: path, REVENUECAT_SECRET_API_KEY: "test-only" },
    });
    assert.match(output, /Complete Firebase user deletion/);
    store = create_usage_store({}, { path });
    assert.deepEqual(store.reports().map(r => r.user_id), ["account-b"]);
    assert.ok(store.accountDeletion("account-a").completed_at);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test("external deletion instructions are public while the operator script stays private", async () => {
  await server({}, async base => {
    const page = await fetch(base + "/delete-account");
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /href="https:\/\/violet-subtasks-579694\.framer\.app\/delete-account"/);
    assert.match(html, /href="mailto:votic\.support@gmail\.com\?subject=Votic%20account%20deletion"/);
    assert.match(html, /verify control of the account email or ask you to sign in/);
    assert.match(html, /We do not ask for your password/);
    assert.equal((await fetch(base + "/security/delete-account-data.js")).status, 404);
  });
});

test("account deletion requires recent verified identity, an exact schema and ready services before erasure", async () => {
  await server({ env }, async base => assert.equal((await post(base, "complete")).status, 401));
  await server({ env, authorize: () => ({ uid: "account-a", auth_time: 1 }) }, async base => {
    const r = await post(base, "prepare"); assert.equal(r.status, 409); assert.equal((await r.json()).code, "REAUTH_REQUIRED");
  });
  await server({ env: {}, authorize: identity }, async base => assert.equal((await post(base, "prepare")).status, 503));
  await server({ env, authorize: identity }, async base => assert.equal((await post(base, "complete", { uid: "account-b" })).status, 400));
});

test("deletion erases only the authenticated account's reports, anonymizes costs, blocks stale tokens and survives restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "votic-delete-")), path = join(dir, "usage.sqlite");
  let store = create_usage_store({}, { path });
  const reserve = uid => store.reserve({ user_id: "user:" + uid, feature: "ask", model: "gpt-6-luna", input_bound: 100, output_bound: 100, rates: model_prices("gpt-6-luna") });
  try {
    const id = reserve("account-a"); reserve("account-b");
    store.recordReport({ user_id: "account-a", reason: "harmful", answer: "private answer a" });
    store.recordReport({ user_id: "account-b", reason: "other", answer: "private answer b" });
    const cost = store.records().reduce((n, r) => n + r.estimated_cost_usd, 0);
    let calls = 0;
    await server({ env, usageStore: store, authorize: identity, authorizePremium: () => { throw new Error("Deletion must not require Premium"); }, accountDeletionFetchImpl: async (url, init) => {
      assert.equal(url, "https://api.revenuecat.com/v1/subscribers/account-a"); assert.equal(init.method, "DELETE");
      calls++; return { ok: true, status: 200 };
    } }, async base => {
      assert.equal((await post(base, "prepare")).status, 200); assert.equal(calls, 0);
      assert.equal((await post(base, "complete")).status, 200);
      assert.equal((await post(base, "complete")).status, 200); // Idempotent retry.
      const denied = await fetch(base + "/api/account-status", { method: "POST" });
      assert.equal(denied.status, 403); assert.equal((await denied.json()).code, "ACCOUNT_DELETED");
    });
    assert.deepEqual(store.reports().map(r => r.user_id), ["account-b"]);
    assert.equal(store.records().reduce((n, r) => n + r.estimated_cost_usd, 0), cost);
    assert.ok(store.records().find(r => r.request_id === id).user_id.startsWith("deleted:"));
    store.finish(id, { status: "completed", provider_request_id: "late-provider-id", result: { id: "late-response", usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } });
    assert.equal(store.records().find(r => r.request_id === id).provider_request_id, null);
    assert.throws(() => reserve("account-a"), /being deleted/);
    assert.throws(() => store.recordReport({ user_id: "account-a", reason: "other", answer: "late" }), /being deleted/);
    store.close(); store = create_usage_store({}, { path }); assert.ok(store.accountDeletion("account-a"));
    assert.equal(store.accountDeletion("account-b"), null);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test("vendor failures never acknowledge completion; retry handles an already-deleted vendor profile", async () => {
  const store = create_usage_store(); let failing = true;
  try {
    await server({ env, usageStore: store, authorize: identity, accountDeletionFetchImpl: async () => ({ ok: false, status: failing ? 403 : 404 }) }, async base => {
      assert.equal((await post(base, "complete")).status, 503);
      assert.equal(store.accountDeletion("account-a").completed_at, null);
      failing = false;
      assert.equal((await post(base, "complete")).status, 200);
      assert.ok(store.accountDeletion("account-a").completed_at);
    });
  } finally { store.close(); }
});
