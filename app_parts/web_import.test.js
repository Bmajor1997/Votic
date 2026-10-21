/* global Response, ReadableStream, queueMicrotask */
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import test from "node:test";
import assert from "node:assert/strict";
import { clean_webpage_html, fetch_public_page, import_public_webpage, validate_public_url } from "./web_import.js";

test("smart webpage cleanup removes page chrome and repeated clutter", () => {
  const result=clean_webpage_html("<html><head><title>Useful article</title><style>.x{}</style></head><body><nav>Menu</nav><main><h1>Useful article</h1><p>First meaningful paragraph with enough information to read.</p><p>Second meaningful paragraph with more article content.</p></main><footer>Footer</footer><script>alert(1)</script></body></html>");
  assert.equal(result.title,"Useful article");
  assert.match(result.text,/First meaningful paragraph/);
  assert.doesNotMatch(result.text,/Menu|Footer|alert/);
});
test("web importer rejects private-network targets", async () => {
  await assert.rejects(()=>validate_public_url("http://example.test",async()=>[{address:"127.0.0.1",family:4}]),/not public/);
});
test("web importer validates redirects before following them", async () => {
  const lookup_impl=async(host)=>host==="public.test"?[{address:"203.0.113.10",family:4}]:[{address:"10.0.0.2",family:4}];
  const fetch_impl=async()=>new Response("",{status:302,headers:{location:"http://private.test/secret"}});
  await assert.rejects(()=>import_public_webpage("https://public.test/article",{fetchImpl: fetch_impl,lookupImpl: lookup_impl}),/not public/);
});
test("web importer returns cleaned readable text", async () => {
  const lookup_impl=async()=>[{address:"203.0.113.10",family:4}];
  const html="<title>Story</title><article><h1>Story</h1><p>This is a long public article paragraph with useful information for a Votic reader.</p><p>Another paragraph makes the page long enough to be accepted by the importer.</p></article>";
  const fetch_impl=async()=>new Response(html,{status:200,headers:{"content-type":"text/html"}});
  const page=await import_public_webpage("https://public.test/story",{fetchImpl: fetch_impl,lookupImpl: lookup_impl});
  assert.equal(page.title,"Story"); assert.match(page.text,/long public article/);
});

test("web importer rejects mapped IPv4, private IPv6 and non-public IPv4 targets", async () => {
  for (const address of ["::ffff:127.0.0.1", "::ffff:a00:1", "::1", "fd00::1", "fe80::1", "0.1.2.3", "100.64.1.1"]) {
    await assert.rejects(() => validate_public_url("https://public.test", async () => [{ address, family: address.includes(":") ? 6 : 4 }]), /not public/);
  }
  await assert.rejects(() => validate_public_url("http://[::ffff:127.0.0.1]/"), /not public/);
  await assert.rejects(() => validate_public_url("http://localhost./", async () => [{ address: "203.0.113.10", family: 4 }]), /not public/);
});

test("public webpage transport pins DNS while preserving the HTTPS hostname", async () => {
  const url = new URL("https://public.test/article");
  let connection;
  const request_impl = (target, options, onResponse) => {
    assert.equal(target.hostname, "public.test");
    assert.equal(options.autoSelectFamily, false);
    options.lookup("public.test", {}, (error, address, family) => { connection = { error, address, family }; });
    const request = new EventEmitter();
    request.end = () => {
      const response = Readable.from([Buffer.from("body")]);
      response.statusCode = 200;
      response.headers = { "content-type": "text/html" };
      onResponse(response);
    };
    return request;
  };
  const response = await fetch_public_page(url, {}, [{ address: "203.0.113.10", family: 4 }], request_impl);
  assert.deepEqual(connection, { error: null, address: "203.0.113.10", family: 4 });
  assert.equal(await response.text(), "body");
});

test("web importer rejects oversized streamed bodies without a Content-Length", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(2_000_001)); },
    cancel() { cancelled = true; },
  });
  await assert.rejects(() => import_public_webpage("https://public.test", {
    lookupImpl: async () => [{ address: "203.0.113.10", family: 4 }],
    fetchImpl: async () => new Response(body, { headers: { "content-type": "text/html" } }),
  }), /too large/);
  assert.equal(cancelled, true);
});

