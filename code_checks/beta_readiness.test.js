import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { beta_access_config } from "../app_parts/beta_access.js";
import { create_votic_server, validate_production_security } from "../votic_server.js";
import { create_usage_store } from "../app_parts/ai_usage.js";
import { create_premium_authorizer } from "../app_parts/premium_access.js";

const silent = { warn() {}, error() {} };
async function server(options, work) {
  const instance = create_votic_server({ logger: silent, ...options });
  instance.listen(0, "127.0.0.1"); await once(instance, "listening");
  try { await work(`http://127.0.0.1:${instance.address().port}`); }
  finally { instance.closeAllConnections(); await new Promise(resolve => instance.close(resolve)); }
}
const post = (url, body = {}, headers = {}) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

test("beta defaults off, validates settings, and never grants anonymous or client-asserted access", () => {
  assert.equal(beta_access_config().allows("tester"), false);
  const config = beta_access_config({ VOTIC_BETA_ACCESS_MODE: "allowlist", VOTIC_BETA_TESTER_UIDS: " tester " });
  assert.equal(config.allows("tester"), true);
  assert.equal(config.allows("other"), false);
  for (const value of [null, true, {}, ""]) assert.equal(beta_access_config({ VOTIC_BETA_ACCESS_MODE: "all-signed-in" }).allows(value), false);
  assert.throws(() => beta_access_config({ VOTIC_BETA_ACCESS_MODE: "public" }), /VOTIC_BETA_ACCESS_MODE/);
  assert.throws(() => beta_access_config({ VOTIC_BETA_ACCESS_MODE: "allowlist" }), /VOTIC_BETA_TESTER_UIDS/);
  assert.throws(() => validate_production_security({ VOTIC_BETA_ACCESS_MODE: "all-signed-in" }), /persistent/);
});

test("beta uses verified UID, gates all feature routes, and preserves paid priority", async () => {
  const folder = mkdtempSync(join(tmpdir(), "votic-beta-"));
  const env = { FIREBASE_PROJECT_ID: "fixture", VOTIC_AI_USAGE_DB: join(folder, "usage.sqlite"), VOTIC_BETA_ACCESS_MODE: "allowlist", VOTIC_BETA_TESTER_UIDS: "tester" };
  let uid = "outsider";
  const unpaid = async () => false;
  unpaid.subscription = async () => ({ allowed: false });
  const store = create_usage_store(env);
  try {
    await server({ env, usageStore: store, authorize: () => ({ uid }), authorizePremium: unpaid }, async base => {
      assert.equal((await post(base + "/api/access", { uid: "tester", beta: true })).status, 200);
      assert.equal((await (await post(base + "/api/access")).json()).allowed, false);
      for (const path of ["extract", "scan", "import-url", "help", "review", "transcribe-question", "voice-question-status"])
        assert.equal((await post(base + "/api/" + path, { uid: "tester", beta: true })).status, 403, path);
      uid = "tester";
      const access = await post(base + "/api/access");
      assert.equal(access.headers.get("cache-control"), "no-store");
      assert.deepEqual(await access.json(), { uid: "tester", allowed: true, beta: true });
      const usage = await (await post(base + "/api/ai-usage")).json();
      assert.equal(usage.monthly.allowance, 1000);
      assert.equal(usage.plan.name, "Votic Beta");
      assert.deepEqual(usage.purchaseProducts, []);
      uid = null;
      assert.equal((await post(base + "/api/access")).status, 401);
    });
    const paid = async () => true;
    paid.subscription = async () => ({ allowed: true, periodStart: "2026-01-01T00:00:00Z", periodEnd: null });
    await server({ env, usageStore: store, authorize: () => ({ uid: "tester" }), authorizePremium: paid }, async base => {
      assert.deepEqual(await (await post(base + "/api/access")).json(), { uid: "tester", allowed: true, beta: false });
    });
  } finally { store.close(); rmSync(folder, { recursive: true, force: true }); }
});

