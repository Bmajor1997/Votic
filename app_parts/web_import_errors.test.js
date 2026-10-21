/* global Response */
import test from "node:test";
import assert from "node:assert/strict";
import {
  http_failure,
  import_public_webpage,
  network_failure,
  retry_after_seconds,
  WEB_IMPORT_USER_AGENT,
} from "./web_import.js";

const lookupImpl = async () => [{ address: "203.0.113.10", family: 4 }];
const ARTICLE =
  "<title>Story</title><article><h1>Story</h1><p>This is a long public article paragraph with useful information for a Votic reader.</p><p>Another paragraph makes the page long enough to be accepted.</p></article>";
const import_with = (respond) =>
  import_public_webpage("https://public.test/story", { lookupImpl, fetchImpl: async (...args) => respond(...args) });

test("web importer explains access denial, missing pages, rate limits and server errors separately", async () => {
  const cases = [
    [401, {}, /denied Votic access\. Try another page or import a document instead\./],
    [403, {}, /denied Votic access/],
    [403, { "cf-mitigated": "challenge" }, /browser check that Votic can't complete/],
    [404, {}, /wasn't found/],
    [410, {}, /wasn't found/],
    [429, { "retry-after": "30" }, /limiting requests right now\. Try again in a minute\./],
    [429, { "retry-after": "600" }, /Try again in about 10 minutes\./],
    [429, {}, /limiting requests right now\. Try again later\./],
    [500, {}, /having trouble right now/],
    [503, { "retry-after": "120" }, /having trouble right now/],
    [418, {}, /returned an error \(HTTP 418\)/],
  ];
  for (const [status, headers, message] of cases)
    await assert.rejects(() => import_with(() => new Response("", { status, headers })), message, `HTTP ${status}`);
});

test("an unexplained failure never claims the website blocked Votic", async () => {
  for (const status of [400, 404, 429, 500, 502]) {
    const message = http_failure(new Response("", { status }));
    assert.doesNotMatch(message, /denied|blocked/i, `HTTP ${status}`);
  }
});

test("Retry-After is read as seconds or as an HTTP date", () => {
  const now = Date.parse("2026-10-21T12:00:00Z");
  assert.equal(retry_after_seconds("45", now), 45);
  assert.equal(retry_after_seconds("Wed, 21 Oct 2026 12:05:00 GMT", now), 300);
  assert.equal(retry_after_seconds("Wed, 21 Oct 2026 11:00:00 GMT", now), 0);
  assert.equal(retry_after_seconds("soon", now), null);
  assert.equal(retry_after_seconds(null, now), null);
});

test("bot checks and script-only pages returned with HTTP 200 are explained, not reported as empty articles", async () => {
  const challenge = "<html><head><title>Just a moment...</title></head><body><script src=\"/cdn-cgi/challenge-platform/h/b/orchestrate\"></script></body></html>";
  await assert.rejects(
    () => import_with(() => new Response(challenge, { status: 200, headers: { "content-type": "text/html" } })),
    /needs a full web browser/,
  );
  await assert.rejects(
    () => import_with(() => new Response(ARTICLE, { status: 200, headers: { "content-type": "text/html", "cf-mitigated": "challenge" } })),
    /needs a full web browser/,
  );
  const shell = "<html><body><div id=\"root\"></div><noscript>You need to enable JavaScript to run this app.</noscript><script src=\"/app.js\"></script></body></html>";
  await assert.rejects(
    () => import_with(() => new Response(shell, { status: 200, headers: { "content-type": "text/html" } })),
    /needs a full web browser/,
  );
  // A short page without those signs keeps the existing, accurate message.
  await assert.rejects(
    () => import_with(() => new Response("<p>Too short.</p>", { status: 200, headers: { "content-type": "text/html" } })),
    /could not find enough readable article text/,
  );
});

test("unsupported content says what the link is", async () => {
  await assert.rejects(
    () => import_with(() => new Response("%PDF-1.7", { status: 200, headers: { "content-type": "application/pdf" } })),
    /PDF file\. Download it, then import it as a document\./,
  );
  await assert.rejects(
    () => import_with(() => new Response("{}", { status: 200, headers: { "content-type": "application/json" } })),
    /does not point to a readable webpage/,
  );
});

test("DNS, TLS and connection failures are described by what failed", async () => {
  const failing = (code) => async () => {
    throw Object.assign(new Error("lookup failed"), { code });
  };
  await assert.rejects(
    () => import_public_webpage("https://missing.test/", { lookupImpl: failing("ENOTFOUND") }),
    /couldn't find that website/,
  );
  await assert.rejects(
    () => import_public_webpage("https://missing.test/", { lookupImpl: failing("EAI_AGAIN") }),
    /couldn't look up that website right now/,
  );
  for (const [code, message] of [
    ["CERT_HAS_EXPIRED", /secure connection couldn't be verified/],
    ["ERR_TLS_CERT_ALTNAME_INVALID", /secure connection couldn't be verified/],
    ["ECONNREFUSED", /couldn't connect to that website/],
    ["ECONNRESET", /couldn't connect to that website/],
    ["SOMETHING_ELSE", /could not be downloaded\. Try again later\./],
  ])
    await assert.rejects(() => import_with(failing(code)), message, code);
  assert.match(network_failure(new Error("no code")).message, /could not be downloaded/);
});

test("the importer identifies itself with a standard User-Agent and never as a browser", async () => {
  let sent;
  await import_with((_url, options) => {
    sent = options.headers["User-Agent"];
    return new Response(ARTICLE, { status: 200, headers: { "content-type": "text/html" } });
  });
  assert.equal(sent, WEB_IMPORT_USER_AGENT);
  // RFC 9110: product/version, then an optional parenthesized comment.
  assert.match(sent, /^[A-Za-z][\w.-]*\/[\w.-]+(?: \([^()]*\))?$/);
  assert.doesNotMatch(sent, /Mozilla|Chrome|Safari|AppleWebKit|Gecko/i);
});

test("error handling keeps private-network and redirect protections in place", async () => {
  const lookup = async (host) =>
    host === "public.test" ? [{ address: "203.0.113.10", family: 4 }] : [{ address: "10.0.0.2", family: 4 }];
  await assert.rejects(
    () =>
      import_public_webpage("https://public.test/a", {
        lookupImpl: lookup,
        fetchImpl: async () => new Response("", { status: 302, headers: { location: "http://private.test/" } }),
      }),
    /not public/,
  );
  await assert.rejects(() => import_public_webpage("http://127.0.0.1/", { lookupImpl: lookup }), /not public/);
});
