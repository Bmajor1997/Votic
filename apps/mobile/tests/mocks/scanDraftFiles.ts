import { jest } from "@jest/globals";
export const fakeScanPhotos = new Map<string, string>();
export const scan_page_uri = jest.fn(
  async (uid: string, id: string) => `file:///documents/scans/${uid}/${id}`,
);
export const persist_scan_photo = jest.fn(async (uid: string, id: string, uri: string) => {
  fakeScanPhotos.set(`${uid}:${id}`, uri);
  return scan_page_uri(uid, id);
});
export const delete_scan_photos = jest.fn(async (uid: string) => {
  for (const key of fakeScanPhotos.keys()) if (key.startsWith(`${uid}:`)) fakeScanPhotos.delete(key);
});
export const delete_scan_photo = jest.fn(async (uid: string, id: string) => {
  fakeScanPhotos.delete(`${uid}:${id}`);
});