test("web importer times out and cancels a stalled body after headers arrive", async () => {
  let cancelled = false, signal;
  const body = new ReadableStream({ cancel() { cancelled = true; } });
  await assert.rejects(() => import_public_webpage("https://public.test", {
    timeoutMs: 20,
    lookupImpl: async () => [{ address: "203.0.113.10", family: 4 }],
    fetchImpl: async (_url, options) => {
      signal = options.signal;
      return new Response(body, { headers: { "content-type": "text/html" } });
    },
  }), /too long/);
  assert.equal(signal.aborted, true);
  assert.equal(cancelled, true);
});

test("redirect response bodies are cancelled before downloading the next webpage", async () => {
  let cancelled = false, calls = 0;
  const html = "<article>" + "A readable public article. ".repeat(6) + "</article>";
  const result = await import_public_webpage("https://public.test", {
    lookupImpl: async () => [{ address: "203.0.113.10", family: 4 }],
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return new Response(new ReadableStream({ cancel() { cancelled = true; } }), {
        status: 302, headers: { location: "/article" },
      });
      assert.equal(cancelled, true);
      return new Response(html, { headers: { "content-type": "text/html" } });
    },
  });
  assert.match(result.text, /readable public article/);
  assert.equal(calls, 2);
});

test("web importer preserves compressed articles and bounds their decoded size", async () => {
  const { gzipSync } = await import("node:zlib");
  const options = (html) => ({
    lookupImpl: async () => [{ address: "203.0.113.10", family: 4 }],
    fetchImpl: async () => new Response(gzipSync(html), {
      headers: { "content-type": "text/html", "content-encoding": "gzip" },
    }),
  });
  const page = await import_public_webpage("https://public.test", options("<article>" + "A readable article. ".repeat(8) + "</article>"));
  assert.match(page.text, /readable article/);
  await assert.rejects(() => import_public_webpage("https://public.test", options("x".repeat(2_000_001))), /too large/);
});

test("webpage cleanup drops site menus, language lists, and tables of contents but keeps the article", () => {
  const languages = ["العربية", "Català", "Čeština", "Deutsch", "Eesti", "Español", "Euskara", "فارسی", "Français", "日本語"]
    .map((name) => `<li><a href="#">${name}</a></li>`).join("");
  const html = `<html><head><title>Speech synthesis - Wikipedia</title></head><body>
    <a class="mw-jump-link" href="#content">Jump to content</a>
    <div class="vector-header"><div id="p-personal"><ul><li><a>Donate</a></li><li><a>Create account</a></li><li><a>Log in</a></li></ul></div><div>Personal tools</div></div>
    <div class="vector-column-start"><div id="vector-toc"><ul><li><a>(Top)</a></li><li><a>History</a></li><li><a>Synthesizer technologies</a></li><li><a>Challenges</a></li><li><a>See also</a></li></ul></div></div>
    <main id="content">
      <h1>Speech synthesis</h1>
      <div id="p-lang-btn"><span>51 languages</span><ul>${languages}</ul></div>
      <div class="vector-page-toolbar"><ul><li><a>Article</a></li><li><a>Talk</a></li><li><a>Read</a></li><li><a>Edit</a></li><li><a>View history</a></li><li><a>Tools</a></li></ul></div>
      <div id="mw-content-text">
        <div>From Wikipedia, the free encyclopedia</div>
        <p>Speech synthesis is the artificial production of human speech. A computer system used for this purpose is called a speech synthesizer.</p>
        <h2>History</h2>
        <p>Long before the invention of electronic signal processing, some people tried to build machines to emulate human speech.</p>
        <ul><li>Some systems join recorded pieces of human speech together.</li><li>Other systems model the human vocal tract to create a fully synthetic voice.</li></ul>
      </div>
    </main>
    <footer>Privacy policy</footer>
  </body></html>`;
  const { title, text } = clean_webpage_html(html);
  assert.equal(title, "Speech synthesis - Wikipedia");
  assert.match(text, /^Speech synthesis\n\nFrom Wikipedia, the free encyclopedia\n\nSpeech synthesis is the artificial production/);
  assert.match(text, /\n\nHistory\n\nLong before the invention/);
  assert.match(text, /Some systems join recorded pieces/);
  assert.match(text, /Other systems model the human vocal tract/);
  for (const clutter of ["Jump to content", "Donate", "Create account", "Log in", "Personal tools", "Eesti", "Euskara", "51 languages", "View history", "Synthesizer technologies", "(Top)", "Privacy policy"])
    assert.ok(!text.includes(clutter), `should drop "${clutter}"`);
});

