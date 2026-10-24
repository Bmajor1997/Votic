import { UnfinishedScanError, useOcrReview } from "./OcrReviewProvider";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Alert } from "react-native";
import { useVoticPurpose } from "../personalization/PurposeProvider";
import { useVoticTheme } from "../theme/ThemeProvider";
import { useImportSession } from "./useImportSession";
import { remove_import_temp } from "./importCache";
import { ScanSaveError, useScanDraft } from "./useScanDraft";
import { MAX_SCAN_PAGES, move_scan_page } from "./scanDraftModel";
import { recognize_scan_pages, ScanPageError } from "./scanRecognition";
import { rotate_scan_photo } from "./scanPhoto";
export function useScanner() {
  const { theme } = useVoticTheme();
  const { review, resume, ensureAvailable } = useOcrReview();
  const { defaultPlaybackRate } = useVoticPurpose();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const draft = useScanDraft();
  const session = useImportSession();
  const [selected, setSelected] = useState("");
  const [takingPage, setCameraMode] = useState(false);
  const cameraMode = takingPage || draft.draft.pages.length === 0;
  const [retakeId, setRetakeId] = useState<string>();
  const [cameraReady, setCameraReady] = useState(false);
  const [working, setWorking] = useState(false);
  const lock = useRef(false);
  const [processingPage, setProcessingPage] = useState(0);
  const [torch, setTorch] = useState(false);
  const completedPages = useRef(new Map<string, string>());
  const pages = draft.draft.pages;
  const current = cameraMode ? undefined : (pages.find((page) => page.id === selected) ?? pages.at(-1));
  const busy = working || draft.saving;
  function show_problem(error: unknown) {
    if (error instanceof UnfinishedScanError) {
      Alert.alert("Finish your saved scan first", error.message, [
        { text: "Not now", style: "cancel" },
        { text: "Resume review", onPress: resume },
      ]);
    } else {
      if (error instanceof ScanPageError) {
        setSelected(error.pageId);
        setCameraMode(false);
      }
      Alert.alert(
        error instanceof ScanSaveError ? "Could not save scan" : "Could not read scan",
        error instanceof Error ? error.message : "Please try again. Your saved pages are kept.",
      );
    }
  }
  async function run(work: () => Promise<unknown>) {
    if (lock.current || !draft.ready || !session.active()) return;
    lock.current = true;
    setWorking(true);
    try {
      await work();
    } catch (error) {
      if (session.active()) show_problem(error);
    } finally {
      lock.current = false;
      setWorking(false);
    }
  }
  function show_page(id: string) {
    setSelected(id);
    setCameraMode(false);
    setRetakeId(undefined);
  }
  async function capture() {
    if (!cameraRef.current || !cameraReady) return;
    if (!retakeId && pages.length >= MAX_SCAN_PAGES) {
      Alert.alert(
        "Scan page limit",
        `Finish this document before scanning more than ${MAX_SCAN_PAGES} pages.`,
      );
      return;
    }
    await run(async () => {
      const photo = await cameraRef.current!.takePictureAsync({ quality: 0.9, skipProcessing: false });
      if (!photo?.uri) return;
      try {
        if (!session.active()) return;
        const id = await draft.photo(photo.uri, retakeId);
        if (session.active()) {
          setCameraReady(false);
          show_page(id);
        }
      } finally {
        remove_import_temp(photo.uri);
      }
    });
  }
  function add_page(replaceId?: string) {
    setRetakeId(replaceId);
    setCameraReady(false);
    setCameraMode(true);
  }
  async function rotate() {
    if (!current) return;
    await run(async () => {
      const rotated = await rotate_scan_photo(current.uri);
      try {
        if (!session.active()) return;
        const text = current.text ?? completedPages.current.get(current.id);
        const id = await draft.photo(rotated.uri, current.id, text);
        if (session.active()) show_page(id);
      } finally {
        remove_import_temp(rotated.uri);
      }
    });
  }
  async function move(direction: -1 | 1) {
    if (!current) return;
    await run(() =>
      draft.commit(
        move_scan_page(
          draft.latest.current,
          pages.findIndex((p) => p.id === current.id),
          direction,
        ),
      ),
    );
  }
  function remove_page() {
    if (!current) return;
    Alert.alert("Remove this page?", "The remaining pages stay together in this document.", [
      { text: "Keep page", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          void run(async () => {
            const next = await draft.remove(current.id);
            if (next.pages.length) show_page(next.pages[0].id);
            else add_page();
          }),
      },
    ]);
  }
  async function finish_scan() {
    if (!pages.length) return;
    await run(async () => {
      ensureAvailable();
      const snapshot = draft.latest.current;
      await draft.commit(snapshot);
      const job = session.start();
      if (!job) return;
      try {
        const extracted = await recognize_scan_pages(
          snapshot.pages,
          job,
          completedPages.current,
          setProcessingPage,
          (id, text) =>
            draft.commit({
              ...draft.latest.current,
              pages: draft.latest.current.pages.map((p) => (p.id === id ? { ...p, text } : p)),
            }),
        );
        if (!extracted || !job.current()) return;
        const name = (snapshot.title.trim() || "Scanned document").replace(/\.txt$/i, "") + ".txt";
        const saved = await review(name, extracted, {
          playbackRate: defaultPlaybackRate,
          origin: "scan",
          importId: snapshot.id,
          onPrepared: async () => {
            await draft.clear();
            completedPages.current.clear();
            setCameraMode(true);
          },
        });
        if (saved && job.current()) router.replace("/reader");
      } finally {
        job.finish();
        setProcessingPage(0);
      }
    });
  }
  async function close() {
    await run(async () => {
      await draft.commit(draft.latest.current);
      router.back();
    });
  }
  function discard() {
    Alert.alert(
      "Discard this scan?",
      "This removes its saved photos. Your library documents are unchanged.",
      [
        { text: "Keep scan", style: "cancel" },
        {
          text: "Discard scan",
          style: "destructive",
          onPress: () => {
            void draft
              .clear()
              .then(() => {
                completedPages.current.clear();
                add_page();
              })
              .catch(show_problem);
          },
        },
      ],
    );
  }
  return {
    theme,
    permission,
    requestPermission,
    cameraRef,
    draft,
    selected,
    cameraMode,
    retakeId,
    cameraReady,
    setCameraReady,
    busy,
    processingPage,
    torch,
    setTorch,
    pages,
    current,
    show_page,
    capture,
    add_page,
    rotate,
    move,
    remove_page,
    finish_scan,
    close,
    discard,
  };
}
