/** Conservative geometric columns. Page-wide headings divide the page into independent reading bands. */
export function pdf_reading_blocks(fragments, depth = 0) {
  if (fragments.length < 4 || depth > 2) return [fragments];
  const cut = column_cut(fragments);
  if (cut === null) return [fragments];
  const spans = fragments.filter((f) => f.x < cut && f.x + f.width > cut).sort((a, b) => b.y - a.y);
  const spanning = new Set(spans);
  let remaining = fragments.filter((f) => !spanning.has(f));
  const blocks = [];
  for (const span of spans) {
    const before = remaining.filter((f) => f.y > span.y + Math.max(2, span.height / 2));
    blocks.push(...columns(before, cut, depth));
    blocks.push([span]);
    const read = new Set(before);
    remaining = remaining.filter((f) => !read.has(f));
  }
  blocks.push(...columns(remaining, cut, depth));
  return blocks.filter((block) => block.length);
}
function columns(fragments, cut, depth) {
  const left = fragments.filter((f) => f.x < cut);
  const right = fragments.filter((f) => f.x >= cut);
  // Numeric data is a strong table signal: keep row alignment rather than reading all labels first.
  if (right.length && right.filter((f) => /^[\d\s.,%$€£()+−-]+$/.test(f.text)).length / right.length > 0.6)
    return [fragments.sort((a, b) => b.y - a.y || a.x - b.x)];
  const ordered = fragments.filter((f) => f.direction === "rtl").length > fragments.length / 2 ? [right, left] : [left, right];
  return ordered.flatMap((column) => pdf_reading_blocks(column, depth + 1));
}
function column_cut(fragments) {
  const min = fragments.reduce((value, f) => Math.min(value, f.x), Infinity);
  const max = fragments.reduce((value, f) => Math.max(value, f.x + f.width), -Infinity);
  const width = max - min;
  const starts = [...new Set(fragments.map((f) => Math.round(f.x)))].sort((a, b) => a - b);
  if (starts.length > 128) return null; // Bound analysis of irregular drawings; retain the extracted row order.
  let best = null, score = 0;
  for (const start of starts) {
    const left = fragments.filter((f) => f.x + f.width <= start - Math.max(24, width * 0.04) && f.width >= width * 0.15);
    const right = fragments.filter((f) => f.x >= start && f.width >= width * 0.15);
    if (new Set(left.map((f) => Math.round(f.y / 4))).size < 2 || new Set(right.map((f) => Math.round(f.y / 4))).size < 2) continue;
    const edge = left.reduce((value, f) => Math.max(value, f.x + f.width), -Infinity);
    const gap = start - edge;
    const candidate = gap * Math.min(left.length, right.length);
    if (candidate > score) { score = candidate; best = (edge + start) / 2; }
  }
  return best;
}