test("webpage cleanup closes gaps left by inline links before punctuation", () => {
  const { text } = clean_webpage_html("<main><p>A system is called a <a href=\"#\">speech synthesizer</a>, and a text-to-speech (<a>TTS</a>) system <b>converts</b> text.</p></main>");
  assert.equal(text, "A system is called a speech synthesizer, and a text-to-speech (TTS) system converts text.");
});

test("webpage cleanup preserves article headers, short lists, short paragraphs and repeated instructions", () => {
  const { text } = clean_webpage_html(`<article><header><h1>Safety checklist</h1><p>Read before starting</p></header>
    <ul><li>Safety goggles</li><li>Protective gloves</li><li>First aid kit</li></ul>
    <p>Stop the machine</p><p>Disconnect power</p><p>Call for help</p><p>Stop the machine</p></article>`);
  for (const expected of ["Safety checklist", "Read before starting", "• Safety goggles", "• Protective gloves", "• First aid kit", "Stop the machine", "Disconnect power", "Call for help"])
    assert.ok(text.includes(expected), `preserve ${expected}`);
  assert.equal(text.match(/Stop the machine/g).length, 2);
});

test("webpage cleanup ignores fake article markup in scripts, comments and templates", () => {
  const { text } = clean_webpage_html(`<script>const example="<article>Fake script content</article>";</script>
    <!-- <article>Fake comment content</article> -->
    <template><article>Fake template content</article></template>
    <main><h1>Actual article</h1><p>The real article must be preserved.</p></main>`);
  assert.equal(text, "Actual article\n\nThe real article must be preserved.");
});

test("webpage cleanup preserves linked punctuation and Unicode entities without damaging table cells", () => {
  const { title, text } = clean_webpage_html(`<title>Safety &#x2014; guide</title><article><p><a>Run</a>, then stop.</p>
    <table><tr><th>Item</th><th>Amount</th></tr><tr><td>Gloves</td><td>2</td></tr></table></article>`);
  assert.equal(title, "Safety — guide");
  assert.match(text, /^Run, then stop\./);
  assert.match(text, /Gloves 2/);
});

test("webpage cleanup drops unlabeled link menus but keeps checklists, steps and linked references", () => {
  const { text } = clean_webpage_html(`<body>
    <div class="site-links"><a href="/">Home</a> | <a href="/about">About</a> | <a href="/blog">Blog</a> | <a href="/contact">Contact</a></div>
    <main><h2>Safety checklist</h2>
      <ul><li>Safety goggles</li><li>Protective gloves</li><li>First aid kit</li></ul>
      <ol><li>Stop the machine</li><li>Disconnect power</li><li>Call for help</li></ol>
      <h2>Related guides</h2>
      <ul><li><a href="/a">A practical guide to workshop safety for beginners</a></li><li><a href="/b">How protective equipment prevents common injuries</a></li><li><a href="/c">What to keep in a first aid kit at work</a></li></ul>
    </main></body>`);
  for (const kept of ["Safety checklist", "• Safety goggles", "• Protective gloves", "• First aid kit", "• Stop the machine", "• Call for help", "Related guides", "A practical guide to workshop safety"])
    assert.ok(text.includes(kept), `keep "${kept}"`);
  for (const menu of ["Home", "About", "Blog", "Contact"]) assert.ok(!text.includes(menu), `drop "${menu}"`);
});

test("webpage cleanup reads the main article, not a shorter teaser before it, and normalizes non-breaking spaces", () => {
  const { text } = clean_webpage_html(`<body><article><p>Related: a short teaser.</p></article>
    <article><h1>The real story</h1><p>This&nbsp;article has the full text that people came to read, with several sentences of detail.</p></article></body>`);
  assert.match(text, /^The real story\n\nThis article has the full text/);
  assert.ok(!text.includes("teaser"));
});

