import test from "node:test";
import assert from "node:assert/strict";
import { clean_webpage_html } from "./web_import.js";

/** Paragraphs the app will read, split the same way as the mobile passage splitter (on blank lines). */
const paragraphs = (text) => text.split(/\n[ \t]*\n/);

// Source-wrapped paragraphs, like hand-written essays: hard line breaks every ~70 columns inside one <p>.
const WRAPPED = `<html><head><title>How to Do Great Work</title></head><body><article>
<h1>How to Do Great Work</h1>
<p>If you collected lists of techniques for doing great work in a lot of
different fields, what would the intersection look like? I decided to
find out by making it.</p>
<p>Partly my goal was to create a guide that could be used by someone
working in any field. But I was also curious about the shape of the
intersection.</p>
</article></body></html>`;

// Legacy HTML: tables, <font>, and paragraphs separated by <br><br> rather than <p>.
const LEGACY = `<html><head><title>Legacy Essay</title></head><body><table><tr><td>
<font size="2" face="verdana">The first paragraph of a legacy essay wraps
across several source lines but is still a single
paragraph.<br><br>The second paragraph starts after two
line breaks, which is how this kind of page marks a new paragraph.<br><br>
Roses are red,<br>violets are blue.</font></td></tr></table></body></html>`;

test("source line wrapping inside a paragraph collapses to spaces", () => {
  const { text } = clean_webpage_html(WRAPPED);
  assert.deepEqual(paragraphs(text), [
    "How to Do Great Work",
    "If you collected lists of techniques for doing great work in a lot of different fields, what would the intersection look like? I decided to find out by making it.",
    "Partly my goal was to create a guide that could be used by someone working in any field. But I was also curious about the shape of the intersection.",
  ]);
});

test("legacy <br><br> paragraphs stay separate, and a single <br> stays a line break inside its paragraph", () => {
  const { text } = clean_webpage_html(LEGACY);
  assert.deepEqual(paragraphs(text), [
    "The first paragraph of a legacy essay wraps across several source lines but is still a single paragraph.",
    "The second paragraph starts after two line breaks, which is how this kind of page marks a new paragraph.",
    "Roses are red,\nviolets are blue.",
  ]);
});

test("headings, list items, quotations and preformatted text keep their structure", () => {
  const { text } = clean_webpage_html(`<main>
    <h2>Ingredients
      for bread</h2>
    <ul>
      <li>Flour,
        sifted</li>
      <li>Water</li>
    </ul>
    <blockquote>Bread is
      older than writing.</blockquote>
    <pre>line one
  indented line two</pre>
  </main>`);
  assert.deepEqual(paragraphs(text), [
    "Ingredients for bread",
    "• Flour, sifted",
    "• Water",
    "Bread is older than writing.",
    "line one\nindented line two",
  ]);
});

test("inline elements and wrapped links keep words apart without inventing spaces", () => {
  const { text } = clean_webpage_html(`<article><p>Read the <a href="/a">first
    chapter</a>, then <em>the</em> <strong>second</strong>. Price:
    <span>$</span><span>20</span>.</p></article>`);
  assert.equal(text, "Read the first chapter, then the second. Price: $20.");
});

test("navigation, scripts and styles stay excluded after whitespace changes", () => {
  const { text } = clean_webpage_html(`<body><nav>Home
    About</nav><style>p { color: red }</style><script>var essay = "fake";</script>
    <main><p>Only this
    sentence is the article.</p></main><footer>Footer text</footer></body>`);
  assert.equal(text, "Only this sentence is the article.");
});

test("Unicode text, punctuation and non-breaking spaces survive", () => {
  const { text } = clean_webpage_html(`<article><p>Café — “quoted” text…
    naïve&nbsp;résumé, 日本語の文章。</p><p>Ελληνικά and emoji 📚.</p></article>`);
  assert.deepEqual(paragraphs(text), ["Café — “quoted” text… naïve résumé, 日本語の文章。", "Ελληνικά and emoji 📚."]);
});

