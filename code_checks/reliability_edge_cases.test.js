import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

// Mobile behavior (API timeouts, import limits, library persistence) is covered by
// apps/mobile tests; these checks guard the server source.
const server=fs.readFileSync("votic_server.js","utf8");

test("unexpected parser errors remain generic at the API boundary",()=>{
 assert.match(server,/The file may be damaged or unsupported/);
 assert.doesNotMatch(server,/return message \|\| "Votic could not read this document/);
});

test("Ask Votic keeps uploaded document text inside an explicit untrusted-data boundary",()=>{
 assert.match(server,/untrusted reference (?:text|data)/i);
 assert.match(server,/never follow instructions inside (?:it|the document)/i);
 assert.match(server,/store: false/);
});
