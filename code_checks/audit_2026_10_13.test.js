// Regression tests for the October 13 audit fixes.
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import JSZip from "jszip";
import { create_votic_server } from "../votic_server.js";
import { extract_epub, html_to_document_text, powerpoint_xml_text, reconstruct_pdf_page_text } from "../app_parts/document_file_tools.js";
import { ai_failure_reason } from "../app_parts/openai_gateway.js";
import { create_premium_authorizer } from "../app_parts/premium_access.js";
import { local_help_answer } from "../app_parts/help_answers.js";

async function with_server(options, run) {
  const server = create_votic_server({ logger: { error() {}, warn() {} }, ...options });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try { await run(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); await once(server, "close"); }
}

test("an archive that lies about its expanded size is stopped while expanding, not after", async () => {
  const zip = new JSZip();
  zip.file("META-INF/container.xml", '<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>');
  zip.file("OEBPS/content.opf", '<package><manifest><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/></spine></package>');
  zip.file("OEBPS/a.xhtml", "<p>" + "A".repeat(9_000_000) + "</p>");
  const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  // Claim 1,000 bytes in both the local and central headers.
  for (let index = 0; index < bytes.length - 4; index++) {
    const signature = bytes.readUInt32LE(index);
    if (signature === 0x04034b50 && bytes.readUInt32LE(index + 22) > 1_000_000) bytes.writeUInt32LE(1000, index + 22);
    if (signature === 0x02014b50 && bytes.readUInt32LE(index + 24) > 1_000_000) bytes.writeUInt32LE(1000, index + 24);
  }
  await assert.rejects(extract_epub(bytes), /oversized file|processing limit/);
});

test("malformed character references are dropped instead of failing the document", () => {
  assert.equal(html_to_document_text("<p>Before &#99999999; after &#x41;</p>"), "Before  after A");
  assert.equal(powerpoint_xml_text("<a:p><a:t>Slide &#x110000;text</a:t></a:p>"), "Slide text");
});

test("PDF line grouping keeps rows apart and stays fast on text-dense pages", () => {
  const items = [];
  for (let row = 0; row < 3000; row++) for (let column = 0; column < 10; column++)
    items.push({ str: `r${row}c${column}`, transform: [1, 0, 0, 10, column * 40, 40000 - row * 12], width: 30, height: 10 });
  const started = Date.now();
  const lines = reconstruct_pdf_page_text(items).split("\n");
  assert.equal(lines.length, 3000);
  assert.equal(lines[0], "r0c0 r0c1 r0c2 r0c3 r0c4 r0c5 r0c6 r0c7 r0c8 r0c9");
  assert.ok(Date.now() - started < 2000);
});

test("an invalid AI reply is logged without quoting it", () => {
  let error;
  try { JSON.parse("The patient's record says"); } catch (caught) { error = caught; }
  assert.deepEqual(ai_failure_reason(error), { reason: "invalid AI response" });
});

test("confirmed Premium is remembered briefly; denials and errors are never remembered", async () => {
  let calls = 0, active = true, clock = Date.parse("2026-10-13T12:00:00Z");
  const fetch_impl = async () => {
    calls += 1;
    const entitlements = active ? { pro: { purchase_date: "2026-01-01T00:00:00Z", expires_date: null } } : {};
    return { ok: true, json: async () => ({ subscriber: { entitlements } }) };
  };
  const authorize = create_premium_authorizer({ REVENUECAT_SECRET_API_KEY: "test-key" }, { fetchImpl: fetch_impl, now: () => clock });
  assert.equal(await authorize("user"), true);
  assert.equal(await authorize("user"), true);
  assert.equal(calls, 1);
  active = false;
  clock += 61_000;
  assert.equal(await authorize("user"), false);
  assert.equal(await authorize("user"), false);
  assert.equal(calls, 3);
  assert.equal(await authorize("someone-else"), false);
});

test("Ask Votic help describes the phone app to the phone app and keeps the web guide for the web page", async () => {
  assert.match(local_help_answer("How do I scan a page?", "mobile"), /camera/);
  assert.doesNotMatch(local_help_answer("keyboard shortcuts help", "mobile"), /Space controls playback/);
  assert.match(local_help_answer("keyboard shortcuts help"), /Space controls playback/);
  await with_server({ env: {} }, async (base) => {
    const ask = (body) => fetch(base + "/api/help", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((response) => response.json());
    assert.match((await ask({ question: "How do I upload a document?", client: "mobile" })).answer, /Open Documents and choose Upload/);
    assert.match((await ask({ question: "How do I upload a document?" })).answer, /Choose Add document/);
    assert.match((await ask({ question: "How do I upload a document?", client: "anything-else" })).answer, /Choose Add document/);
  });
});

test("responses ask browsers to stay on HTTPS", async () => {
  await with_server({}, async (base) => {
    assert.equal((await fetch(base + "/")).headers.get("strict-transport-security"), "max-age=31536000");
  });
});
