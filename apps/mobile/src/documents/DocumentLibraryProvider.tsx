import { useAccountData } from "../storage/AccountDataProvider";
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { DocumentOrigin, SavedPassage, VoticDocument } from "./types";
import { create_document_store, load_collections, save_collections } from "./documentStorage";
import { create_throttled_saver } from "./throttledSaver";

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
  collections: string[];
  activeDocument: VoticDocument | null;
  persistenceError: string | null;
  /** False until the saved library has been read (or failed to read), so screens can show loading. */
  loaded: boolean;
  renameDocument: (id: string, title: string) => void;
  addTextDocument: (
    sourceName: string,
    text: string,
    options?: { playbackRate?: number; origin?: DocumentOrigin },
  ) => VoticDocument;
  openDocument: (id: string, sentenceIndex?: number) => void;
  addCollection: (name: string) => void;
  setDocumentCollection: (id: string, collection?: string) => void;
  removeDocument: (id: string) => void;
  addQuickNote: (passage: SavedPassage) => void;
  savePassage: (documentId: string, passage: SavedPassage) => void;
  removePassage: (documentId: string, passageId: string) => void;
  updateProgress: (id: string, progress: number, sentenceIndex?: number, wordIndex?: number) => void;
  recordActivity: (id: string, readingSeconds: number, listeningSeconds: number) => void;
  completeDocument: (id: string, sentenceIndex: number, wordIndex: number) => void;
  updatePlaybackRate: (id: string, rate: number) => void;
  updateReviewResponses: (id: string, responses: Record<string, string>) => void;
};

const C = createContext<Library | null>(null);

function title_from(sourceName: string, text: string) {
  const fileTitle = sourceName.replace(/\.(txt|md)$/i, "").trim();
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
  const [documents, setDocuments] = useState<VoticDocument[]>([]);
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
      .then(([savedDocuments, savedCollections]) => {
        if (!isCurrent()) return;
        setDocuments(savedDocuments);
        setCollections(savedCollections);
        setActiveId((current) =>
          reloading && savedDocuments.some((document) => document.id === current)
            ? current
            : savedDocuments[0]?.id || null,
        );
        const unavailable = store.unavailableDocuments();
        setPersistenceError(unavailable.length ? unavailable_message(unavailable) : null);
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
    () => documents.find((document) => document.id === activeId) || null,
    [documents, activeId],
  );

  function add_text_document(
    sourceName: string,
    text: string,
    options: { playbackRate?: number; origin?: DocumentOrigin } = {},
  ) {
    const now = Date.now();
    const document: VoticDocument = {
      id: "doc-" + now + "-" + Math.random().toString(36).slice(2, 8),
      title: title_from(sourceName, text),
      sourceName,
      ...(options.origin ? { origin: options.origin } : {}),
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
    if (!clean) return;
    setCollections((current) =>
      current.some((value) => value.toLocaleLowerCase() === clean.toLocaleLowerCase())
        ? current
        : [...current, clean],
    );
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
    setDocuments((current) => current.filter((document) => document.id !== id));
    setActiveId((current) => (current === id ? null : current));
  }

  function add_quick_note(passage: SavedPassage) {
    setDocuments((current) => {
      const existing = current.find((document) => document.notebookKind === "quick-notes");
      if (existing)
        return current.map((document) => {
          if (document.id !== existing.id) return document;
          const savedPassages = [...(document.savedPassages || []), passage];
          return {
            ...document,
            savedPassages,
            plainText: savedPassages.map((saved) => saved.note).join("\n\n"),
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
    setDocuments((current) =>
      current.map((document) =>
        document.id === documentId
          ? {
              ...document,
              savedPassages: (document.savedPassages || []).filter((saved) => saved.id !== passageId),
              ...(document.notebookKind === "quick-notes"
                ? {
                    plainText: (document.savedPassages || [])
                      .filter((saved) => saved.id !== passageId)
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

  function update_review_responses(id: string, responses: Record<string, string>) {
    setDocuments((current) =>
      current.map((document) =>
        document.id === id ? { ...document, reviewResponses: responses, updatedAt: Date.now() } : document,
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

  return (
    <C.Provider
      value={{
        documents,
        collections,
        activeDocument,
        persistenceError,
        loaded,
        renameDocument: rename_document,
        addTextDocument: add_text_document,
        openDocument: open_document,
        addCollection: add_collection,
        setDocumentCollection: set_document_collection,
        removeDocument: remove_document,
        addQuickNote: add_quick_note,
        savePassage: save_passage,
        removePassage: remove_passage,
        updateProgress: update_progress,
        recordActivity: record_activity,
        completeDocument: complete_document,
        updatePlaybackRate: update_playback_rate,
        updateReviewResponses: update_review_responses,
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
