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
test("production parser rejects malformed HTML encoding with a safe recovery action", async () => {
  const result = await extract("fixture.html", Buffer.from([60,112,62,233,60,47,112,62]));
  assert.equal(result.status, 400);
  assert.match(result.data.error, /Save or export it as UTF-8/);
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
