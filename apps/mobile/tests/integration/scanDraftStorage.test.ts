import AsyncStorage from "@react-native-async-storage/async-storage";
import { expect, it, jest } from "@jest/globals";
import { erase_scan_draft, load_scan_draft, store_scan_draft } from "../../src/documents/scanDraftStorage";
import { new_scan_draft } from "../../src/documents/scanDraftModel";
import { erase_local_account, mark_account_deletion } from "../../src/storage/accountDeletion";
import { fakeScanPhotos } from "../mocks/scanDraftFiles";

it("checkpoints large Unicode OCR text in chunks and reconstructs only the owner's photo paths", async () => {
  const draft = {
    ...new_scan_draft(),
    pages: [
      {
        id: "page-test.jpg",
        uri: "file:///other-account/source.jpg",
        text: "a".repeat(499_999) + "😀" + "b".repeat(100_000),
      },
    ],
  };
  await store_scan_draft("a", draft);
  expect(await load_scan_draft("b")).toBeNull();
  expect(await load_scan_draft("a")).toEqual({
    ...draft,
    pages: [{ ...draft.pages[0], uri: "file:///documents/scans/a/page-test.jpg" }],
  });
});
it("preserves the last committed scan when the next manifest cannot be written", async () => {
  const before = new_scan_draft();
  await store_scan_draft("a", before);
  jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("Full disk"));
  await expect(store_scan_draft("a", { ...before, title: "Unsaved title" })).rejects.toThrow("Full disk");
  expect((await load_scan_draft("a"))?.title).toBe(before.title);
});
it("erases an account's draft and orphan photos, blocks stale writes, and leaves the other account intact", async () => {
  const draft = new_scan_draft();
  await store_scan_draft("a", draft);
  await store_scan_draft("b", draft);
  fakeScanPhotos.set("a:orphan.jpg", "private a");
  fakeScanPhotos.set("b:page.jpg", "private b");
  await mark_account_deletion("a");
  await erase_scan_draft("a");
  await erase_local_account("a");
  await store_scan_draft("a", draft);
  expect(await load_scan_draft("a")).toBeNull();
  expect(await load_scan_draft("b")).not.toBeNull();
  expect(fakeScanPhotos.has("a:orphan.jpg")).toBe(false);
  expect(fakeScanPhotos.has("b:page.jpg")).toBe(true);
});
it("does not overwrite an unreadable saved draft during loading", async () => {
  const { account_storage_key } = jest.requireActual<typeof import("../../src/storage/accountStorage")>(
    "../../src/storage/accountStorage",
  );
  const key = account_storage_key("scan-draft.v1", "a");
  await AsyncStorage.setItem(key, "not-json");
  await expect(load_scan_draft("a")).rejects.toThrow();
  expect(await AsyncStorage.getItem(key)).toBe("not-json");
});
