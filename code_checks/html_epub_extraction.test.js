import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import JSZip from "jszip";
import { create_votic_server } from "../votic_server.js";

/** Extracts through the production route: HTTP upload, isolated parser process, and cleanup. */
async function extract(filename, body) {
  const server = create_votic_server({ logger: { warn() {}, error() {} } });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "X-Votic-Filename": filename },
      body,
    });
    assert.equal(response.status, 200);
    return (await response.json()).text;
  } finally {
    server.closeAllConnections();
    server.close();
    await once(server, "close");
  }
}
function assert_in_order(text, expected) {
  let from = 0;
  for (const part of expected) {
    const at = text.indexOf(part, from);
    assert.ok(at >= 0, `missing or out of order: ${JSON.stringify(part)}\n--- extracted ---\n${text}`);
    from = at + part.length;
  }
}
function assert_absent(text, unwanted) {
  for (const part of unwanted) assert.ok(!text.includes(part), `should be left out: ${JSON.stringify(part)}\n${text}`);
}

const SAVED_PAGE = `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="utf-8"><title>Octopus Facts | Ocean Site</title>
  <style>.menu { color: red }</style><script>window.track("page")</script>
</head><body>
  <header><a href="/">Ocean Site</a><nav><a href="/">Home</a> | <a href="/about">About</a></nav></header>
  <div role="navigation"><a href="/a">Topics</a></div>
  <main><article>
    <h1>Octopus
      facts</h1>
    <p>An octopus has <b>three</b> <i>hearts</i> and blue blood.<br>It can taste with its arms.</p>
    <ul><li>Eight arms</li><li>Café-level intelligence 🐙</li></ul>
    <div hidden><div>Hidden nested text</div><p>More hidden text</p></div>
    <p>Visible after the hidden block. <span aria-hidden="true">decorative icon text</span></p>
    <aside>Related fact inside the article: octopuses are invertebrates.</aside>
    <footer>Written by the Ocean Site science team.</footer>
  </article></main>
  <aside>Advertisement sidebar</aside>
  <footer>Footer links | Privacy | Contact</footer>
</body></html>`;

test("a saved web page keeps the article and leaves out doctype, metadata, scripts, hidden text and site chrome", async () => {
  const text = await extract("saved page.html", Buffer.from(SAVED_PAGE));
  assert_in_order(text, [
    "# Octopus facts",
    "An octopus has three hearts and blue blood.\nIt can taste with its arms.",
    "• Eight arms",
    "• Café-level intelligence 🐙",
    "Visible after the hidden block.",
    "Related fact inside the article: octopuses are invertebrates.",
    "Written by the Ocean Site science team.",
  ]);
  assert_absent(text, [
    "DOCTYPE",
    "doctype",
    "Octopus Facts | Ocean Site",
    "color: red",
    "window.track",
    "Home",
    "About",
    "Topics",
    "Hidden nested text",
    "More hidden text",
    "decorative icon text",
    "Advertisement sidebar",
    "Footer links",
  ]);
});

