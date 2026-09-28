import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const api=fs.readFileSync("apps/mobile/src/api/voticApi.ts","utf8");
const imports=fs.readFileSync("apps/mobile/src/documents/importDocument.ts","utf8");
const documents=fs.readFileSync("apps/mobile/app/(tabs)/documents.tsx","utf8");
const server=fs.readFileSync("votic_server.js","utf8");

test("mobile API requests are bounded and abortable",()=>{
 assert.match(api,/new AbortController\(\)/);
 assert.match(api,/setTimeout\(\(\)=>controller\.abort\(\),timeoutMs\)/);
 assert.match(api,/signal:controller\.signal/);
 assert.match(api,/took too long to respond/);
});

test("document imports enforce the byte limit even without picker size metadata",()=>{
 assert.match(imports,/export function validateLoadedBytes/);
 assert.match(imports,/byteLength>MAX_DOCUMENT_BYTES/);
 assert.match(documents,/validateLoadedBytes\(bytes\.byteLength\)/);
});

test("unknown extraction failures do not expose raw parser errors",()=>{
 assert.match(server,/The file may be damaged or unsupported/);
 assert.doesNotMatch(server,/return message \|\| "Votic could not read this document/);
});

test("library storage failures cannot masquerade as an empty successful load",()=>{
 const storage=fs.readFileSync("apps/mobile/src/documents/documentStorage.ts","utf8");
 const provider=fs.readFileSync("apps/mobile/src/documents/DocumentLibraryProvider.tsx","utf8");
 const screen=fs.readFileSync("apps/mobile/src/components/Screen.tsx","utf8");
 assert.match(storage,/Saved \\?\$?\{?label\}? data could not be read|could not be read/);
 assert.doesNotMatch(storage,/catch\s*\{\s*return\s*\[\]\s*\}/);
 assert.match(provider,/\.catch\(\(\)=>\{/);
 assert.match(provider,/setHydrated\(false\)/);
 assert.match(provider,/Your stored data has not been overwritten/);
 assert.match(screen,/accessibilityRole="alert"/);
 assert.match(screen,/persistenceError/);
});
