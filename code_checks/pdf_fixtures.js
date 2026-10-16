import { deflateSync } from "node:zlib";

/** Small real PDFs for parser/HTTP regressions, without external tools or checked-in binary fixtures. */
export function pdf_fixture(pages, { image_size = 8 } = {}) {
  const objects = [];
  const add = (source) => { objects.push(Buffer.isBuffer(source) ? source : Buffer.from(source)); return objects.length; };
  const stream = (dict, data) => Buffer.concat([Buffer.from(`<< ${dict} /Length ${data.length} >>\nstream\n`), data, Buffer.from("\nendstream")]);
  const catalog = add(""), tree = add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const page_ids = [];
  let seed = 42;
  const pixels = Buffer.alloc(image_size * image_size * 3);
  for (let i = 0; i < pixels.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; pixels[i] = seed >>> 24; }
  const image = add(stream(`/Type /XObject /Subtype /Image /Width ${image_size} /Height ${image_size} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode`, deflateSync(pixels)));
  for (const page of pages) {
    const escaped = (page.text || "").replace(/[\\()]/g, "\\$&");
    const commands = [page.image ? "q 400 0 0 500 60 160 cm /Im0 Do Q" : "", escaped ? `BT /F1 12 Tf 60 720 Td (${escaped}) Tj ET` : ""].join("\n");
    const content = add(stream("", Buffer.from(commands)));
    page_ids.push(add(`<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> /XObject << /Im0 ${image} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objects[catalog - 1] = Buffer.from(`<< /Type /Catalog /Pages ${tree} 0 R >>`);
  objects[tree - 1] = Buffer.from(`<< /Type /Pages /Count ${pages.length} /Kids [${page_ids.map((id) => `${id} 0 R`).join(" ")}] >>`);
  const chunks = [Buffer.from("%PDF-1.7\n")], offsets = [0];
  let size = chunks[0].length;
  for (const [index, object] of objects.entries()) {
    offsets.push(size);
    const chunk = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), object, Buffer.from("\nendobj\n")]);
    chunks.push(chunk); size += chunk.length;
  }
  chunks.push(Buffer.from(`xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${offsets.length} /Root ${catalog} 0 R >>\nstartxref\n${size}\n%%EOF\n`));
  return Buffer.concat(chunks);
}
