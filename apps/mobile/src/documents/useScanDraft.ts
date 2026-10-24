import { useEffect, useRef, useState } from "react";
import { useAccountData } from "../storage/AccountDataProvider";
import { account_writable, write_account_data } from "../storage/accountDeletion";
import { clear_scan_draft, load_scan_draft, store_scan_draft } from "./scanDraftStorage";
import { persist_scan_photo } from "./scanDraftFiles";
import { new_scan_draft, scan_page_id, ScanDraft } from "./scanDraftModel";

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
  function commit(next: ScanDraft) {
    if (!uid || !account_writable(uid))
      return Promise.reject(new Error("Sign in again before saving a scan."));
    latest.current = next;
    if (mounted.current) setDraft(next);
    const work = store_scan_draft(uid, next)
      .then(() => {
        if (mounted.current) setError(null);
      })
      .catch((e) => {
        if (mounted.current)
          setError("Draft changes could not be saved. Keep Votic open and retry before leaving.");
        throw e;
      });
    pending.current = work;
    return work;
  }
  async function photo(uri: string, replaceId?: string) {
    if (!uid) throw new Error("Sign in before scanning.");
    setSaving(true);
    try {
      const id = scan_page_id();
      const savedUri = await write_account_data(uid, () => persist_scan_photo(uid, id, uri));
      if (!savedUri) throw new Error("The account changed before this page was saved.");
      const page = { id, uri: savedUri };
      const current = latest.current;
      const pages = replaceId
        ? current.pages.map((p) => (p.id === replaceId ? page : p))
        : [...current.pages, page];
      await commit({ ...current, pages });
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
