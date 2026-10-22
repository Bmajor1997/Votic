import { useMotionFeedback } from "../motion/MotionFeedback";
import { account_writable } from "../storage/accountDeletion";
import { load_ocr_review, store_ocr_review } from "./ocrReviewStorage";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAccountData } from "../storage/AccountDataProvider";
import { useVoticTheme } from "../theme/ThemeProvider";
import { useDocumentLibrary } from "./DocumentLibraryProvider";
import { DocumentOrigin, VoticDocument } from "./types";

type Review = { id: string; name: string; pages: string[]; playbackRate: number; origin: DocumentOrigin };
type Options = { playbackRate: number; origin: DocumentOrigin };
type Value = {
  review: (name: string, pages: string[], options: Options) => Promise<VoticDocument | null>;
  resume: () => void;
  /** Throws before any paid text recognition starts if a new review could not be opened afterwards. */
  ensureAvailable: () => void;
};
/** A saved, unfinished scan review must be finished or discarded before another image is read. */
export class UnfinishedScanError extends Error {
  constructor() {
    super(
      "You have an unfinished scan review. Resume or discard it before scanning or importing another image, so text recognition isn't used twice.",
    );
    this.name = "UnfinishedScanError";
  }
}
const Context = createContext<Value | null>(null);
export function OcrReviewProvider({ children }: PropsWithChildren) {
  const { uid, registerFlush } = useAccountData();
  const library = useDocumentLibrary();
  const { show } = useMotionFeedback();
  const { theme } = useVoticTheme();
  const [record, setRecord] = useState<Review | null>(null);
  const [visible, setVisible] = useState(false);
  const [page, setPage] = useState(0);
  const [ready, setReady] = useState(!uid);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(record);
  useEffect(() => {
    latest.current = record;
  }, [record]);
  const availability = useRef({ ready, error });
  useEffect(() => {
    availability.current = { ready, error };
  }, [ready, error]);
  // Stable, so screens can list it in effect dependencies without restarting an import.
  const ensureAvailable = useCallback(() => {
    if (!availability.current.ready)
      throw new Error(availability.current.error || "Scan review is loading. Please try again.");
    if (latest.current) throw new UnfinishedScanError();
  }, []);
  const mounted = useRef(true);
  const callback = useRef<((document: VoticDocument | null) => void) | null>(null);
  const queue = useRef(Promise.resolve());
  const persist = useCallback(() => {
    const value = latest.current;
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        if (uid) await store_ocr_review(uid, value);
      });
    return queue.current;
  }, [uid]);
  useEffect(() => {
    let current = true;
    mounted.current = true;
    if (uid)
      void load_ocr_review(uid)
        .then((saved) => {
          if (!current) return;
          if (saved) {
            const value = saved as Review;
            if (
              typeof value.id !== "string" ||
              typeof value.name !== "string" ||
              !Array.isArray(value.pages) ||
              value.pages.length > 1000 ||
              !value.pages.every((p: unknown) => typeof p === "string") ||
              !["scan", "file"].includes(value.origin) ||
              !Number.isFinite(value.playbackRate)
            )
              throw new Error("Saved scan review could not be read.");
            setRecord(value);
            latest.current = value;
          }
          setReady(true);
        })
        .catch(() => setError("Saved scan review could not be read. It has not been overwritten."));
    return () => {
      current = false;
      mounted.current = false;
      callback.current?.(null);
      callback.current = null;
    };
  }, [uid]);
  useEffect(
    () => registerFlush(() => (ready ? persist() : Promise.resolve())),
    [registerFlush, ready, persist],
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      if (ready)
        void persist().catch(() => setError("Review changes could not be saved. Keep Votic open and retry."));
    }, 300);
    return () => clearTimeout(timer);
  }, [record, ready, persist]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", () => {
      if (ready) void persist().catch(() => setError("Review could not be saved."));
    });
    return () => subscription.remove();
  }, [ready, persist]);
  async function close(discard: boolean) {
    if (discard) {
      latest.current = null;
      setRecord(null);
    }
    await persist();
    setVisible(false);
    callback.current?.(null);
    callback.current = null;
  }
  async function save() {
    if (!record || busy) return;
    if (!record.pages.join("\n\n").trim()) {
      setError("Add readable text before saving this document.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await persist();
      if (!mounted.current || !account_writable(uid)) return;
      const document = await library.addTextDocumentDurably(record.name, record.pages.join("\n\n"), {
        playbackRate: record.playbackRate,
        origin: record.origin,
        importId: record.id,
      });
      if (!mounted.current || !account_writable(uid)) return;
      latest.current = null;
      await persist();
      if (!mounted.current) return;
      setRecord(null);
      setVisible(false);
      show("import", document.title);
      const waiting = callback.current;
      callback.current = null;
      if (waiting) waiting(document);
      else {
        library.openDocument(document.id);
        router.push("/reader");
      }
    } catch {
      setError(
        "Votic could not finish saving this scan. Your review has been kept. Free device storage and retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  const requestClose = () => {
    if (!busy)
      Alert.alert(
        "Keep this scan review?",
        "Recognized text and corrections can be resumed from Settings → Help. Temporary photos are not retained as originals.",
        [
          { text: "Keep editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => void close(true).catch(() => setError("Could not discard review.")),
          },
          {
            text: "Keep review",
            onPress: () => void close(false).catch(() => setError("Could not save review.")),
          },
        ],
      );
  };
  return (
    <Context.Provider
      value={{
        ensureAvailable,
        review: async (name, pages, options) => {
          if (!ready) throw new Error(error || "Scan review is loading. Please try again.");
          if (latest.current) throw new UnfinishedScanError();
          const next = {
            id: `scan-review-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name,
            pages,
            ...options,
          };
          latest.current = next;
          setRecord(next);
          setPage(0);
          setError(null);
          try {
            await persist();
          } catch {
            throw new Error(
              "Your scan review could not be saved. Keep Votic open and resume it from Settings → Help → Unfinished scan.",
            );
          }
          if (!mounted.current || !account_writable(uid)) return null;
          setVisible(true);
          return new Promise((resolve) => {
            callback.current = resolve;
          });
        },
        resume: () => {
          if (!record) {
            Alert.alert("No unfinished scan", error || "Your scan reviews have been saved or discarded.");
            return;
          }
          setPage(0);
          setVisible(true);
        },
      }}
    >
      {children}
      <Modal visible={visible} animationType="none" onRequestClose={requestClose}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16 }}>
              <Text accessibilityRole="header" style={{ color: theme.text, fontSize: 24 }}>
                Review recognized text
              </Text>
              <Text style={{ color: theme.mutedText }}>
                Page {page + 1} of {record?.pages.length || 0}. Correct mistakes before saving. Editing does
                not call text recognition again. Temporary scan images are removed when the scanner closes.
              </Text>
              {error ? (
                <Text accessibilityRole="alert" style={{ color: theme.text }}>
                  {error}
                </Text>
              ) : null}
              {record ? (
                <TextInput
                  accessibilityLabel={`Recognized text, page ${page + 1}`}
                  multiline
                  value={record.pages[page]}
                  maxLength={1_000_000}
                  editable={!busy}
                  onChangeText={(text) =>
                    setRecord((r) =>
                      r ? { ...r, pages: r.pages.map((p, at) => (at === page ? text : p)) } : null,
                    )
                  }
                  style={{
                    minHeight: 300,
                    color: theme.text,
                    borderColor: theme.border,
                    borderWidth: 1,
                    padding: 12,
                    textAlignVertical: "top",
                    fontSize: 17,
                  }}
                />
              ) : null}
              <View style={{ flexDirection: "row", gap: 16 }}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || page === 0}
                  onPress={() => setPage((p) => p - 1)}
                  style={{ minHeight: 48, justifyContent: "center" }}
                >
                  <Text style={{ color: theme.accentText }}>Previous page</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || page >= (record?.pages.length || 1) - 1}
                  onPress={() => setPage((p) => p + 1)}
                  style={{ minHeight: 48, justifyContent: "center" }}
                >
                  <Text style={{ color: theme.accentText }}>Next page</Text>
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void save()}
                style={{ minHeight: 48, justifyContent: "center" }}
              >
                <Text style={{ color: theme.accentText }}>{busy ? "Saving…" : "Save document"}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={requestClose}
                style={{ minHeight: 48, justifyContent: "center" }}
              >
                <Text style={{ color: theme.text }}>Close review</Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </Context.Provider>
  );
}
export function useOcrReview() {
  const value = useContext(Context);
  if (!value) throw new Error("Scan review provider is unavailable.");
  return value;
}
