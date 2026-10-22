/**
 * Conservative PDF column detection. A page is read as columns only when there is a real gutter: a vertical strip
 * that most lines leave empty, with prose-width lines on both sides. Ordinary one-column text, where lines run
 * across the middle of the page and are merely split into pieces by bold, italic or code fonts, keeps its line
 * order. Lines that cross the gutter (titles, full-width paragraphs) divide the page into bands read top to bottom.
 */
const MAX_FRAGMENTS = 4000;

export function pdf_reading_blocks(fragments, depth = 0) {
  if (fragments.length < 4 || fragments.length > MAX_FRAGMENTS || depth > 2) return [fragments];
  const rows = pdf_rows(fragments);
  const cut = column_cut(rows);
  if (!cut) return [fragments];
  const blocks = [];
  let band = [];
  const flush = () => {
    if (band.length) blocks.push(...columns(band, cut, depth));
    band = [];
  };
  for (const row of rows) {
    if (crosses(row, cut)) {
      flush();
      blocks.push(row.fragments);
    } else band.push(...row.fragments);
  }
  flush();
  return blocks.filter((block) => block.length);
}

/** Fragments grouped into visual lines, top to bottom. */
function pdf_rows(fragments) {
  const sorted = [...fragments].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const fragment of sorted) {
    const row = rows.at(-1);
    if (row && Math.abs(row.y - fragment.y) <= Math.max(2, Math.min(row.height, fragment.height) * 0.45)) {
      row.fragments.push(fragment);
      row.height = Math.max(row.height, fragment.height);
    } else rows.push({ y: fragment.y, height: fragment.height, fragments: [fragment] });
  }
  return rows;
}

const crosses = (row, cut) => row.fragments.some((f) => f.x < cut.right && f.x + f.width > cut.left);

function columns(fragments, cut, depth) {
  const middle = (cut.left + cut.right) / 2;
  const left = fragments.filter((f) => f.x + f.width / 2 < middle);
  const right = fragments.filter((f) => f.x + f.width / 2 >= middle);
  // Numeric data is a strong table signal: keep row alignment rather than reading all labels first.
  if (right.length && right.filter((f) => /^[\d\s.,%$€£()+−-]+$/.test(f.text)).length / right.length > 0.6)
    return [[...fragments].sort((a, b) => b.y - a.y || a.x - b.x)];
  const rtl = fragments.filter((f) => f.direction === "rtl").length > fragments.length / 2;
  return (rtl ? [right, left] : [left, right]).flatMap((column) => pdf_reading_blocks(column, depth + 1));
}

/**
 * The gutter between two columns, or null. Candidate positions in the middle of the text area are tested; one is
 * accepted only when at least half the lines (and at least three) leave the strip empty, and at least two lines on
 * each side are as wide as a column of prose. The widest run of accepted positions gives the gutter.
 */
function column_cut(rows) {
  const all = rows.flatMap((row) => row.fragments);
  const min = Math.min(...all.map((f) => f.x));
  const max = Math.max(...all.map((f) => f.x + f.width));
  const width = max - min;
  if (!(width > 0)) return null;
  const half = Math.max(5, width * 0.012);
  const steps = 120;
  let best = null,
    run = null;
  for (let step = Math.round(steps * 0.25); step <= Math.round(steps * 0.75); step++) {
    const at = min + (width * step) / steps;
    const ok = gutter_at(rows, at - half, at + half, width);
    if (ok) {
      run = run ? { ...run, end: at } : { start: at, end: at };
      if (!best || run.end - run.start > best.end - best.start) best = run;
    } else run = null;
  }
  if (!best) return null;
  const center = (best.start + best.end) / 2;
  return { left: center - half, right: center + half };
}

function gutter_at(rows, left, right, width) {
  let open = 0,
    leftProse = 0,
    rightProse = 0;
  for (const row of rows) {
    if (row.fragments.some((f) => f.x < right && f.x + f.width > left)) continue;
    open += 1;
    const sides = [row.fragments.filter((f) => f.x + f.width <= left), row.fragments.filter((f) => f.x >= right)];
    const extent = (side) =>
      side.length
        ? Math.max(...side.map((f) => f.x + f.width)) - Math.min(...side.map((f) => f.x))
        : 0;
    if (extent(sides[0]) >= width * 0.2) leftProse += 1;
    if (extent(sides[1]) >= width * 0.2) rightProse += 1;
  }
  return open >= 3 && open >= rows.length / 2 && leftProse >= 2 && rightProse >= 2;
}