test("beta credit exhaustion survives restart, blocks provider spend, and consent blocks before work", async () => {
  const folder = mkdtempSync(join(tmpdir(), "votic-beta-limit-"));
  const env = { FIREBASE_PROJECT_ID: "fixture", VOTIC_AI_USAGE_DB: join(folder, "ledger.sqlite"), VOTIC_BETA_ACCESS_MODE: "all-signed-in", VOTIC_MONTHLY_CREDITS: "1", OPENAI_API_KEY: "fixture", VOTIC_REQUIRE_AI_CONSENT: "true" };
  let work = 0;
  const options = { env, authorize: () => ({ uid: "tester" }),
    fetchImpl: async () => { work++; return { ok: true, headers: new Headers(), json: async () => ({ id: "resp-fixture", output_text: "Helpful response", usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 } }) }; } };
  try {
    const store = create_usage_store(env);
    try {
      await server({ ...options, usageStore: store }, async base => {
        assert.equal((await post(base + "/api/help", { question: "What is knowledge?" })).status, 428);
        assert.equal(work, 0);
        assert.equal((await post(base + "/api/help", { question: "What is knowledge?" }, { "X-Votic-AI-Consent": "openai-v1" })).status, 200);
        assert.equal(work, 1);
      });
    } finally { store.close(); }
    const restarted = create_usage_store(env);
    try {
      await server({ ...options, usageStore: restarted }, async base => {
        const denied = await post(base + "/api/help", { question: "Another general question?" }, { "X-Votic-AI-Consent": "openai-v1" });
        assert.equal(denied.status, 200);
        assert.equal((await denied.json()).mode, "built-in");
        assert.equal(work, 1);
      });
    } finally { restarted.close(); }
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test("entitlement fallback uses premium and rejects empty configuration", async () => {
  assert.throws(() => create_premium_authorizer({ REVENUECAT_ENTITLEMENT_ID: "  " }), /ENTITLEMENT_ID/);
  const verify = create_premium_authorizer({ REVENUECAT_SECRET_API_KEY: "fixture" }, { fetchImpl: async () => ({ ok: true, json: async () => ({ subscriber: { entitlements: { premium: { purchase_date: "2026-01-01T00:00:00Z", expires_date: null } } } }) }) });
  assert.equal(await verify("tester"), true);
});

test("deployment rejects missing/malformed SHA before cloud or root operations and never resolves branch heads", () => {
  for (const script of ["gce-create.sh", "vm-bootstrap.sh"]) {
    for (const sha of ["", "main", "abc; echo BAD", "a".repeat(39)]) {
      const result = spawnSync("bash", [`deploy/backend/${script}`], { env: { PATH: process.env.PATH, COMMIT_SHA: sha, VOTIC_BACKEND_HOST: "fixture.example" }, encoding: "utf8" });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /COMMIT_SHA/);
    }
    assert.equal(spawnSync("bash", ["-n", `deploy/backend/${script}`]).status, 0);
    const source = readFileSync(`deploy/backend/${script}`, "utf8");
    assert.doesNotMatch(source, /reset --hard FETCH_HEAD|\$BRANCH|curl.*\| sudo/);
  }
});

test("CI verification build opts into debug signing explicitly, never for production, and labels its artifact", () => {
  const workflow = readFileSync(".github/workflows/android-notification-playback.yml", "utf8");
  // Every Gradle step that runs release tasks carries both opt-ins, or the signing guard stops the build.
  const steps = workflow.split(/\n      - name: /).filter(step => /gradlew[^\n]*Release/.test(step));
  assert.equal(steps.length, 2);
  for (const step of steps) {
    assert.match(step, /VOTIC_CI_VERIFY_BUILD: "1"/);
    assert.match(step, /VOTIC_LOCAL_DEBUG_SIGNING: "1"/);
    assert.doesNotMatch(step, /EAS_BUILD_PROFILE/);
  }
  assert.match(workflow, /name: android-ci-build-debug-signed-NOT-FOR-PLAY/);
  const GUARD = readFileSync("apps/mobile/plugins/withUploadSigning.js", "utf8");
  assert.match(GUARD, /voticProfile != 'production'/);
  assert.match(GUARD, /VOTIC_CI_VERIFY_BUILD/);
});