async function epub(files, spine) {
  const archive = new JSZip();
  archive.file("mimetype", "application/epub+zip");
  archive.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`,
  );
  const manifest = Object.keys(files)
    .map((name) => `<item id="${name}" href="${name}.xhtml" media-type="application/xhtml+xml"${name === "nav" ? ' properties="nav"' : ""}/>`)
    .join("");
  archive.file(
    "OEBPS/content.opf",
    `<?xml version="1.0"?><package><metadata><dc:title>Lighthouse Stories</dc:title></metadata><manifest>${manifest}</manifest><spine>${spine.map((id) => `<itemref idref="${id}"/>`).join("")}</spine></package>`,
  );
  for (const [name, body] of Object.entries(files)) archive.file(`OEBPS/${name}.xhtml`, body);
  return archive.generateAsync({ type: "nodebuffer" });
}
const chapter = (title, body) =>
  `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${title}</title><link rel="stylesheet" href="style.css"/><style>p{margin:0}</style></head><body>${body}</body></html>`;

test("an EPUB keeps chapters in spine order without the hidden title, table of contents, or markup", async () => {
  const book = await epub(
    {
      // Listed first in the manifest, read second: the spine decides the order.
      c2: chapter("Chapter Two", "<h1>Chapter Two</h1><p>One stormy night a ship followed the light into harbor.</p>"),
      nav: chapter("Contents", '<nav epub:type="toc"><ol><li><a href="c1.xhtml">Chapter One</a></li><li><a href="c2.xhtml">Chapter Two</a></li></ol></nav>'),
      c1: chapter(
        "Chapter One",
        `<h1>Chapter One</h1><p>The keeper lit the lamp at dusk.<br/>Every night, without fail.</p>
         <p>She said, <q>The light is a promise.</q> — «Toujours».</p>
         <span hidden="hidden">Hidden page marker</span>
         <aside epub:type="footnote"><p>1. The lamp burned whale oil.</p></aside>
         <footer><p>End of chapter one.</p></footer>
         <nav epub:type="landmarks"><a href="c1.xhtml">Start</a></nav>`,
      ),
    },
    ["nav", "c1", "c2"],
  );
  const text = await extract("lighthouse.epub", book);
  assert_in_order(text, [
    "# Chapter One",
    "The keeper lit the lamp at dusk.\nEvery night, without fail.",
    "She said, The light is a promise. — «Toujours».",
    // Book footers and asides are notes and endings, not website chrome.
    "1. The lamp burned whale oil.",
    "End of chapter one.",
    "# Chapter Two",
    "One stormy night a ship followed the light into harbor.",
  ]);
  assert_absent(text, ["Chapter One# Chapter One", "Contents", "DOCTYPE", "xml version", "p{margin", "Hidden page marker", "Start"]);
  assert.equal(text.split("Chapter One").length - 1, 1, text);
});

test("an EPUB chapter that is only a table of contents adds nothing, and the remaining chapters still read", async () => {
  const book = await epub(
    {
      nav: chapter("Contents", '<nav epub:type="toc" role="doc-toc"><ol><li><a href="c1.xhtml">Only chapter</a></li></ol></nav>'),
      c1: chapter("Only chapter", "<h2>Only chapter</h2><p>A short and complete story.</p>"),
    },
    ["nav", "c1"],
  );
  assert.equal(await extract("short.epub", book), "## Only chapter\n\nA short and complete story.");
});

test("an EPUB navigation element without table-of-contents meaning is kept as book content", async () => {
  const book = await epub(
    { c1: chapter("Directions", "<p>Before the walk:</p><nav><p>Turn left at the harbor wall.</p></nav>") },
    ["c1"],
  );
  assert_in_order(await extract("walk.epub", book), ["Before the walk:", "Turn left at the harbor wall."]);
});

test("a hidden image, field or line break never stops the rest of a saved page from being read", async () => {
  const page = `<!doctype html><html><body><main>
    <h1>Field notes</h1>
    <p>Intro <img src="ornament.png" alt="" aria-hidden="true"> continues here.</p>
    <p>Before the form.</p><input hidden name="token"><p>After the form.</p>
    <p>Line one<br aria-hidden="true">Line two</p>
    <p hidden>Secret draft paragraph<p>First visible after the hidden one.
    <ul><li hidden>Hidden item<li>Shown item</ul>
    <div class="text-lg hidden md:block">Shown on larger screens.</div>
    <p>The final paragraph must be read.</p>
  </main></body></html>`;
  const text = await extract("notes.html", Buffer.from(page));
  assert_in_order(text, [
    "# Field notes",
    "Intro",
    "continues here.",
    "Before the form.",
    "After the form.",
    "Line one\nLine two",
    "First visible after the hidden one.",
    "Shown item",
    "Shown on larger screens.",
    "The final paragraph must be read.",
  ]);
  assert_absent(text, ["Secret draft paragraph", "Hidden item"]);
});

test("a decorative image in an EPUB chapter does not cut the chapter short", async () => {
  const book = await epub(
    {
      c1: chapter(
        "One",
        '<h1>Chapter One</h1><p>First paragraph. <img src="orn.png" alt="" aria-hidden="true"/> More words.</p><img src="rule.png" role="presentation" hidden><p>The rest of the chapter that must be read.</p>',
      ),
    },
    ["c1"],
  );
  const text = await extract("book.epub", book);
  assert_in_order(text, ["# Chapter One", "First paragraph.", "More words.", "The rest of the chapter that must be read."]);
});

test("hidden nested list descendants stay excluded while following siblings survive", async () => {
  const page = '<main><ul><li hidden>Hidden parent<ul><li>Hidden nested item<ol><li>Hidden deep item</li></ol></li></ul></li><li>Visible item</li></ul>' +
    '<dl><dd hidden>Hidden definition<dl><dt>Hidden term</dt><dd>Hidden detail</dd></dl></dd><dt>Visible term</dt><dd>Visible definition</dd></dl><p>Ending.</p></main>';
  const book = await epub({ c1: chapter("Nested lists", page) }, ["c1"]);
  for (const text of [await extract("nested.html", Buffer.from(page)), await extract("nested.epub", book)]) {
    assert_absent(text, ["Hidden"]);
    assert_in_order(text, ["Visible item", "Visible term", "Visible definition", "Ending."]);
  }
});

test("unclosed hidden content stays excluded through the end of the file", async () => {
  for (const tag of ["div", "p", "li", "dd"]) {
    const text = await extract("unfinished.html", Buffer.from(`<p>Visible.</p><${tag} hidden>Hidden content`));
    assert.equal(text, "Visible.");
  }
});

test("an unclosed hidden element ends where its parent closes, so the rest of the page is still read", async () => {
  const page = `<main><p>Intro <span aria-hidden="true">★ decorative<b>star</p><p>Second paragraph must stay.</p>
    <div><i hidden>hidden note</div><p>Third paragraph must stay.</p></main><footer>Site footer</footer>`;
  const book = await epub({ c1: chapter("Unclosed", page) }, ["c1"]);
  for (const text of [await extract("unclosed.html", Buffer.from(page)), await extract("unclosed.epub", book)]) {
    assert_in_order(text, ["Intro", "Second paragraph must stay.", "Third paragraph must stay."]);
    assert_absent(text, ["decorative", "star", "hidden note"]);
  }
});
