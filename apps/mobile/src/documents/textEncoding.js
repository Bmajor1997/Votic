export const TEXT_ENCODING_ERROR =
  "This file's text encoding could not be read safely. Save or export it as UTF-8 text, then import it again.";
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
