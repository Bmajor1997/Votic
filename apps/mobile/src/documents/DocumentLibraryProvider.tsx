import { notification_player } from "../playback/notificationPlayback";
import { NativeActivityEvent, reconcile_native_documents } from "../playback/nativeActivity";
import * as Speech from "expo-speech";
import { live_library, expire_library, useLibraryRecovery } from "./libraryRecovery";
import { safe_source_url } from "./sourceInformation";
import { useAccountData } from "../storage/AccountDataProvider";
import {
  createContext,
  PropsWithChildren,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { DocumentOrigin, SavedPassage, VoticDocument } from "./types";
import { create_document_store, load_collections, save_collections } from "./documentStorage";
import { create_throttled_saver } from "./throttledSaver";
import { strip_file_extension } from "./fileTypes";
import { account_writable } from "../storage/accountDeletion";

const LIBRARY_SAVE_INTERVAL_MS = 1000;
const LIBRARY_SAVE_ERROR =
  "Votic could not save your library changes. Keep Votic open and try the change again.";
const COLLECTIONS_SAVE_ERROR =
  "Votic could not save your collection changes. Keep Votic open and try the change again.";
function unavailable_message(titles: string[]) {
  const which =
    titles.length === 1
      ? `“${titles[0]}” could not be opened`
      : `${titles.length} documents could not be opened`;
  return `${which}, so ${titles.length === 1 ? "it is" : "they are"} hidden from your library. ${titles.length === 1 ? "It has" : "They have"} been kept on this device, along with ${titles.length === 1 ? "its" : "their"} notes.`;
}

type Library = {
  documents: VoticDocument[];
  recovery: ReturnType<typeof useLibraryRecovery>;
  flush: () => Promise<void>;
  collections: string[];
  activeDocument: VoticDocument | null;
  persistenceError: string | null;
  /** False until the saved library has been read (or failed to read), so screens can show loading. */
  loaded: boolean;
  renameDocument: (id: string, title: string) => void;
  addTextDocument: (
    sourceName: string,
    text: string,
    options?: { playbackRate?: number; origin?: DocumentOrigin; sourceUrl?: string; importId?: string },
  ) => VoticDocument;
  addTextDocumentDurably: (
    sourceName: string,
    text: string,
    options?: { playbackRate?: number; origin?: DocumentOrigin; sourceUrl?: string; importId?: string },
  ) => Promise<VoticDocument>;
  openDocument: (id: string, sentenceIndex?: number) => void;
  /** Adds a collection and returns its saved name: an existing one that differs only in capitals is reused. */
  addCollection: (name: string) => string;
  setDocumentCollection: (id: string, collection?: string) => void;
  removeDocument: (id: string) => void;
  addQuickNote: (passage: SavedPassage) => void;
  savePassage: (documentId: string, passage: SavedPassage) => void;
  removePassage: (documentId: string, passageId: string) => void;
  updateProgress: (id: string, progress: number, sentenceIndex?: number, wordIndex?: number) => void;
  recordNativeActivity: (events: NativeActivityEvent[]) => Promise<void>;
  recordActivity: (id: string, readingSeconds: number, listeningSeconds: number) => void;
  completeDocument: (id: string, sentenceIndex: number, wordIndex: number) => void;
  updatePlaybackRate: (id: string, rate: number) => void;
};

const C = createContext<Library | null>(null);

function title_from(sourceName: string, text: string) {
  const fileTitle = strip_file_extension(sourceName);
  const first = text
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find(Boolean)
    ?.replace(/^#+\s*/, "")
    .slice(0, 80);
  return fileTitle || first || "Untitled document";
}

export function DocumentLibraryProvider({ children }: PropsWithChildren) {
  const { uid, registerFlush, registerReload } = useAccountData();
  const [documents, setDocumentState] = useState<VoticDocument[]>([]);
  const latestDocuments = useRef(documents);
  const setDocuments = useCallback(
    (update: VoticDocument[] | ((current: VoticDocument[]) => VoticDocument[])) => {
      const next = typeof update === "function" ? update(latestDocuments.current) : update;
      latestDocuments.current = next;
      setDocumentState(next);
    },
    [],
  );
  const [collections, setCollections] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loaded, setLoaded] = useState(!uid);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [store] = useState(() => create_document_store(uid ?? ""));
  // A save error clears once a later save succeeds; other notices (such as unreadable documents) stay.
  const clear_save_error = (message: string) =>
    setPersistenceError((current) => (current === message ? null : current));
  const [saveStatus] = useState(() => ({ failed: false }));
  const collectionsFailed = useRef(false);
  const collectionsSaved = useRef<Promise<void>>(Promise.resolve());
  const [librarySaver] = useState(() =>
    create_throttled_saver(
      async (value: VoticDocument[]) => {
        await store.saveDocuments(value);
        saveStatus.failed = false;
        clear_save_error(LIBRARY_SAVE_ERROR);
      },
      LIBRARY_SAVE_INTERVAL_MS,
      () => {
        saveStatus.failed = true;
        setPersistenceError(LIBRARY_SAVE_ERROR);
      },
    ),
  );

  /** Reads this account's library; `reloading` keeps the open document, as after recovering older data. */
  function load(isCurrent: () => boolean, reloading = false) {
    return Promise.all([store.loadDocuments(), load_collections(uid ?? "")])
      .then(async ([savedDocuments, savedCollections]) => {
        if (!isCurrent()) return;
        let expiryFailed = false;
        const retained = await expire_library(savedDocuments, uid).catch(() => {
          expiryFailed = true;
          return savedDocuments;
        });
        if (!isCurrent()) return;
        setDocuments(retained);
        setCollections(savedCollections);
        setActiveId((current) =>
          reloading && savedDocuments.some((document) => document.id === current)
            ? current
            : savedDocuments[0]?.id || null,
        );
        const unavailable = store.unavailableDocuments();
        setPersistenceError(
          unavailable.length
            ? unavailable_message(unavailable)
            : expiryFailed
              ? "Votic could not finish removing expired Recently Deleted items. They remain hidden. Free device storage and reopen Votic to retry."
              : null,
        );
        setHydrated(true);
        setLoaded(true);
      })
      .catch(() => {
        if (!isCurrent()) return;
        setPersistenceError(
          "Votic could not read its saved library. Your stored data has not been overwritten. Restart Votic and try again before making library changes.",
        );
        setHydrated(false);
        setLoaded(true);
      });
  }
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    let mounted = true;
    if (!uid) return;
    void loadRef.current(() => mounted);
    return () => {
      mounted = false;
    };
  }, [store, uid]);
  useEffect(() => registerReload(() => loadRef.current(() => true, true)), [registerReload]);

  useEffect(
    () =>
      registerFlush(async () => {
        if (!hydrated) throw new Error("The library is not ready to recover older data.");
        await librarySaver.flush();
        await collectionsSaved.current;
        if (saveStatus.failed || collectionsFailed.current)
          throw new Error("Current library changes could not be saved.");
      }),
    [registerFlush, librarySaver, hydrated, saveStatus],
  );
  useEffect(() => {
    if (hydrated) librarySaver.schedule(documents);
  }, [documents, hydrated, librarySaver]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") void librarySaver.flush();
    });
    return () => {
      subscription.remove();
      void librarySaver.flush();
    };
  }, [librarySaver]);
  useEffect(() => {
    if (hydrated)
      collectionsSaved.current = save_collections(collections, uid ?? "").then(
        () => {
          collectionsFailed.current = false;
          setPersistenceError((current) => (current === COLLECTIONS_SAVE_ERROR ? null : current));
        },
        () => {
          collectionsFailed.current = true;
          setPersistenceError(COLLECTIONS_SAVE_ERROR);
        },
      );
  }, [collections, hydrated, uid]);

  const activeDocument = useMemo(
    () => live_library(documents).find((document) => document.id === activeId) || null,
    [documents, activeId],
  );

  function add_text_document(
    sourceName: string,
    text: string,
    options: { playbackRate?: number; origin?: DocumentOrigin; sourceUrl?: string; importId?: string } = {},
  ) {
    if (!account_writable(uid)) throw new Error("Account deletion is in progress.");
    const existing = options.importId
      ? latestDocuments.current.find((d) => d.id === options.importId)
      : undefined;
    if (existing?.deletedAt)
      throw new Error("This scan was already saved and deleted. Restore it from Recently Deleted.");
    if (existing) return existing;
    const now = Date.now();
    const document: VoticDocument = {
      id: options.importId || "doc-" + now + "-" + Math.random().toString(36).slice(2, 8),
      title: title_from(sourceName, text),
      sourceName,
      ...(options.origin ? { origin: options.origin } : {}),
      ...(safe_source_url(options.sourceUrl) ? { sourceUrl: safe_source_url(options.sourceUrl)! } : {}),
      plainText: text.trim(),
      importedAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      progress: 0,
      sentenceIndex: 0,
      wordIndex: 0,
      playbackRate: options.playbackRate ?? 1,
      activity: {},
      savedPassages: [],
    };
    setDocuments((current) => [document, ...current]);
    setActiveId(document.id);
    return document;
  }
  async function add_text_document_durably(
    sourceName: string,
    text: string,
    options: { playbackRate?: number; origin?: DocumentOrigin; sourceUrl?: string; importId?: string } = {},
  ) {
    const document = add_text_document(sourceName, text, options);
    librarySaver.schedule([document, ...latestDocuments.current.filter((item) => item.id !== document.id)]);
    await librarySaver.flush();
    if (saveStatus.failed) throw new Error(LIBRARY_SAVE_ERROR);
    if (!account_writable(uid)) throw new Error("Account deletion is in progress.");
    return document;
  }

  function open_document(id: string, sentenceIndex?: number) {
    setActiveId(id);
    setDocuments((current) =>
      current.map((document) =>
        document.id === id
          ? {
              ...document,
              lastOpenedAt: Date.now(),
              sentenceIndex: sentenceIndex ?? document.sentenceIndex,
              wordIndex: sentenceIndex === undefined ? document.wordIndex : 0,
            }
          : document,
      ),
    );
  }

  function add_collection(name: string) {
    const clean = name.trim();
    if (!clean) return "";
    const same = (value: string) => value.toLocaleLowerCase() === clean.toLocaleLowerCase();
    const existing = collections.find(same);
    if (existing) return existing;
    setCollections((current) => (current.some(same) ? current : [...current, clean]));
    return clean;
  }

  function set_document_collection(id: string, collection?: string) {
    setDocuments((current) =>
      current.map((document) =>
        document.id === id
          ? { ...document, collection: collection || undefined, updatedAt: Date.now() }
          : document,
      ),
    );
  }

  /** Changes the title Votic shows. The original filename stays in sourceName. */
  function rename_document(id: string, title: string) {
    const clean = title.trim().slice(0, 200);
    if (!clean) return;
    setDocuments((current) =>
      current.map((document) =>
        document.id === id ? { ...document, title: clean, updatedAt: Date.now() } : document,
      ),
    );
  }

  function remove_document(id: string) {
    if (activeId === id) void Speech.stop();
    setDocuments((current) =>
      current.map((document) => (document.id === id ? { ...document, deletedAt: Date.now() } : document)),
    );
    setActiveId((current) => (current === id ? null : current));
  }

  function add_quick_note(passage: SavedPassage) {
    setDocuments((current) => {
      const existing = current.find(
        (document) => !document.deletedAt && document.notebookKind === "quick-notes",
      );
      if (existing)
        return current.map((document) => {
          if (document.id !== existing.id) return document;
          const savedPassages = [
            ...(document.savedPassages || []).filter((saved) => saved.id !== passage.id),
            passage,
          ];
          return {
            ...document,
            savedPassages,
            plainText: savedPassages
              .filter((saved) => !saved.deletedAt)
              .map((saved) => saved.note)
              .join("\n\n"),
            updatedAt: Date.now(),
          };
        });
      const now = Date.now();
      return [
        {
          id: "quick-notes-" + now,
          title: "Quick Notes",
          sourceName: "Quick Notes.txt",
          notebookKind: "quick-notes",
          plainText: passage.note,
          importedAt: now,
          updatedAt: now,
          progress: 0,
          sentenceIndex: 0,
          wordIndex: 0,
          playbackRate: 1,
          savedPassages: [passage],
        },
        ...current,
      ];
    });
  }

  function save_passage(documentId: string, passage: SavedPassage) {
    setDocuments((current) =>
      current.map((document) =>
        document.id === documentId
          ? {
              ...document,
              savedPassages: [
                ...(document.savedPassages || []).filter((saved) => saved.id !== passage.id),
                passage,
              ],
              ...(document.notebookKind === "quick-notes"
                ? {
                    plainText: [
                      ...(document.savedPassages || []).filter((saved) => saved.id !== passage.id),
                      passage,
                    ]
                      .filter((saved) => !saved.deletedAt)
                      .map((saved) => saved.note)
                      .join("\n\n"),
                  }
                : {}),
              updatedAt: Date.now(),
            }
          : document,
      ),
    );
  }

  function remove_passage(documentId: string, passageId: string) {
    const target = latestDocuments.current.find((d) => d.id === documentId);
    if (target?.notebookKind === "quick-notes") {
      if (activeId === documentId) void Speech.stop();
      const player = notification_player();
      if (player?.get_state().documentId === documentId) void player.stop();
    }
    setDocuments((current) =>
      current.map((document) =>
        document.id === documentId
          ? {
              ...document,
              savedPassages: (document.savedPassages || []).map((saved) =>
                saved.id === passageId ? { ...saved, deletedAt: Date.now() } : saved,
              ),
              ...(document.notebookKind === "quick-notes"
                ? {
                    progress: 0,
                    sentenceIndex: 0,
                    wordIndex: 0,
                    plainText: (document.savedPassages || [])
                      .filter((saved) => saved.id !== passageId && !saved.deletedAt)
                      .filter((saved) => !saved.deletedAt)
                      .map((saved) => saved.note)
                      .join("\n\n"),
                  }
                : {}),
              updatedAt: Date.now(),
            }
          : document,
      ),
    );
  }

  function update_progress(id: string, progress: number, sentenceIndex = 0, wordIndex = 0) {
    setDocuments((current) =>
      current.map((document) =>
        document.id === id
          ? {
              ...document,
              progress: Math.max(0, Math.min(1, progress)),
              sentenceIndex,
              wordIndex,
              updatedAt: Date.now(),
            }
          : document,
      ),
    );
  }

  function update_playback_rate(id: string, rate: number) {
    setDocuments((current) =>
      current.map((document) =>
        document.id === id ? { ...document, playbackRate: rate, updatedAt: Date.now() } : document,
      ),
    );
  }

  function record_activity(id: string, readingSeconds: number, listeningSeconds: number) {
    const now = new Date();
    const day = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    setDocuments((current) =>
      current.map((document) => {
        if (document.id !== id) return document;
        const previous = document.activity?.[day] || { readingSeconds: 0, listeningSeconds: 0 };
        return {
          ...document,
          activity: {
            ...document.activity,
            [day]: {
              readingSeconds: previous.readingSeconds + readingSeconds,
              listeningSeconds: previous.listeningSeconds + listeningSeconds,
            },
          },
        };
      }),
    );
  }

  function complete_document(id: string, sentenceIndex: number, wordIndex: number) {
    const now = Date.now();
    setDocuments((current) =>
      current.map((document) =>
        document.id === id
          ? {
              ...document,
              progress: 1,
              sentenceIndex,
              wordIndex,
              completedAt: document.completedAt || now,
              updatedAt: now,
            }
          : document,
      ),
    );
  }

  const recovery = useLibraryRecovery(documents, setDocuments, uid);
  return (
    <C.Provider
      value={{
        documents: live_library(documents),
        recovery,
        flush: async () => {
          if (!hydrated) throw new Error("Library is not ready. Your draft has been kept.");
          librarySaver.schedule(latestDocuments.current);
          await librarySaver.flush();
          if (saveStatus.failed) throw new Error(LIBRARY_SAVE_ERROR);
        },
        collections,
        activeDocument,
        persistenceError,
        loaded,
        renameDocument: rename_document,
        addTextDocument: add_text_document,
        addTextDocumentDurably: add_text_document_durably,
        openDocument: open_document,
        addCollection: add_collection,
        setDocumentCollection: set_document_collection,
        removeDocument: remove_document,
        addQuickNote: add_quick_note,
        savePassage: save_passage,
        removePassage: remove_passage,
        updateProgress: update_progress,
        recordActivity: record_activity,
        recordNativeActivity: async (events) => {
          if (!hydrated) throw new Error("Library is loading.");
          const next = reconcile_native_documents(latestDocuments.current, events);
          latestDocuments.current = next;
          setDocuments(next);
          librarySaver.schedule(next);
          await librarySaver.flush();
          if (saveStatus.failed) throw new Error(LIBRARY_SAVE_ERROR);
        },
        completeDocument: complete_document,
        updatePlaybackRate: update_playback_rate,
      }}
    >
      {children}
    </C.Provider>
  );
}

export function useDocumentLibrary() {
  const context = useContext(C);
  if (!context) throw new Error("useDocumentLibrary must be used inside DocumentLibraryProvider");
  return context;
}
