import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { create_votic_server, load_server_config } from "../votic_server.js";

async function with_server(options, run) {
  const server = create_votic_server({ logger: { error() {}, warn() {} }, ...options });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await run(base); } finally { server.close(); await once(server, "close"); }
}
const pdf = Buffer.from("%PDF-1.7\nmock");

test("serves only allowlisted assets with security headers", async () => {
  await with_server({}, async (base) => {
    const home = await fetch(base + "/");
    assert.equal(home.status, 200);
    assert.equal(home.headers.get("x-content-type-options"), "nosniff");
    assert.match(home.headers.get("content-security-policy"), /default-src 'self'/);
    const home_text = await home.text();
    assert.match(home_text, /class="player-wordmark"[^>]*>Votic<\/span>/);
    assert.doesNotMatch(home_text, /class="timeline-brand[^>]*<img/);
    for (const path of ["/votic_server.js", "/package.json", "/.env", "/code_checks/document_tools.test.js", "/%2e%2e/votic_server.js", "/future-secret.txt"]) {
      assert.equal((await fetch(base + path)).status, 404, path);
    }
    assert.equal((await fetch(base + "/", { method: "POST" })).status, 405);
    const head = await fetch(base + "/main_look.css", { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    const logo = await fetch(base + "/assets/votic-mark.png");
    assert.equal(logo.status, 200);
    assert.equal(logo.headers.get("content-type"), "image/png");
    assert.ok((await logo.arrayBuffer()).byteLength > 0);
  });
});

test("rejects malformed paths and unsupported API methods", async () => {
  await with_server({}, async (base) => {
    assert.equal((await fetch(base + "/%E0%A4")).status, 400);
    const response = await fetch(base + "/api/help");
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "POST");
  });
});

test("accepts binary documents and validates names, signatures, and content types", async () => {
  await with_server({ extractDocument: async (_name, body) => `read ${body.length}` }, async (base) => {
    const valid = await fetch(base + "/api/extract", { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Votic-Filename": encodeURIComponent("file.pdf") }, body: pdf });
    assert.equal(valid.status, 200);
    assert.deepEqual(await valid.json(), { text: `read ${pdf.length}` });
    const powerpoint = await fetch(base + "/api/extract", { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Votic-Filename": "slides.pptx" }, body: Buffer.from([0x50, 0x4b, 0x03, 0x04]) });
    assert.equal(powerpoint.status, 200);
    const epub = await fetch(base + "/api/extract", { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Votic-Filename": "book.epub" }, body: Buffer.from([0x50, 0x4b, 0x03, 0x04]) });
    assert.equal(epub.status, 200);
    const legacyPowerpoint = await fetch(base + "/api/extract", { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Votic-Filename": "slides.ppt" }, body: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) });
    assert.equal(legacyPowerpoint.status, 200);
    assert.equal((await fetch(base + "/api/extract", { method: "POST", headers: { "Content-Type": "application/json", "X-Votic-Filename": "file.pdf" }, body: "{}" })).status, 415);
    assert.equal((await fetch(base + "/api/extract", { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Votic-Filename": "file.docx" }, body: pdf })).status, 415);
    assert.equal((await fetch(base + "/api/extract", { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Votic-Filename": "file.ppt" }, body: Buffer.from([0x50, 0x4b, 0x03, 0x04]) })).status, 415);
    assert.equal((await fetch(base + "/api/extract", { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: pdf })).status, 400);
  });
});

test("enforces body limits before document parsing", async () => {
  await with_server({ config: { max_document_bytes: 6 }, extractDocument: async () => { throw new Error("must not parse"); } }, async (base) => {
    const response = await fetch(base + "/api/extract", { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Votic-Filename": "file.pdf" }, body: pdf });
    assert.equal(response.status, 413);
  });
});

test("limits document parsing concurrency", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await with_server({ config: { extract_concurrency: 1 }, extractDocument: async () => { await gate; return "done"; } }, async (base) => {
    const request = () => fetch(base + "/api/extract", { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Votic-Filename": "file.pdf" }, body: pdf });
    const first = request();
    await new Promise((resolve) => setTimeout(resolve, 25));
    const second = await request();
    assert.equal(second.status, 429);
    assert.equal(second.headers.get("retry-after"), "2");
    release();
    assert.equal((await first).status, 200);
  });
});

test("rate limits AI help independently", async () => {
  await with_server({ config: { help_rate_limit: 1 } }, async (base) => {
    const request = () => fetch(base + "/api/help", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: "How do I upload?" }) });
    assert.equal((await request()).status, 200);
    const limited = await request();
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get("retry-after")) >= 1);
  });
});

test("falls back safely when AI help times out or fails", async () => {
  await with_server({ env: { OPENAI_API_KEY: "test" }, config: { ai_timeout_ms: 10 }, fetchImpl: async (_url, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))) }, async (base) => {
    const response = await fetch(base + "/api/help", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: "How do I upload?" }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).mode, "built-in");
  });
});

test("answers from an explicitly supplied document and returns a safe section link", async () => {
  let apiBody;
  const fetchImpl = async (_url, options) => { apiBody = JSON.parse(options.body); return { ok: true, async json() { return { output_text: JSON.stringify({ answer: "The conclusion recommends testing.", sectionIndex: 1, sectionTitle: "Ignored model title" }) }; } }; };
  await with_server({ env: { OPENAI_API_KEY: "test-key", OPENAI_DOCUMENT_MODEL: "document-model" }, fetchImpl }, async (base) => {
    const document = { title: "Plan", sections: [{ heading: "Introduction", text: "Background." }, { heading: "Conclusion", text: "Test the prototype." }] };
    const response = await fetch(base + "/api/help", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: "What is recommended?", document }) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { answer: "The conclusion recommends testing.", mode: "document-ai", sectionIndex: 1, sectionTitle: "Conclusion" });
    assert.equal(apiBody.model, "document-model");
    assert.equal(apiBody.store, false);
    assert.equal(apiBody.text.format.type, "json_schema");
    assert.match(apiBody.input, /Test the prototype/);
  });
});

test("does not send a document when document AI is not connected", async () => {
  await with_server({ env: {} }, async (base) => {
    const response = await fetch(base + "/api/help", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: "What does it say?", document: { title: "Plan", sections: [{ heading: "Start", text: "Private text." }] } }) });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.mode, "built-in");
    assert.match(result.answer, /require the AI connection/i);
  });
});

test("generates a private structured AI review", async () => {
  let apiRequest;
  const fetchImpl = async (url, options) => {
    apiRequest = { url, options, body: JSON.parse(options.body) };
    return { ok: true, async json() { return { output_text: JSON.stringify({ summary: "A focused summary.", takeaways: ["First point", "Second point"] }) }; } };
  };
  await with_server({ env: { OPENAI_API_KEY: "test-key", OPENAI_REVIEW_MODEL: "review-model" }, fetchImpl }, async (base) => {
    const response = await fetch(base + "/api/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Plan", sections: [{ heading: "Start", text: "Important source material." }] }) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { summary: "A focused summary.", takeaways: ["First point", "Second point"], mode: "ai" });
    assert.equal(apiRequest.url, "https://api.openai.com/v1/responses");
    assert.equal(apiRequest.body.model, "review-model");
    assert.equal(apiRequest.body.store, false);
    assert.equal(apiRequest.body.text.format.type, "json_schema");
    assert.match(apiRequest.body.input, /Important source material/);
  });
});

test("keeps the local review available when AI review is not connected", async () => {
  await with_server({ env: {} }, async (base) => {
    const response = await fetch(base + "/api/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Plan", sections: [{ heading: "Start", text: "Text." }] }) });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /local review/i);
  });
});

test("validates AI review document content", async () => {
  await with_server({ env: { OPENAI_API_KEY: "test-key" } }, async (base) => {
    const response = await fetch(base + "/api/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Empty", sections: [] }) });
    assert.equal(response.status, 400);
  });
});

test("provides an authentication seam without inventing accounts", async () => {
  await with_server({ authorize: () => false }, async (base) => {
    assert.equal((await fetch(base + "/")).status, 401);
  });
});

test("validates environment-backed server limits", () => {
  assert.equal(load_server_config({ VOTIC_RATE_LIMIT: "7" }).general_rate_limit, 7);
  assert.throws(() => load_server_config({ VOTIC_RATE_LIMIT: "zero" }), /integer/);
});
