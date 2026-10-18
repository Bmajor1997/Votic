import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extract_document } from "../app_parts/document_file_tools.js";
import { parse_document_isolated } from "../app_parts/document_parser.js";
import { AI_EXECUTION_LEASE_MS, AI_EXECUTION_TIMEOUT_MS, create_usage_store, model_prices } from "../app_parts/ai_usage.js";
import { accounted_fetch } from "../app_parts/openai_gateway.js";
import { create_votic_server } from "../votic_server.js";

function mixed_pdf(image = true, watermark = "", imageSize = 200) {
  const stream = (text) => `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>",
    stream("BT /F1 12 Tf 50 700 Td (Selectable first page.) Tj ET"),
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> /XObject << /Im 8 0 R >> >> /Contents 6 0 R >>",
    stream(`${image ? `q ${imageSize} 0 0 ${imageSize} 30 30 cm /Im Do Q` : ""}${watermark ? ` BT /F1 12 Tf 50 700 Td (${watermark}) Tj ET` : ""}`),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length 3 >>\nstream\n00>\nendstream",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

test("mixed PDFs and selectable scan watermarks require OCR; truly blank pages do not", async () => {
  for (const watermark of ["", "Page 2"]) {
    await assert.rejects(extract_document("mixed.pdf", mixed_pdf(true, watermark)), { code: "PDF_OCR_REQUIRED" });
    await assert.rejects(parse_document_isolated("mixed.pdf", mixed_pdf(true, watermark)), { code: "PDF_OCR_REQUIRED" });
  }
  assert.match(await extract_document("blank-page.pdf", mixed_pdf(false)), /Selectable first page/);
  const heading = "A lengthy selectable heading above scanned content. ".repeat(3);
  await assert.rejects(extract_document("partial-ocr.pdf", mixed_pdf(true, heading, 500)), { code: "PDF_OCR_REQUIRED" });
  await assert.rejects(extract_document("small-scanned-region.pdf", mixed_pdf(true, heading, 20)), { code: "PDF_OCR_REQUIRED" });
  assert.equal(await parse_document_isolated("article.html", Buffer.from("<h1>Article</h1><p>Complete text.</p>")), "# Article\n\nComplete text.");
});

const loopWorker = new URL("data:text/javascript,while(true){}");
test("synchronous stuck parser workers are terminated on timeout and cancellation", async () => {
  await assert.rejects(parse_document_isolated("stuck.pdf", Buffer.alloc(0), { timeoutMs: 100, workerUrl: loopWorker }), { code: "PARSER_TIMEOUT" });
  const controller = new AbortController();
  const promise = parse_document_isolated("stuck.pdf", Buffer.alloc(0), { signal: controller.signal, workerUrl: loopWorker });
  controller.abort();
  await assert.rejects(promise, /canceled/);
});

async function with_server(options, run) {
  const server = create_votic_server({ logger: { warn() {}, error() {} }, ...options });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections(); server.close(); await once(server, "close"); }
}
const upload = (base, bytes, signal) => fetch(base + "/api/extract", { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Votic-Filename": "mixed.pdf" }, body: bytes, signal });

test("timed-out parsers release HTTP upload capacity", async () => {
  await with_server({ parserWorkerUrl: loopWorker, config: { parser_timeout_ms: 100, extract_concurrency: 1 } }, async (base) => {
    assert.equal((await upload(base, Buffer.from("%PDF-1.4\n"))).status, 504);
    assert.equal((await upload(base, Buffer.from("%PDF-1.4\n"))).status, 504);
  });
});
test("mixed-PDF HTTP import OCRs the whole document instead of returning partial text", async () => {
  let calls = 0;
  await with_server({ env: { OPENAI_API_KEY: "test-only" }, fetchImpl: async (_url, init) => {
    calls++;
    assert.equal(JSON.parse(init.body).input[0].content[1].type, "input_file");
    return { ok: true, json: async () => ({ output_text: "Selectable first page.\nScanned second page." }) };
  } }, async (base) => {
    const response = await upload(base, mixed_pdf(true, "A lengthy selectable heading above scanned content. ".repeat(3), 20));
    assert.equal(response.status, 200);
    assert.match((await response.json()).text, /Scanned second page/);
    assert.equal(calls, 1);
  });
  await with_server({}, async (base) => assert.equal((await upload(base, mixed_pdf())).status, 503));
});

test("orphaned AI execution slots recover across restart without refunding reserved spend", () => {
  const dir = mkdtempSync(join(tmpdir(), "votic-lease-"));
  const path = join(dir, "usage.sqlite");
  let time = new Date("2026-10-01T00:00:00Z");
  const input = { user_id: "account-a", feature: "ask", model: "gpt-6-luna", input_bound: 100, output_bound: 100, rates: model_prices("gpt-6-luna") };
  let store;
  try {
    store = create_usage_store({ VOTIC_AI_USER_CONCURRENCY: "1" }, { path, now: () => time });
    const id = store.reserve(input), reserved = store.records()[0];
    assert.throws(() => store.reserve(input), /Too many/);
    store.close();
    time = new Date(time.getTime() + AI_EXECUTION_LEASE_MS + 1);
    store = create_usage_store({ VOTIC_AI_USER_CONCURRENCY: "1" }, { path, now: () => time });
    store.reserve(input);
    const old = store.records().find((row) => row.request_id === id);
    assert.equal(old.status, "unknown");
    assert.equal(old.allowance_tokens, reserved.allowance_tokens);
    assert.equal(old.estimated_cost_usd, reserved.estimated_cost_usd);
    store.finish(id, { status: "completed", result: { usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } } });
    assert.equal(store.records().find((row) => row.request_id === id).allowance_tokens, 15);
  } finally { store?.close(); rmSync(dir, { recursive: true, force: true }); }
});
test("AI cancellation releases execution capacity even when provider ignores AbortSignal", async () => {
  const store = create_usage_store({ VOTIC_AI_USER_CONCURRENCY: "1" });
  const controller = new AbortController();
  try {
    const run = accounted_fetch({ fetch_impl: async () => new Promise(() => {}), store, env: {}, user_id: "user-a", feature: "ask" });
    const pending = run("https://api.openai.com/v1/responses", { signal: controller.signal, headers: {}, body: JSON.stringify({ model: "gpt-6-luna", input: "question", max_output_tokens: 10 }) });
    controller.abort(); await assert.rejects(pending, /canceled/);
    assert.equal(store.records()[0].status, "unknown");
    assert.ok(store.records()[0].allowance_tokens > 0);
    store.reserve({ user_id: "user-a", feature: "ask", model: "gpt-6-luna", input_bound: 1, output_bound: 1, rates: model_prices("gpt-6-luna") });
  } finally { store.close(); }
});

test("the AI execution deadline also bounds a stalled provider response body", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const store = create_usage_store({ VOTIC_AI_USER_CONCURRENCY: "1" });
  try {
    let reading = false;
    const run = accounted_fetch({ fetch_impl: async () => ({ ok: true, json: () => { reading = true; return new Promise(() => {}); } }), store, env: {}, user_id: "user-a", feature: "ask" });
    const pending = run("https://api.openai.com/v1/responses", { headers: {}, body: JSON.stringify({ model: "gpt-6-luna", input: "question", max_output_tokens: 10 }) });
    const outcome = assert.rejects(pending, /timed out/);
    await Promise.resolve();
    assert.equal(reading, true);
    t.mock.timers.tick(AI_EXECUTION_TIMEOUT_MS);
    await outcome;
    assert.equal(store.records()[0].status, "unknown");
    store.reserve({ user_id: "user-a", feature: "ask", model: "gpt-6-luna", input_bound: 1, output_bound: 1, rates: model_prices("gpt-6-luna") });
  } finally { store.close(); }
});

test("answer reports survive restart and expire after 30 days", () => {
  const dir = mkdtempSync(join(tmpdir(), "votic-reports-"));
  const path = join(dir, "usage.sqlite");
  let time = new Date("2026-10-01T00:00:00Z"), store;
  try {
    store = create_usage_store({}, { path, now: () => time });
    const id = store.recordReport({ user_id: "account-a", reason: "harmful", answer: "Opted-in answer" });
    store.close();
    store = create_usage_store({}, { path, now: () => time });
    assert.equal(store.reports()[0].id, id);
    store.resolveReport(id);
    assert.equal(store.reports()[0].status, "reviewed");
    time = new Date(time.getTime() + 31 * 86400000);
    assert.equal(store.reports().length, 0);
  } finally { store?.close(); rmSync(dir, { recursive: true, force: true }); }
});

test("answer reports require identity and explicit consent, persist privately, and reject extra document fields", async () => {
  const store = create_usage_store();
  const report = { reason: "harmful", answer: "Reported answer", consent: true };
  const post = (base, body) => fetch(base + "/api/report-answer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  try {
    await with_server({ usageStore: store }, async (base) => assert.equal((await post(base, report)).status, 401));
    await with_server({ usageStore: store, authorize: () => ({ uid: "verified-account" }), authorizePremium: () => { throw new Error("Reporting must not check Premium"); } }, async (base) => {
      assert.equal((await post(base, { ...report, consent: false })).status, 400);
      assert.equal((await post(base, { ...report, document: "private" })).status, 400);
      assert.equal((await post(base, { ...report, answer: "x".repeat(8001) })).status, 400);
      const response = await post(base, report); assert.equal(response.status, 201);
      assert.ok((await response.json()).id);
      assert.equal((await fetch(base + "/api/report-answer")).status, 405);
    });
    assert.equal(store.reports().length, 1);
    assert.equal(store.reports()[0].user_id, "verified-account");
    assert.equal(store.reports()[0].answer, report.answer);
  } finally { store.close(); }
});
