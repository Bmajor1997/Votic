import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { Document, HeadingLevel, Packer, Paragraph } from "docx";
import JSZip from "jszip";
import { Document as LegacyOfficeDocument } from "office-oxide";
import { posix as path_posix } from "node:path";

export async function extract_document(name, buffer) {
  if (/\.epub$/i.test(name)) return extract_epub(buffer);
  if (/\.ppt$/i.test(name)) return extract_legacy_powerpoint(buffer);
  if (/\.pptx$/i.test(name)) return extract_powerpoint(buffer);
  if (/\.docx$/i.test(name)) {
    const result = await mammoth.convertToHtml({ buffer }, { styleMap: [
      "p[style-name='Title'] => h1:fresh",
      "p[style-name='Heading 1'] => h2:fresh",
      "p[style-name='Heading 2'] => h3:fresh",
      "p[style-name='Heading 3'] => h4:fresh",
      "p[style-name='Heading 4'] => h5:fresh",
      "p[style-name='Heading 5'] => h6:fresh",
    ] });
    const text = clean_extracted_text(html_to_document_text(result.value));
    if (!text.trim()) throw new Error("This Word document does not contain readable text.");
    return text;
  }
  const parser = new PDFParse({ data: buffer });
  try {
    const document = await parser.load();
    const pages = [];
    for (let page_number = 1; page_number <= document.numPages; page_number++) {
      const page = await document.getPage(page_number);
      try {
        const content = await page.getTextContent({ includeMarkedContent: false, disableNormalization: false });
        pages.push(reconstruct_pdf_page_text(content.items));
      } finally { page.cleanup(); }
    }
    const text = pages.join("\f");
    if (!text.trim()) throw new Error("This PDF has no selectable text. Scanned PDFs need OCR, which is not included yet.");
    return clean_extracted_text(text, { removeRepeatedPageArtifacts: true });
  } finally { await parser.destroy(); }
}

export function extract_legacy_powerpoint(buffer) {
  const document = LegacyOfficeDocument.fromBytes(new Uint8Array(buffer), "ppt");
  try {
    const text = clean_extracted_text(document.toMarkdown());
    if (!text.trim()) throw new Error("This PowerPoint presentation does not contain readable text.");
    return text;
  } finally { document.close(); }
}

export async function extract_epub(buffer) {
  const archive = await JSZip.loadAsync(buffer);
  const container_file = archive.file("META-INF/container.xml");
  if (!container_file) throw new Error("This EPUB is missing its publication manifest.");
  const container = await container_file.async("string");
  const package_path = decode_powerpoint_xml(container.match(/<rootfile\b[^>]*full-path=["']([^"']+)["']/i)?.[1] || "");
  const package_file = archive.file(package_path);
  if (!package_path || !package_file) throw new Error("This EPUB is missing its publication package.");
  const package_xml = await package_file.async("string");
  const manifest = new Map([...package_xml.matchAll(/<item\b([^>]*)\/?\s*>/gi)].map(([, source]) => {
    const attributes = xml_attributes(source);
    return [attributes.id, attributes];
  }).filter(([id, item]) => id && item.href));
  const spine = [...package_xml.matchAll(/<itemref\b([^>]*)\/?\s*>/gi)]
    .map(([, source]) => manifest.get(xml_attributes(source).idref))
    .filter(Boolean);
  const reading_order = spine.length ? spine : [...manifest.values()].filter((item) => /(?:xhtml|html)/i.test(item["media-type"] || "") || /\.x?html?$/i.test(item.href));
  if (reading_order.length > 1000) throw new Error("This EPUB contains too many reading sections.");

  const package_directory = path_posix.dirname(package_path);
  const sections = [];
  let extracted_characters = 0;
  for (const item of reading_order) {
    const item_path = path_posix.normalize(path_posix.join(package_directory, decode_powerpoint_xml(item.href).split("#", 1)[0]));
    const content_file = archive.file(item_path);
    if (!content_file) continue;
    const text = clean_extracted_text(html_to_document_text(await content_file.async("string")));
    if (!text) continue;
    extracted_characters += text.length;
    if (extracted_characters > 10_000_000) throw new Error("This EPUB expands beyond Votic's current reading limit.");
    sections.push(text);
  }
  const text = clean_extracted_text(sections.join("\n\n"));
  if (!text.trim()) throw new Error("This EPUB does not contain readable text. It may be image-only or DRM-protected.");
  return text;
}

