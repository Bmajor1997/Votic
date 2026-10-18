import test from "node:test";
/* global Response */
import assert from "node:assert/strict";
import { mkdtempSync,rmSync,statSync,readFileSync } from "node:fs";
import { once } from "node:events";
import { PNG } from "pngjs";
import { convert_heif_isolated } from "../app_parts/heif_converter.js";
import { create_votic_server } from "../votic_server.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { create_usage_store } from "../app_parts/ai_usage.js";
import { snapshot_ledger,verify_ledger } from "../security/ledger-snapshot.js";
import checker from "../security/check-mobile-audit.cjs";
import { convert_heif } from "../app_parts/heif_image.js";

test("dependency exceptions expire in the npm gate on the OSV policy date",()=>{
  const report={vulnerabilities:{braces:{severity:"high",via:[{severity:"high",url:"https://github.com/advisories/GHSA-vfj7-8cjw-p6xm"}]}}};
  assert.equal(checker.blocking_mobile_findings(report,{now:new Date("2026-11-14T23:59:59Z")}).length,0);
  assert.equal(checker.blocking_mobile_findings(report,{now:new Date("2026-11-15T00:00:00Z")}).length,1);
});
test("reports paginate oldest first and respect a global storage cap",()=>{
  const store=create_usage_store({VOTIC_REPORT_MAX_ROWS:"101"});
  try{
    for(let i=0;i<101;i++)store.recordReport({user_id:"audit",reason:"other",answer:"Private fixture"});
    const first=store.reports({status:"open"});const last=first.at(-1);
    const next=store.reports({status:"open",after:{created_at:last.created_at,id:last.id}});
    assert.equal(first.length,100);assert.equal(next.length,1);assert.ok(!first.some(r=>r.id===next[0].id));
    assert.throws(()=>store.recordReport({user_id:"other",reason:"other",answer:"Extra"}),/busy/);
    assert.equal(store.operationalStatus().reports.open,101);
    store.recordClientEvent("screen-render",2);assert.deepEqual(store.operationalStatus().diagnostics.map(e=>({...e})),[{code:"screen-render",count:2}]);
  }finally{store.close();}
});
test("online SQLite snapshot preserves data, is private, and refuses overwrite",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"votic-snapshot-"));const source=join(directory,"live.sqlite"),snapshot=join(directory,"backup.sqlite");
  const store=create_usage_store({VOTIC_AI_USAGE_DB:source});
  try{
    store.recordReport({user_id:"audit",reason:"other",answer:"Private fixture"});
    await snapshot_ledger(source,snapshot);assert.equal(verify_ledger(snapshot),true);
    assert.equal(statSync(snapshot).mode&0o777,0o600);
    const restored=create_usage_store({VOTIC_AI_USAGE_DB:snapshot});assert.equal(restored.reports().length,1);restored.close();
    await assert.rejects(snapshot_ledger(source,snapshot),/new snapshot/);
  }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});
test("HEIF conversion checks dimensions and sequence length before decoding RGBA",async()=>{
  let decoded=0,disposed=0;
  const image={width:1,height:1,decode:async()=>{decoded++;return {data:new Uint8Array([0,0,0,255])};}};
  const images=Object.assign([image],{dispose:()=>disposed++});
  const decoder={all:async()=>images};
  const png=await convert_heif(Buffer.alloc(0),{decoder});assert.equal(png.subarray(1,4).toString(),"PNG");
  image.width=30_000;image.height=30_000;
  await assert.rejects(convert_heif(Buffer.alloc(0),{decoder}),/megapixel/);assert.equal(decoded,1);assert.equal(disposed,2);
  images.push(image);await assert.rejects(convert_heif(Buffer.alloc(0),{decoder}),/single HEIC/);
});
test("real HEIC bytes decode in the isolated worker and reach OCR as PNG",async()=>{
  const bytes=readFileSync(new URL("./fixtures/scan-page.heic",import.meta.url));
  const png=await convert_heif_isolated(bytes);
  const decoded=PNG.sync.read(png);assert.equal(decoded.width,128);assert.equal(decoded.height,64);
  let called=0;
  const server=create_votic_server({env:{OPENAI_API_KEY:"fixture-only"},authorize:()=>({uid:"audit"}),fetchImpl:async(_url,init)=>{
    called++;const body=JSON.parse(init.body);assert.match(JSON.stringify(body),/data:image\/png;base64/);
    return new Response(JSON.stringify({output_text:"VOTIC TEST",usage:{input_tokens:10,output_tokens:5,total_tokens:15}}),{headers:{"Content-Type":"application/json"}});
  }});
  server.listen(0,"127.0.0.1");await once(server,"listening");
  try{
    const base=`http://127.0.0.1:${server.address().port}`;
    const response=await fetch(base+"/api/scan",{method:"POST",headers:{"Content-Type":"application/octet-stream","X-Votic-Filename":"fixture.heic"},body:bytes});
    assert.equal(response.status,200);assert.equal((await response.json()).text,"VOTIC TEST");assert.equal(called,1);
    assert.equal((await fetch(base+"/healthz")).status,200);assert.equal((await fetch(base+"/readyz")).status,200);
    const event=await fetch(base+"/api/client-event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:"screen-render",count:1,consent:true,privateText:"must reject"})});
    assert.equal(event.status,400);
  }finally{server.close();await once(server,"close");}
});
