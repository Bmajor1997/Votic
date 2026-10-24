export const TEXT_ENCODING_ERROR =
  "This file's text encoding could not be read safely. Save or export it as UTF-8 text, then import it again.";
export const NOT_TEXT_ERROR =
  "This file does not look like text. Check that you chose the right file, then try again.";
/** Shared by native imports and the Node parser. No platform APIs or encoding guesses. */
export function decode_document_bytes(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const fail = () => {
    throw new Error(TEXT_ENCODING_ERROR);
  };
  let start = 0;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return utf16(bytes.subarray(2), true, fail);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return utf16(bytes.subarray(2), false, fail);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) start = 3;
  const parts = [],
    chunk = [];
  for (let at = start; at < bytes.length;) {
    const first = bytes[at++];
    const decoded = utf8_point(bytes, at, first, fail);
    at = decoded.at;
    const point = decoded.point;
    chunk.push(String.fromCodePoint(point));
    if (chunk.length === 4096) {
      parts.push(chunk.join(""));
      chunk.length = 0;
    }
  }
  parts.push(chunk.join(""));
  return parts.join("");
}
function utf16(bytes, little, fail) {
  if (bytes.length % 2) fail();
  const parts = [],
    chunk = [];
  const unit = (at) => (little ? bytes[at] + bytes[at + 1] * 256 : bytes[at] * 256 + bytes[at + 1]);
  for (let at = 0; at < bytes.length; at += 2) {
    const value = unit(at);
    if (value === 0 || (value >= 0xdc00 && value <= 0xdfff)) fail();
    if (value >= 0xd800 && value <= 0xdbff) {
      if (at + 3 >= bytes.length) fail();
      const low = unit(at + 2);
      if (low < 0xdc00 || low > 0xdfff) fail();
      chunk.push(String.fromCharCode(value, low));
      at += 2;
    } else chunk.push(String.fromCharCode(value));
    if (chunk.length === 4096) {
      parts.push(chunk.join(""));
      chunk.length = 0;
    }
  }
  parts.push(chunk.join(""));
  return parts.join("");
}

function utf8_length(first) {
  if (first < 0x80) return 0;
  if (first >= 0xc2 && first <= 0xdf) return 1;
  if (first >= 0xe0 && first <= 0xef) return 2;
  if (first >= 0xf0 && first <= 0xf4) return 3;
  return -1;
}
function invalid_point(point, length) {
  const minimum = [0, 0x80, 0x800, 0x10000][length];
  return point < minimum || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff);
}
function utf8_point(bytes, at, first, fail) {
  const length = utf8_length(first);
  if (length < 0 || at + length > bytes.length || first === 0) fail();
  let point = first & (length === 0 ? 0x7f : (1 << (6 - length)) - 1);
  for (let count = 0; count < length; count++) {
    const next = bytes[at++];
    if ((next & 0xc0) !== 0x80) fail();
    point = point * 64 + (next & 0x3f);
  }
  if (invalid_point(point, length)) fail();
  return { at, point };
}

/** Windows-1252 bytes 0x80–0x9F. Others (0xA0–0xFF) match Latin-1; the five undefined bytes pass through (WHATWG). */
const CP1252 = [
  0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0x8d,
  0x17d, 0x8f, 0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a,
  0x153, 0x9d, 0x17e, 0x178,
];
function windows_1252(bytes) {
  const parts = [],
    chunk = [];
  for (const byte of bytes) {
    chunk.push(byte >= 0x80 && byte <= 0x9f ? CP1252[byte - 0x80] : byte);
    if (chunk.length === 4096) {
      parts.push(String.fromCharCode(...chunk));
      chunk.length = 0;
    }
  }
  parts.push(String.fromCharCode(...chunk));
  return parts.join("");
}
/** NUL bytes or many control characters mean a binary file, which is never read aloud as text. */
function looks_binary(bytes) {
  let controls = 0;
  for (const byte of bytes) {
    if (byte === 0) return true;
    if (byte < 0x20 && byte !== 9 && byte !== 10 && byte !== 12 && byte !== 13 && byte !== 27) controls += 1;
  }
  return controls > Math.max(8, bytes.length / 100);
}
const LATIN = new Set([
  "windows-1252",
  "cp1252",
  "iso-8859-1",
  "iso8859-1",
  "latin1",
  "l1",
  "us-ascii",
  "ascii",
  "x-cp1252",
]);
const UTF8 = new Set(["utf-8", "utf8", "unicode-1-1-utf-8"]);

