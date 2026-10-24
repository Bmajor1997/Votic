import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
/** Rotate the actual JPEG sent to OCR, not only its preview. */
export async function rotate_scan_photo(uri: string) {
  const context = ImageManipulator.manipulate(uri);
  try {
    context.rotate(90);
    const image = await context.renderAsync();
    try {
      return await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}
