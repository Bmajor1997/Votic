import AsyncStorage from "@react-native-async-storage/async-storage";
import { expect, it } from "@jest/globals";
import { account_storage_key } from "../../src/storage/accountStorage";
import {
  account_deletion_pending,
  erase_local_account,
  finish_local_deletion,
  mark_account_deletion,
  reset_account_deletion_state,
  resume_local_deletions,
  write_account_data,
} from "../../src/storage/accountDeletion";
import { create_document_store } from "../../src/documents/documentStorage";
import { load_pronunciations, save_pronunciations } from "../../src/reader/pronunciationDictionary";
import { test_document } from "../renderWithProviders";

it("erases account-owned data and owned legacy backups while preserving another account", async () => {
  await create_document_store("a").saveDocuments([test_document("private-a", "Private A")]);
  await create_document_store("b").saveDocuments([test_document("private-b", "Private B")]);
  await AsyncStorage.multiSet([
    ["votic.mobile.onboarding.v1:a", "private setup"],
    ["votic.mobile.personalization-preferences.v1:a", "private preference"],
    ["votic.mobile.walkthrough.v1:a", "private progress"],
    ["votic.mobile.legacy-library-owner.v1", JSON.stringify({ uid: "a", complete: true })],
    ["votic.mobile.document-text.v1:old", "legacy private text"],
    [account_storage_key("votic.mobile.activity.v1", "a"), "private activity"],
  ]);
  await mark_account_deletion("a");
  await erase_local_account("a");
  const keys = await AsyncStorage.getAllKeys();
  expect(
    keys.some(
      (k) =>
        k.startsWith("votic.mobile.account:a:") ||
        (!k.startsWith("votic.mobile.pending-deletion.") && k.endsWith(":a")) ||
        k === "votic.mobile.document-text.v1:old",
    ),
  ).toBe(false);
  expect((await create_document_store("b").loadDocuments())[0].title).toBe("Private B");
  await create_document_store("a").saveDocuments([test_document("late", "Late stale save")]);
  expect((await AsyncStorage.getAllKeys()).some((k) => k.startsWith("votic.mobile.account:a:"))).toBe(false);
});

it("drains an in-flight writer and retries erasure after a process restart", async () => {
  let release!: () => void;
  const key = account_storage_key("private", "a");
  const work = write_account_data("a", async () => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await AsyncStorage.setItem(key, "late native write");
  });
  await Promise.resolve();
  const mark = mark_account_deletion("a");
  release();
  await work;
  await mark;
  reset_account_deletion_state(); // New JavaScript process, same disk.
  await resume_local_deletions();
  expect(await AsyncStorage.getItem(key)).toBeNull();
  expect(await account_deletion_pending("a")).toBe(true);
  await finish_local_deletion("a");
  expect(await account_deletion_pending("a")).toBe(false);
});

it("keeps pronunciations isolated and removes them on account erasure", async () => {
  const entry = { id: "name", term: "Private name", pronunciation: "Private pronunciation" };
  await save_pronunciations("a", [entry]);
  expect(await load_pronunciations("b")).toEqual([]);
  expect(await load_pronunciations()).toEqual([]);
  expect(await load_pronunciations("a")).toEqual([entry]);
  await mark_account_deletion("a");
  await erase_local_account("a");
  expect(await load_pronunciations("a")).toEqual([]);
});

it("migrates a legacy dictionary only for its known owner", async () => {
  const entry = { id: "name", term: "Old private name", pronunciation: "Old pronunciation" };
  await AsyncStorage.setItem("@votic/pronunciation-dictionary/v1", JSON.stringify([entry]));
  expect(await load_pronunciations("b")).toEqual([]);
  await AsyncStorage.setItem(
    "votic.mobile.legacy-library-owner.v1",
    JSON.stringify({ uid: "a", complete: true }),
  );
  expect(await load_pronunciations("b")).toEqual([]);
  expect(await load_pronunciations("a")).toEqual([entry]);
  expect(await AsyncStorage.getItem("@votic/pronunciation-dictionary/v1")).toBeNull();
});