/**
 * Text from a plain-text, Markdown or HTML file. UTF-8 (with or without a BOM) and BOM UTF-16 are read exactly.
 * Older Windows files (Windows-1252 / Latin-1) are read as such instead of being refused; a declared charset is
 * honoured when the platform can decode it. Binary data is refused rather than read aloud as noise.
 */
export function decode_text_file(input, declared) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const charset = String(declared || "")
    .trim()
    .toLowerCase();
  const bom =
    (bytes[0] === 0xff && bytes[1] === 0xfe) ||
    (bytes[0] === 0xfe && bytes[1] === 0xff) ||
    (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf);
  // A Unicode signature wins over stale metadata and is never second-guessed.
  if (bom) return decode_document_bytes(bytes);
  if (UTF8.has(charset)) {
    const text = declared_utf8(bytes);
    if (text !== null) return text;
  }
  if (looks_binary(bytes)) throw new Error(NOT_TEXT_ERROR);
  const declaredText = decode_declared(bytes, charset);
  if (declaredText !== null) return declaredText;
  try {
    return decode_document_bytes(bytes);
  } catch {
    return windows_1252(bytes);
  }
}
/**
 * Text declared as UTF-8. Valid UTF-8 is returned. If the bytes also contain real UTF-8 characters, the file is
 * corrupted UTF-8 and is refused. If they contain none, the label is simply wrong (common on older sites and saved
 * pages written in Windows-1252), so null lets the caller read it as that legacy text.
 */
function declared_utf8(bytes) {
  try {
    return decode_document_bytes(bytes);
  } catch (error) {
    if (has_utf8_sequence(bytes)) throw error;
    return null;
  }
}
/** Whether any well-formed multi-byte UTF-8 character appears. */
function has_utf8_sequence(bytes) {
  const invalid = () => {
    throw new Error(TEXT_ENCODING_ERROR);
  };
  for (let at = 0; at < bytes.length; at++) {
    if (utf8_length(bytes[at]) < 1) continue;
    try {
      utf8_point(bytes, at + 1, bytes[at], invalid);
      return true;
    } catch {
      // Not a complete character here; keep looking.
    }
  }
  return false;
}
/** Text in a declared single-byte or legacy charset, or null to fall back to detection. */
function decode_declared(bytes, charset) {
  if (LATIN.has(charset)) return windows_1252(bytes);
  if (!charset || UTF8.has(charset) || typeof TextDecoder !== "function") return null;
  let decoder = null;
  try {
    decoder = new TextDecoder(charset);
  } catch {
    return null; // Unknown label: fall back to detection.
  }
  return ["utf-8", "utf-16le", "utf-16be"].includes(decoder.encoding) ? null : decoder.decode(bytes);
}
/** The charset a saved web page declares in its first bytes: <meta charset> or an http-equiv Content-Type. */
export function declared_html_charset(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const head = String.fromCharCode(...bytes.subarray(0, 2048));
  const match =
    /<meta[^>]+charset\s*=\s*["']?\s*([a-z0-9._:-]+)/i.exec(head) ||
    /<\?xml[^>]+encoding\s*=\s*["']([a-z0-9._:-]+)/i.exec(head);
  return match ? match[1].toLowerCase() : null;
}
/** A charset from a Content-Type header value such as "text/html; charset=ISO-8859-1". */
export function header_charset(value) {
  const match = /charset\s*=\s*["']?([a-z0-9._:-]+)/i.exec(String(value || ""));
  return match ? match[1].toLowerCase() : null;
}