function xml_attributes(source) {
  return Object.fromEntries([...String(source).matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map((match) => [match[1], decode_powerpoint_xml(match[2])]));
}

export async function extract_powerpoint(buffer) {
  const archive = await JSZip.loadAsync(buffer);
  const slides = Object.keys(archive.files)
    .map((path) => ({ path, number: Number(path.match(/^ppt\/slides\/slide(\d+)\.xml$/)?.[1]) }))
    .filter(({ number }) => Number.isInteger(number))
    .sort((left, right) => left.number - right.number);
  if (!slides.length) throw new Error("This PowerPoint presentation does not contain readable slides.");

  const sections = [];
  for (const slide of slides) {
    const slide_text = powerpoint_xml_text(await archive.file(slide.path).async("string"));
    const notes_path = `ppt/notesSlides/notesSlide${slide.number}.xml`;
    const notes_file = archive.file(notes_path);
    const notes_text = notes_file ? powerpoint_xml_text(await notes_file.async("string"), { notes: true }) : "";
    const content = [slide_text, notes_text && `Speaker notes:\n${notes_text}`].filter(Boolean).join("\n\n");
    if (content) sections.push(`# Slide ${slide.number}\n\n${content}`);
  }
  const text = clean_extracted_text(sections.join("\n\n"));
  if (!text.trim()) throw new Error("This PowerPoint presentation does not contain readable text.");
  return text;
}

export function powerpoint_xml_text(xml, { notes = false } = {}) {
  let source = String(xml || "");
  if (notes) {
    const note_shapes = [...source.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/gi)]
      .map(([shape]) => shape)
      .filter((shape) => !/<p:ph\b[^>]*type="(?:sldNum|dt|hdr|ftr)"/i.test(shape));
    source = note_shapes.join("");
  }
  return [...source.matchAll(/<a:p\b[\s\S]*?<\/a:p>/gi)]
    .map(([paragraph]) => [...paragraph.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/gi)]
      .map((match) => decode_powerpoint_xml(match[1]))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim())
    .filter(Boolean)
    .join("\n");
}

