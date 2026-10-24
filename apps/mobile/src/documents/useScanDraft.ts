import { useEffect, useRef, useState } from "react";
import { useAccountData } from "../storage/AccountDataProvider";
import { account_writable, write_account_data } from "../storage/accountDeletion";
import { clear_scan_draft, load_scan_draft, store_scan_draft } from "./scanDraftStorage";
import { delete_scan_photo, persist_scan_photo } from "./scanDraftFiles";
import { new_scan_draft, scan_page_id, ScanDraft } from "./scanDraftModel";

/** A scan change that could not be saved, as opposed to text recognition that failed. */
export class ScanSaveError extends Error {
  constructor() {
    super("Your scan changes could not be saved. Keep Votic open, free some storage, and try again.");
    this.name = "ScanSaveError";
  }
}
const TITLE_SAVE_DELAY_MS = 400;

export function useScanDraft() {
  const { uid, registerFlush } = useAccountData();
  const [draft, setDraft] = useState(new_scan_draft);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);
  const latest = useRef(draft);
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    let current = true;
    mounted.current = true;
    if (uid)
      void load_scan_draft(uid)
        .then((saved) => {
          if (!current) return;
          if (saved) {
            latest.current = saved;
            setDraft(saved);
          }
          setReady(true);
        })
        .catch((e) => {
          if (current) setError(e instanceof Error ? e.message : "Could not restore your saved scan.");
        });
    return () => {
      current = false;
      mounted.current = false;
    };
  }, [uid]);
  useEffect(
    () =>
      registerFlush(async () => {
        await pending.current;
      }),
    [registerFlush],
  );
  const titleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(titleTimer.current), []);
  function commit(next: ScanDraft) {
    clearTimeout(titleTimer.current);
    if (!uid || !account_writable(uid))
      return Promise.reject(new Error("Sign in again before saving a scan."));
    latest.current = next;
    if (mounted.current) setDraft(next);
    const owner = uid;
    // Validation runs inside the promise, so a bad draft is reported as a failed save, never thrown synchronously.
    const work = Promise.resolve()
      .then(() => store_scan_draft(owner, next))
      .then(() => {
        if (mounted.current) setError(null);
      })
      .catch(() => {
        if (mounted.current)
          setError("Draft changes could not be saved. Keep Votic open and retry before leaving.");
        throw new ScanSaveError();
      });
    pending.current = work;
    return work;
  }
  /** Shows each keystroke at once but saves the title after typing pauses; a failure shows inline, never as alerts. */
  function rename(title: string) {
    const next = { ...latest.current, title };
    latest.current = next;
    if (mounted.current) setDraft(next);
    clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => {
      void commit(latest.current).catch(() => {});
    }, TITLE_SAVE_DELAY_MS);
  }
  /** Deletes photos the saved draft no longer uses. A failed delete is cleaned up when the scan is cleared. */
  function forget_photos(ids: string[]) {
    if (!uid) return;
    const used = new Set(latest.current.pages.map((page) => page.id));
    for (const id of ids) if (!used.has(id)) void delete_scan_photo(uid, id).catch(() => {});
  }
  async function remove(id: string) {
    const next = { ...latest.current, pages: latest.current.pages.filter((p) => p.id !== id) };
    await commit(next);
    forget_photos([id]);
    return next;
  }
  async function photo(uri: string, replaceId?: string, text?: string) {
    if (!uid) throw new Error("Sign in before scanning.");
    setSaving(true);
    try {
      const id = scan_page_id();
      const savedUri = await write_account_data(uid, () => persist_scan_photo(uid, id, uri));
      if (!savedUri) throw new Error("The account changed before this page was saved.");
      // Rotating a page keeps text already recognized from it, so it is not paid for again.
      const page = text === undefined ? { id, uri: savedUri } : { id, uri: savedUri, text };
      const current = latest.current;
      const pages = replaceId
        ? current.pages.map((p) => (p.id === replaceId ? page : p))
        : [...current.pages, page];
      await commit({ ...current, pages });
      if (replaceId) forget_photos([replaceId]);
      return id;
    } finally {
      if (mounted.current) setSaving(false);
    }
  }
  return {
    draft,
    ready,
    error,
    saving,
    photo,
    commit,
    rename,
    remove,
    latest,
    flush: () => pending.current,
    async clear() {
      if (!uid) return;
      await clear_scan_draft(uid);
      const next = new_scan_draft();
      latest.current = next;
      if (mounted.current) {
        setDraft(next);
        setError(null);
        setReady(true);
      }
    },
  };
}
