import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { create_firebase_authorizer } from "../app_parts/firebase_auth.js";
import { create_votic_server } from "../votic_server.js";

async function with_server(options, run) {
  const server = create_votic_server({ logger: { error() {}, warn() {} }, ...options });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await run(base); } finally { server.close(); await once(server, "close"); }
}
const document = { title: "Field Guide", sections: [{ heading: "Intro", text: "Revenue is income from sales." }] };
const ask = (base, body, headers = {}) => fetch(base + "/api/help", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
function capturing_ai(answer = { answer: "Income from sales.", sectionIndex: null, sectionTitle: null }) {
  const requests = [];
  const fetchImpl = async (_url, options) => { requests.push(JSON.parse(options.body)); return { ok: true, async json() { return { output_text: JSON.stringify(answer) }; } }; };
  return { requests, fetchImpl };
}

test("shapes document answers with the chosen explanation style", async () => {
  const ai = capturing_ai();
  await with_server({ env: { OPENAI_API_KEY: "test-key" }, fetchImpl: ai.fetchImpl }, async (base) => {
    assert.equal((await ask(base, { question: "What is revenue?", document, explanationStyle: "simple" })).status, 200);
    assert.match(ai.requests[0].instructions, /plain, everyday words/);
    assert.doesNotMatch(ai.requests[0].instructions, /Be concise and accessible/);
    assert.equal((await ask(base, { question: "What is revenue?", document, explanationStyle: "detailed" })).status, 200);
    assert.match(ai.requests[1].instructions, /thorough answer/);
    assert.equal(ai.requests[1].max_output_tokens, 900);
    // Adaptive, or no preference, keeps the original instructions unchanged.
    assert.equal((await ask(base, { question: "What is revenue?", document })).status, 200);
    assert.match(ai.requests[2].instructions, /Be concise and accessible\./);
    assert.equal(ai.requests[2].max_output_tokens, 600);
  });
});

test("treats a missing or unknown explanation style as no preference", async () => {
  const ai = capturing_ai();
  await with_server({ env: { OPENAI_API_KEY: "test-key" }, fetchImpl: ai.fetchImpl }, async (base) => {
    for (const explanationStyle of [undefined, "poetic", { toString: "quick" }])
      assert.equal((await ask(base, { question: "What is revenue?", document, explanationStyle })).status, 200);
    const [missing, unknown, object] = ai.requests;
    // An older or newer app never gets an error, and never changes the default instructions.
    assert.equal(unknown.instructions, missing.instructions);
    assert.equal(object.instructions, missing.instructions);
    assert.equal(unknown.max_output_tokens, missing.max_output_tokens);
  });
});

async function firebase_fixture(project_id = "votic-test") {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "test-key", alg: "RS256" };
  const keys = createLocalJWKSet({ keys: [jwk] });
  const token = (claims = {}, options = {}) =>
    new SignJWT({ ...claims })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(options.issuer ?? `https://securetoken.google.com/${project_id}`)
      .setAudience(options.audience ?? project_id)
      .setSubject(options.subject ?? "user-123")
      .setIssuedAt()
      .setExpirationTime(options.expires ?? "1h")
      .sign(privateKey);
  return { authorize: create_firebase_authorizer(project_id, { keys }), token };
}

test("requires a valid Firebase sign-in for the API when accounts are turned on", async () => {
  const firebase = await firebase_fixture();
  await with_server({ authorize: firebase.authorize }, async (base) => {
    assert.equal((await fetch(base + "/")).status, 200, "public pages stay open");
    assert.equal((await ask(base, { question: "How do I upload?" })).status, 401);
    const bad = [
      await firebase.token({}, { audience: "another-project" }),
      await firebase.token({}, { issuer: "https://securetoken.google.com/another-project" }),
      await firebase.token({}, { expires: Math.floor(Date.now() / 1000) - 60 }),
      "not-a-token",
    ];
    for (const token of bad) assert.equal((await ask(base, { question: "How do I upload?" }, { Authorization: `Bearer ${token}` })).status, 401);
    const good = await firebase.token();
    assert.equal((await ask(base, { question: "How do I upload?" }, { Authorization: `Bearer ${good}` })).status, 200);
  });
});

test("gives each signed-in account its own AI allowance", async () => {
  const firebase = await firebase_fixture();
  const ai = capturing_ai();
  const [first, second] = [await firebase.token({}, { subject: "first" }), await firebase.token({}, { subject: "second" })];
  await with_server({ authorize: firebase.authorize, env: { OPENAI_API_KEY: "test-key" }, config: { ai_client_daily_limit: 1 }, fetchImpl: ai.fetchImpl }, async (base) => {
    const answer = async (token) => (await (await ask(base, { question: "What is revenue?", document }, { Authorization: `Bearer ${token}` })).json()).answer;
    assert.equal(await answer(first), "Income from sales.");
    assert.match(await answer(first), /reached today's limit/);
    // Both requests come from the same address, but the second account has its own allowance.
    assert.equal(await answer(second), "Income from sales.");
  });
});
