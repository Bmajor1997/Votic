import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { create_premium_authorizer, has_premium_entitlement } from "../app_parts/premium_access.js";
import { create_votic_server, validate_production_security } from "../votic_server.js";

const now = Date.parse("2026-10-10T12:00:00Z");
const purchase = "2026-10-01T12:00:00Z", expired = "2026-10-09T12:00:00Z", future = "2026-10-11T12:00:00Z";
const customer = (entry) => ({ subscriber: { entitlements: entry === undefined ? {} : { pro: { purchase_date: purchase, expires_date: future, grace_period_expires_date: null, ...entry } } } });

test("Premium accepts active/trial/paid-through/lifetime/grace and denies expired or absent entitlements", () => {
  assert.equal(has_premium_entitlement(customer({}), "pro", now), true);
  assert.equal(has_premium_entitlement(customer({ expires_date: null }), "pro", now), true);
  assert.equal(has_premium_entitlement(customer({ expires_date: expired, grace_period_expires_date: future }), "pro", now), true);
  assert.equal(has_premium_entitlement(customer({ expires_date: expired }), "pro", now), false);
  assert.equal(has_premium_entitlement(customer({ expires_date: new Date(now).toISOString() }), "pro", now), false);
  assert.equal(has_premium_entitlement(customer(undefined), "pro", now), false);
  assert.equal(has_premium_entitlement(customer({ purchase_date: future }), "pro", now), false);
  assert.equal(has_premium_entitlement(customer({}), "other-entitlement", now), false);
  for (const entry of [{ expires_date: undefined }, { expires_date: "invalid" }, { purchase_date: null }, { grace_period_expires_date: "invalid" }])
    assert.throws(() => has_premium_entitlement(customer(entry), "pro", now), /could not verify Premium/);
  assert.throws(() => has_premium_entitlement({}, "pro", now), /could not verify Premium/);
});

test("RevenueCat checks use only the authenticated UID, encoded safely, and a backend key", async () => {
  const requests = [];
  const authorize = create_premium_authorizer({ REVENUECAT_SECRET_API_KEY: "test-backend-key" }, {
    now: () => now,
    fetchImpl: async (url, init) => { requests.push({ url, init }); return { ok: true, json: async () => customer({}) }; },
  });
  assert.equal(await authorize("firebase/user?#"), true);
  assert.equal(requests[0].url, "https://api.revenuecat.com/v1/subscribers/firebase%2Fuser%3F%23");
  assert.equal(requests[0].init.headers.Authorization, "Bearer test-backend-key");
  assert.equal(requests[0].init.redirect, "error");
  assert.equal(await authorize(null), false);
  assert.equal(requests.length, 1);
});

test("RevenueCat outages, missing keys and malformed bodies fail closed without exposing credentials", async () => {
  const settings = { REVENUECAT_SECRET_API_KEY: "test-backend-key" };
  for (const fetchImpl of [
    async () => { throw new Error("secret upstream detail"); },
    async () => ({ ok: false, status: 401 }),
    async () => ({ ok: true, json: async () => { throw new Error("parse error"); } }),
    async () => ({ ok: true, json: async () => ({}) }),
  ]) {
    await assert.rejects(create_premium_authorizer(settings, { fetchImpl })("user"), (error) =>
      error.status === 503 && !/secret|detail|parse|key/.test(error.message));
  }
  await assert.rejects(create_premium_authorizer({})("user"), /could not verify Premium/);
});

test("Premium verification deadlines cover a stalled response body, even if abort is ignored", async () => {
  let signal;
  const authorize = create_premium_authorizer({ REVENUECAT_SECRET_API_KEY: "test-key" }, {
    timeoutMs: 15,
    fetchImpl: async (_url, init) => { signal = init.signal; return { ok: true, json: () => new Promise(() => {}) }; },
  });
  await assert.rejects(authorize("user"), (error) => error.status === 503);
  assert.equal(signal.aborted, true);
});

async function withServer(options, run) {
  const server = create_votic_server({ env: { REVENUECAT_SECRET_API_KEY: "test-backend-key" },
    authorize: () => ({ uid: "unpaid-account" }), logger: { error() {}, warn() {} }, ...options });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
}

test("every Premium endpoint denies an authenticated unpaid account before processing or spending AI", async () => {
  let work = 0;
  await withServer({ revenueCatFetchImpl: async () => ({ ok: true, json: async () => customer(undefined) }),
    fetchImpl: async () => { work++; throw new Error("must not send AI"); },
    extractDocument: async () => { work++; return "must not extract"; },
  }, async (base) => {
    for (const path of ["extract", "import-url", "scan", "voice-question-status", "transcribe-question", "help", "review"]) {
      const response = await fetch(`${base}/api/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: "Help", uid: "paid-account", premium: true }) });
      assert.equal(response.status, 403, path);
      assert.match((await response.json()).error, /Premium subscription is required/);
    }
    assert.equal(work, 0);
  });
});

test("Premium verification errors return curated 503; public pages and signed-out 401 remain independent", async () => {
  let checks = 0;
  await withServer({ authorize: (request, path) => path.startsWith("/api/") ? (request.headers.authorization ? { uid: "user" } : false) : true,
    revenueCatFetchImpl: async () => { checks++; throw new Error("private upstream detail"); },
  }, async (base) => {
    assert.equal((await fetch(base)).status, 200);
    assert.equal((await fetch(`${base}/api/help`, { method: "POST" })).status, 401);
    assert.equal(checks, 0);
    const response = await fetch(`${base}/api/help`, { method: "POST", headers: { Authorization: "Bearer verified-test-session" } });
    assert.equal(response.status, 503);
    assert.doesNotMatch(JSON.stringify(await response.json()), /private|upstream|test-backend-key/);
    assert.equal(checks, 1);
  });
});

test("subscribed accounts retain API access and RevenueCat checks cannot spend the AI allowance", async () => {
  let checks = 0, ai = 0;
  await withServer({ revenueCatFetchImpl: async () => { checks++; return { ok: true, json: async () => customer({ expires_date: null }) }; },
    fetchImpl: async () => { ai++; throw new Error("AI is not configured for this test"); },
  }, async (base) => {
    const response = await fetch(`${base}/api/help`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: "How do I upload?" }) });
    assert.equal(response.status, 200);
    assert.equal(checks, 1);
    assert.equal(ai, 0);
  });
});

test("production cannot start without Premium verification or expose the RevenueCat secret in a public variable", () => {
  assert.throws(() => validate_production_security({ NODE_ENV: "production", FIREBASE_PROJECT_ID: "votic" }), /REVENUECAT_SECRET_API_KEY/);
  assert.throws(() => validate_production_security({ EXPO_PUBLIC_REVENUECAT_SECRET_API_KEY: "test" }), /backend/);
  assert.doesNotThrow(() => validate_production_security({ NODE_ENV: "production", FIREBASE_PROJECT_ID: "votic", REVENUECAT_SECRET_API_KEY: "test-backend-key" }));
});
