import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

// Mobile request timeouts, import limits, and storage-failure handling are covered by
// behavioral tests in apps/mobile (npm run test:components).
const server=fs.readFileSync("votic_server.js","utf8");

test("unknown extraction failures do not expose raw parser errors",()=>{
 assert.match(server,/The file may be damaged or unsupported/);
 assert.doesNotMatch(server,/return message \|\| "Votic could not read this document/);
});
