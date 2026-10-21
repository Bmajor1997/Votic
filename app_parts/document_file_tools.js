import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import JSZip from "jszip";
import { Document as LegacyOfficeDocument } from "office-oxide";
import { posix as path_posix } from "node:path";

const MAX_ARCHIVE_ENTRIES = 5000;
const MAX_ARCHIVE_ENTRY_BYTES = 8_000_000;
const MAX_ARCHIVE_TOTAL_BYTES = 40_000_000;
const MAX_POWERPOINT_SLIDES = 1000;

const ARCHIVE_TOO_LARGE = "This document archive expands beyond Votic's processing limit.";

/** Expands one entry while counting real bytes, stopping as soon as a limit is passed. */
function measure_entry(entry, limit) {
  return new Promise((resolve, reject) => {
    let size = 0, settled = false;
    const stream = entry.internalStream("uint8array");
    stream.on("data", (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > limit) {
        settled = true;
        stream.pause();
        reject(new Error(limit < MAX_ARCHIVE_ENTRY_BYTES ? ARCHIVE_TOO_LARGE : "This document archive contains an oversized file."));
      }
    }).on("error", (error) => { if (!settled) { settled = true; reject(error); } })
      .on("end", () => { if (!settled) { settled = true; resolve(size); } });
    stream.resume();
  });
}

// Sizes in the archive's headers are claims an attacker controls, so every entry is also expanded once
// with a running count. A small file can no longer expand to gigabytes before it is rejected.
async function validate_archive(archive) {
  const entries = Object.values(archive.files).filter((entry) => !entry.dir);
  if (entries.length > MAX_ARCHIVE_ENTRIES) throw new Error("This document archive contains too many files.");
  let total = 0;
  for (const entry of entries) {
    const declared = Number(entry?._data?.uncompressedSize);
    if (Number.isSafeInteger(declared) && declared > MAX_ARCHIVE_ENTRY_BYTES) throw new Error("This document archive contains an oversized file.");
    total += await measure_entry(entry, Math.min(MAX_ARCHIVE_ENTRY_BYTES, MAX_ARCHIVE_TOTAL_BYTES - total));
  }
  return archive;
}

async function load_safe_archive(buffer) { return validate_archive(await JSZip.loadAsync(buffer)); }
async function safe_archive_text(file) {
  const size = Number(file?._data?.uncompressedSize);
  if (Number.isSafeInteger(size) && size > MAX_ARCHIVE_ENTRY_BYTES) throw new Error("This document archive contains an oversized file.");
  const text = await file.async("string");
  if (Buffer.byteLength(text, "utf8") > MAX_ARCHIVE_ENTRY_BYTES) throw new Error("This document archive contains an oversized file.");
  return text;
}

async function pdf_page_needs_ocr(page) {
  const { fnArray } = await page.getOperatorList();
  const images = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject,
    OPS.paintInlineImageXObjectGroup, OPS.paintImageMaskXObjectGroup, OPS.paintImageXObjectRepeat, OPS.paintImageMaskXObjectRepeat]);
  // Neither selectable-character count nor image area proves an image has no additional text.
  // Until per-page OCR is available, conservatively OCR even small illustrations/logos.
  return fnArray.some((op) => images.has(op));
}

