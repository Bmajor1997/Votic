import { useAccountData } from "../storage/AccountDataProvider";
import { account_storage_key } from "../storage/accountStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { write_account_data } from "../storage/accountDeletion";
import {
  PropsWithChildren,
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import {
  ActivityKind,
  ActivityLog,
  AskEvent,
  add_ask_event,
  add_interval,
  empty_log,
  parse_log,
} from "./activityModel";
import { sample_activity_log } from "./sampleActivity";

export const ACTIVITY_KEY = "votic.mobile.activity.v1";
const SAVE_DELAY_MS = 2000;

type ActivityValue = {
  log: ActivityLog;
  /** Always the measured log, even while sample statistics are shown (used by the home-screen widgets). */
  measuredLog: ActivityLog;
  hydrated: boolean;
  recordTime: (documentId: string, kind: ActivityKind, start: number, end: number) => void;
  recordAsk: (event: AskEvent) => void;
  /** Development builds only: shows generated statistics without touching real measurements. */
  sampleData: boolean;
  setSampleData: (documentIds: string[] | null) => void;
};
const ActivityContext = createContext<ActivityValue | null>(null);

export function ActivityProvider({ children }: PropsWithChildren) {
  const { uid, registerFlush, registerReload } = useAccountData();
  const storageKey = account_storage_key(ACTIVITY_KEY, uid ?? "");
  const [log, setLog] = useState<ActivityLog>(() => empty_log());
  const [hydrated, setHydrated] = useState(!uid);
  const [sample, setSample] = useState<ActivityLog | null>(null);
  const latest = useRef(log);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Changes made before storage loads are applied on top of what was saved.
  const pending = useRef<((current: ActivityLog) => ActivityLog)[]>([]);
  const hydratedRef = useRef(false);

  const saving = useRef<Promise<void>>(Promise.resolve());
  const save = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current || !uid) return saving.current;
    dirty.current = false;
    const snapshot = JSON.stringify(latest.current);
    saving.current = saving.current
      .then(() => write_account_data(uid, () => AsyncStorage.setItem(storageKey, snapshot)))
      .catch(() => {
        dirty.current = true;
      });
    return saving.current;
  }, [uid, storageKey]);
  function change(update: (current: ActivityLog) => ActivityLog) {
    if (!hydratedRef.current) {
      pending.current.push(update);
      return;
    }
    latest.current = update(latest.current);
    setLog(latest.current);
    dirty.current = true;
    if (!timer.current) timer.current = setTimeout(save, SAVE_DELAY_MS);
  }

  useEffect(() => {
    let mounted = true;
    if (!uid) return;
    void AsyncStorage.getItem(storageKey)
      .catch(() => null)
      .then((raw) => {
        if (!mounted) return;
        const saved = parse_log(raw);
        let loaded = saved ?? empty_log();
        for (const update of pending.current) loaded = update(loaded);
        pending.current = [];
        latest.current = loaded;
        hydratedRef.current = true;
        // A new log (first launch of this version) is saved right away, so its start date sticks.
        dirty.current = !saved || loaded !== saved;
        setLog(loaded);
        setHydrated(true);
        save();
      });
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") save();
    });
    return () => {
      mounted = false;
      subscription.remove();
      save();
    };
  }, [uid, storageKey, save]);

  // After older activity is merged in, read it again in place; changes made meanwhile are kept.
  useEffect(
    () =>
      registerReload(async () => {
        if (!uid) return;
        hydratedRef.current = false;
        const saved = parse_log(await AsyncStorage.getItem(storageKey).catch(() => null));
        let loaded = saved ?? latest.current;
        for (const update of pending.current) loaded = update(loaded);
        pending.current = [];
        latest.current = loaded;
        hydratedRef.current = true;
        setLog(loaded);
      }),
    [registerReload, uid, storageKey],
  );
  useEffect(
    () =>
      registerFlush(async () => {
        if (!hydratedRef.current) throw new Error("Activity is still loading.");
        await save();
        if (dirty.current) throw new Error("Activity could not be saved.");
      }),
    [registerFlush, save],
  );

  return (
    <ActivityContext.Provider
      value={{
        log: sample ?? log,
        measuredLog: log,
        hydrated,
        recordTime: (documentId, kind, start, end) =>
          change((current) => add_interval(current, documentId, kind, start, end)),
        recordAsk: (event) => change((current) => add_ask_event(current, event)),
        sampleData: Boolean(sample),
        setSampleData: (documentIds) =>
          setSample(__DEV__ && documentIds ? sample_activity_log(documentIds) : null),
      }}
    >
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  const value = useContext(ActivityContext);
  if (!value) throw new Error("useActivity must be used inside ActivityProvider");
  return value;
}
