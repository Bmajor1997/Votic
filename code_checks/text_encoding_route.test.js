import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import JSZip from "jszip";
import { create_votic_server } from "../votic_server.js";

async function extract(name, bytes) {
  const server = create_votic_server({ logger: { warn() {}, error() {} } });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/extract`, { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Votic-Filename": name }, body: bytes });
    return { status: response.status, data: await response.json() };
  } finally { server.closeAllConnections(); server.close(); await once(server, "close"); }
}
test("production HTML parser preserves BOM UTF-16 in both byte orders", async () => {
  const text = "Café — 日本語 العربية 😀";
  const bytes = Buffer.from(`<!doctype html><main><p>${text}</p></main>`, "utf16le");
  for (const body of [Buffer.concat([Buffer.from([255,254]), bytes]), Buffer.concat([Buffer.from([254,255]), Buffer.from(bytes).swap16()])]) {
    const result = await extract("fixture.html", body);
    assert.equal(result.status, 200);
    assert.equal(result.data.text.trim(), text);
  }
});
test("production parser reads older Windows/Latin-1 HTML instead of refusing it", async () => {
  const result = await extract("fixture.html", Buffer.from("<p>Caf\xe9 \x93quoted\x94 \x96 r\xe9sum\xe9</p>", "latin1"));
  assert.equal(result.status, 200);
  assert.equal(result.data.text.trim(), "Café “quoted” – résumé");
});
test("UTF-8 BOM takes precedence over stale legacy HTML metadata", async () => {
  const body = Buffer.concat([Buffer.from([239,187,191]), Buffer.from('<meta charset="windows-1252"><p>Café 日本語 😀</p>')]);
  const result = await extract("fixture.html", body);
  assert.equal(result.status, 200);
  assert.equal(result.data.text, "Café 日本語 😀");
});
test("declared or BOM UTF-8 corruption is rejected instead of guessed as Windows text", async () => {
  for (const prefix of [Buffer.from([239,187,191]), Buffer.from('<meta charset="utf-8">')]) {
    const body = Buffer.concat([prefix, Buffer.from("<p>caf"), Buffer.from([195]), Buffer.from("</p>")]);
    const result = await extract("fixture.html", body);
    assert.equal(result.status, 400);
    assert.match(result.data.error, /Save or export it as UTF-8/);
  }
});
test("production parser honours a saved page's declared charset", async () => {
  const body = Buffer.concat([Buffer.from('<meta charset="shift_jis"><p>'), Buffer.from([0x93,0xfa,0x96,0x7b,0x8c,0xea]), Buffer.from("</p>")]);
  const result = await extract("fixture.html", body);
  assert.equal(result.status, 200);
  assert.equal(result.data.text.trim(), "日本語");
});
test("EPUB chapter XML uses strict BOM decoding instead of implicit UTF-8 replacement", async () => {
  const zip = new JSZip();
  zip.file("META-INF/container.xml", '<container><rootfile full-path="book.opf"/></container>');
  zip.file("book.opf", '<package><manifest><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/></spine></package>');
  zip.file("one.xhtml", Buffer.concat([Buffer.from([255,254]),Buffer.from("<html><body><p>Résumé 日本語 😀</p></body></html>","utf16le")]));
  const result = await extract("fixture.epub", await zip.generateAsync({ type: "nodebuffer" }));
  assert.equal(result.status, 200);
  assert.match(result.data.text, /Résumé 日本語 😀/);
});