export async function extract_document(name, buffer) {
  // An uploaded HTML file is usually a saved web page, so its site navigation and page furniture are left out.
  if (/\.html?$/i.test(name)) return clean_extracted_text(html_file_text(buffer.toString("utf8"), { chrome: true }));
  if (/\.rtf$/i.test(name)) return extract_rtf(buffer);
  if (/\.odt$/i.test(name)) return extract_odt(buffer);
  if (/\.epub$/i.test(name)) return extract_epub(buffer);
  if (/\.ppt$/i.test(name)) return extract_legacy_powerpoint(buffer);
  if (/\.pptx$/i.test(name)) return extract_powerpoint(buffer);
  if (/\.docx$/i.test(name)) {
    await load_safe_archive(buffer);
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
        const text = reconstruct_pdf_page_text(content.items);
        if (await pdf_page_needs_ocr(page)) {
          const error = new Error("This PDF contains scanned pages that need OCR.");
          error.code = "PDF_OCR_REQUIRED";
          throw error;
        }
        pages.push(text);
      } finally { page.cleanup(); }
    }
    const text = pages.join("\f");
    if (!text.trim()) throw new Error("This PDF has no selectable text and needs OCR.");
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
  const archive = await load_safe_archive(buffer);
  const container_file = archive.file("META-INF/container.xml");
  if (!container_file) throw new Error("This EPUB is missing its publication manifest.");
  const container = await safe_archive_text(container_file);
  const package_path = decode_powerpoint_xml(container.match(/<rootfile\b[^>]*full-path=["']([^"']+)["']/i)?.[1] || "");
  const package_file = archive.file(package_path);
  if (!package_path || !package_file) throw new Error("This EPUB is missing its publication package.");
  const package_xml = await safe_archive_text(package_file);
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
    const package_prefix = package_directory === "." ? "" : package_directory + "/";
    if (item_path.startsWith("../") || (package_prefix && !item_path.startsWith(package_prefix))) throw new Error("This EPUB contains an unsafe publication path.");
    const content_file = archive.file(item_path);
    if (!content_file) continue;
    const text = clean_extracted_text(html_file_text(await safe_archive_text(content_file), { book: true }));
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
  const archive = await load_safe_archive(buffer);
  const slides = Object.keys(archive.files)
    .map((path) => ({ path, number: Number(path.match(/^ppt\/slides\/slide(\d+)\.xml$/)?.[1]) }))
    .filter(({ number }) => Number.isInteger(number))
    .sort((left, right) => left.number - right.number);
  if (!slides.length) throw new Error("This PowerPoint presentation does not contain readable slides.");
  if (slides.length > MAX_POWERPOINT_SLIDES) throw new Error("This PowerPoint presentation contains too many slides.");

  const sections = [];
  for (const slide of slides) {
    const slide_text = powerpoint_xml_text(await safe_archive_text(archive.file(slide.path)));
    const notes_path = `ppt/notesSlides/notesSlide${slide.number}.xml`;
    const notes_file = archive.file(notes_path);
    const notes_text = notes_file ? powerpoint_xml_text(await safe_archive_text(notes_file), { notes: true }) : "";
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

// A malformed character reference (beyond Unicode) is dropped instead of failing the whole document.
function code_point(value) { return Number.isInteger(value) && value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : ""; }

function decode_powerpoint_xml(text) {
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (_match, value) => code_point(parseInt(value, 16)))
    .replace(/&#(\d+);/g, (_match, value) => code_point(Number(value)))
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
    // Fragments arrive top to bottom, so only the most recent lines can match. Searching back from the newest
    // line and stopping once lines are far above keeps text-dense pages linear instead of quadratic.
    let line;
    for (let index = lines.length - 1; index >= 0; index--) {
      const candidate = lines[index];
      if (Math.abs(candidate.y - fragment.y) <= Math.max(2, Math.min(candidate.height, fragment.height) * .45)) { line = candidate; break; }
      if (candidate.y - fragment.y > Math.max(4, candidate.height, fragment.height) * 4) break;
    }
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
  if (removeRepeatedPageArtifacts) pages = without_page_furniture(pages);
  text = pages.join("\n\n")
    .replace(/([A-Za-z])-[ \t]*\n[ \t]*([a-z])/g, "$1$2")
    .replace(/^\s*[•◦▪●]\s*/gm, "• ")
    .replace(/^\s*(\d+)[)]\s+/gm, "$1. ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
}

/**
 * PDF page furniture: running headers, footers and page numbers. Reading accuracy comes first, so a line is removed
 * only with evidence from several pages, only at the top or bottom of a page, and never because it merely looks
 * similar after its numbers are ignored ("Chapter 1" and "Chapter 2" are different lines). Anything uncertain stays.
 */
const MIN_HEADER_PAGES = 3;
const MAX_HEADER_CHARS = 80;
/** A line made only of a page number: "7", "Page 7", "7 of 20", "- 7 -". Returns the number, or null. */
function page_number_of(line) {
  const match = /^(?:page\s+)?(\d{1,4})(?:\s+of\s+\d{1,4})?$/i.exec(line) || /^[-–—]\s*(\d{1,4})\s*[-–—]$/.exec(line);
  return match ? Number(match[1]) : null;
}
/** Comparison key for running headers. Only explicit page markers ("Page 7", "7 of 20") are allowed to differ. */
function header_key(line) {
  return line.toLowerCase().replace(/\s+/g, " ").trim()
    .replace(/\bpage\s+\d+(?:\s+of\s+\d+)?\b/g, "page #").replace(/\b\d+\s+of\s+\d+\b/g, "# of #");
}
const edge_indexes = (lines) => {
  const kept = lines.map((line, index) => (line.trim() ? index : -1)).filter((index) => index >= 0);
  return kept.length ? [...new Set([kept[0], kept.at(-1)])] : [];
};
/** Edge lines that are page numbers counting with the pages (the same offset on at least two pages). */
function page_number_lines(pages) {
  const found = [], offsets = new Map();
  pages.forEach((lines, page) => {
    for (const index of edge_indexes(lines)) {
      const number = page_number_of(lines[index].trim());
      if (number === null) continue;
      found.push({ page, index, offset: number - page });
      offsets.set(number - page, (offsets.get(number - page) || 0) + 1);
    }
  });
  const [offset, count] = [...offsets].sort((a, b) => b[1] - a[1])[0] || [];
  return count >= 2 ? found.filter((item) => item.offset === offset) : [];
}
/** Edge lines repeated at the same edge on most pages: short labels, not sentences, never differing in other numbers. */
function running_header_lines(pages) {
  if (pages.length < MIN_HEADER_PAGES) return [];
  const counts = new Map(), found = [];
  pages.forEach((lines, page) => {
    const edges = edge_indexes(lines);
    edges.forEach((index, position) => {
      const line = lines[index].trim();
      if (line.length > MAX_HEADER_CHARS || /[.!?]["'’”)\]]*$/.test(line)) return;
      const key = `${position === 0 && edges.length > 1 ? "top" : edges.length === 1 ? "only" : "bottom"}:${header_key(line)}`;
      counts.set(key, (counts.get(key) || 0) + 1);
      found.push({ page, index, key });
    });
  });
  const needed = Math.max(MIN_HEADER_PAGES, Math.ceil(pages.length * 0.6));
  return found.filter((item) => counts.get(item.key) >= needed);
}
function without_lines(pages, lines) {
  const drop = new Set(lines.map(({ page, index }) => `${page}:${index}`));
  return pages.map((page_lines, page) => page_lines.filter((_line, index) => !drop.has(`${page}:${index}`)));
}
function without_page_furniture(pages) {
  let split = pages.map((page) => page.split("\n"));
  split = without_lines(split, page_number_lines(split));
  split = without_lines(split, running_header_lines(split));
  return split.map((lines) => lines.join("\n"));
}

function decode_html(text) {
  return text.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi, (_, entity) => {
    if (entity[0] === "#") return code_point(parseInt(entity.slice(entity[1]?.toLowerCase() === "x" ? 2 : 1), entity[1]?.toLowerCase() === "x" ? 16 : 10));
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[entity.toLowerCase()];
  });
}

// Elements whose contents are never part of the readable page.
const HIDDEN_HTML = new Set(["script", "style", "noscript", "template", "head", "svg", "math", "iframe", "object"]);
const HTML_BLOCKS = new Set(["p", "div", "section", "article", "main", "header", "footer", "aside", "blockquote", "pre", "table", "tr", "ul", "ol", "dl", "dt", "dd", "figure", "figcaption", "hr"]);

/** Book navigation that is a list of links, not reading: a table of contents, landmarks, or a page list. */
const BOOK_NAVIGATION = /\b(?:toc|landmarks|page-list|doc-toc|doc-pagelist)\b/i;
/**
 * Whether an element and everything inside it is left out. Hidden content never counts. A saved web page also
 * drops its site navigation, and its footer and asides when they sit outside the article. A book keeps footers and
 * asides (often notes) and drops only navigation marked as a table of contents, landmarks, or page list.
 */
function skipped_element(name, attributes, { chrome, book, inContent }) {
  if (/(?:^|\s)hidden(?:[\s=/]|$)/i.test(attributes) || /aria-hidden\s*=\s*["']?true/i.test(attributes)) return true;
  if (chrome) {
    if (name === "nav" || /role\s*=\s*["']?navigation/i.test(attributes)) return true;
    if ((name === "footer" || name === "aside") && !inContent) return true;
  }
  return book && name === "nav" && BOOK_NAVIGATION.test(attributes);
}
/** The index just after the element that opened before `from`, counting nested elements of the same name. */
function element_end(lower, name, from) {
  let depth = 1, at = from;
  const boundary = (index) => /[\s/>]/.test(lower[index + name.length + 1] || ">");
  while (depth > 0) {
    const next_open = lower.indexOf(`<${name}`, at), next_close = lower.indexOf(`</${name}`, at);
    if (next_close === -1) return -1;
    if (next_open !== -1 && next_open < next_close) {
      at = next_open + name.length + 1;
      if (boundary(next_open)) depth += 1;
      continue;
    }
    at = next_close + name.length + 2;
    if (/[\s>]/.test(lower[at] || ">")) depth -= 1;
  }
  const after = lower.indexOf(">", at);
  return after === -1 ? -1 : after + 1;
}

/**
 * Readable text from an uploaded HTML file or EPUB chapter, in one forward pass. Unlike html_to_document_text (for
 * the tidy HTML mammoth makes from Word files), broken or hostile markup stays fast, and it drops declarations
 * (`<!doctype>`), metadata such as the page title, scripts, styles and hidden content instead of reading them aloud.
 * `chrome` drops a saved web page's navigation and page furniture; `book` treats the markup as an ebook chapter.
 */
export function html_file_text(html, { chrome = false, book = false } = {}) {
  const lower = html.toLowerCase(), parts = [], lists = [];
  let i = 0, content_depth = 0;
  while (i < html.length) {
    const open = html.indexOf("<", i);
    if (open === -1) { parts.push(html_text_run(html.slice(i))); break; }
    if (open > i) parts.push(html_text_run(html.slice(i, open)));
    if (html.startsWith("<!--", open)) {
      const end = html.indexOf("-->", open + 4);
      if (end === -1) break;
      i = end + 3;
      continue;
    }
    const close = html.indexOf(">", open + 1);
    // No later ">" means no later tag can finish either; the rest is not readable markup.
    if (close === -1) break;
    i = close + 1;
    // Declarations and processing instructions (<!doctype html>, <?xml ?>, <![CDATA[) are never readable text.
    if (html[open + 1] === "!" || html[open + 1] === "?") continue;
    const tag = /^(\/?)([a-z][a-z0-9:-]*)/i.exec(html.slice(open + 1, Math.min(close, open + 64)));
    if (!tag) { parts.push(html_text_run(html.slice(open, close + 1))); continue; }
    const ending = Boolean(tag[1]), name = tag[2].toLowerCase();
    const self_closing = html[close - 1] === "/";
    if (name === "article" || name === "main") content_depth = Math.max(0, content_depth + (ending ? -1 : self_closing ? 0 : 1));
    if (!ending && !self_closing && (HIDDEN_HTML.has(name) ||
        skipped_element(name, html.slice(open + 1 + name.length, close), { chrome, book, inContent: content_depth > 0 }))) {
      const end = HIDDEN_HTML.has(name) ? hidden_end(lower, html, name, i) : element_end(lower, name, i);
      if (end === -1) break;
      i = end;
      continue;
    }
    parts.push(structure_text(name, ending, lists));
  }
  return parts.join("")
    .replace(/[ \t]+\|[ \t]*(?=\n|$)/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function html_text_run(text) { return decode_html(text.replace(/\s+/g, " ")); }
/** The line breaks and marks a tag adds: headings, breaks, numbered or bulleted list items, table cells, blocks. */
function structure_text(name, ending, lists) {
  if (/^h[1-6]$/.test(name)) return ending ? "\n\n" : name === "h1" ? "\n# " : "\n## ";
  if (name === "br") return "\n";
  if (["ol", "ul", "li"].includes(name)) return list_text(name, ending, lists);
  if (name === "td" || name === "th") return ending ? " | " : "";
  return HTML_BLOCKS.has(name) ? "\n" : "";
}
/** Lists: each <li> starts a line, numbered inside <ol> (counting per nested list) and bulleted otherwise. */
function list_text(name, ending, lists) {
  if (name !== "li") {
    if (ending) lists.pop();
    else lists.push(name === "ol" ? 0 : null);
    return "\n";
  }
  if (ending) return "";
  const depth = lists.length - 1;
  return depth >= 0 && lists[depth] !== null ? `\n${(lists[depth] += 1)}. ` : "\n• ";
}
/** Script, style and similar contents end at the first closing tag: their text is not markup, so nothing nests. */
function hidden_end(lower, html, name, from) {
  const end = lower.indexOf(`</${name}`, from);
  if (end === -1) return -1;
  const after = html.indexOf(">", end);
  return after === -1 ? -1 : after + 1;
}

/** Minimal RTF plain-text reader: handles common escapes and ignores hidden destinations. */
export function extract_rtf(buffer) {
  const source = buffer.toString("latin1");
  if (!source.startsWith("{\\rtf")) throw new Error("This is not a valid RTF document.");
  const stack = []; let skip = false, pending = false, unicodeSkip = 1, text = "";
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === "{") { stack.push({ skip, unicodeSkip }); pending = true; continue; }
    if (c === "}") { const state = stack.pop(); if (!state) throw new Error("Malformed RTF document."); skip = state.skip; unicodeSkip = state.unicodeSkip; pending = false; continue; }
    if (c !== "\\") { if (!skip && c !== "\r" && c !== "\n") text += c; continue; }
    const next = source[++i];
    if (next === "*" && pending) { skip = true; pending = false; continue; }
    if (next === "'" && /^[0-9a-f]{2}$/i.test(source.slice(i+1,i+3))) { if (!skip) text += Buffer.from([parseInt(source.slice(i+1,i+3),16)]).toString("latin1"); i += 2; continue; }
    if (next === "\\" || next === "{" || next === "}") { if (!skip) text += next; continue; }
    const m = source.slice(i).match(/^([a-zA-Z]+)(-?\d+)? ?/);
    if (!m) { if (!skip && next === "~") text += " "; continue; }
    i += m[0].length-1; const word=m[1].toLowerCase(), arg=m[2] == null ? null : Number(m[2]);
    if (["fonttbl","colortbl","stylesheet","info","pict","object","header","footer","generator"].includes(word)) skip = true;
    if (word === "uc" && arg !== null) unicodeSkip=Math.max(0,Math.min(10,arg));
    if (!skip && word === "u" && arg !== null) { text += String.fromCharCode((arg+65536)%65536); i += unicodeSkip; }
    if (!skip && ["par","line"].includes(word)) text += "\n";
    if (!skip && word === "tab") text += "\t";
    pending = false;
  }
  if (stack.length) throw new Error("Malformed RTF document.");
  return clean_extracted_text(text);
}
export async function extract_odt(buffer) {
  const archive = await load_safe_archive(buffer);
  const mimetype = archive.file("mimetype");
  if (!mimetype || (await safe_archive_text(mimetype)).trim() !== "application/vnd.oasis.opendocument.text") throw new Error("This is not a valid ODT document.");
  const content = archive.file("content.xml");
  if (!content) throw new Error("This ODT document is missing its content.");
  const xml = await safe_archive_text(content);
  const readable = xml.replace(/<text:tab\b[^>]*\/>/g,"\t").replace(/<text:line-break\b[^>]*\/>/g,"\n")
    .replace(/<\/text:(?:p|h|list-item)>/g,"\n").replace(/<[^>]*>/g," ");
  return clean_extracted_text(decode_powerpoint_xml(readable));
}
