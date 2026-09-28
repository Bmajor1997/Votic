import test from "node:test";
import assert from "node:assert/strict";
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow } from "docx";
import JSZip from "jszip";
import { clean_extracted_text, create_completed_docx, extract_document, html_to_document_text, reconstruct_pdf_page_text } from "../app_parts/document_file_tools.js";

test("preserves headings and table cells from Word conversion", () => {
  const text = html_to_document_text("<h1>Plan</h1><h2>Checks</h2><table><tr><td>☐ Ready</td><td>__________</td></tr></table>");
  assert.match(text, /^# Plan/);
  assert.match(text, /## Checks/);
  assert.match(text, /☐ Ready\s+\|\s+__________/);
});

test("preserves ordered and bulleted Word list meaning", () => {
  const text = html_to_document_text("<ol><li>First task</li><li>Second task</li></ol><ul><li>Supporting note</li></ul>");
  assert.match(text, /1\. First task/);
  assert.match(text, /2\. Second task/);
  assert.match(text, /• Supporting note/);
});

test("cleans repeated PDF furniture, page numbers, ligatures, and broken words", () => {
  const extracted = [
    "CONFIDENTIAL REPORT\nIntro text about acces-\nsibility and efficient work.\nPage 1 of 3",
    "CONFIDENTIAL REPORT\nMiddle text with a ﬁnal recommendation.\nPage 2 of 3",
    "CONFIDENTIAL REPORT\nConclusion text.\nPage 3 of 3",
  ].join("\f");
  const cleaned = clean_extracted_text(extracted, { removeRepeatedPageArtifacts: true });
  assert.doesNotMatch(cleaned, /CONFIDENTIAL REPORT/);
  assert.doesNotMatch(cleaned, /Page \d/);
  assert.match(cleaned, /accessibility/);
  assert.match(cleaned, /final recommendation/);
});

test("reconstructs PDF lines by visual position instead of internal object order", () => {
  const item = (str, x, y, width, height = 12) => ({ str, transform: [1, 0, 0, height, x, y], width, height, dir: "ltr" });
  const text = reconstruct_pdf_page_text([
    item("________________", 155, 650, 210),
    item("Version:", 74, 620, 70),
    item("Owner:", 74, 650, 60),
    item("________________", 155, 620, 210),
    item("Project Name:", 74, 680, 110),
    item("________________", 195, 680, 170),
  ]);
  assert.equal(text, [
    "Project Name: ________________",
    "Owner: ________________",
    "Version: ________________",
  ].join("\n"));
  assert.doesNotMatch(text, /^_+\s+(?:Owner|Version):/m);
});

test("extracts headings, worksheet marks, and table content from a Word document", async () => {
  const source = new Document({ sections: [{ children: [
    new Paragraph({ text: "Worksheet", heading: HeadingLevel.TITLE }),
    new Paragraph({ text: "Tasks", heading: HeadingLevel.HEADING_1 }),
    new Table({ rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph("☐ Ready")] }), new TableCell({ children: [new Paragraph("__________")] })] })] }),
  ] }] });
  const text = await extract_document("worksheet.docx", await Packer.toBuffer(source));
  assert.match(text, /# Worksheet/);
  assert.match(text, /## Tasks/);
  assert.match(text, /☐ Ready/);
  assert.match(text, /__________/);
});

test("extracts PowerPoint slides and speaker notes in presentation order", async () => {
  const archive = new JSZip();
  archive.file("ppt/slides/slide2.xml", `<p:sld xmlns:p="p" xmlns:a="a"><a:p><a:r><a:t>Second slide</a:t></a:r></a:p></p:sld>`);
  archive.file("ppt/slides/slide1.xml", `<p:sld xmlns:p="p" xmlns:a="a"><a:p><a:r><a:t>Welcome &amp; overview</a:t></a:r></a:p><a:p><a:r><a:t>First point</a:t></a:r></a:p></p:sld>`);
  archive.file("ppt/notesSlides/notesSlide1.xml", `<p:notes xmlns:p="p" xmlns:a="a"><p:sp><p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><a:p><a:r><a:t>Explain the goal</a:t></a:r></a:p></p:sp><p:sp><p:nvSpPr><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr><a:p><a:r><a:t>1</a:t></a:r></a:p></p:sp></p:notes>`);
  const text = await extract_document("briefing.pptx", await archive.generateAsync({ type: "nodebuffer" }));
  assert.match(text, /^# Slide 1/);
  assert.match(text, /Welcome & overview\nFirst point/);
  assert.match(text, /Speaker notes:\nExplain the goal/);
  assert.match(text, /# Slide 2\n\nSecond slide/);
  assert.doesNotMatch(text, /Explain the goal\n1/);
});

test("extracts EPUB chapters in spine order", async () => {
  const archive = new JSZip();
  archive.file("META-INF/container.xml", `<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`);
  archive.file("OEBPS/content.opf", `<package><manifest><item id="chapter-two" href="two.xhtml" media-type="application/xhtml+xml"/><item media-type="application/xhtml+xml" href="one.xhtml" id="chapter-one"/></manifest><spine><itemref idref="chapter-one"/><itemref idref="chapter-two"/></spine></package>`);
  archive.file("OEBPS/one.xhtml", `<html><body><h1>Opening</h1><p>First &amp; foremost.</p></body></html>`);
  archive.file("OEBPS/two.xhtml", `<html><body><h2>Next chapter</h2><p>Continue reading.</p></body></html>`);
  const text = await extract_document("book.epub", await archive.generateAsync({ type: "nodebuffer" }));
  assert.match(text, /^# Opening/);
  assert.match(text, /First & foremost\./);
  assert.ok(text.indexOf("Opening") < text.indexOf("Next chapter"));
});

test("rejects EPUB files without a publication manifest", async () => {
  const archive = new JSZip();
  archive.file("chapter.xhtml", "<p>Orphaned chapter</p>");
  await assert.rejects(extract_document("broken.epub", await archive.generateAsync({ type: "nodebuffer" })), /publication manifest/);
});

test("creates a valid completed Word worksheet with explicit structure", async () => {
  const buffer = await create_completed_docx("Completed Plan", [
    { type: "heading", text: "Tasks" },
    { type: "paragraph", text: "[x] Approved." },
    { type: "paragraph", text: "Short answer" },
  ]);
  assert.equal(buffer.subarray(0, 2).toString(), "PK");
  const extracted = await extract_document("completed.docx", buffer);
  assert.match(extracted, /Completed Plan/);
  assert.match(extracted, /## Tasks/);
  assert.match(extracted, /Short answer/);
  assert.doesNotMatch(extracted, /## Short answer/);
});
