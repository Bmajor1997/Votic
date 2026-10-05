/* global Response */
import test from "node:test";
import assert from "node:assert/strict";
import { clean_webpage_html, import_public_webpage, validate_public_url } from "./web_import.js";

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