function decode_powerpoint_xml(text) {
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (_match, value) => String.fromCodePoint(parseInt(value, 16)))
    .replace(/&#(\d+);/g, (_match, value) => String.fromCodePoint(Number(value)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

export function reconstruct_pdf_page_text(items) {
  const fragments = items
    .filter((item) => item && typeof item.str === "string" && item.str.trim() && Array.isArray(item.transform) && item.transform.length >= 6)
    .map((item) => ({
      text: item.str.trim(),
      x: Number(item.transform[4]) || 0,
      y: Number(item.transform[5]) || 0,
      width: Math.max(0, Number(item.width) || 0),
      height: Math.max(1, Math.abs(Number(item.height) || Number(item.transform[3]) || 1)),
      direction: item.dir === "rtl" ? "rtl" : "ltr",
    }))
    .sort((left, right) => right.y - left.y || left.x - right.x);
  if (!fragments.length) return "";

  const lines = [];
  for (const fragment of fragments) {
    const line = lines.find((candidate) => Math.abs(candidate.y - fragment.y) <= Math.max(2, Math.min(candidate.height, fragment.height) * .45));
    if (line) {
      line.fragments.push(fragment);
      const count = line.fragments.length;
      line.y = ((line.y * (count - 1)) + fragment.y) / count;
      line.height = Math.max(line.height, fragment.height);
    } else lines.push({ y: fragment.y, height: fragment.height, fragments: [fragment] });
  }

  lines.sort((left, right) => right.y - left.y);
  return lines.map((line, index) => {
    const rtl = line.fragments.filter((fragment) => fragment.direction === "rtl").length > line.fragments.length / 2;
    line.fragments.sort((left, right) => rtl ? right.x - left.x : left.x - right.x);
    const text = join_pdf_line_fragments(line.fragments, rtl);
    const next = lines[index + 1];
    const has_paragraph_gap = next && line.y - next.y > Math.max(line.height, next.height) * 3;
    return text + (has_paragraph_gap ? "\n" : "");
  }).join("\n");
}

function join_pdf_line_fragments(fragments, rtl) {
  let output = "", previous = null;
  for (const fragment of fragments) {
    if (previous) {
      const previous_edge = rtl ? previous.x : previous.x + previous.width;
      const gap = rtl ? previous_edge - (fragment.x + fragment.width) : fragment.x - previous_edge;
      const average_character_width = previous.text.length ? previous.width / previous.text.length : 0;
      if (!/\s$/.test(output) && !/^\s/.test(fragment.text) && gap > Math.max(1.5, average_character_width * .2)) output += " ";
    }
    output += fragment.text;
    previous = fragment;
  }
  return output.trim();
}

export function html_to_document_text(html) {
  const with_ordered_lists = html.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (_list, items) => {
    let number = 0;
    return items.replace(/<li[^>]*>(.*?)<\/li>/gis, (_item, content) => `${++number}. ${content}\n`);
  });
  return decode_html(with_ordered_lists
    .replace(/<h1[^>]*>(.*?)<\/h1>/gis, "# $1\n\n")
    .replace(/<h[2-6][^>]*>(.*?)<\/h[2-6]>/gis, "## $1\n\n")
    .replace(/<li[^>]*>(.*?)<\/li>/gis, "• $1\n")
    .replace(/<\/(td|th)>/gi, " | ")
    .replace(/<\/(tr|p|table)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+\|[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function clean_extracted_text(source, { removeRepeatedPageArtifacts = false } = {}) {
  let text = String(source || "").replace(/\r\n?/g, "\n").replace(/[\uFB00-\uFB06]/g, (character) => ({ "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st" })[character] || character);
  let pages = text.split(/\f|\n\s*---\s*PAGE\s+\d+\s*---\s*\n/gi);
  if (removeRepeatedPageArtifacts && pages.length >= 3) {
    const candidates = new Map();
    for (const page of pages) {
      const lines = page.split("\n").map((line) => line.trim()).filter(Boolean);
      for (const line of [lines[0], lines.at(-1)]) if (line && !is_page_number(line)) candidates.set(normalize_artifact(line), (candidates.get(normalize_artifact(line)) || 0) + 1);
    }
    const repeated = new Set([...candidates].filter(([, count]) => count >= Math.ceil(pages.length * .6)).map(([line]) => line));
    pages = pages.map((page) => page.split("\n").filter((line) => !repeated.has(normalize_artifact(line))).join("\n"));
  }
  text = pages.join("\n\n")
    .replace(/^\s*(?:page\s+)?\d+(?:\s+of\s+\d+)?\s*$/gim, "")
    .replace(/([A-Za-z])-[ \t]*\n[ \t]*([a-z])/g, "$1$2")
    .replace(/^\s*[•◦▪●]\s*/gm, "• ")
    .replace(/^\s*(\d+)[)]\s+/gm, "$1. ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
}

function normalize_artifact(line) { return line.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim(); }
function is_page_number(line) { return /^(?:page\s+)?\d+(?:\s+of\s+\d+)?$/i.test(line.trim()); }

function decode_html(text) {
  return text.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi, (_, entity) => {
    if (entity[0] === "#") return String.fromCodePoint(parseInt(entity.slice(entity[1]?.toLowerCase() === "x" ? 2 : 1), entity[1]?.toLowerCase() === "x" ? 16 : 10));
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[entity.toLowerCase()];
  });
}

export async function create_completed_docx(title, blocks) {
  const safeTitle = String(title || "Completed worksheet").slice(0, 300);
  const children = [new Paragraph({ text: safeTitle, heading: HeadingLevel.TITLE })];
  for (const block of blocks) {
    if (!block || !["heading", "paragraph"].includes(block.type) || typeof block.text !== "string") continue;
    const text = block.text.trim().slice(0, 100_000);
    if (!text) continue;
    children.push(new Paragraph(block.type === "heading" ? { text, heading: HeadingLevel.HEADING_1 } : { text }));
  }
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}
