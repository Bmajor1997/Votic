import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { create_votic_server } from "../votic_server.js";

test("the Privacy Policy and Terms are public pages that link to each other and to account deletion", async () => {
  const s = create_votic_server({ logger: { warn() {}, error() {} } });
  s.listen(0, "127.0.0.1");
  await once(s, "listening");
  const base = `http://127.0.0.1:${s.address().port}`;
  try {
    const privacy = await fetch(base + "/privacy");
    assert.equal(privacy.status, 200);
    assert.match(privacy.headers.get("content-type"), /text\/html/);
    const privacyHtml = await privacy.text();
    assert.match(privacyHtml, /<h1>Votic Privacy Policy<\/h1>/);
    assert.match(privacyHtml, /href="\/delete-account"/);
    const terms = await fetch(base + "/terms");
    assert.equal(terms.status, 200);
    const termsHtml = await terms.text();
    assert.match(termsHtml, /<h1>Votic Terms of Use<\/h1>/);
    assert.match(termsHtml, /href="\/privacy"/);
    for (const html of [privacyHtml, termsHtml]) assert.doesNotMatch(html, /<script|<style/i);
  } finally {
    s.closeAllConnections();
    s.close();
    await once(s, "close");
  }
});
