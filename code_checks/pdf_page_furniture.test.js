import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { create_votic_server } from "../votic_server.js";

/**
 * A text PDF with one page per entry. Each line is drawn 20 points below the last, starting near the top edge, so
 * the first and last lines sit where running headers and footers would. `reverse` writes each page's lines into
 * the content stream bottom-first, to prove reading order comes from position rather than stream order.
 */
function text_pdf(pages, { reverse = false } = {}) {
  const escape = (text) => text.replace(/[\\()]/g, (character) => `\\${character}`);
  const stream = (text) => `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`;
  const font = 3 + pages.length * 2;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_page, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  ];
  pages.forEach((lines, index) => {
    const drawn = lines.map((line, row) => { const value = typeof line === "string" ? { text: line, x: 50, y: 750 - row * 20 } : line; return `BT /F1 12 Tf ${value.x} ${value.y} Td (${escape(value.text)}) Tj ET`; });
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${4 + index * 2} 0 R >>`,
      stream((reverse ? drawn.reverse() : drawn).join("\n")),
    );
  });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

/** Extracts through the production route: HTTP upload, isolated parser process, and cleanup. */
async function extract(pdf) {
  const server = create_votic_server({ logger: { warn() {}, error() {} } });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "X-Votic-Filename": "fixture.pdf" },
      body: pdf,
    });
    assert.equal(response.status, 200);
    return (await response.json()).text;
  } finally {
    server.closeAllConnections();
    server.close();
    await once(server, "close");
  }
}
/** Asserts every expected line is present, in this order. */
function assert_in_order(text, expected) {
  let from = 0;
  for (const line of expected) {
    const at = text.indexOf(line, from);
    assert.ok(at >= 0, `missing or out of order: ${JSON.stringify(line)}\n--- extracted ---\n${text}`);
    from = at + line.length;
  }
}

test("numbered chapter headings and distinct bottom sentences survive on every page", async () => {
  const pages = [1, 2, 3].map((n) => [
    `Chapter ${n}`,
    `The story of chapter ${n} begins here with its first full sentence.`,
    `Chapter ${n} ends with its own closing sentence at the bottom of page ${n}.`,
  ]);
  const text = await extract(text_pdf(pages));
  assert_in_order(text, pages.flat());
});

test("reading order comes from position on the page, not the order lines were written", async () => {
  const pages = [["Title at the top", "Middle paragraph.", "Closing line at the bottom."]];
  assert_in_order(await extract(text_pdf(pages, { reverse: true })), pages[0]);
});

test("repeated meaningful sentences stay, including at page edges", async () => {
  const refrain = "Remember to check your work before moving on.";
  const pages = [1, 2, 3].map((n) => [refrain, `Lesson ${n} explains a new idea in detail.`, refrain]);
  const text = await extract(text_pdf(pages));
  assert.equal(text.split(refrain).length - 1, 6, text);
  assert_in_order(text, pages.flat());
});

test("standalone page numbers counting with the pages are removed, but numbers in the body stay", async () => {
  const pages = [1, 2, 3].map((n) => [`Section ${n} opens the page.`, "42", `Section ${n} closes the page.`, String(n)]);
  const text = await extract(text_pdf(pages));
  assert_in_order(text, pages.flatMap((lines) => lines.slice(0, 3)));
  assert.doesNotMatch(text, /^(?:1|2|3)$/m);
});

test("ambiguous repeated labels remain while sequential page footers are removed", async () => {
  const pages = [1, 2, 3].map((n) => [
    "VOTIC FIELD GUIDE",
    `Field note ${n} describes what was seen on day ${n}.`,
    `Page ${n} of 3`,
  ]);
  const text = await extract(text_pdf(pages));
  assert.equal(text.split("VOTIC FIELD GUIDE").length - 1, 3);
  assert.doesNotMatch(text, /Page \d of 3/);
  assert_in_order(text, pages.map((lines) => lines[1]));
});

test("a single-page document keeps every line, including a heading and a short last line", async () => {
  const lines = ["Chapter 1", "A one-page story starts and finishes here.", "The End", "1"];
  const text = await extract(text_pdf([lines]));
  assert_in_order(text, lines);
});

test("a two-page document keeps identical headings, since two pages are not enough evidence", async () => {
  const pages = [1, 2].map((n) => ["Introduction", `Page ${n} of the introduction has its own sentence.`]);
  const text = await extract(text_pdf(pages));
  assert.equal(text.split("Introduction\n").length - 1, 2, text);
});

test("short repeated instructions at either page edge are never deleted as headers", async () => {
  const pages = [1,2,3].map(n => ["Safety first", `Lesson ${n} has its own instruction.`, "Check your work"]);
  assert_in_order(await extract(text_pdf(pages)), pages.flat());
});

test("production PDF route reads uneven columns and mixed full-width blocks in visual order", async () => {
  const positioned = [
    { text: "A full width introduction spanning both columns before the article begins.", x: 50, y: 750 },
    { text: "Left column first sentence.", x: 50, y: 710 },
    { text: "Right column first sentence.", x: 335, y: 710 },
    { text: "Left column second sentence.", x: 50, y: 690 },
    { text: "Right column second sentence.", x: 335, y: 690 },
    { text: "Right column third sentence.", x: 335, y: 670 },
    { text: "A full width closing paragraph spanning both columns ends the article.", x: 50, y: 630 },
  ];
  const text = await extract(text_pdf([positioned], { reverse: true }));
  assert_in_order(text, [positioned[0], positioned[1], positioned[3], positioned[2], positioned[4], positioned[5], positioned[6]].map((v) => v.text));
});