test("webpage cleanup leaves out review boxes, short descriptions, navigation boxes and the references section", () => {
  const { text } = clean_webpage_html(`<html><body><main id="content"><h1>Speech synthesis</h1>
    <div id="mw-fr-revision-toggle" class="mw-fr-revision-toggle">Checked</div>
    <div class="mw-fr-revision-details">Page version status<p>This is an accepted version of this page</p></div>
    <div class="shortdescription nomobile noexcerpt noprint searchaux">Artificial production of human speech</div>
    <p>Speech synthesis is the artificial production of human speech.</p>
    <h2>History</h2><p>Early machines tried to imitate the human voice.</p>
    <div class="mw-heading mw-heading2"><h2 id="References">References</h2><span class="mw-editsection">[edit]</span></div>
    <div class="reflist"><ol class="references"><li>"AI-Generated Voice Firm". Vice. January 30, 2023.</li></ol></div>
    <h2>External links</h2><ul><li>A longer external link description that would otherwise be kept</li></ul>
    <div class="navbox"><a>Speech</a> <a>Synthesis</a> <a>Recognition</a></div>
    <div id="catlinks" class="catlinks">Categories: Speech synthesis</div>
  </main></body></html>`);
  assert.equal(
    text,
    "Speech synthesis\n\nSpeech synthesis is the artificial production of human speech.\n\nHistory\n\nEarly machines tried to imitate the human voice.",
  );
});

test("webpage cleanup keeps a page whose first heading is Notes", () => {
  const { text } = clean_webpage_html(`<main><h2>Notes</h2><p>Meeting notes for Tuesday.</p></main>`);
  assert.equal(text, "Notes\n\nMeeting notes for Tuesday.");
});

test("webpage cleanup preserves substantive Notes and Sources sections after an introduction", () => {
  const { text } = clean_webpage_html(`<main><h1>Meeting</h1><p>Introduction.</p>
    <h2>Notes</h2><p>Decisions to retain.</p><h2>Sources</h2><p>Interview findings.</p>
    <h2>Next steps</h2><p>Schedule a follow-up.</p></main>`);
  for (const content of ["Decisions to retain.", "Interview findings.", "Schedule a follow-up."])
    assert.ok(text.includes(content));
});

test("webpage cleanup stops at Notes, Sources and See also that lead into References", () => {
  const { text } = clean_webpage_html(`<main><h1>Topic</h1><p>Intro text.</p><h2>History</h2><p>Body.</p>
    <h2>See also</h2><ul><li>Related one</li><li>Related two</li></ul>
    <h2>Notes</h2><div class="reflist"><ol><li>Note a.</li></ol></div>
    <h2>Sources</h2><ul><li>Smith, J. (2001). A Book. ISBN 978-0-00-000000-0.</li></ul>
    <h2>References</h2><div class="reflist"><ol><li>Ref 1</li></ol></div></main>`);
  assert.equal(text, "Topic\n\nIntro text.\n\nHistory\n\nBody.");
});

test("web importer accepts a pasted domain without a scheme and still blocks private addresses", async () => {
  assert.equal((await validate_public_url(" public.test/article ", async () => [{ address: "203.0.113.10", family: 4 }])).href, "https://public.test/article");
  assert.equal((await validate_public_url("public.test:8080/news", async () => [{ address: "203.0.113.10", family: 4 }])).href, "https://public.test:8080/news");
  await assert.rejects(() => validate_public_url("localhost:4173/secret"), /not public/);
  await assert.rejects(() => validate_public_url("javascript:alert(1)"), /Only http and https/);
  await assert.rejects(() => validate_public_url("localhost/secret"), /not public/);
  await assert.rejects(() => validate_public_url("192.168.1.1/secret"), /not public/);
});

test("public transport retries only validated addresses when one connection fails", async () => {
  const attempted = [];
  const request_impl = (_url, options, onResponse) => {
    const request = new EventEmitter();
    options.lookup("public.test", {}, (_error, address) => attempted.push(address));
    request.end = () => {
      if (attempted.length === 1) {
        queueMicrotask(() => request.emit("error", new Error("ENETUNREACH")));
      } else {
        const response = Readable.from([Buffer.from("Recovered article")]);
        response.statusCode = 200;
        response.headers = { "content-type": "text/html" };
        onResponse(response);
      }
    };
    return request;
  };
  const response = await fetch_public_page(new URL("https://public.test"), {}, [
    { address: "2606:4700::1111", family: 6 }, { address: "203.0.113.10", family: 4 },
  ], request_impl);
  assert.deepEqual(attempted, ["203.0.113.10", "2606:4700::1111"]);
  assert.equal(await response.text(), "Recovered article");
});