test("every word of a source-wrapped page is kept, in order", () => {
  const words = (html) => html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean);
  const { text } = clean_webpage_html(WRAPPED);
  assert.deepEqual(text.split(/\s+/), words(WRAPPED.replace(/<title>.*?<\/title>/, "")));
});

test("webpage breadcrumbs are excluded without removing article paragraphs", () => {
  const { text } = clean_webpage_html('<body><ul class="breadcrumbs"><li>Instructions and Guides</li></ul><main><h1>Example Domains</h1><p>These domains are maintained for documentation purposes and illustrative examples.</p></main></body>');
  assert.doesNotMatch(text, /Instructions and Guides/);
  assert.match(text, /maintained for documentation/);
});

// A government-style page: no <article> or <main>, a header of skip links, site name and utility links, then the
// document. The content area is marked only by id="main-content" on one page and not at all on another.
const SITE_HEADER = `<div class="header"><a href="#top">Top</a><a class="skip-link" href="#main-content">Skip to main content</a>
<div><a href="/">The U.S. National Archives Home</a></div>
<p><a href="/a">Citizen Archivists</a> · <a href="/b">Bookmark/Share</a> · <a href="/c">Contact Us</a></p>
<p>America's Founding Documents</p></div>`;
const BODY = `<h1>The Constitution of the United States: A Transcription</h1>
<p><a href="#">Print This Page</a></p>
<p>We the People of the United States, in Order to form a more perfect Union, establish Justice, insure domestic
Tranquility, provide for the common defence, promote the general Welfare, and secure the Blessings of Liberty to
ourselves and our Posterity, do ordain and establish this Constitution for the United States of America.</p>
<h2>Article. I.</h2><p>All legislative Powers herein granted shall be vested in a Congress of the United States.</p>`;

test("a page marked only by id=main-content starts at its content, not the site header", () => {
  const { text } = clean_webpage_html(`<html><body>${SITE_HEADER}<div id="main-content">${BODY}</div></body></html>`);
  const parts = paragraphs(text);
  assert.equal(parts[0], "The Constitution of the United States: A Transcription");
  assert.ok(parts[1].startsWith("We the People"));
  assert.ok(!/Skip to main content|Print This Page|Citizen Archivists/.test(text));
});

test("with no content region at all, reading starts at the page's first <h1>", () => {
  const { text } = clean_webpage_html(`<html><body>${SITE_HEADER}<div class="page"><div class="col">${BODY}</div></div></body></html>`);
  const parts = paragraphs(text);
  assert.equal(parts[0], "The Constitution of the United States: A Transcription");
  assert.ok(!/National Archives Home|America's Founding Documents|Print This Page/.test(text));
  assert.ok(parts.includes("Article. I."));
});

test("Project Gutenberg's header and license boilerplate are skipped", () => {
  const html = `<html><body><section class="pg-boilerplate pgheader" id="pg-header"><h2>The Project Gutenberg eBook of The Gift of the Magi</h2>
<p>This eBook is for the use of anyone anywhere in the United States and most other parts of the world.</p></section>
<h1>The Gift of the Magi</h1><p>One dollar and eighty-seven cents. That was all. And sixty cents of it was in pennies.</p>
<section class="pg-boilerplate pgheader" id="pg-footer"><h2>*** END OF THE PROJECT GUTENBERG EBOOK ***</h2><p>Updated editions will replace the previous one.</p></section></body></html>`;
  const { text } = clean_webpage_html(html);
  assert.deepEqual(paragraphs(text), ["The Gift of the Magi", "One dollar and eighty-seven cents. That was all. And sixty cents of it was in pennies."]);
});

test("a page with no <h1> keeps everything readable from the top", () => {
  const { text } = clean_webpage_html(`<html><body><p>First paragraph of a plain page.</p><p>Second paragraph.</p></body></html>`);
  assert.deepEqual(paragraphs(text), ["First paragraph of a plain page.", "Second paragraph."]);
});
