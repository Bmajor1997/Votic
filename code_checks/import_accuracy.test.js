import test from "node:test";
import assert from "node:assert/strict";
import { decode_document_bytes } from "../apps/mobile/src/documents/textEncoding.js";
import { reconstruct_pdf_page_text, html_file_text } from "../app_parts/document_file_tools.js";

test("strict UTF-8 and BOM UTF-16 imports preserve multilingual content", () => {
  for (const text of ["", "café — résumé", "日本語 العربية 😀\n\nSecond paragraph", "replacement � is a real character"]) {
    assert.equal(decode_document_bytes(Buffer.from(text)), text);
    assert.equal(decode_document_bytes(Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(text)])),text);
    const little=Buffer.from(text,"utf16le"), big=Buffer.from(little).swap16();
    assert.equal(decode_document_bytes(Buffer.concat([Buffer.from([0xff,0xfe]),little])),text);
    assert.equal(decode_document_bytes(Buffer.concat([Buffer.from([0xfe,0xff]),big])),text);
  }
  for (const bytes of [[0xc0,0xaf],[0xed,0xa0,0x80],[0xf4,0x90,0x80,0x80],[0xe9],[0,65],[255,254,65],[255,254,0,216],[254,255,220,0]])
    assert.throws(()=>decode_document_bytes(new Uint8Array(bytes)),/UTF-8/);
});
const item=(str,x,y,width=170,dir="ltr")=>({str,transform:[1,0,0,12,x,y],width,height:12,dir});
test("PDF columns read in order around spanning headings, including uneven and RTL columns",()=>{
  const content=[item("Heading",40,750,500),item("Left first sentence.",40,700),item("Right first sentence.",330,700),item("Left second sentence.",40,680),item("Right second sentence.",330,680),item("Right third sentence.",330,660),item("Full width ending",40,620,500)];
  const output=reconstruct_pdf_page_text(content);
  assert.ok(output.indexOf("Left second")<output.indexOf("Right first"),output);
  assert.ok(output.indexOf("Heading")<output.indexOf("Left first"));
  assert.ok(output.indexOf("Full width ending")>output.indexOf("Right third"));
  const rtl=reconstruct_pdf_page_text(content.slice(1,-1).map(i=>({...i,dir:"rtl"})));
  assert.ok(rtl.indexOf("Right second")<rtl.indexOf("Left first"),rtl);
});
test("numeric tables stay row aligned and hidden inline HTML is excluded",()=>{
  const table=reconstruct_pdf_page_text([item("Apples",40,700),item("12",330,700),item("Oranges",40,680),item("24",330,680)]);
  assert.ok(table.indexOf("12")<table.indexOf("Oranges"));
  const text=html_file_text('<main><p>Visible.</p><div style="display: none !important"><div>Hidden</div></div><span style="visibility:hidden">Invisible</span><p>Still visible.</p></main>',{chrome:true});
  assert.doesNotMatch(text,/Hidden|Invisible/);
  assert.match(text,/Visible/);assert.match(text,/Still visible/);
});
