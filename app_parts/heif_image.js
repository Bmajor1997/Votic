import decode from "heic-decode";
import { PNG } from "pngjs";

/** Decode dimensions before allocating the RGBA output; refuse sequences rather than omit pages. */
export async function convert_heif(bytes, { decoder = decode, maxPixels = 20_000_000 } = {}) {
  const images = await decoder.all({ buffer: bytes });
  try {
    if (images.length !== 1) throw new Error("Choose a single HEIC/HEIF photo, not a multi-image sequence.");
    const image = images[0];
    if (!Number.isSafeInteger(image.width) || !Number.isSafeInteger(image.height) || image.width<1 || image.height<1 || image.width*image.height>maxPixels)
      throw new Error("This photo exceeds the 20 megapixel limit. Resize it and try again.");
    const decoded = await image.decode();
    const png = PNG.sync.write({width:image.width,height:image.height,data:Buffer.from(decoded.data)});
    if (png.byteLength>12_000_000) throw new Error("The converted photo exceeds 12 MB. Resize or crop it and try again.");
    return png;
  } finally { images.dispose(); }
}
