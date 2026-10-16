import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { create_votic_server } from "../votic_server.js";
import { extract_document, extract_rtf, PdfOcrRequiredError, render_pdf_for_ocr } from "../app_parts/document_file_tools.js";
import { AI_EXECUTION_LEASE_MS, create_usage_store, model_prices } from "../app_parts/ai_usage.js";
import { accounted_fetch } from "../app_parts/openai_gateway.js";
import { pdf_fixture } from "./pdf_fixtures.js";
const require = createRequire(import.meta.url);
const { verify_gitleaks_log } = require("../security/verify-gitleaks-log.cjs");
const { IMPORT_TYPES } = require("../apps/mobile/config/importTypes.js");
const configure_app = require("../apps/mobile/app.config.js");
const app = require("../apps/mobile/app.json");

async function with_server(options, run) {
  const server = create_votic_server({ logger: { error() {}, warn() {} }, ...options });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { server.close(); await once(server, "close"); }
}
const upload = (base, body) => fetch(base + "/api/extract", { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Votic-Filename": "scan.pdf" }, body });
const provider_reply = { output_text: "Cover text.\n\nScanned page text.", usage: { input_tokens: 5000, output_tokens: 20, total_tokens: 5020 } };

test("real mixed PDFs and image pages with selectable footers require complete OCR", async () => {
  for (const pages of [[{ text: "Cover text." }, { image: true }], [{ image: true, text: "Selectable footer" }]])
    await assert.rejects(extract_document("mixed.pdf", pdf_fixture(pages)), PdfOcrRequiredError);
  assert.match(await extract_document("text.pdf", pdf_fixture([{ text: "A normal text PDF." }])), /normal text PDF/);
});

test("mixed PDF HTTP import sends every page in order and never returns only the cover", async () => {
  let request;
  await with_server({ env: { OPENAI_API_KEY: "test-key" }, fetchImpl: async (_url, options) => {
    request = JSON.parse(options.body); return { ok: true, json: async () => provider_reply };
  } }, async (base) => {
    const response = await upload(base, pdf_fixture([{ text: "Cover text." }, { image: true }]));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { text: provider_reply.output_text });
    const content = request.input[0].content;
    assert.deepEqual(content.filter((item) => item.type === "input_text").map((item) => item.text), ["Page 1 of 2", "Page 2 of 2"]);
    assert.equal(content.filter((item) => item.type === "input_image").length, 2);
    assert.equal(request.store, false);
  });
});

test("a realistic PDF above 1.5 MB reaches OCR with a fresh default allowance", async () => {
  const body = pdf_fixture([{ image: true }], { image_size: 720 });
  assert.ok(body.length > 1_500_000);
  let calls = 0;
  const store = create_usage_store();
  try {
    await with_server({ env: { OPENAI_API_KEY: "test-key" }, usageStore: store, fetchImpl: async () => {
      calls++; return { ok: true, json: async () => provider_reply };
    } }, async (base) => {
      const response = await upload(base, body);
      assert.equal(response.status, 200);
      assert.equal(calls, 1);
      assert.ok(store.records()[0].reserved_tokens < 100_000);
      assert.equal(store.records()[0].total_tokens, 5020);
    });
  } finally { store.close(); }
});

test("PDF page limits reject before paid calls and allowance errors remain HTTP 429", async () => {
  const large = pdf_fixture(Array.from({ length: 21 }, () => ({ image: true })));
  await assert.rejects(render_pdf_for_ocr(large), /at most 20 pages/);
  let calls = 0;
  await with_server({ env: { OPENAI_API_KEY: "test-key", VOTIC_AI_MONTHLY_TOKENS: "100" }, fetchImpl: async () => { calls++; } }, async (base) => {
    assert.equal((await upload(base, large)).status, 413);
    const response = await upload(base, pdf_fixture([{ image: true }]));
    assert.equal(response.status, 429);
    assert.match((await response.json()).error, /monthly AI allowance/);
    assert.equal(calls, 0);
  });
});

test("expired execution leases release slots across workers/restart while retaining unknown charges", () => {
  const dir = mkdtempSync(join(tmpdir(), "votic-recovery-")), path = join(dir, "usage.sqlite");
  let time = new Date("2026-10-16T12:00:00Z"), first, second;
  const args = { user_id: "audit", feature: "ask-votic", model: "gpt-6-luna", input_bound: 100, output_bound: 10, rates: model_prices("gpt-6-luna") };
  const settings = { VOTIC_AI_MONTHLY_TOKENS: "400" };
  try {
    first = create_usage_store(settings, { path, now: () => time }); second = create_usage_store(settings, { path, now: () => time });
    first.reserve(args); first.reserve(args);
    assert.throws(() => second.reserve(args), /Too many/);
    first.close(); first = null;
    time = new Date(time.getTime() + AI_EXECUTION_LEASE_MS - 1);
    assert.throws(() => second.reserve(args), /Too many/);
    time = new Date(time.getTime() + 2);
    second.reserve(args);
    const old = second.records().filter((record) => record.started_at === "2026-10-16T12:00:00.000Z");
    assert.equal(old.length, 2);
    assert.ok(old.every((record) => record.allowance_tokens === 110 && record.estimated_cost_usd > 0));
    assert.throws(() => second.reserve(args), /monthly AI allowance/);
  } finally { first?.close(); second?.close(); rmSync(dir, { recursive: true, force: true }); }
});

test("the gateway bounds a stalled provider body and retains its charge after timeout", async () => {
  const store = create_usage_store();
  let signal;
  try {
    const paid = accounted_fetch({ store, env: {}, user_id: "audit", feature: "ask-votic", timeout_ms: 10,
      fetch_impl: async (_url, options) => { signal = options.signal; return { ok: true, json: async () => new Promise(() => {}) }; } });
    await assert.rejects(paid("https://api.openai.com/v1/responses", { body: JSON.stringify({ model: "gpt-6-luna", input: "hello", max_output_tokens: 100 }) }), /timed out/);
    assert.equal(signal.aborted, true);
    assert.equal(store.records()[0].status, "unknown");
    assert.ok(store.records()[0].allowance_tokens > 0);
  } finally { store.close(); }
});

test("RTF decodes code pages, multi-byte runs, escaped Unicode fallbacks, and binary destinations", () => {
  const read = (rtf) => extract_rtf(Buffer.from(rtf, "latin1"));
  assert.equal(read(String.raw`{\rtf1\ansi\ansicpg1252 Smart \'93quote\'94 and \'80 10.}`), "Smart “quote” and € 10.");
  assert.equal(read(String.raw`{\rtf1\ansi\uc1 Value \u233\'e9 end.}`), "Value é end.");
  assert.equal(read(String.raw`{\rtf1\ansi\ansicpg932 \'82\'a0}`), "あ");
  assert.equal(read(String.raw`{\rtf1\ansi\uc1 \u-10179?\u-8704?}`), "😀");
  assert.equal(read(String.raw`{\rtf1 Before {\pict\bin4 {}\x}After.}`), "Before After.");
  assert.throws(() => read(String.raw`{\rtf1 \bin999 short}`), /binary/);
  assert.throws(() => read(String.raw`{\rtf1\ansicpg99999 text}`), /unsupported text encoding/);
});

test("native Android share filters use the same complete import list as the picker", () => {
  const config = configure_app({ config: app.expo });
  const sharing = config.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-sharing")[1];
  assert.deepEqual(sharing.android.singleShareMimeTypes, Object.keys(IMPORT_TYPES));
  assert.ok(sharing.android.singleShareMimeTypes.includes("image/webp"));
  assert.ok(sharing.android.singleShareMimeTypes.includes("text/rtf"));
  assert.equal(sharing.ios.enabled, true);
});

test("secret scan verification rejects empty or broken history scans even after a green scanner exit", () => {
  verify_gitleaks_log("INF 238 commits scanned.\nINF no leaks found");
  for (const log of ["INF 0 commits scanned.\nINF no leaks found", "INF no leaks found", "INF 10 commits scanned.\ncommand aborted: exit status 128"])
    assert.throws(() => verify_gitleaks_log(log), /did not successfully inspect/);
});
