import test from "node:test";
import assert from "node:assert/strict";
import { decode_document_bytes, decode_text_file, declared_html_charset, header_charset } from "../apps/mobile/src/documents/textEncoding.js";
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
test("text files from older Windows apps are read instead of refused; binary data still is", () => {
  assert.equal(decode_text_file(Buffer.from("caf\xe9 \x93hi\x94 \x80 \x85", "latin1")), "café “hi” € …");
  assert.equal(decode_text_file(Buffer.from("café — résumé")), "café — résumé");
  assert.equal(decode_text_file(Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from("Résumé","utf16le")])), "Résumé");
  assert.equal(decode_text_file(Buffer.from("caf\xe9", "latin1"), "iso-8859-1"), "café");
  assert.equal(decode_text_file(Buffer.from([0x93,0xfa,0x96,0x7b]), "shift_jis"), "日本");
  assert.equal(decode_text_file(Buffer.from("plain"), "made-up-charset"), "plain");
  assert.equal(decode_text_file(Buffer.from("caf\xe9", "latin1"), "utf-8"), "café");
  assert.throws(() => decode_text_file(Buffer.concat([Buffer.from("café "), Buffer.from([0xe9])]), "utf-8"), /UTF-8/);
  assert.throws(() => decode_text_file(new Uint8Array([72,0,105])), /does not look like text/);
  assert.throws(() => decode_text_file(new Uint8Array(Array.from({ length: 200 }, (_, i) => i % 8))), /does not look like text/);
  assert.equal(declared_html_charset(Buffer.from('<head><meta http-equiv="Content-Type" content="text/html; charset=windows-1252">')), "windows-1252");
  assert.equal(declared_html_charset(Buffer.from("<meta charset='UTF-8'>")), "utf-8");
  assert.equal(declared_html_charset(Buffer.from("<p>none</p>")), null);
  assert.equal(header_charset("text/html; charset=\"ISO-8859-1\""), "iso-8859-1");
  assert.equal(header_charset("text/html"), null);
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
