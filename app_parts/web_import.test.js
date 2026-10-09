/* global Response, ReadableStream */
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
  const lookupImpl=async(host)=>host==="public.test"?[{address:"203.0.113.10",family:4}]:[{address:"10.0.0.2",family:4}];
  const fetchImpl=async()=>new Response("",{status:302,headers:{location:"http://private.test/secret"}});
  await assert.rejects(()=>import_public_webpage("https://public.test/article",{fetchImpl,lookupImpl}),/not public/);
});
test("web importer returns cleaned readable text", async () => {
  const lookupImpl=async()=>[{address:"203.0.113.10",family:4}];
  const html="<title>Story</title><article><h1>Story</h1><p>This is a long public article paragraph with useful information for a Votic reader.</p><p>Another paragraph makes the page long enough to be accepted by the importer.</p></article>";
  const fetchImpl=async()=>new Response(html,{status:200,headers:{"content-type":"text/html"}});
  const page=await import_public_webpage("https://public.test/story",{fetchImpl,lookupImpl});
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
  const requestImpl = (target, options, onResponse) => {
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
  const response = await fetch_public_page(url, {}, [{ address: "203.0.113.10", family: 4 }], requestImpl);
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
