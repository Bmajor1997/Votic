import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { generateKeyPair, SignJWT } from "jose";
import { create_usage_store } from "../app_parts/ai_usage.js";
import { create_firebase_authorizer } from "../app_parts/firebase_auth.js";
import { capability_report, create_votic_server } from "../votic_server.js";

const feedback = () => ({ category: "bug", title: "Crash", description: "The reader closed.", requestId: randomUUID() });
async function serve(options, work) {
  const store = create_usage_store();
  const server = create_votic_server({ usageStore: store, logger: { error() {}, warn() {} }, ...options });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await work(`http://127.0.0.1:${server.address().port}`, store);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  }
}
const post = (base, token) =>
  fetch(`${base}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(feedback()),
  }).then(async (response) => ({ status: response.status, body: await response.json() }));

test("feedback on a server without sign-in verification is unavailable, not a request to sign in", async () => {
  await serve({ env: {} }, async (base, store) => {
    for (const token of [null, "a-real-looking-token"]) {
      const { status, body } = await post(base, token);
      assert.equal(status, 503);
      assert.equal(body.code, "AUTH_UNAVAILABLE");
      assert.doesNotMatch(body.error, /sign in/i);
      assert.doesNotMatch(body.error, /FIREBASE|PROJECT|configur/i);
    }
    // Nothing was stored under an unverified identity.
    assert.equal(store.feedback.dashboard().totals.bug, 0);
  });
});

test("feedback distinguishes no session from an expired or forged one, and accepts a verified token", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const token = (expiration) =>
    new SignJWT({})
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("reader")
      .setIssuedAt()
      .setExpirationTime(expiration)
      .setIssuer("https://securetoken.google.com/votic-test")
      .setAudience("votic-test")
      .sign(privateKey);
  await serve(
    { env: { FIREBASE_PROJECT_ID: "votic-test" }, authorize: create_firebase_authorizer("votic-test", { keys: publicKey }) },
    async (base, store) => {
      const missing = await post(base, null);
      assert.equal(missing.status, 401);
      assert.equal(missing.body.code, "AUTH_REQUIRED");

      const expired = await post(base, await token(1));
      assert.equal(expired.status, 401);
      assert.equal(expired.body.code, "AUTH_EXPIRED");
      assert.match(expired.body.error, /expired\. Sign in again/);

      const forged = await post(base, "not-a-token");
      assert.equal(forged.body.code, "AUTH_EXPIRED");

      const valid = await post(base, await token("1h"));
      assert.equal(valid.status, 201);
      assert.equal(store.feedback.dashboard().totals.bug, 1);
    },
  );
});

test("client-supplied identities are never trusted when verification is configured", async () => {
  await serve({ env: { FIREBASE_PROJECT_ID: "votic-test" } }, async (base) => {
    const response = await fetch(`${base}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Id": "someone", Authorization: "Bearer someone" },
      body: JSON.stringify({ ...feedback(), uid: "someone" }),
    });
    assert.equal(response.status, 401);
  });
});

test("startup report names missing settings and never prints secret values", () => {
  const secret = "sk-test-secret-value-that-must-not-print";
  const configured = capability_report({
    FIREBASE_PROJECT_ID: "votic-da5c4",
    OPENAI_API_KEY: secret,
    OPENAI_MODEL: "gpt-6-luna",
    VOTIC_CLIENT_KEYS: "public-key-a,public-key-b",
  }).join("\n");
  assert.match(configured, /Sign-in verification: on \(Firebase project votic-da5c4\)/);
  assert.match(configured, /AI features: on \(model gpt-6-luna\)/);
  assert.match(configured, /required \(2 configured\)/);
  assert.doesNotMatch(configured, new RegExp(secret));
  assert.doesNotMatch(configured, /public-key-a/);

  const empty = capability_report({}).join("\n");
  assert.match(empty, /Sign-in verification: OFF\. Set FIREBASE_PROJECT_ID/);
  assert.match(empty, /AI features: OFF\. Set OPENAI_API_KEY.*camera text recognition/);
  assert.match(empty, /Voice questions: off/);
  assert.match(empty, /App client keys: not required/);
});

test("AI features without a key report temporary unavailability without implementation details", async () => {
  await serve({ env: {} }, async (base) => {
    const scan = await fetch(`${base}/api/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "X-Votic-Filename": "page.jpg" },
      body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    });
    const { error } = await scan.json();
    assert.equal(scan.status, 503);
    assert.match(error, /temporarily unavailable/);
    assert.doesNotMatch(error, /OPENAI|API key|configur|not connected/i);
  });
});