test("webpage cleanup skips Wikipedia fact boxes, side notes, sidebars and footnote markers", () => {
  const { text } = clean_webpage_html(`<main><h1>Braille</h1>
    <div role="note" class="hatnote">This article is about the writing system.</div>
    <div class="hatnote navigation-not-searchable">For other uses, see Braille (disambiguation).</div>
    <table class="infobox vcard"><tr><th>Script type</th><td>Alphabet</td></tr><tr><th>Languages</th><td>133 languages</td></tr></table>
    <table class="sidebar"><tr><td>Writing systems</td></tr></table>
    <p>Braille is a tactile writing system.<sup class="reference"><a href="#cite-1">[1]</a></sup> It was created in 1824.</p>
    <table class="wikitable"><tr><th>Letter</th><td>Dots</td></tr></table></main>`);
  assert.equal(text, "Braille\n\nBraille is a tactile writing system. It was created in 1824.\n\nLetter Dots");
});

test("deep and wide webpages are rejected before recursive cleanup", () => {
  const deep = '<article>' + '<div>'.repeat(5000) + 'Text' + '</div>'.repeat(5000) + '</article>';
  assert.throws(() => clean_webpage_html(deep), /too complex/);
  assert.throws(() => clean_webpage_html('<article>' + '<p>x</p>'.repeat(11000) + '</article>'), /too complex/);
});

test("webpage worker deadline releases work and leaves the event loop responsive", async () => {
  const { clean_webpage_isolated } = await import('./web_import.js');
  let ticked = false;
  const tick = setTimeout(() => { ticked = true; }, 0);
  await assert.rejects(() => clean_webpage_isolated('<p>' + 'text '.repeat(100000) + '</p>', { timeoutMs: 1 }), /too long/);
  clearTimeout(tick);
  assert.equal(ticked, true);
  const page = await clean_webpage_isolated('<title>Recovered</title><article>Normal text</article>');
  assert.equal(page.title, 'Recovered');
});

test("stuck DNS cannot exceed the import deadline or start a late fetch", async () => {
  let fetched = false;
  await assert.rejects(() => import_public_webpage('https://public.test', {
    timeoutMs: 10,
    lookupImpl: () => new Promise(() => {}),
    fetchImpl: async () => { fetched = true; },
  }), /too long/);
  assert.equal(fetched, false);
});

test("empty stream chunks cannot spin past the work budget", async () => {
  await assert.rejects(() => import_public_webpage("https://public.test", {
    lookupImpl: async () => [{ address: "203.0.113.10", family: 4 }],
    fetchImpl: async () => new Response(new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(0)); } }), {headers: {"content-type": "text/html"}}),
  }), /fragmented/);
});

test("oversized readable text is rejected instead of silently truncated", () => {
  assert.throws(() => clean_webpage_html('<article>' + 'word '.repeat(80001) + '</article>'), /completely/);
});

test("web imports preserve BOM UTF-16 and explain unsupported encoding instead of replacing bytes", async () => {
  const html = "<article><p>Résumé 日本語 😀. " + "A useful sentence in this public article. ".repeat(5) + "</p></article>";
  const body = Buffer.concat([Buffer.from([255,254]), Buffer.from(html,"utf16le")]);
  const options = { lookupImpl: async () => [{address:"203.0.113.10",family:4}], fetchImpl: async () => new Response(body,{headers:{"content-type":"text/html"}}) };
  const result = await import_public_webpage("https://public.test/article", options);
  assert.match(result.text,/Résumé 日本語 😀/);
  await assert.rejects(() => import_public_webpage("https://public.test/article", { ...options, fetchImpl: async () => new Response(Buffer.from([60,112,62,233,60,47,112,62]),{headers:{"content-type":"text/html"}}) }), /text encoding.*UTF-8/);
});
